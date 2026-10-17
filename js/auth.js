/* Auth: everyone signs in with Discord. Only people in the Discord server can see anything,
   and members with the admin role can edit. The discord-access function asks Discord and the database enforces the answer. */
const Auth = (() => {
  const { $, el } = Dom;
  const cfg = window.APP_CONFIG || {};
  const configured = /^https:\/\/.+\.supabase\.co/.test(cfg.supabaseUrl || "")
    && Boolean(cfg.supabaseAnonKey) && !cfg.supabaseAnonKey.startsWith("YOUR");
  const LIVE = "https://jusondre.github.io/film-production/";
  const siteUrl = () => (cfg.siteUrl || "").trim() || LIVE;
  const RECHECK_EVERY = 15 * 60 * 1000;  // ask Discord again this often while the site is open

  let client = null;
  let onReady = () => {};
  let status = "signed-out";   // "signed-out" | "not-member" | "member"
  let me = null;               // { id, name, avatar, isAdmin } once signed in with Discord

  const isAdmin = () => status === "member" && Boolean(me?.isAdmin);

  /* ---------- gate screens (setup problems and errors only) ---------- */
  function showGate(content) {
    $("app").hidden = true;
    $("gate").hidden = false;
    $("gate").replaceChildren(content);
  }
  function showApp() { $("gate").hidden = true; $("app").hidden = false; }
  function message(title, body, ...actions) {
    const row = el("div", "gate-actions"); row.append(...actions);
    const box = el("div", "gate-card");
    box.append(el("p", "gate-brand", "Film Production"), el("h1", null, title), el("p", "gate-sub", body), row);
    return box;
  }
  const button = (label, cls, action) => { const b = el("button", cls, label); b.type = "button"; b.onclick = action; return b; };

  const setupScreen = () => message("Almost ready", "Film Production isn’t connected to its database yet. Open SETUP.md in this folder, follow the steps, then add your keys to config.js.");
  const fileScreen = () => message("Open it from a web address", "Sign-in needs a web address. Run “python3 -m http.server 8000” in this folder and open http://localhost:8000, or use the GitHub Pages address.");
  const errorScreen = text => message("Something went wrong", text,
    button("Try again", "btn btn-primary", () => refresh()), button("Sign out", "btn btn-ghost", signOut));

  /* ---------- Discord check ---------- */
  async function check() {
    const { data, error } = await client.functions.invoke("discord-access");
    if (error) {
      let text = "Couldn’t check your Discord membership.";
      try { text = (await error.context.json()).error || text; } catch {}
      if (/not found|FunctionsFetchError|Failed to send/i.test(text + error.name)) text = "The discord-access function isn’t deployed yet. See SETUP.md.";
      throw new Error(text);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function refresh() {
    const { data: { session } } = await client.auth.getSession();
    if (!session) { status = "signed-out"; me = null; showApp(); return onReady(); }

    let result;
    try { result = await check(); }
    catch (error) { return showGate(errorScreen(error.message)); }

    me = { id: session.user.id, name: result.name, avatar: result.avatar, isAdmin: result.isAdmin };
    status = result.isMember ? "member" : "not-member";
    showApp();
    onReady();
  }

  /* While the site is open, ask Discord again, so leaving the server or losing the admin role takes effect. */
  function watch() {
    const again = async () => {
      if (status === "signed-out" || document.hidden) return;
      try {
        const result = await check();
        if (result.isMember !== (status === "member") || result.isAdmin !== Boolean(me?.isAdmin)) location.reload();
      } catch {}
    };
    setInterval(again, RECHECK_EVERY);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) again(); });
  }

  /* Discord sends people back with ?error=... (or #error=...) when something went wrong. Say what, instead of silently showing sign-in again. */
  function returnedError() {
    const params = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.replace(/^#/, ""));
    const text = params.get("error_description") || hash.get("error_description") || params.get("error") || hash.get("error");
    if (!text) return "";
    history.replaceState(null, "", location.pathname);
    if (/database error saving new user|not_invited/i.test(text)) return "The database still has the old invite-only rule. Run supabase/step7_discord.sql in the Supabase SQL Editor, then sign in again.";
    if (/email/i.test(text)) return `Discord didn’t share a verified email address, which Supabase needs to create your account. Verify the email on your Discord account, then try again. (${text})`;
    if (/redirect/i.test(text)) return `Discord or Supabase doesn’t accept the return address. Check the redirect URLs in SETUP.md. (${text})`;
    return text;
  }

  async function start(callback) {
    onReady = callback;
    if (!configured) return showGate(setupScreen());
    if (location.protocol === "file:") return showGate(fileScreen());
    const problem = returnedError();
    client = supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } });
    client.auth.onAuthStateChange(event => { if (event === "SIGNED_OUT") location.reload(); });
    watch();
    if (problem) return showGate(message("Couldn’t sign you in", problem, button("Back", "btn btn-primary", () => location.replace(location.pathname))));
    await refresh();
  }

  const signIn = () => client.auth.signInWithOAuth({ provider: "discord", options: { redirectTo: siteUrl() } });

  async function signOut() {
    await client.auth.signOut();
    location.reload();
  }

  return { start, signIn, signOut, siteUrl, isAdmin, status: () => status, me: () => me, profile: () => (status === "member" ? me : null), client: () => client };
})();
