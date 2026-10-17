/* Visualize tab: switches between mood boards, story boards and shot lists. */
const Visualize = (() => {
  const { el } = Dom;
  const SECTIONS = [
    { id: "moods", label: "Mood boards", render: MoodBoards.render },
    { id: "story", label: "Story boards", render: StoryBoard.render },
    { id: "shots", label: "Shot lists", render: ShotList.render },
  ];
  let active = "moods";

  function render(root, project) {
    const nav = el("div", "subtabs");
    SECTIONS.forEach(s => {
      const b = el("button", "subtab", s.label);
      b.setAttribute("aria-pressed", s.id === active);
      b.onclick = () => { active = s.id; render(root, project); };
      nav.append(b);
    });
    const body = el("div");
    SECTIONS.find(s => s.id === active).render(body, project);
    root.replaceChildren(nav, body);
  }
  return { render };
})();
