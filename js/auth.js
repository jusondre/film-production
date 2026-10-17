/* Auth: email + password sign-in, the invitation and password-reset screens, and the signed-in profile. */
const Auth = (() => {
  const { $, el } = Dom;
  const cfg = window.APP_CONFIG || {};
  const configured = /^https:\/\/.+\.supabase\.co/.test(cfg.supabaseUrl || "")
    && Boolean(cfg.supabaseAnonKey) && !cfg.supabaseAnonKey.startsWith("YOUR");
  const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);
  const returnTo = () => (cfg.siteUrl || "").trim() || location.origin + location.pathname;
  /* True when invitation links would point at this computer instead of a real website. */
  const linksBroken = () => local && !(cfg.siteUrl || "").trim();
  const MIN_PASSWORD = 8;

  let client = null;
  let profile = null;
  let onApproved = () => {};
  let notice = ""; // shown once on the sign-in screen (for example, an expired link)

  const isAdmin = () => profile?.role === "admin" && profile?.status === "approved";

  function friendly(error) {
    const text = error.message || "";
    if (/invalid login credentials/i.test(text)) return "That email and password don’t match.";
    if (/not confirmed/i.test(text)) return "This account isn’t activated yet. Open your invitation email and set your password first.";
    if (/rate limit|too many/i.test(text)) return "Too many attempts. Wait a few minutes and try again.";
    return text;
  }

  /* ---------- screen building blocks ---------- */
  function showGate(content) {
    $("app").hidden = true;
    $("gate").hidden = false;
    $("gate").replaceChildren(content);
  }
  function card(...children) {
    const box = el("div", "gate-card");
    box.append(el("p", "gate-brand", "Film Production"), ...children);
    return box;
  }
  function button(label, cls, action) {
    const b = el("button", cls, label); b.type = "button"; b.onclick = action;
    return b;
  }
  function message(title, body, ...actions) {
    const row = el("div", "gate-actions"); row.append(...actions);
    return card(el("h1", null, title), el("p", "gate-sub", body), row);
  }
  function field(type, placeholder, autocomplete, name = type) {
    const input = el("input", "gate-input");
    input.type = type; input.name = name; input.placeholder = placeholder;
    input.autocomplete = autocomplete; input.required = true; input.ariaLabel = placeholder;
    return input;
  }
  function note() {
    const p = el("p", "gate-note"); p.setAttribute("role", "alert");
    return p;
  }

  /* ---------- screens ---------- */
  function loginScreen() {
    const problem = note(); problem.textContent = notice; notice = "";
    const email = field("email", "Email", "username");
    const password = field("password", "Password", "current-password");
    const submit = el("button", "btn btn-primary btn-wide", "Sign in");
    const form = el("form", "gate-form");
    form.append(email, password, submit);
    form.onsubmit = async e => {
      e.preventDefault();
      submit.disabled = true; problem.textContent = "";
      const { error } = await client.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
      if (error) { submit.disabled = false; problem.textContent = friendly(error); return; }
      refresh();
    };
    const links = el("div", "gate-links");
    links.append(button("Forgot password?", "link-btn", () => showGate(forgotScreen())));
    return card(
      el("h1", null, "Welcome to the set."),
      el("p", "gate-sub", "Sign in with your email and password. Access is by invitation only."),
      form, problem, links);
  }

  function forgotScreen() {
    const problem = note();
    const email = field("email", "Your email", "username");
    const submit = el("button", "btn btn-primary btn-wide", "Send reset link");
    const form = el("form", "gate-form");
    form.append(email, submit);
    form.onsubmit = async e => {
      e.preventDefault();
      submit.disabled = true; problem.textContent = "";
      const { error } = await client.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: returnTo() });
      if (error) { submit.disabled = false; problem.textContent = friendly(error); return; }
      form.replaceWith(el("p", "gate-sent", "If that email has an account, a reset link is on its way. Check your inbox."));
    };
    const links = el("div", "gate-links");
    links.append(button("Back to sign in", "link-btn", () => showGate(loginScreen())));
    return card(el("h1", null, "Forgot your password?"),
      el("p", "gate-sub", "Enter your email and we’ll send you a link to choose a new one."), form, problem, links);
  }

  /* Shown after someone opens their invitation ("invite") or reset ("recovery") link.
     An invitation also collects name and phone, which end up on the Crew tab. */
  function passwordScreen(kind, address = "") {
    const invite = kind === "invite";
    const problem = note();
    const first = field("text", "First name", "given-name", "first");
    const last = field("text", "Last name", "family-name", "last");
    const email = field("email", "Email", "username", "email");
    email.value = address; email.readOnly = true;
    const phone = field("tel", "Phone number", "tel", "phone");
    const password = field("password", invite ? "Password" : "Choose a password", "new-password");
    const confirm = field("password", "Repeat the password", "new-password", "confirm");
    password.minLength = confirm.minLength = MIN_PASSWORD;
    const submit = el("button", "btn btn-primary btn-wide", invite ? "Create my account" : "Save new password");
    const form = el("form", "gate-form");
    const names = el("div", "gate-pair"); names.append(first, last);
    form.append(...(invite ? [names, email, phone] : []), password, confirm, submit);
    form.onsubmit = async e => {
      e.preventDefault();
      problem.textContent = "";
      if (password.value.length < MIN_PASSWORD) return void (problem.textContent = `Use at least ${MIN_PASSWORD} characters.`);
      if (password.value !== confirm.value) return void (problem.textContent = "The two passwords don’t match.");
      submit.disabled = true;
      const details = { first_name: first.value.trim(), last_name: last.value.trim(), phone: phone.value.trim() };
      const { error } = await client.auth.updateUser({ password: password.value, ...(invite ? { data: details } : {}) });
      if (error) { submit.disabled = false; problem.textContent = error.message; return; }
      if (invite) {
        const saved = await client.rpc("save_my_profile", { p_first: details.first_name, p_last: details.last_name, p_phone: details.phone });
        if (saved.error) {
          submit.disabled = false;
          problem.textContent = /save_my_profile|schema cache|not find/i.test(saved.error.message)
            ? "Your details couldn’t be saved because setup isn’t finished. Tell the admin to run supabase/step5_people.sql."
            : saved.error.message;
          return;
        }
      }
      refresh();
    };
    return card(
      el("h1", null, invite ? "Welcome aboard." : "Choose a new password."),
      el("p", "gate-sub", invite ? "Tell us who you are and choose a password. You’ll use it to sign in from now on." : "Pick a password you haven’t used before."),
      form, problem);
  }

  const setupScreen = () => message("Almost ready", "Film Production isn’t connected to its database yet. Open SETUP.md in this folder, follow the steps, then add your keys to config.js.");
  const fileScreen = () => message("Open it from a web address", "Sign-in needs a web address. Run “python3 -m http.server 8000” in this folder and open http://localhost:8000, or deploy the folder. SETUP.md has the details.");
  const pendingScreen = () => message("You’re on the list.", `Your account is waiting for the admin’s go-ahead. You’re signed in as ${profile.email}.`,
    button("Check again", "btn btn-primary", () => refresh()), button("Sign out", "btn btn-ghost", signOut));
  const revokedScreen = () => message("Access removed", "Your access to Film Production has been removed. If you think that’s a mistake, get in touch with the admin.",
    button("Sign out", "btn btn-ghost", signOut));
  const errorScreen = text => message("Something went wrong", text, button("Try again", "btn btn-primary", () => refresh()), button("Sign out", "btn btn-ghost", signOut));

  /* The joined_at column exists once supabase/step5_people.sql has been run; before that nobody is held back. */
  const needsSignup = p => "joined_at" in p && !p.joined_at && p.role !== "admin";

  /* ---------- session ---------- */
  async function refresh() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) { profile = null; return showGate(loginScreen()); }

    const { data, error } = await client.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (error) return showGate(errorScreen(error.message));
    if (!data) return showGate(errorScreen("We couldn’t find your account record. Ask the admin to check your access."));
    profile = data;

    // Anyone who got in through an invitation but hasn't filled in the sign-up form yet is sent to it first,
    // however they arrived (emailed link, copied link, or a link that signs them straight in).
    if (data.status === "approved" && needsSignup(data)) return showGate(passwordScreen("invite", data.email));
    if (data.status === "approved") { $("gate").hidden = true; $("app").hidden = false; onApproved(); }
    else showGate(data.status === "pending" ? pendingScreen() : revokedScreen());
  }

  async function start(callback) {
    onApproved = callback;
    if (!configured) return showGate(setupScreen());
    if (location.protocol === "file:") return showGate(fileScreen());
    client = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { flowType: "implicit" } });
    client.auth.onAuthStateChange(event => { if (event === "SIGNED_OUT") location.reload(); });

    // Invitation and reset emails link back here with ?token_hash=...&type=invite|recovery
    const params = new URLSearchParams(location.search);
    const type = params.get("type"), tokenHash = params.get("token_hash");
    if (tokenHash && ["invite", "recovery"].includes(type)) {
      history.replaceState(null, "", location.pathname);
      const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return showGate(passwordScreen(type, data?.user?.email || ""));
      notice = "That link has expired or was already used. Ask the admin to send a new invitation, or use “Forgot password?”.";
    }
    await refresh();
  }

  async function signOut() {
    await client.auth.signOut();
    location.reload();
  }

  const changePassword = password => client.auth.updateUser({ password });

  /* Admin only. All three go through the invite-user function, which holds the private key. */
  const UNREACHABLE = "Couldn’t reach the invite function. In Supabase, open Edge Functions and check that one named invite-user is deployed, then look at its Logs tab. See SETUP.md.";
  async function callInvite(body) {
    const { data, error } = await client.functions.invoke("invite-user", { body: { ...body, redirectTo: returnTo() } });
    if (!error) return data?.error ? { error: data.error } : { data };
    // The function answered with an error of its own: show it as written.
    if (error.name === "FunctionsHttpError") {
      let text = error.message;
      try { const reply = await error.context.json(); text = reply.error || reply.message || text; } catch {}
      if (/function was not found/i.test(text)) return { error: UNREACHABLE, unreachable: true };
      return { error: text };
    }
    // No usable answer: the function isn't there, or it crashed before it could reply.
    return { error: `${UNREACHABLE} (${error.name})`, unreachable: true };
  }
  /* Adds someone to a project and emails them an invitation. */
  const invite = (email, projectId, role) => callInvite({ action: "invite", email, projectId, role });
  /* Makes a new invitation link to pass on by hand. Any earlier link for that email stops working. */
  const inviteLink = (email, projectId, role) => callInvite({ action: "link", email, projectId, role });
  /* Deletes someone’s account completely, including their access to every project. */
  const deleteAccount = email => callInvite({ action: "delete", email });
  /* Removes someone from a project, and cancels the invitation if they never accepted. */
  async function revoke(email, projectId) {
    const result = await callInvite({ action: "revoke", email, projectId });
    if (!result.unreachable) return result;
    // Without the function the membership can still be removed directly; a pending account just stays unused.
    const { error } = await client.from("project_members").delete().eq("project_id", projectId).eq("email", email);
    return error ? { error: error.message } : { data: { status: "revoked" } };
  }

  return { start, signOut, linksBroken, changePassword, invite, inviteLink, revoke, deleteAccount, isAdmin, profile: () => profile, client: () => client };
})();
