/* Storage: this browser's own preferences only (theme, last project). Project data lives in the database. */
const Storage = (() => {
  const KEY = "film-production:prefs";
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  }
  function save(prefs) {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
  }
  return { load, save };
})();
