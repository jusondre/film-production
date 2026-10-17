/* Auth: editors sign in with their email and a code sent to it (no passwords, no sign-up form).
   Only emails the admin added can get in. Viewers don't sign in at all: they open a project's view link. */
const Auth = (() => {
  const { $, el } = Dom;
  const cfg = window.APP_CONFIG || {};
  const configured = /^https:\/\/.+\.supabase\.co/.test(cfg.supabaseUrl || "")
    && Boolean(cfg.supabaseAnonKey) && !cfg.supabaseAnonKey.startsWith("YOUR");
  /* The live address of the site. Emails and links always use it, never localhost. */
  const LIVE = "https://jusondre.github.io/film-production/";
  const siteUrl = () => (cfg.siteUrl || "").trim() || LIVE;

  let client = null;
  let profile = null;
  let onReady = () => {};

  const isAdmin = () => profile?.role === "admin" && profile?.status === "approved";

  function friendly(error) {
    const text = error.message || "";
    if (/signups? not allowed|database error|not_invited/i.test(text)) return "That email hasn’t been given access. Ask the admin to add you as an editor.";
    if (/rate limit|too many|only request this after|security purposes/i.test(text)) return "Too many tries. Wait a minute and ask for a new code.";
    if (/expired|invalid|token/i.test(text)) return "That code is wrong or has expired. Check it, or go back and ask for a new one.";
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
  function showApp() { $("gate").hidden = true; $("app").hidden = false; }
  function note() {
    const p = el("p", "gate-note"); p.setAttribute("role", "alert");
    return p;
  }

  /* ---------- screens ---------- */
  function loginScreen(prefill = "") {
    const problem = note();
    const email = el("input", "gate-input");
    email.type = "email"; email.name = "email"; email.placeholder = "Your email"; email.autocomplete = "username";
    email.required = true; email.ariaLabel = "Your email"; email.value = prefill;
    const submit = el("button", "btn btn-primary btn-wide", "Email me a code");
    const form = el("form", "gate-form");
    form.append(email, submit);
    form.onsubmit = async e => {
      e.preventDefault();
      submit.disabled = true; problem.textContent = "";
      const address = email.value.trim().toLowerCase();
      const { error } = await client.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true, emailRedirectTo: siteUrl() } });
      if (error) { submit.disabled = false; problem.textContent = friendly(error); return; }
      showGate(codeScreen(address));
    };
    const links = el("div", "gate-links");
    links.append(button("Back to the projects", "link-btn", showApp));
    return card(
      el("h1", null, "Editor sign-in."),
      el("p", "gate-sub", "Enter your email and we’ll send you a code. No password needed."),
      form, problem, links);
  }

  function codeScreen(address) {
    const problem = note();
    const code = el("input", "gate-input gate-code");
    code.name = "code"; code.inputMode = "numeric"; code.autocomplete = "one-time-code";
    code.placeholder = "Code from your email"; code.maxLength = 12; code.required = true; code.ariaLabel = "Sign-in code";
    const submit = el("button", "btn btn-primary btn-wide", "Sign in");
    const form = el("form", "gate-form");
    form.append(code, submit);
    form.onsubmit = async e => {
      e.preventDefault();
      submit.disabled = true; problem.textContent = "";
      const { error } = await client.auth.verifyOtp({ email: address, token: code.value.replace(/\s+/g, ""), type: "email" });
      if (error) { submit.disabled = false; problem.textContent = friendly(error); return; }
      refresh();
    };
    const links = el("div", "gate-links");
    links.append(button("Use a different email or send a new code", "link-btn", () => showGate(loginScreen(address))));
    return card(el("h1", null, "Check your email."),
      el("p", "gate-sub", `We sent a code to ${address}. Type it here to sign in.`), form, problem, links);
  }

  const setupScreen = () => message("Almost ready", "Film Production isn’t connected to its database yet. Open SETUP.md in this folder, follow the steps, then add your keys to config.js.");
  const fileScreen = () => message("Open it from a web address", "Sign-in needs a web address. Run “python3 -m http.server 8000” in this folder and open http://localhost:8000, or deploy the folder. SETUP.md has the details.");
  const removedScreen = () => message("Access removed", "This email no longer has access to Film Production. If you think that’s a mistake, get in touch with the admin.",
    button("Sign out", "btn btn-ghost", signOut));
  const errorScreen = text => message("Something went wrong", text, button("Try again", "btn btn-primary", () => refresh()), button("Sign out", "btn btn-ghost", signOut));

  /* ---------- session ---------- */
  async function refresh() {
    const { data: { session } } = await client.auth.getSession();
    // Not signed in: anyone can look at the projects straight away. Editors use the Sign in button.
    if (!session) { profile = null; showApp(); return onReady(); }

    const { data, error } = await client.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (error) return showGate(errorScreen(error.message));
    if (!data) return showGate(errorScreen("We couldn’t find your account record. Ask the admin to check your access."));
    profile = data;

    if (data.status === "approved") { showApp(); onReady(); }
    else showGate(removedScreen());
  }

  /* callback runs once the projects can be shown: for a signed-in editor, or for a visitor who is just looking. */
  async function start(callback) {
    onReady = callback;
    if (!configured) return showGate(setupScreen());
    if (location.protocol === "file:") return showGate(fileScreen());
    client = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { flowType: "implicit" } });
    client.auth.onAuthStateChange(event => { if (event === "SIGNED_OUT") location.reload(); });
    await refresh();
  }

  const showLogin = () => showGate(loginScreen());

  async function signOut() {
    await client.auth.signOut();
    location.reload();
  }

  return { start, signOut, showLogin, siteUrl, isAdmin, profile: () => profile, client: () => client };
})();
