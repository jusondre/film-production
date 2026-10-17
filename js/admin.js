/* Admin: one screen for everyone's access to every project. Opened from the Admin button in the top bar (admins only).
   Add people by email, see who is pending or accepted, change roles, revoke invitations. */
const Admin = (() => {
  const { el } = Dom;
  const db = () => Auth.client();
  const ROLES = [["editor", "Editor"], ["viewer", "Viewer"]];
  let flash = null;   // { text, ok, link } shown once after the next refresh
  let chosen = null;  // project picked in the add form, kept across refreshes

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
    const byEmail = new Map(people.map(p => [p.email, p]));
    const accepted = m => Boolean(byEmail.get(m.email)?.joined_at);

    const message = el("div", "admin-message"); message.setAttribute("role", "alert");
    const say = (text, ok = false, link = "") => {
      message.replaceChildren(el("p", ok ? "form-error form-ok" : "form-error", text));
      if (link) message.append(linkBox(link));
      message.scrollIntoView({ block: "nearest" });
    };
    if (flash) { say(flash.text, flash.ok, flash.link); flash = null; }
    /* Refreshes the lists and then shows a message. */
    const done = (text, ok = true, link = "") => { flash = { text, ok, link }; render(root); };
    const run = async (request, text) => {
      const { error } = await request;
      if (error) say(error.message); else done(text);
    };
    const btn = (label, cls, fn) => { const b = el("button", cls, label); b.type = "button"; b.onclick = fn; return b; };

    /* The same message wording for a new or repeated invitation. */
    const reportInvite = (result, address, title, finish) => {
      if (result.error) return finish(result.error, false);
      const { status, emailed, emailError, link } = result.data;
      if (status === "exists") return finish(`${address} already has an account and can now open “${title}”.`);
      if (emailed === false) return finish(`${address} was added to “${title}”, but the email couldn’t be sent (${emailError}). Send them this link yourself:`, false, link);
      finish(`Invitation sent to ${address} for “${title}”.`);
    };

    const pendingCount = members.filter(m => !accepted(m)).length;
    const head = el("div", "vis-head");
    head.append(el("h3", null, "Admin"),
      el("span", "hint", `${members.length - pendingCount} accepted, ${pendingCount} pending, across ${projects.length} ${projects.length === 1 ? "project" : "projects"}`));
    const parts = [head, addForm(projects, reportInvite, done, say), message];

    projects.forEach(project => {
      const list = members.filter(m => m.project_id === project.id);
      const rows = list.map(m => memberRow(project, m, byEmail.get(m.email), accepted(m), { say, done, run, btn, reportInvite }));
      parts.push(block(project.title, rows, "Nobody added yet.", `${list.filter(accepted).length} accepted, ${list.filter(m => !accepted(m)).length} pending`));
    });
    if (!projects.length) parts.push(el("p", "hint", "Create a project first, then add people to it."));

    parts.push(block("Everyone with an account", people.map(p => row({
      name: p.full_name || p.email,
      sub: p.status === "pending" ? "Waiting for approval" : p.status === "revoked" ? "Access removed"
        : [p.full_name ? p.email : "", p.phone].filter(Boolean).join(" · "),
      badge: p.role === "admin" ? "Admin" : "",
      controls: p.id === me.id ? [el("span", "hint", "You")]
        : p.status === "approved" ? [btn("Block sign-in", "btn btn-danger", () => {
            if (confirm(`Block ${p.email} from signing in at all?`)) run(db().from("profiles").update({ status: "revoked" }).eq("id", p.id), "Sign-in blocked.");
          })]
        : [btn(p.status === "pending" ? "Approve" : "Restore access", "btn btn-ghost",
            () => run(db().from("profiles").update({ status: "approved" }).eq("id", p.id), "Access restored."))],
    })), "Nobody yet.", String(people.length)));

    root.replaceChildren(...parts);
  }

  function memberRow(project, m, person, isAccepted, { say, done, run, btn, reportInvite }) {
    const select = el("select", "select"); select.ariaLabel = `Role for ${m.email}`;
    ROLES.forEach(([value, label]) => select.append(new Option(label, value)));
    select.value = m.role;
    select.onchange = () => run(db().from("project_members").update({ role: select.value })
      .eq("project_id", project.id).eq("email", m.email), "Role updated.");

    if (isAccepted) {
      return row({
        name: person.full_name || m.email, badge: "Accepted",
        sub: [person.full_name ? m.email : "", person.phone].filter(Boolean).join(" · "),
        controls: [select, btn("Remove", "btn btn-danger", async () => {
          if (!confirm(`Remove ${person.full_name || m.email} from “${project.title}”?`)) return;
          const result = await Auth.revoke(m.email, project.id);
          if (result.error) say(result.error); else done("Removed from the project.");
        })],
      });
    }
    return row({
      name: m.email, badge: "Pending", pending: true,
      sub: "Invited, hasn’t created an account yet",
      controls: [select,
        btn("Copy link", "btn btn-ghost", async () => {
          const result = await Auth.inviteLink(m.email, project.id, select.value);
          if (result.error) return say(result.error);
          say("New link created. Any link sent earlier to this email no longer works.", true, result.data.link);
        }),
        btn("Resend", "btn btn-ghost", async () => reportInvite(await Auth.invite(m.email, project.id, select.value), m.email, project.title, say)),
        btn("Revoke", "btn btn-danger", async () => {
          if (!confirm(`Revoke the invitation for ${m.email} to “${project.title}”? Their link will stop working.`)) return;
          const result = await Auth.revoke(m.email, project.id);
          if (result.error) say(result.error); else done("Invitation revoked.");
        })],
    });
  }

  function addForm(projects, reportInvite, done, say) {
    const form = el("form", "admin-add");
    const email = el("input", "search"); email.type = "email"; email.required = true;
    email.placeholder = "Email address"; email.ariaLabel = "Email to invite";
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

  function row({ name, sub, badge, pending, controls }) {
    const r = el("div", "admin-row");
    const who = el("strong", null, name);
    if (badge) who.append(" ", el("span", pending ? "badge badge-pending" : "badge", badge));
    const info = el("span", "crew-info"); info.append(who, el("small", null, sub || ""));
    const person = el("span", "crew-person");
    person.append(el("span", "avatar avatar-lg", Crew.initials(name)), info);
    const actions = el("span", "admin-actions"); actions.append(...controls);
    r.append(person, actions);
    return r;
  }

  function block(title, rows, emptyText, count) {
    const wrap = el("section", "admin-section");
    const h = el("h4", null, title); h.append(el("span", null, count));
    wrap.append(h, ...(rows.length ? rows : [el("p", "hint", emptyText)]));
    return wrap;
  }

  return { render };
})();
