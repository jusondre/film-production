/* Tasks tab: drag-and-drop board plus a detail panel with description and checklists. */
const Tasks = (() => {
  const STATUSES = [
    { id: "todo", label: "To do", color: "var(--ev-meeting)" },
    { id: "doing", label: "In progress", color: "var(--ev-deadline)" },
    { id: "done", label: "Done", color: "var(--ev-scout)" },
  ];
  let draft = null;      // working copy of the task open in the panel
  let editingId = null;  // null while creating a new task

  const { $, el, uid } = Dom;

  /* Older saved tasks had one flat checklist; fold it into the new checklist groups. */
  function ensure(project) {
    project.tasks ||= []; project.crew ||= [];
    project.tasks.forEach(t => {
      t.lists ||= t.checklist?.length ? [{ id: uid(), title: "Checklist", items: t.checklist }] : [];
      delete t.checklist;
      t.description ||= "";
    });
  }

  const steps = task => task.lists.flatMap(l => l.items);
  const share = items => items.length ? Math.round(items.filter(i => i.done).length / items.length * 100) : 0;
  function percent(task) {
    if (task.status === "done") return 100;
    const items = steps(task);
    if (items.length) return share(items);
    return task.status === "doing" ? 50 : 0;
  }
  const overall = tasks => tasks.length ? Math.round(tasks.reduce((s, t) => s + percent(t), 0) / tasks.length) : 0;
  function bar(pct, color) {
    const track = el("div", "progress"), fill = el("i");
    fill.style.width = pct + "%";
    if (color) fill.style.setProperty("--bar", color);
    track.append(fill);
    return track;
  }

  /* ---------- board ---------- */
  function render(root, project) {
    ensure(project);
    const pct = overall(project.tasks);
    const done = project.tasks.filter(t => t.status === "done").length;
    const summary = el("div", "task-summary");
    summary.append(el("strong", null, `${pct}% complete`), el("span", null, `${done} of ${project.tasks.length} tasks done`), bar(pct));
    root.replaceChildren(summary, board(root, project));
  }

  function board(root, project) {
    const wrap = el("div", "board");
    const today = new Date().toISOString().slice(0, 10);
    for (const status of STATUSES) {
      const tasks = project.tasks.filter(t => t.status === status.id);
      const col = el("section", "column");
      const head = el("h4"), dot = el("i", "dot");
      dot.style.background = status.color;
      head.append(dot, status.label, el("span", null, String(tasks.length)));
      col.append(head, ...tasks.map(t => card(root, project, t, status, today)));

      const add = el("button", "add-task", "+ Add task");
      add.onclick = () => openTask(root, project, null, status.id);
      col.append(add);

      // Drop target: dropping a card here changes its status.
      col.ondragover = e => { e.preventDefault(); col.classList.add("is-over"); };
      col.ondragleave = e => { if (!col.contains(e.relatedTarget)) col.classList.remove("is-over"); };
      col.ondrop = e => {
        e.preventDefault();
        if (!Projects.canEdit()) return;
        const task = project.tasks.find(t => t.id === e.dataTransfer.getData("text/plain"));
        if (task) {
          project.tasks = project.tasks.filter(t => t !== task).concat(Object.assign(task, { status: status.id }));
          Projects.persist(true);
        }
        render(root, project);
      };
      wrap.append(col);
    }
    return wrap;
  }

  function card(root, project, task, status, today) {
    const c = el("div", "task-card");
    c.draggable = Projects.canEdit(); c.tabIndex = 0; c.role = "button";
    c.ondragstart = e => { e.dataTransfer.setData("text/plain", task.id); e.dataTransfer.effectAllowed = "move"; c.classList.add("is-dragging"); };
    c.ondragend = () => c.classList.remove("is-dragging");
    c.onclick = () => openTask(root, project, task);
    c.onkeydown = e => { if (e.key === "Enter") openTask(root, project, task); };

    const items = steps(task), pct = percent(task);
    c.append(el("div", "task-title", task.title));
    const row = el("div", "task-row");
    row.append(el("span", null, items.length ? `${items.filter(i => i.done).length}/${items.length} steps` : "No steps"), el("span", null, pct + "%"));
    c.append(row, bar(pct, status.color));

    const who = Crew.nameOf(project, task.assignee);
    if (task.due || who) {
      const foot = el("div", "task-foot");
      const due = el("span", "due", task.due ? `Due ${task.due}` : "");
      if (task.due && task.due < today && task.status !== "done") due.classList.add("is-overdue");
      foot.append(due);
      if (who) { const a = el("span", "avatar", Crew.initials(who)); a.title = who; foot.append(a); }
      c.append(foot);
    }
    return c;
  }

  /* ---------- detail panel ---------- */
  function openTask(root, project, task = null, status = "todo") {
    const dialog = $("task-dialog"), form = $("task-form");
    editingId = task ? task.id : null;
    draft = task ? structuredClone(task)
                 : { title: "", assignee: "", due: "", status, description: "", lists: [] };
    $("task-delete").hidden = !task;

    const assignee = form.elements.assignee;
    if (project.crew.length) {
      assignee.disabled = false;
      assignee.replaceChildren(new Option("Unassigned", ""),
        ...project.crew.map(c => new Option(c.role ? `${c.name} (${c.role})` : c.name, c.id)));
    } else {
      assignee.disabled = true;
      assignee.replaceChildren(new Option("Add crew in the Crew tab first", ""));
    }
    form.elements.status.replaceChildren(...STATUSES.map(s => new Option(s.label, s.id)));
    form.elements.title.value = draft.title;
    form.elements.assignee.value = draft.assignee;
    form.elements.status.value = draft.status;
    form.elements.due.value = draft.due;
    form.elements.description.value = draft.description;
    $("cl-new-group").value = "";
    renderChecklists();

    const addGroup = () => {
      const title = $("cl-new-group").value.trim();
      if (!title) return;
      const group = { id: uid(), title, items: [] };
      draft.lists.push(group);
      $("cl-new-group").value = ""; renderChecklists(group.id);
    };
    $("cl-add-group").onclick = addGroup;
    $("cl-new-group").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); addGroup(); } };

    form.onsubmit = e => {
      if (e.submitter?.value === "cancel") return; // Cancel must not save
      Object.assign(draft, {
        title: form.elements.title.value.trim(), assignee: form.elements.assignee.value,
        status: form.elements.status.value, due: form.elements.due.value,
        description: form.elements.description.value,
      });
      if (editingId) project.tasks[project.tasks.findIndex(t => t.id === editingId)] = draft;
      else project.tasks.push({ id: uid(), ...draft });
      Projects.persist(true); render(root, project);
    };
    $("task-delete").onclick = () => {
      project.tasks = project.tasks.filter(t => t.id !== editingId);
      Projects.persist(true); dialog.close(); render(root, project);
    };
    dialog.returnValue = "";
    dialog.showModal();
  }

  function renderChecklists(focusId) {
    const all = steps(draft);
    const pct = share(all);
    $("cl-summary").hidden = !all.length;
    $("cl-pct").textContent = `${pct}% complete`;
    $("cl-count").textContent = `${all.filter(i => i.done).length} of ${all.length} steps`;
    $("cl-bar").replaceChildren(bar(pct, "var(--ev-scout)"));
    $("cl-groups").replaceChildren(...draft.lists.map(g => group(g, focusId)));
  }

  function group(g, focusId) {
    const d = el("details", "cl-group");
    d.open = g.open !== false;
    d.ontoggle = () => { g.open = d.open; };

    const head = el("summary");
    const remove = el("button", "icon-btn", "×"); remove.type = "button"; remove.ariaLabel = `Remove ${g.title}`;
    remove.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      draft.lists = draft.lists.filter(x => x !== g); renderChecklists();
    };
    head.append(el("span", "cl-title", g.title), el("span", "cl-n", `${g.items.filter(i => i.done).length}/${g.items.length}`), remove);

    const list = el("ul", "checklist");
    g.items.forEach(item => {
      const li = el("li"); li.classList.toggle("is-done", item.done);
      const box = el("input"); box.type = "checkbox"; box.checked = item.done;
      box.onchange = () => { item.done = box.checked; renderChecklists(); };
      const rm = el("button", "icon-btn", "×"); rm.type = "button"; rm.ariaLabel = "Remove step";
      rm.onclick = () => { g.items = g.items.filter(i => i !== item); renderChecklists(); };
      li.append(box, el("span", null, item.text), rm);
      list.append(li);
    });

    const add = el("input", "cl-add"); add.placeholder = "Add a step";
    add.onkeydown = e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const text = add.value.trim();
      if (!text) return;
      g.items.push({ id: uid(), text, done: false }); renderChecklists(g.id);
    };
    if (g.id === focusId) setTimeout(() => add.focus());
    d.append(head, list, add);
    return d;
  }

  return { render };
})();
