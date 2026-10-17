/* Theme: light/dark, remembers the choice, defaults to the system setting. */
const Theme = (() => {
  const button = () => document.getElementById("theme-toggle");

  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    button().textContent = theme === "dark" ? "Light mode" : "Dark mode";
  }
  function init(saved, onChange) {
    const system = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    apply(saved || system);
    button().addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      apply(next);
      onChange(next);
    });
  }
  return { init };
})();
