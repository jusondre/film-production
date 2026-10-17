/* Crew tab: contact list with roles, email, phone and search. Also shared crew helpers. */
const Crew = (() => {
  const { $, el, uid } = Dom;
  let query = ""; // search text, kept while switching tabs

  const initials = name => name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const nameOf = (project, id) => project.crew.find(c => c.id === id)?.name || "";

  function render(root, project) {
    project.crew ||= []; project.tasks ||= [];
    const count = project.crew.length;

    const title = el("div", "crew-title");
    title.append(el("h3", null, "Crew"), el("span", "crew-count", count === 1 ? "1 person" : `${count} people`));
    const search = el("input", "search");
    search.type = "search"; search.value = query; search.ariaLabel = "Search crew";
    search.placeholder = "Search name, role, email or phone";
    const add = el("button", "btn btn-primary", "Add crew member");
    add.onclick = () => openDialog(root, project);
    const head = el("div", "crew-head");
    head.append(title, el("span", "spacer"), search, add);

    const list = el("div", "crew-list");
    search.oninput = () => { query = search.value; drawList(list, root, project); };
    drawList(list, root, project);
    root.replaceChildren(head, list);
  }

  function drawList(list, root, project) {
    const q = query.trim().toLowerCase();
    if (!project.crew.length) {
      const empty = el("div", "empty");
      empty.append(el("h3", null, "Who’s on the team?"), el("p", null, "Add your crew with their roles and contact details. You can assign them tasks later."));
      return list.replaceChildren(empty);
    }
    const people = project.crew.filter(c => [c.name, c.role, c.email, c.phone].join(" ").toLowerCase().includes(q));
    if (!people.length) return list.replaceChildren(el("p", "hint", `No one matches “${query.trim()}”.`));

    const labels = el("div", "crew-row crew-labels");
    ["Name", "Email", "Phone", "Tasks"].forEach(l => labels.append(el("span", null, l)));
    list.replaceChildren(labels, ...people.map(c => row(root, project, c)));
  }

  function link(href, text) {
    if (!text) return el("span", "crew-none", "–");
    const a = el("a", null, text); a.href = href;
    a.onclick = e => e.stopPropagation(); // don't open the editor when contacting someone
    return a;
  }

  function row(root, project, c) {
    const r = el("div", "crew-row"); r.tabIndex = 0; r.role = "button";
    const person = el("span", "crew-person"), info = el("span", "crew-info");
    info.append(el("strong", null, c.name), el("small", null, c.role || "No role yet"));
    person.append(el("span", "avatar avatar-lg", initials(c.name)), info);
    const open = project.tasks.filter(t => t.assignee === c.id && t.status !== "done").length;
    r.append(person, link(`mailto:${c.email}`, c.email), link(`tel:${c.phone}`, c.phone),
      el("span", "crew-tasks", open ? `${open} open` : "None"));
    r.onclick = () => openDialog(root, project, c);
    r.onkeydown = e => { if (e.key === "Enter" && e.target === r) openDialog(root, project, c); };
    return r;
  }

  function openDialog(root, project, member = null) {
    const dialog = $("crew-dialog"), form = $("crew-form");
    $("crew-dialog-title").textContent = member ? "Edit crew member" : "Add crew member";
    $("crew-delete").hidden = !member;
    for (const key of ["name", "role", "email", "phone"]) form.elements[key].value = member?.[key] || "";

    form.onsubmit = () => {
      const fields = Object.fromEntries(["name", "role", "email", "phone"].map(k => [k, form.elements[k].value.trim()]));
      if (member) Object.assign(member, fields);
      else project.crew.push({ id: uid(), ...fields });
      Projects.persist(true); render(root, project);
    };
    $("crew-delete").onclick = () => {
      project.crew = project.crew.filter(c => c !== member);
      project.tasks.forEach(t => { if (t.assignee === member.id) t.assignee = ""; });
      Projects.persist(true); dialog.close(); render(root, project);
    };
    dialog.returnValue = "";
    dialog.showModal();
  }

  return { render, initials, nameOf };
})();
