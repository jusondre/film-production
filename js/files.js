/* Files tab: scripts, schedules, contracts and anything else the team shares. Stored in Supabase Storage,
   one folder per project, so the same access rules as the project apply (see supabase/step4_files.sql). */
const Files = (() => {
  const { el } = Dom;
  const BUCKET = "project-files";
  const MAX_BYTES = 50 * 1024 * 1024;
  const DAY = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

  const store = () => Auth.client().storage.from(BUCKET);
  let token = 0; // ignores a slow listing if the person already moved on

  /* Keys stay plain ASCII; the visible name is whatever follows the timestamp. */
  const safeName = name => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "") || "file";
  const shownName = key => key.replace(/^\d+__/, "");
  const size = bytes => bytes < 1024 ? `${bytes} B`
    : bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

  /* People who opened a view link aren't signed in, so their file list and downloads go through the shared-files function. */
  async function viaLink(body) {
    const { data, error } = await Auth.client().functions.invoke("shared-files", { body: { token: Projects.shared(), ...body } });
    if (error) {
      let text = "Files aren’t available through this link right now.";
      try { text = (await error.context.json()).error || text; } catch {}
      throw new Error(text);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function list(projectId) {
    if (Projects.shared()) return (await viaLink({ action: "list" })).files;
    const { data, error } = await store().list(projectId, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw error;
    return data.filter(f => f.name !== ".emptyFolderPlaceholder");
  }

  /* Used when a project is deleted. */
  async function removeAll(projectId) {
    const files = await list(projectId);
    if (!files.length) return;
    const { error } = await store().remove(files.map(f => `${projectId}/${f.name}`));
    if (error) throw error;
  }

  async function render(root, project) {
    const mine = ++token;
    const status = el("span", "hint");
    const upload = el("button", "btn btn-primary", "Upload files");
    const title = el("div", "crew-title");
    const count = el("span", "crew-count");
    title.append(el("h3", null, "Files"), count);
    const head = el("div", "crew-head");
    head.append(title, el("span", "spacer"), status, upload);
    const body = el("div", "files-list");
    root.replaceChildren(head, body);

    async function refresh() {
      let files;
      try { files = await list(project.id); }
      catch (error) {
        if (mine === token) body.replaceChildren(el("p", "form-error", `${error.message}${Projects.shared() ? "" : ". If this is a new setup, run supabase/step4_files.sql."}`));
        return;
      }
      if (mine !== token) return;
      count.textContent = files.length === 1 ? "1 file" : `${files.length} files`;
      if (!files.length) {
        const empty = el("div", "empty");
        empty.append(el("h3", null, "No files yet"), el("p", null, "Upload scripts, schedules, releases and references so the whole team has the latest versions."));
        return body.replaceChildren(empty);
      }
      body.replaceChildren(...files.map(f => row(project, f, refresh, status)));
    }

    async function send(selected) {
      const files = [...selected];
      let failed = [];
      for (const [i, file] of files.entries()) {
        if (file.size > MAX_BYTES) { failed.push(`${file.name} is over 50 MB`); continue; }
        status.textContent = `Uploading ${i + 1} of ${files.length}…`;
        const { error } = await store().upload(`${project.id}/${Date.now()}__${safeName(file.name)}`, file);
        if (error) failed.push(`${file.name}: ${error.message}`);
      }
      status.textContent = failed.length ? "" : "Uploaded";
      if (failed.length) alert(`Some files weren’t uploaded:\n${failed.join("\n")}`);
      refresh();
    }

    upload.onclick = () => {
      const picker = el("input"); picker.type = "file"; picker.multiple = true;
      picker.onchange = () => send(picker.files);
      picker.click();
    };
    body.ondragover = e => e.preventDefault();
    body.ondrop = e => { e.preventDefault(); if (Projects.canEdit() && e.dataTransfer.files.length) send(e.dataTransfer.files); };
    refresh();
  }

  function row(project, file, refresh, status) {
    const name = shownName(file.name);
    const r = el("div", "file-row");
    const info = el("span", "crew-info");
    info.append(el("strong", null, name), el("small", null, `${size(file.metadata?.size || 0)} · ${DAY.format(new Date(file.created_at))}`));
    const open = el("button", "btn btn-ghost", "Download");
    open.onclick = async () => {
      try {
        const url = Projects.shared()
          ? (await viaLink({ action: "download", name: file.name })).url
          : await (async () => {
              const { data, error } = await store().createSignedUrl(`${project.id}/${file.name}`, 60, { download: name });
              if (error) throw error;
              return data.signedUrl;
            })();
        const a = el("a"); a.href = url; a.click();
      } catch (error) { alert(error.message); }
    };
    const del = el("button", "btn btn-danger", "Delete");
    del.onclick = async () => {
      if (!confirm(`Delete “${name}”?`)) return;
      const { error } = await store().remove([`${project.id}/${file.name}`]);
      if (error) return alert(error.message);
      status.textContent = "";
      refresh();
    };
    const actions = el("span", "admin-actions"); actions.append(open, del);
    r.append(info, actions);
    return r;
  }

  return { render, removeAll };
})();
