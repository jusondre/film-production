/* Admin: one plain list of every account. Under each name: full name, phone, email and the projects they can open.
   Admins can invite people (top form) and remove or restore someone's access. Opened from the Admin button (admins only). */
const Admin = (() => {
  const { el } = Dom;
  const db = () => Auth.client();
  const ROLES = [["editor", "Editor"], ["viewer", "Viewer"]];
  let flash = null;   // { text, ok, link } shown once after the next refresh
  let chosen = null;  // project picked in the invite form, kept across refreshes

  async function render(root) {
    root.replaceChildren(el("p", "hint", "Loading…"));
    const [projects, members, people] = await Promise.all([
      db().from("projects").select("id, title").order("created_at"),
      db().from("project_members").select("*").order("added_at"),
      db().from("profiles").select("*").order("created_at"),
    ]);
    const error = projects.error || members.error || people.error;
    if (error) return root.replaceChildren(el("p", "form-error", error.message));
    draw(root, projects.data, members.data, people.data);
  }

  function draw(root, projects, members, people) {
    const me = Auth.profile();
    const titles = new Map(projects.map(p => [p.id, p.title]));

    const message = el("div", "admin-message"); message.setAttribute("role", "alert");
    const say = (text, ok = false, link = "") => {
      message.replaceChildren(el("p", ok ? "form-error form-ok" : "form-error", text));
      if (link) message.append(linkBox(link));
      message.scrollIntoView({ block: "nearest" });
    };
    if (flash) { say(flash.text, flash.ok, flash.link); flash = null; }
    const done = (text, ok = true, link = "") => { flash = { text, ok, link }; render(root); };
    const btn = (label, cls, fn) => { const b = el("button", cls, label); b.type = "button"; b.onclick = fn; return b; };

    const reportInvite = (result, address, title, finish) => {
      if (result.error) return finish(result.error, false);
      const { status, emailed, emailError, link } = result.data;
      if (status === "exists") return finish(`${address} already has an account and can now open “${title}”.`);
      if (emailed === false) {
        const limited = /rate limit/i.test(emailError || "");
        return finish(`${address} was added to “${title}”. ${limited ? "The email limit was reached, so no email went out." : `The email couldn’t be sent (${emailError}).`} Send them this link yourself:`, false, link);
      }
      finish(`Invitation sent to ${address} for “${title}”.`);
    };

    /* One entry per account: everyone with a profile, plus people invited who haven't signed up yet. */
    const projectsOf = email => members.filter(m => m.email === email)
      .map(m => ({ id: m.project_id, title: titles.get(m.project_id), role: m.role })).filter(p => p.title);
    const accounts = people.map(p => ({
      id: p.id, email: p.email, admin: p.role === "admin", status: p.status,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.full_name || "",
      phone: p.phone || "", joined: Boolean(p.joined_at) || p.role === "admin",
    }));
    const known = new Set(people.map(p => p.email));
    [...new Set(members.map(m => m.email))].filter(e => !known.has(e))
      .forEach(email => accounts.push({ email, name: "", phone: "", status: "invited", joined: false }));

    const head = el("div", "vis-head");
    head.append(el("h3", null, "Accounts"), el("span", "hint", `${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}`));

    const rows = accounts.map(a => accountRow(a, projectsOf(a.email), me, { say, done, btn }));
    const list = el("section", "admin-section");
    list.append(...(rows.length ? rows : [el("p", "hint", "Nobody yet.")]));
    root.replaceChildren(head, inviteForm(projects, reportInvite, done, say), message, list);
  }

  function accountRow(a, projects, me, { say, done, btn }) {
    const removed = a.status === "revoked";
    const waiting = a.status === "pending";
    const unjoined = a.status === "invited" || (!a.joined && a.status === "approved");

    const who = el("strong", null, a.name || a.email);
    if (a.admin) who.append(" ", el("span", "badge", "Admin"));
    if (removed) who.append(" ", el("span", "badge badge-pending", "Access removed"));
    else if (waiting) who.append(" ", el("span", "badge badge-pending", "Waiting for approval"));
    else if (unjoined) who.append(" ", el("span", "badge badge-pending", "Invited, not signed up"));

    const info = el("span", "crew-info");
    info.append(who);
    if (a.name) info.append(el("small", null, a.email));
    info.append(el("small", null, a.phone ? `Phone: ${a.phone}` : "Phone: not given"));
    info.append(el("small", null, projects.length
      ? "Projects: " + projects.map(p => `${p.title} (${p.role === "editor" ? "editor" : "viewer"})`).join(", ")
      : a.admin ? "Projects: all (admin)" : "Projects: none"));

    const person = el("span", "crew-person");
    person.append(el("span", "avatar avatar-lg", Crew.initials(a.name || a.email)), info);

    const controls = [];
    if (a.id === me.id) controls.push(el("span", "hint", "You"));
    else if (a.status === "invited") {
      controls.push(btn("Remove access", "btn btn-danger", async () => {
        if (!confirm(`Remove ${a.email}’s access? Their invitation will stop working.`)) return;
        for (const p of projects) {
          const result = await Auth.revoke(a.email, p.id);
          if (result.error) return say(result.error);
        }
        done("Access removed.");
      }));
    } else if (a.status === "approved") {
      controls.push(btn("Remove access", "btn btn-danger", async () => {
        if (!confirm(`Remove access for ${a.name || a.email}? They won’t be able to open anything.`)) return;
        const { error } = await db().from("profiles").update({ status: "revoked" }).eq("id", a.id);
        if (error) say(error.message); else done("Access removed.");
      }));
    } else {
      controls.push(btn(waiting ? "Approve" : "Restore access", "btn btn-ghost", async () => {
        const { error } = await db().from("profiles").update({ status: "approved" }).eq("id", a.id);
        if (error) say(error.message); else done(waiting ? "Approved." : "Access restored.");
      }));
    }

    const r = el("div", "admin-row");
    const actions = el("span", "admin-actions"); actions.append(...controls);
    r.append(person, actions);
    return r;
  }

  function inviteForm(projects, reportInvite, done, say) {
    const form = el("form", "admin-add");
    const email = el("input", "search"); email.type = "email"; email.required = true;
    email.placeholder = "Invite by email"; email.ariaLabel = "Email to invite";
    const project = el("select", "select"); project.ariaLabel = "Project";
    projects.forEach(p => project.append(new Option(p.title, p.id)));
    project.value = projects.some(p => p.id === chosen) ? chosen : (Projects.active()?.id || projects[0]?.id || "");
    project.onchange = () => { chosen = project.value; };
    const role = el("select", "select"); role.ariaLabel = "Role";
    ROLES.forEach(([value, label]) => role.append(new Option(label, value)));
    const submit = el("button", "btn btn-primary", "Add and send link");
    form.append(email, project, role, submit);
    if (!projects.length) [email, project, role, submit].forEach(c => { c.disabled = true; });

    form.onsubmit = async e => {
      e.preventDefault();
      submit.disabled = true; say("Sending…", true);
      const address = email.value.trim().toLowerCase();
      const title = projects.find(p => p.id === project.value)?.title || "the project";
      reportInvite(await Auth.invite(address, project.value, role.value), address, title, done);
    };
    return form;
  }

  function linkBox(link) {
    const box = el("div", "admin-link");
    const input = el("input", "search"); input.value = link; input.readOnly = true; input.ariaLabel = "Invitation link";
    input.onfocus = () => input.select();
    const copy = el("button", "btn btn-ghost", "Copy");
    copy.type = "button";
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(link); } catch { input.select(); document.execCommand("copy"); }
      copy.textContent = "Copied";
    };
    box.append(input, copy);
    return box;
  }

  return { render };
})();
