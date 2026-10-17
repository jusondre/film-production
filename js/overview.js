/* Overview tab: project details, a short summary, and project settings (rename, delete). */
const Overview = (() => {
  const { $, el } = Dom;
  const FORMATS = ["Short film", "Feature film", "Series", "Documentary", "Commercial", "Music video", "Other"];
  const STATUSES = ["Development", "Pre-production", "Production", "Post-production", "Delivered"];
  const DAY = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const niceDate = value => DAY.format(new Date(`${value}T00:00`));

  function stat(value, label) {
    const box = el("div", "ov-stat");
    box.append(el("strong", null, value), el("span", null, label));
    return box;
  }

  function summary(project) {
    const crew = (project.crew || []).length;
    const open = (project.tasks || []).filter(t => t.status !== "done").length;
    const today = iso(new Date());
    const next = (project.events || []).filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
    const grid = el("div", "ov-grid");
    grid.append(
      stat(String(crew), crew === 1 ? "crew member" : "crew members"),
      stat(String(open), open === 1 ? "open task" : "open tasks"),
      stat(next ? niceDate(next.date) : "None", next ? `next: ${next.title}` : "nothing scheduled"));
    return grid;
  }

  /* Wraps a control in a label. Changes are saved as you type. */
  function field(label, control) {
    const wrap = el("label", "ov-field");
    wrap.append(el("span", null, label), control);
    return wrap;
  }

  function bind(control, details, key, editable) {
    control.classList.add("ov-input");
    control.value = details[key] || "";
    if (control.tagName === "SELECT") control.disabled = !editable; else control.readOnly = !editable;
    control.oninput = control.onchange = () => { details[key] = control.value; Projects.persist(); };
    return control;
  }

  function select(options, details, key, editable) {
    const control = el("select");
    options.forEach(o => control.append(new Option(o, o)));
    return bind(control, details, key, editable);
  }

  function input(type, details, key, editable, placeholder = "") {
    const control = el("input"); control.type = type; control.placeholder = placeholder;
    return bind(control, details, key, editable);
  }

  function area(rows, details, key, editable, placeholder = "") {
    const control = el("textarea"); control.rows = rows; control.placeholder = placeholder;
    return bind(control, details, key, editable);
  }

  function render(root, project) {
    const details = project.details ||= {};
    const editable = Projects.canEdit();

    const title = el("input", "title-input");
    title.value = project.title; title.ariaLabel = "Project title"; title.readOnly = !editable;
    title.onchange = async () => {
      try { await Projects.rename(title.value); } catch (error) { alert(error.message); }
      title.value = project.title;
      Projects.renderSelect($("project-select"));
    };
    const head = el("div", "vis-head");
    head.append(title);

    const form = el("div", "ov-form");
    const row1 = el("div", "ov-row");
    row1.append(
      field("Status", select(STATUSES, details, "status", editable)),
      field("Format", select(FORMATS, details, "format", editable)),
      field("Genre", input("text", details, "genre", editable, "e.g. Psychological thriller")));
    const row2 = el("div", "ov-row");
    row2.append(
      field("Shoot starts", input("date", details, "shootStart", editable)),
      field("Shoot ends", input("date", details, "shootEnd", editable)));
    form.append(row1,
      field("Logline", area(2, details, "logline", editable, "One or two sentences on what the film is about")),
      row2,
      field("Notes", area(7, details, "notes", editable, "Anything the team should know: budget status, contacts, decisions")));

    const parts = [head, summary(project), form];

    if (Auth.isAdmin()) {
      const danger = el("div", "ov-danger");
      const del = el("button", "btn btn-danger", "Delete project");
      del.onclick = async () => {
        if (!confirm(`Delete “${project.title}” with its crew, calendar, tasks, boards and files? This can’t be undone.`)) return;
        del.disabled = true;
        try {
          await Files.removeAll(project.id);
          await Projects.remove();
          Projects.refresh();
        } catch (error) { del.disabled = false; alert(error.message); }
      };
      danger.append(del, el("span", "hint", "Only admins can delete a project."));
      parts.push(danger);
    }
    root.replaceChildren(...parts);
  }

  return { render, FORMATS, STATUSES };
})();
