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
    const view = $("view");
    Projects.renderSelect($("project-select"));
    document.body.classList.toggle("is-viewer", Boolean(project) && !Projects.canEdit());
    $("role-note").textContent = project && !Projects.canEdit() ? "View only" : "";
    const previewing = Projects.previewing();
    $("preview-bar").hidden = !previewing;
    $("preview-toggle").hidden = !Auth.isAdmin() || !project;
    $("preview-toggle").textContent = previewing ? "Exit viewer preview" : "View as viewer";
    $("new-project").hidden = !Auth.isAdmin() || previewing;
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

  /* The top-right menu: your Discord picture (or "Menu" when signed out), then dark mode and sign in / out. */
  function drawMenu() {
    const status = Auth.status(), me = Auth.me();
    const btn = $("profile-btn");
    btn.classList.toggle("has-avatar", Boolean(me));
    if (me) {
      if (me.avatar) {
        const img = document.createElement("img");
        img.src = me.avatar; img.alt = ""; img.referrerPolicy = "no-referrer";
        btn.replaceChildren(img);
      } else btn.replaceChildren(Crew.initials(me.name || "?"));
      btn.ariaLabel = `Menu for ${me.name}`;
    } else { btn.replaceChildren("Menu ▾"); btn.ariaLabel = "Menu"; }
    $("user-name").textContent = me ? me.name : "";
    $("user-name").parentElement.hidden = !me;
    $("sign-in").hidden = status !== "signed-out";
    $("sign-out").hidden = status === "signed-out";
  }

  /* Runs whenever the sign-in state is known. Only people who are in the Discord server get to see anything. */
  async function enter() {
    drawMenu();
    Projects.onStatus(text => { $("save-status").textContent = text; });
    const status = Auth.status(), view = $("view");
    $("tabs").hidden = true; $("project-select").hidden = true;
    $("new-project").hidden = $("preview-toggle").hidden = true;
    if (status === "signed-out") {
      return renderEmpty(view, "Sign in to continue", "This site is for our Discord server. Sign in with Discord to see the projects.",
        { label: "Sign in with Discord", run: Auth.signIn });
    }
    if (status === "not-member") {
      return renderEmpty(view, "You’re not in the server", "Only members of our Discord server can see this site. Join the server, then sign in again.",
        { label: "Sign out", run: Auth.signOut });
    }
    try {
      await Projects.load();
    } catch (error) {
      return renderEmpty(view, "Couldn’t load projects", `${error.message}. If this is a new setup, run supabase/step7_discord.sql.`);
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
    $("project-select").onchange = e => { Projects.setActive(e.target.value); render(); };
    const newProject = $("project-form").elements;
    Overview.FORMATS.forEach(v => newProject.format.append(new Option(v, v)));
    Overview.STATUSES.forEach(v => newProject.status.append(new Option(v, v)));
    $("project-form").onsubmit = async () => {
      try {
        await Projects.create(newProject.title.value, { format: newProject.format.value, status: newProject.status.value });
        activeTab = "overview"; render();
      } catch (error) { alert(error.message); }
    };
    $("sign-out").onclick = Auth.signOut;
    $("preview-toggle").onclick = () => { Projects.setPreview(!Projects.previewing()); render(); };
    $("preview-exit").onclick = () => { Projects.setPreview(false); render(); };
    $("sign-in").onclick = Auth.signIn;
    Auth.start(enter);
  }
  return { init };
})();

App.init();
