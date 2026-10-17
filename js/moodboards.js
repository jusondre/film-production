/* Mood boards: named boards of reference images. */
const MoodBoards = (() => {
  const { el, uid } = Dom;
  let activeId = null;

  function render(root, project) {
    project.moods ||= [];
    if (!project.moods.some(b => b.id === activeId)) activeId = project.moods[0]?.id || null;

    const pills = el("div", "pill-row");
    project.moods.forEach(b => {
      const pill = el("button", "pill", b.name);
      pill.setAttribute("aria-pressed", b.id === activeId);
      pill.onclick = () => { activeId = b.id; render(root, project); };
      pills.append(pill);
    });
    const add = el("button", "link-btn edit-only", "New board");
    add.onclick = async () => {
      const name = await Dialogs.ask({ title: "New mood board", label: "Name", placeholder: "e.g. Winter light" });
      if (!name) return;
      const board = { id: uid(), name, images: [] };
      project.moods.push(board); activeId = board.id;
      Projects.persist(); render(root, project);
    };
    pills.append(add);

    const board = project.moods.find(b => b.id === activeId);
    root.replaceChildren(pills, board ? boardView(root, project, board) : empty());
  }

  function empty() {
    const box = el("div", "empty");
    box.append(el("h3", null, "Set the look"), el("p", null, "Create a board and fill it with images that capture the mood, light and color of your film."));
    return box;
  }

  function boardView(root, project, board) {
    const wrap = el("div");
    const head = el("div", "vis-head");
    const name = el("input", "title-input"); name.value = board.name; name.ariaLabel = "Board name"; name.readOnly = !Projects.canEdit();
    name.onchange = () => { board.name = name.value.trim() || board.name; Projects.persist(); render(root, project); };
    const del = el("button", "btn btn-ghost edit-only", "Delete board");
    del.onclick = () => {
      if (!confirm(`Delete “${board.name}” and its images?`)) return;
      project.moods = project.moods.filter(b => b !== board);
      Projects.persist(); render(root, project);
    };
    const add = el("button", "btn btn-primary", "Add images");
    add.onclick = () => Images.pick({ multiple: true }).then(srcs => {
      srcs.forEach(src => board.images.push({ id: uid(), src }));
      Projects.persist(); render(root, project);
    });
    head.append(name, del, add);

    const grid = el("div", "masonry");
    board.images.forEach(image => {
      const tile = el("figure", "tile");
      const img = el("img"); img.src = image.src; img.alt = "";
      const rm = el("button", "tile-remove", "×"); rm.ariaLabel = "Remove image";
      rm.onclick = () => { board.images = board.images.filter(i => i !== image); Projects.persist(); render(root, project); };
      tile.append(img, rm); grid.append(tile);
    });
    wrap.append(head, board.images.length ? grid : el("p", "hint", "No images yet. Add a few to get started."));
    return wrap;
  }

  return { render };
})();
