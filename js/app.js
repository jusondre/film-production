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
    const previewing = Projects.previewing();
    $("preview-bar").hidden = !previewing;
    $("preview-toggle").hidden = !Auth.isAdmin() || !project;
    $("preview-toggle").textContent = previewing ? "Exit viewer preview" : "View as viewer";
    $("new-project").hidden = !Auth.isAdmin() || previewing;
    $("admin-open").hidden = !Auth.isAdmin() || previewing;
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
        : renderEmpty(view, "No projects yet", "Nothing has been added here yet. Check back soon.");
    }
    tab.render(view, project);
  }

  function openProjectDialog() {
    $("project-form").reset();
    $("project-dialog").returnValue = "";
    $("project-dialog").showModal();
  }

  /* Runs when the projects can be shown: for a signed-in editor, or for anyone who is just looking. */
  async function enter() {
    const me = Auth.profile();   // null for visitors who are only looking
    $("user-name").textContent = me ? me.full_name || me.email : "";
    $("user-name").parentElement.hidden = !me;
    $("sign-out").hidden = !me;
    $("viewer-signin").hidden = Boolean(me);
    $("profile-btn").firstChild.textContent = me ? "Profile " : "Menu ";
    Projects.onStatus(text => { $("save-status").textContent = text; });
    try {
      await Projects.load();
    } catch (error) {
      return renderEmpty($("view"), "Couldn’t load projects", `${error.message}. If this is a new setup, run supabase/step6_share_and_editors.sql.`);
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
    // Profile menu: opens on click, closes after choosing something, on outside click, or Escape.
    const menu = $("menu"), toggle = $("profile-btn");
    const setMenu = open => { menu.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); };
    toggle.onclick = e => { e.stopPropagation(); setMenu(menu.hidden); };
    menu.onclick = () => setMenu(false);
    document.addEventListener("click", e => { if (!$("profile-menu").contains(e.target)) setMenu(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });
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
    $("preview-toggle").onclick = () => { Projects.setPreview(!Projects.previewing()); adminOpen = false; render(); };
    $("preview-exit").onclick = () => { Projects.setPreview(false); render(); };
    $("viewer-signin").onclick = Auth.showLogin;
    Auth.start(enter);
  }
  return { init };
})();

App.init();
