/* Admin: add and remove editors. Editors sign in with a code sent to their email and can change the projects you give them.
   Everyone else just views the site. Opened from the Profile menu (admins only). */
const Admin = (() => {
  const { el } = Dom;
  const db = () => Auth.client();
  const ALL = "all";
  let flash = null;      // { text, ok } shown once after the next refresh
  let chosen = ALL;      // project picked in the add form, kept across refreshes

  async function render(root) {
    root.replaceChildren(el("p", "hint", "Loading…"));
    const [projects, members, people] = await Promise.all([
      db().from("projects").select("id, title").order("created_at"),
      db().from("project_members").select("*").order("added_at"),
      db().from("profiles").select("email, role").order("created_at"),
    ]);
    const error = projects.error || members.error || people.error;
    if (error) return root.replaceChildren(el("p", "form-error", error.message));
    draw(root, projects.data, members.data, people.data);
  }

  function draw(root, projects, members, people) {
    const titles = new Map(projects.map(p => [p.id, p.title]));
    const admins = new Set(people.filter(p => p.role === "admin").map(p => p.email));
    const signedUp = new Set(people.map(p => p.email));

    const message = el("div", "admin-message"); message.setAttribute("role", "alert");
    const say = (text, ok = false) => {
      message.replaceChildren(el("p", ok ? "form-error form-ok" : "form-error", text));
      message.scrollIntoView({ block: "nearest" });
    };
    if (flash) { say(flash.text, flash.ok); flash = null; }
    const done = text => { flash = { text, ok: true }; render(root); };
    const btn = (label, cls, fn) => { const b = el("button", cls, label); b.type = "button"; b.onclick = fn; return b; };

    const emails = [...new Set([...members.map(m => m.email), ...people.map(p => p.email)])].filter(e => !admins.has(e));
    const head = el("div", "vis-head");
    head.append(el("h3", null, "Editors"), el("span", "hint", `${emails.length} ${emails.length === 1 ? "editor" : "editors"}`));
    const intro = el("p", "hint admin-intro", "Editors can change the projects you give them. Everyone else can look at the projects without signing in, but can’t change anything.");

    const list = el("section", "admin-section");
    list.append(...(emails.length ? emails.map(email => row(email, members, titles, signedUp.has(email), { say, done, btn })) : [el("p", "hint", "No editors yet.")]));

    root.replaceChildren(head, intro, addForm(projects, say, done), message, list);
  }

  function row(email, members, titles, hasAccount, { say, done, btn }) {
    const mine = members.filter(m => m.email === email && titles.has(m.project_id));

    const who = el("strong", null, email);
    if (!hasAccount) who.append(" ", el("span", "badge badge-pending", "Hasn’t signed in yet"));

    const projects = el("span", "admin-projects");
    if (!mine.length) projects.append(el("small", null, "No projects"));
    mine.forEach(m => {
      const chip = el("span", "admin-chip", titles.get(m.project_id));
      const x = el("button", "admin-chip-x", "×"); x.type = "button";
      x.ariaLabel = `Remove ${email} from ${titles.get(m.project_id)}`;
      x.onclick = async () => {
        if (!confirm(`Take ${email} off “${titles.get(m.project_id)}”?`)) return;
        const { error } = await db().from("project_members").delete().eq("project_id", m.project_id).eq("email", email);
        if (error) say(error.message); else done(`${email} can no longer edit “${titles.get(m.project_id)}”.`);
      };
      chip.append(x); projects.append(chip);
    });

    const info = el("span", "crew-info"); info.append(who, projects);
    const person = el("span", "crew-person");
    person.append(el("span", "avatar avatar-lg", Crew.initials(email)), info);

    const remove = btn("Remove", "btn btn-danger", async () => {
      if (!confirm(`Remove ${email}? This deletes their account and they won’t be able to sign in. You can add them again later.`)) return;
      const { error } = await db().rpc("remove_editor", { p_email: email });
      if (error) say(/function .*remove_editor|schema cache/i.test(error.message) ? "Run supabase/step6_share_and_editors.sql in the SQL Editor first." : error.message);
      else done(`${email} was removed.`);
    });
    const actions = el("span", "admin-actions"); actions.append(remove);

    const r = el("div", "admin-row");
    r.append(person, actions);
    return r;
  }

  function addForm(projects, say, done) {
    const form = el("form", "admin-add");
    const email = el("input", "search"); email.type = "email"; email.required = true;
    email.placeholder = "Editor’s email"; email.ariaLabel = "Editor’s email";
    const project = el("select", "select"); project.ariaLabel = "Project";
    project.append(new Option("All projects", ALL));
    projects.forEach(p => project.append(new Option(p.title, p.id)));
    project.value = chosen === ALL || projects.some(p => p.id === chosen) ? chosen : ALL;
    project.onchange = () => { chosen = project.value; };
    const submit = el("button", "btn btn-primary", "Add editor");
    form.append(email, project, submit);
    if (!projects.length) [email, project, submit].forEach(c => { c.disabled = true; });

    form.onsubmit = async e => {
      e.preventDefault();
      submit.disabled = true;
      const address = email.value.trim().toLowerCase();
      const targets = project.value === ALL ? projects : projects.filter(p => p.id === project.value);
      const { error } = await db().from("project_members")
        .upsert(targets.map(p => ({ project_id: p.id, email: address, role: "editor" })), { onConflict: "project_id,email" });
      if (error) { submit.disabled = false; return say(error.message); }
      await db().from("profiles").update({ status: "approved" }).eq("email", address); // in case they were removed before
      done(`${address} is now an editor. They can sign in at ${Auth.siteUrl()} with a code sent to that email.`);
    };
    return form;
  }

  return { render };
})();
