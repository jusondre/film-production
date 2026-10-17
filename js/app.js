/* App: wires sign-in, projects, tabs, and views together. */
const App = (() => {
  const { $ } = Dom;

  // Add a new production stage here.
  const BASE_TABS = [
    { id: "overview", label: "Overview", render: Overview.render },
    { id: "crew", label: "Crew", render: Crew.render },
    { id: "calendar", label: "Calendar", render: Calendar.render },
    { id: "tasks", label: "Tasks", render: Tasks.render },
    { id: "visualize", label: "Visualize", render: Visualize.render },
    { id: "files", label: "Files", render: Files.render },
  ];
  const tabs = () => BASE_TABS;
  let activeTab = "overview";
  let adminOpen = false; // the Admin screen replaces the project tabs while it is open

  function renderTabs() {
    $("tabs").replaceChildren(...tabs().map(t => {
      const b = document.createElement("button");
      b.className = "tab"; b.textContent = t.label; b.role = "tab";
      b.setAttribute("aria-selected", t.id === activeTab);
      b.onclick = () => { activeTab = t.id; render(); };
      return b;
    }));
  }

  function renderEmpty(view, title, body, action) {
    const box = document.createElement("div");
    box.className = "empty";
    const h = document.createElement("h3"); h.textContent = title;
    const p = document.createElement("p"); p.textContent = body;
    box.append(h, p);
    if (action) {
      const b = document.createElement("button");
      b.className = "btn btn-primary"; b.textContent = action.label; b.onclick = action.run;
      box.append(b);
    }
    view.replaceChildren(box);
  }

  function render() {
    const project = Projects.active();
    Projects.renderSelect($("project-select"));
    document.body.classList.toggle("is-viewer", Boolean(project) && !Projects.canEdit());
    $("role-note").textContent = project && !Projects.canEdit() ? "View only" : "";
    $("admin-open").hidden = !Auth.isAdmin();
    $("admin-open").textContent = adminOpen ? "Back to project" : "Admin";
    const view = $("view");
    if (adminOpen && Auth.isAdmin()) { $("tabs").hidden = true; return Admin.render(view); }
    $("tabs").hidden = !project;
    renderTabs();
    const tab = tabs().find(t => t.id === activeTab) || tabs()[0];

    if (!project) {
      return Auth.isAdmin()
        ? renderEmpty(view, "Start your first film", "Create a project to keep its details, crew, shoot days, tasks, boards and files in one place.",
            { label: "New project", run: openProjectDialog })
        : renderEmpty(view, "No projects yet", "You haven’t been added to a project yet. Ask the admin to add you.");
    }
    tab.render(view, project);
  }

  function openProjectDialog() {
    $("project-form").reset();
    $("project-dialog").returnValue = "";
    $("project-dialog").showModal();
  }

  /* Runs once the signed-in person has been approved. */
  async function enter() {
    const me = Auth.profile();
    $("user-name").textContent = me.full_name || me.email;
    $("new-project").hidden = !Auth.isAdmin();
    Projects.onStatus(text => { $("save-status").textContent = text; });
    try {
      await Projects.load();
    } catch (error) {
      return renderEmpty($("view"), "Couldn’t load projects", `${error.message}. If this is a new setup, run supabase/step2_projects.sql.`);
    }
    Projects.startSync(render);
    render();
  }

  function init() {
    document.addEventListener("click", e => {
      const cancel = e.target.closest("[data-cancel]");
      if (cancel) cancel.closest("dialog").close("cancel");
    });
    Theme.init(Projects.theme(), Projects.setTheme);
    $("new-project").onclick = openProjectDialog;
    $("project-select").onchange = e => { adminOpen = false; Projects.setActive(e.target.value); render(); };
    $("admin-open").onclick = () => { adminOpen = !adminOpen; render(); };
    const newProject = $("project-form").elements;
    Overview.FORMATS.forEach(v => newProject.format.append(new Option(v, v)));
    Overview.STATUSES.forEach(v => newProject.status.append(new Option(v, v)));
    $("project-form").onsubmit = async () => {
      try {
        await Projects.create(newProject.title.value, { format: newProject.format.value, status: newProject.status.value });
        adminOpen = false; activeTab = "overview"; render();
      } catch (error) { alert(error.message); }
    };
    $("sign-out").onclick = Auth.signOut;
    $("change-password").onclick = () => {
      $("password-form").reset(); $("password-note").textContent = "";
      $("password-dialog").returnValue = ""; $("password-dialog").showModal();
    };
    $("password-form").onsubmit = async e => {
      e.preventDefault();
      const f = e.target.elements, note = $("password-note");
      if (f.password.value.length < 8) return void (note.textContent = "Use at least 8 characters.");
      if (f.password.value !== f.confirm.value) return void (note.textContent = "The two passwords don’t match.");
      const { error } = await Auth.changePassword(f.password.value);
      if (error) return void (note.textContent = error.message);
      $("password-dialog").close("ok");
      alert("Your password has been updated.");
    };
    Auth.start(enter);
  }
  return { init };
})();

App.init();
