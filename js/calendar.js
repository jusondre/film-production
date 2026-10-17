/* Calendar tab: month grid plus add/edit/delete events. */
const Calendar = (() => {
  const TYPES = {
    shoot: "Shoot day", meeting: "Meeting", scout: "Location scout",
    casting: "Casting", deadline: "Deadline",
  };
  const MONTH = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
  const WEEKDAY = new Intl.DateTimeFormat("en", { weekday: "short" });

  const now = new Date();
  let cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  let editingId = null;

  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const { el } = Dom;

  const byTime = (a, b) => (a.time || "").localeCompare(b.time || "");

  function render(root, project) {
    project.events ||= [];
    root.replaceChildren(toolbar(root, project), grid(root, project));
  }

  function toolbar(root, project) {
    const bar = el("div", "cal-toolbar");
    const shift = n => () => { cursor = new Date(cursor.getFullYear(), cursor.getMonth() + n, 1); render(root, project); };
    const prev = el("button", "btn btn-ghost", "‹"); prev.ariaLabel = "Previous month"; prev.onclick = shift(-1);
    const next = el("button", "btn btn-ghost", "›"); next.ariaLabel = "Next month"; next.onclick = shift(1);
    const today = el("button", "btn btn-ghost", "Today");
    today.onclick = () => { const t = new Date(); cursor = new Date(t.getFullYear(), t.getMonth(), 1); render(root, project); };
    const add = el("button", "btn btn-primary", "Add event");
    add.onclick = () => openEvent(root, project, iso(new Date()));

    const legend = el("div", "cal-legend");
    for (const [key, label] of Object.entries(TYPES)) {
      const item = el("span", null, label);
      const dot = el("i"); dot.style.background = `var(--ev-${key})`;
      item.prepend(dot); legend.append(item);
    }
    bar.append(prev, next, el("h3", null, MONTH.format(cursor)), today, add, legend);
    return bar;
  }

  function grid(root, project) {
    const g = el("div", "cal-grid");
    const start = new Date(cursor);
    start.setDate(1 - ((cursor.getDay() + 6) % 7)); // weeks start Monday
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      g.append(el("div", "cal-dow", WEEKDAY.format(d)));
    }
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = iso(d);
      const cell = el("div", "cal-day");
      cell.role = "button"; cell.tabIndex = 0;
      if (d.getMonth() !== cursor.getMonth()) cell.classList.add("is-other");
      if (key === iso(new Date())) cell.classList.add("is-today");
      cell.append(el("span", "cal-num", String(d.getDate())));

      project.events.filter(e => e.date === key).sort(byTime).forEach(ev => {
        const chip = el("button", "cal-event");
        chip.append(el("i"), ...(ev.time ? [el("b", null, ev.time)] : []), el("span", null, ev.title));
        chip.style.setProperty("--ev-color", `var(--ev-${ev.type})`);
        chip.onclick = e => { e.stopPropagation(); openEvent(root, project, key, ev); };
        cell.append(chip);
      });
      cell.onclick = () => { if (Projects.canEdit()) openEvent(root, project, key); };
      cell.onkeydown = e => { if (e.key === "Enter" && e.target === cell) cell.click(); };
      g.append(cell);
    }
    return g;
  }

  /* 24-hour entry: keeps digits only and inserts the colon (1430 becomes 14:30). */
  function formatTime(input) {
    const digits = input.value.replace(/\D/g, "").slice(0, 4);
    input.value = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
  }

  function openEvent(root, project, date, ev = null) {
    const dialog = document.getElementById("event-dialog");
    const form = document.getElementById("event-form");
    const del = document.getElementById("event-delete");
    editingId = ev ? ev.id : null;
    document.getElementById("event-dialog-title").textContent = ev ? "Edit event" : "Add event";
    del.hidden = !ev;
    form.elements.type.replaceChildren(...Object.entries(TYPES).map(([v, l]) => new Option(l, v)));
    form.elements.title.value = ev?.title || "";
    form.elements.date.value = ev?.date || date;
    form.elements.time.value = ev?.time || "";
    form.elements.time.oninput = e => formatTime(e.target);
    form.elements.type.value = ev?.type || "shoot";
    form.elements.notes.value = ev?.notes || "";

    form.onsubmit = e => {
      if (e.submitter?.value === "cancel") return; // Cancel must not save
      const fields = {
        title: form.elements.title.value.trim(), date: form.elements.date.value, time: form.elements.time.value,
        type: form.elements.type.value, notes: form.elements.notes.value,
      };
      if (editingId) Object.assign(project.events.find(e => e.id === editingId), fields);
      else project.events.push({ id: crypto.randomUUID(), ...fields });
      Projects.persist(true); render(root, project);
    };
    del.onclick = () => {
      project.events = project.events.filter(e => e.id !== editingId);
      Projects.persist(true); dialog.close(); render(root, project);
    };
    dialog.returnValue = "";
    dialog.showModal();
  }
  return { render };
})();
