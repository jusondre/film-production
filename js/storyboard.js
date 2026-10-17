/* Story board: ordered frames, each with an image and a caption. Drag a frame's header to reorder. */
const StoryBoard = (() => {
  const { el, uid } = Dom;

  function render(root, project) {
    project.frames ||= [];
    const save = () => { Projects.persist(); render(root, project); };

    const head = el("div", "vis-head");
    const blank = el("button", "btn btn-ghost edit-only", "Add blank frame");
    blank.onclick = () => { project.frames.push({ id: uid(), src: "", caption: "" }); save(); };
    const upload = el("button", "btn btn-primary", "Add images");
    upload.onclick = () => Images.pick({ multiple: true }).then(srcs => {
      srcs.forEach(src => project.frames.push({ id: uid(), src, caption: "" })); save();
    });
    const n = project.frames.length;
    head.append(el("h3", null, "Story board"), el("span", "hint", n === 1 ? "1 frame" : `${n} frames`), el("span", "spacer"), blank, upload);

    if (!n) {
      const box = el("div", "empty");
      box.append(el("h3", null, "Sketch the story"), el("p", null, "Add frames in order and describe what happens in each one."));
      return root.replaceChildren(head, box);
    }
    const grid = el("div", "frames");
    project.frames.forEach((f, i) => grid.append(frame(project, f, i, save)));
    root.replaceChildren(head, grid);
  }

  function frame(project, f, index, save) {
    const card = el("article", "frame");

    const head = el("div", "frame-head");
    head.draggable = Projects.canEdit() && !matchMedia("(pointer: coarse)").matches; head.title = "Drag to reorder";
    head.ondragstart = e => { e.dataTransfer.setData("text/plain", f.id); e.dataTransfer.setDragImage(card, 20, 20); };
    const rm = el("button", "icon-btn", "×"); rm.ariaLabel = "Remove frame";
    rm.onclick = () => { project.frames = project.frames.filter(x => x !== f); save(); };
    // Touch screens can't drag, so frames also get earlier / later buttons there.
    const move = (label, text, step) => {
      const b = el("button", "icon-btn touch-only", text); b.type = "button"; b.ariaLabel = label;
      b.onclick = () => {
        const from = project.frames.indexOf(f), to = from + step;
        if (to < 0 || to >= project.frames.length) return;
        project.frames.splice(to, 0, project.frames.splice(from, 1)[0]); save();
      };
      return b;
    };
    const tools = el("span", "frame-tools");
    tools.append(move("Move frame earlier", "‹", -1), move("Move frame later", "›", 1), rm);
    head.append(el("span", null, `Frame ${index + 1}`), tools);

    const pic = el("button", "pic");
    if (f.src) { const img = el("img"); img.src = f.src; img.alt = ""; pic.append(img); } else pic.textContent = "Add image";
    pic.onclick = () => Images.pick().then(([src]) => { if (src) { f.src = src; save(); } });

    const caption = el("textarea", "frame-caption");
    caption.readOnly = !Projects.canEdit(); caption.placeholder = "What happens in this frame?"; caption.value = f.caption; caption.ariaLabel = "Caption";
    caption.oninput = () => { f.caption = caption.value; };
    caption.onchange = () => Projects.persist();

    card.ondragover = e => { e.preventDefault(); card.classList.add("is-over"); };
    card.ondragleave = () => card.classList.remove("is-over");
    card.ondrop = e => {
      e.preventDefault();
      const from = project.frames.findIndex(x => x.id === e.dataTransfer.getData("text/plain"));
      if (from < 0) return card.classList.remove("is-over");
      const [moved] = project.frames.splice(from, 1);
      project.frames.splice(project.frames.indexOf(f), 0, moved);
      save();
    };
    card.append(head, pic, caption);
    return card;
  }

  return { render };
})();
