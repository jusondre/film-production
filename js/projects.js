/* Projects: shared projects from the database, with autosave and role-aware access. */
const Projects = (() => {
  const SAVE_DELAY = 800;     // wait this long after the last edit before saving
  const SYNC_EVERY = 20000;   // check for other people's changes this often

  let list = [];
  let activeId = Storage.load().activeId || null;
  let pending = null;         // project with changes not yet saved
  let saving = false;
  let timer = null;
  let syncStarted = false;
  let onStatus = () => {};
  let onChange = () => {};
  let shared = null;          // { token } when the page was opened from a project's view link
  let preview = false;        // an admin looking at the project the way a viewer sees it

  const db = () => Auth.client();
  const active = () => list.find(p => p.id === activeId) || null;
  const canEdit = () => !shared && !preview && ["admin", "editor"].includes(active()?.role);

  /* In memory a project is its content plus id, title, version and your role. Only the content is saved. */
  const fromRow = (row, role) => ({ ...row.data, id: row.id, title: row.title, version: row.version, role, shareToken: row.share_token });
  const toData = ({ id, title, version, role, shareToken, ...content }) => content;

  async function load() {
    const admin = Auth.isAdmin();
    const [projects, mine] = await Promise.all([
      db().from("projects").select("*").order("created_at"),
      admin ? { data: [] } : db().from("project_members").select("project_id, role"),
    ]);
    if (projects.error) throw projects.error;
    const roles = Object.fromEntries((mine.data || []).map(m => [m.project_id, m.role]));
    list = projects.data.map(row => fromRow(row, admin ? "admin" : roles[row.id] || "viewer"));
    if (!list.some(p => p.id === activeId)) activeId = list[0]?.id || null;
  }

  /* Opens the one project a view link points to. Nobody is signed in, so there is nothing to save. */
  async function loadShared(token) {
    const { data, error } = await db().rpc("shared_project", { t: token });
    if (error) throw error;
    shared = { token };
    list = data?.length ? [fromRow(data[0], "viewer")] : [];
    activeId = list[0]?.id || null;
  }

  /* Viewers pick up the editors' changes every so often and when they return to the tab. */
  function startSharedSync(changed) {
    const check = async () => {
      if (document.querySelector("dialog[open]")) return;
      const { data, error } = await db().rpc("shared_project", { t: shared.token });
      if (error) return;
      const now = active(), row = data?.[0];
      if (!row && !now) return;
      if (row && now && row.version === now.version && row.title === now.title) return;
      list = row ? [fromRow(row, "viewer")] : [];
      activeId = list[0]?.id || null;
      changed();
    };
    setInterval(check, SYNC_EVERY);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  }

  /* A new view link: the old one stops working at once. */
  async function newShareLink() {
    const project = active();
    const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    const { data, error } = await db().from("projects").update({ share_token: token }).eq("id", project.id).select("id");
    if (error) throw error;
    if (!data.length) throw new Error("You don’t have permission to change this link.");
    project.shareToken = token;
    return token;
  }

  function setPreview(on) { flush(); preview = on; }

  /* details: the starting project details (format, status), saved with the project. */
  async function create(title, details = {}) {
    const { data, error } = await db().from("projects")
      .insert({ title: title.trim(), data: { details }, created_by: Auth.profile().id }).select().single();
    if (error) throw error;
    const project = fromRow(data, "admin");
    list.push(project);
    setActive(project.id);
    return project;
  }

  async function rename(title) {
    const project = active(), next = title.trim();
    if (!project || !next || next === project.title) return;
    const { data, error } = await db().from("projects").update({ title: next }).eq("id", project.id).select("id");
    if (error) throw error;
    if (!data.length) throw new Error("You don’t have permission to rename this project.");
    project.title = next;
  }

  async function remove() {
    const project = active();
    if (!project) return;
    clearTimeout(timer); pending = null;
    const { data, error } = await db().from("projects").delete().eq("id", project.id).select("id");
    if (error) throw error;
    if (!data.length) throw new Error("You don’t have permission to delete this project.");
    list = list.filter(p => p !== project);
    activeId = list[0]?.id || null;
    Storage.save({ ...Storage.load(), activeId });
  }

  function setActive(id) {
    flush();
    activeId = id;
    Storage.save({ ...Storage.load(), activeId: id });
  }

  /* Called by every tab after it changes something. */
  function persist(now = false) {
    if (!canEdit()) return;
    pending = active();
    onStatus("Saving…");
    clearTimeout(timer);
    if (now) flush(); else timer = setTimeout(flush, SAVE_DELAY);
  }

  async function flush() {
    clearTimeout(timer);
    const project = pending;
    if (!project || saving) return;
    pending = null; saving = true;
    const { data, error } = await db().from("projects")
      .update({ data: toData(project), version: project.version + 1 })
      .eq("id", project.id).eq("version", project.version).select("version");
    saving = false;
    if (error) { pending = pending || project; onStatus("Couldn’t save, retrying…"); timer = setTimeout(flush, 5000); return; }
    if (!data.length) return conflict(project);
    project.version = data[0].version;
    onStatus(pending ? "Saving…" : "Saved");
    if (pending) timer = setTimeout(flush, SAVE_DELAY);
  }

  /* Someone else saved first. Show their version rather than silently overwriting it. */
  async function conflict(project) {
    const { data } = await db().from("projects").select("*").eq("id", project.id).single();
    if (data) list[list.indexOf(project)] = fromRow(data, project.role);
    onStatus("Updated by someone else");
    onChange();
    alert("Someone else changed this project at the same moment, so your last change wasn’t saved. The page now shows the newest version.");
  }

  /* Picks up other people's changes (and access changes) every so often and when you return to the tab. */
  function startSync(changed) {
    onChange = changed;
    if (syncStarted) return;
    syncStarted = true;
    const check = async () => {
      if (pending || saving || document.querySelector("dialog[open]")) return;
      const { data, error } = await db().from("projects").select("id, title, version");
      if (error) return;
      const same = data.length === list.length && data.every(r => {
        const p = list.find(x => x.id === r.id);
        return p && p.version === r.version && p.title === r.title;
      });
      if (same) return;
      await load();
      onChange();
    };
    setInterval(check, SYNC_EVERY);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
    // Save right away when the tab is hidden or closed, so nothing waits in the delay.
    document.addEventListener("visibilitychange", () => { if (document.hidden && pending) flush(); });
    window.addEventListener("pagehide", () => { if (pending) flush(); });
    window.addEventListener("beforeunload", e => { if (pending || saving) { flush(); e.preventDefault(); } });
  }

  function renderSelect(select) {
    select.replaceChildren(...list.map(p => new Option(p.title, p.id)));
    select.value = activeId || "";
    select.hidden = !list.length;
  }

  const theme = () => Storage.load().theme || null;
  const setTheme = value => Storage.save({ ...Storage.load(), theme: value });

  return {
    load, loadShared, startSharedSync, newShareLink, setPreview, shared: () => shared?.token || null, previewing: () => preview, create, rename, remove, refresh: () => onChange(), active, setActive, canEdit, persist, flush, startSync, renderSelect, theme, setTheme,
    onStatus: fn => { onStatus = fn; },
  };
})();
