/* Calendar tab: day, week, month and three-month views, plus add/edit/delete events. */
const Calendar = (() => {
  const TYPES = {
    shoot: "Shoot day", meeting: "Meeting", scout: "Location scout",
    casting: "Casting", deadline: "Deadline",
  };
  const VIEWS = [["day", "Day"], ["week", "Week"], ["month", "Month"], ["quarter", "3 months"]];
  const UNIT = { day: "day", week: "week", month: "month", quarter: "month" };
  const MONTH = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
  const WEEKDAY = new Intl.DateTimeFormat("en", { weekday: "short" });
  const NARROW = new Intl.DateTimeFormat("en", { weekday: "narrow" });
  const LONG = new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const { el } = Dom;
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
  const mondayOf = d => addDays(d, -((d.getDay() + 6) % 7)); // weeks start Monday
  const count = n => n === 1 ? "1 event" : `${n} events`;
  const byTime = (a, b) => (a.time || "").localeCompare(b.time || "");

  function loadMode() {
    try {
      const saved = localStorage.getItem("calendar-view");
      if (VIEWS.some(v => v[0] === saved)) return saved;
    } catch { /* storage unavailable */ }
    return matchMedia("(max-width: 760px)").matches ? "week" : "month";
  }

  let mode = loadMode();
  let cursor = today();   // the day being looked at; month views only use its month
  let editingId = null;

  function setMode(next) {
    const t = today();
    // Moving from a month view of this month to a day or week view lands on today.
    if ((next === "day" || next === "week") && cursor.getFullYear() === t.getFullYear() && cursor.getMonth() === t.getMonth()) cursor = t;
    mode = next;
    try { localStorage.setItem("calendar-view", next); } catch { /* storage unavailable */ }
  }

  function shift(n) {
    if (mode === "day") return addDays(cursor, n);
    if (mode === "week") return addDays(cursor, 7 * n);
    return addMonths(cursor, n);
  }

  function range(a, b, options) {
    const f = new Intl.DateTimeFormat("en", options);
    return typeof f.formatRange === "function" ? f.formatRange(a, b) : `${f.format(a)} – ${f.format(b)}`;
  }

  function title() {
    if (mode === "day") return LONG.format(cursor);
    if (mode === "week") { const s = mondayOf(cursor); return range(s, addDays(s, 6), { month: "short", day: "numeric", year: "numeric" }); }
    if (mode === "month") return MONTH.format(cursor);
    return range(addMonths(cursor, 0), addMonths(cursor, 2), { month: "short", year: "numeric" });
  }

  /* Every event, grouped by date and sorted by time, built once per draw. */
  function groupEvents(project) {
    const map = new Map();
    for (const e of project.events) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    }
    for (const list of map.values()) list.sort(byTime);
    return map;
  }

  /* A row of small colored dots, one per event (used where there is no room for titles). */
  function dots(events) {
    const box = el("span", "cal-dots");
    events.slice(0, 4).forEach(ev => {
      const dot = el("i"); dot.style.setProperty("--ev-color", `var(--ev-${ev.type})`);
      box.append(dot);
    });
    return box;
  }

  /* Swipe left or right on a phone to move to the next or previous period. */
  function swipe(node, step) {
    let x0, y0;
    node.addEventListener("touchstart", e => {
      if (e.touches.length !== 1) { x0 = undefined; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    node.addEventListener("touchend", e => {
      if (x0 === undefined) return;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = undefined;
      if (Math.abs(dx) > 70 && Math.abs(dy) < 40) step(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function render(root, project) {
    project.events ||= [];
    const redraw = () => render(root, project);
    const nav = {
      redraw,
      step: n => { cursor = shift(n); redraw(); },
      jump: (next, date) => { cursor = date; setMode(next); redraw(); },
    };
    const views = { day: dayView, week: weekView, month: monthView, quarter: quarterView };
    const body = views[mode](root, project, nav);
    swipe(body, nav.step);
    const wrap = el("div", "cal");
    wrap.append(toolbar(root, project, nav), legend(), body);
    root.replaceChildren(wrap);
  }

  function toolbar(root, project, nav) {
    const bar = el("div", "cal-toolbar");
    const prev = el("button", "btn btn-ghost cal-prev", "‹"); prev.type = "button";
    prev.ariaLabel = `Previous ${UNIT[mode]}`; prev.onclick = () => nav.step(-1);
    const next = el("button", "btn btn-ghost cal-next", "›"); next.type = "button";
    next.ariaLabel = `Next ${UNIT[mode]}`; next.onclick = () => nav.step(1);
    const now = el("button", "btn btn-ghost cal-today", "Today"); now.type = "button";
    now.onclick = () => { cursor = today(); nav.redraw(); };

    const views = el("div", "subtabs cal-views"); views.role = "group"; views.ariaLabel = "Calendar view";
    for (const [id, label] of VIEWS) {
      const b = el("button", "subtab", label); b.type = "button";
      b.setAttribute("aria-pressed", String(id === mode));
      b.onclick = () => { setMode(id); nav.redraw(); };
      views.append(b);
    }

    const add = el("button", "btn btn-primary cal-add", "Add event"); add.type = "button";
    add.onclick = () => openEvent(root, project, iso(mode === "day" ? cursor : new Date()));

    bar.append(prev, next, el("h3", null, title()), now, views, add);
    return bar;
  }

  function legend() {
    const box = el("div", "cal-legend");
    for (const [key, label] of Object.entries(TYPES)) {
      const item = el("span", null, label);
      const dot = el("i"); dot.style.background = `var(--ev-${key})`;
      item.prepend(dot); box.append(item);
    }
    return box;
  }

  /* ---------- day ---------- */
  function dayView(root, project, nav) {
    const byDate = groupEvents(project);
    const wrap = el("div", "cal-dayview");

    // The week around the chosen day, to jump between days quickly.
    const strip = el("div", "cal-strip");
    const start = mondayOf(cursor);
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i), key = iso(d), events = byDate.get(key) || [];
      const b = el("button", "strip-day"); b.type = "button";
      b.setAttribute("aria-pressed", String(key === iso(cursor)));
      if (key === iso(cursor)) b.classList.add("is-selected");
      if (key === iso(today())) b.classList.add("is-today");
      b.append(el("span", null, WEEKDAY.format(d)), el("strong", null, String(d.getDate())), dots(events));
      b.ariaLabel = `${LONG.format(d)}, ${count(events.length)}`;
      b.onclick = () => { cursor = d; nav.redraw(); };
      strip.append(b);
    }

    const events = byDate.get(iso(cursor)) || [];
    const editable = Projects.canEdit();
    const stack = el("div", "day-stack");
    if (events.length) events.forEach(ev => stack.append(dayCard(root, project, null, ev, editable)));
    else stack.append(el("p", "hint", "Nothing is planned for this day."));
    wrap.append(strip, stack);
    return wrap;
  }

  /* ---------- week ---------- */
  function weekView(root, project) {
    const byDate = groupEvents(project);
    const wrap = el("div", "cal-week");
    const start = mondayOf(cursor);
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i), key = iso(d), events = byDate.get(key) || [];
      const col = el("section", "wk-day");
      if (key === iso(today())) col.classList.add("is-today");

      const head = el("button", "wk-head"); head.type = "button";
      head.append(el("span", "wk-dow", WEEKDAY.format(d)), el("span", "cal-num", String(d.getDate())));
      head.ariaLabel = `${LONG.format(d)}, ${count(events.length)}`;
      head.onclick = () => openDay(root, project, key);

      const list = el("div", "wk-events");
      events.forEach(ev => {
        const chip = el("button", "wk-event"); chip.type = "button";
        chip.style.setProperty("--ev-color", `var(--ev-${ev.type})`);
        chip.append(el("div", "wk-meta", [ev.time || "All day", TYPES[ev.type] || ev.type].join(" · ")), el("div", "wk-title", ev.title));
        chip.onclick = () => openDay(root, project, key);
        list.append(chip);
      });
      if (!events.length) list.append(el("span", "wk-empty", "Nothing planned"));
      col.append(head, list);
      wrap.append(col);
    }
    return wrap;
  }

  /* ---------- month ---------- */
  function monthView(root, project) {
    const byDate = groupEvents(project);
    const g = el("div", "cal-grid");
    const start = mondayOf(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    for (let i = 0; i < 7; i++) g.append(el("div", "cal-dow", WEEKDAY.format(addDays(start, i))));
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i), key = iso(d), events = byDate.get(key) || [];
      const cell = el("div", "cal-day");
      cell.role = "button"; cell.tabIndex = 0;
      if (d.getMonth() !== cursor.getMonth()) cell.classList.add("is-other");
      if (key === iso(today())) cell.classList.add("is-today");
      cell.append(el("span", "cal-num", String(d.getDate())));

      events.forEach(ev => {
        const chip = el("div", "cal-event");
        chip.append(el("i"), ...(ev.time ? [el("b", null, ev.time)] : []), el("span", null, ev.title));
        chip.style.setProperty("--ev-color", `var(--ev-${ev.type})`);
        cell.append(chip);
      });
      cell.append(dots(events));   // phones show dots; the full list is one tap away
      cell.ariaLabel = `${LONG.format(d)}, ${count(events.length)}`;
      cell.onclick = () => openDay(root, project, key);   // everyone can open a day and read it in full
      cell.onkeydown = e => { if (e.key === "Enter" && e.target === cell) cell.click(); };
      g.append(cell);
    }
    return g;
  }

  /* ---------- three months ---------- */
  function quarterView(root, project, nav) {
    const byDate = groupEvents(project);
    const wrap = el("div", "cal-quarter");
    for (let m = 0; m < 3; m++) wrap.append(miniMonth(root, project, addMonths(cursor, m), byDate, nav));
    return wrap;
  }

  function miniMonth(root, project, first, byDate, nav) {
    const box = el("section", "mini");
    const name = el("button", "mini-title", MONTH.format(first)); name.type = "button";
    name.ariaLabel = `Open ${MONTH.format(first)} in month view`;
    name.onclick = () => nav.jump("month", first);

    const grid = el("div", "mini-grid");
    const monday = mondayOf(first);
    for (let i = 0; i < 7; i++) grid.append(el("span", "mini-dow", NARROW.format(addDays(monday, i))));
    for (let i = 0; i < (first.getDay() + 6) % 7; i++) grid.append(el("span"));
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    for (let n = 1; n <= days; n++) {
      const d = new Date(first.getFullYear(), first.getMonth(), n), key = iso(d), events = byDate.get(key) || [];
      const cell = el("button", "mini-day"); cell.type = "button";
      if (key === iso(today())) cell.classList.add("is-today");
      cell.append(el("span", "cal-num", String(n)), dots(events));
      cell.ariaLabel = `${LONG.format(d)}, ${count(events.length)}`;
      cell.onclick = () => openDay(root, project, key);
      grid.append(cell);
    }
    box.append(name, grid);
    return box;
  }

  /* The day popup: every event of one day, in full (nothing cut off). Editors can add and open events from here. */
  function openDay(root, project, date) {
    const dialog = document.getElementById("day-dialog");
    const editable = Projects.canEdit();
    const events = project.events.filter(e => e.date === date).sort(byTime);

    document.getElementById("day-title").textContent = LONG.format(new Date(`${date}T00:00`));
    document.getElementById("day-count").textContent =
      events.length === 0 ? "Nothing planned" : events.length === 1 ? "1 event" : `${events.length} events`;

    const list = document.getElementById("day-list");
    list.replaceChildren(...(events.length
      ? events.map(ev => dayCard(root, project, dialog, ev, editable))
      : [el("p", "hint", "Nothing is planned for this day.")]));
    list.scrollTop = 0;

    document.getElementById("day-add").onclick = () => { dialog.close(); openEvent(root, project, date, null, true); };
    // Clicking the dimmed area outside the popup closes it.
    dialog.onclick = e => {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    };
    dialog.returnValue = "";
    if (!dialog.open) dialog.showModal();
  }

  function dayCard(root, project, dialog, ev, editable) {
    const card = el("article", "day-event");
    card.style.setProperty("--ev-color", `var(--ev-${ev.type})`);
    const meta = el("div", "day-meta");
    meta.append(el("i"), el("b", null, ev.time || "All day"), el("span", null, TYPES[ev.type] || ev.type));
    card.append(meta, el("h4", null, ev.title));
    if (ev.notes && ev.notes.trim()) card.append(el("p", "day-notes", ev.notes));
    if (editable) {
      const edit = () => {
        if (dialog) { dialog.close(); openEvent(root, project, ev.date, ev, true); }   // from the popup: come back to it afterwards
        else openEvent(root, project, ev.date, ev);                                    // from the day view itself
      };
      card.classList.add("is-editable"); card.tabIndex = 0; card.role = "button";
      card.onclick = edit;
      card.onkeydown = e => { if (e.key === "Enter") edit(); };
    }
    return card;
  }

  /* 24-hour entry: keeps digits only and inserts the colon (1430 becomes 14:30). */
  function formatTime(input) {
    const digits = input.value.replace(/\D/g, "").slice(0, 4);
    input.value = digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
  }

  function openEvent(root, project, date, ev = null, back = false) {
    const dialog = document.getElementById("event-dialog");
    const form = document.getElementById("event-form");
    const del = document.getElementById("event-delete");
    editingId = ev ? ev.id : null;
    let backDate = ev?.date || date;
    dialog.onclose = back ? () => openDay(root, project, backDate) : null;   // return to the day popup when this closes
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
      backDate = fields.date || backDate;
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
