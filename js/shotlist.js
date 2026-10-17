/* Shot lists: scenes with a table of shots. Click a shot to edit size, lens, movement, framing and more. */
const ShotList = (() => {
  const { $, el, uid } = Dom;

  const SIZES = [
    { group: "Close-ups", items: [["Extreme Close-up", "ECU"], ["Medium Close-up", "MCU"], ["Full Close-up", "FCU"], ["Wide Close-up", "WCU"]] },
    { group: "Medium shots", items: [["Close Shot", "CS"], ["Medium Close Shot", "MCS"], ["Medium Shot", "MS"]] },
    { group: "Full shots", items: [["Medium Full Shot", "MFS"], ["Full Shot", "FS"]] },
    { group: "Long shots", items: [["Wide Shot", "WS"], ["Long Shot", "LS"], ["Extreme Long Shot", "ELS"]] },
  ];
  const FRAMING = ["Over the shoulder", "Over the hip", "Two shot", "Three shot", "Point of view"];
  const FOCUS = ["Rack focus", "Shallow focus", "Deep focus", "Tilt-shift", "Zoom", "Dutch"];
  const HEIGHT = ["Eye level", "Low angle", "High angle", "Bird’s-eye view", "Overhead", "Shoulder level", "Hip level", "Knee level", "Ground level"];
  const SHORT = Object.fromEntries(SIZES.flatMap(g => g.items));
  const sizeLabel = size => SHORT[size] || size || "";

  let draft = null; // working copy of the shot open in the dialog

  /* ---------- scenes and table ---------- */
  function render(root, project) {
    project.scenes ||= [];
    const save = () => { Projects.persist(); render(root, project); };
    const total = project.scenes.reduce((n, s) => n + s.shots.length, 0);

    const add = el("button", "btn btn-primary", "Add scene");
    add.onclick = async () => {
      const heading = await Dialogs.ask({ title: "New scene", label: "Scene heading", placeholder: "EXT. RIVER - DAY" });
      if (!heading) return;
      project.scenes.push({ id: uid(), heading, shots: [] }); save();
    };
    const head = el("div", "vis-head");
    head.append(el("h3", null, "Shot list"), el("span", "hint", total === 1 ? "1 shot" : `${total} shots`), el("span", "spacer"), add);

    if (!project.scenes.length) {
      const box = el("div", "empty");
      box.append(el("h3", null, "Plan your shots"), el("p", null, "Add a scene, then list each shot with its size, lens and movement."));
      return root.replaceChildren(head, box);
    }
    root.replaceChildren(head, ...project.scenes.map((s, i) => scene(root, project, s, i, save)));
  }

  function scene(root, project, sc, index, save) {
    const section = el("section", "scene");
    const head = el("div", "scene-head");
    const title = el("input", "title-input"); title.value = sc.heading; title.ariaLabel = "Scene heading"; title.readOnly = !Projects.canEdit();
    title.onchange = () => { sc.heading = title.value.trim() || sc.heading; Projects.persist(); };
    const rm = el("button", "icon-btn", "×"); rm.ariaLabel = "Delete scene";
    rm.onclick = () => {
      if (sc.shots.length && !confirm(`Delete “${sc.heading}” and its ${sc.shots.length} shots?`)) return;
      project.scenes = project.scenes.filter(s => s !== sc); save();
    };
    head.append(el("span", "scene-num", `Scene ${index + 1}`), title, rm);

    const table = el("table", "shots");
    const labels = ["Image", "Scene", "Shot", "Description", "Shot size", "Lens", "Movement"];
    const thead = el("thead"), hr = el("tr");
    labels.forEach(l => hr.append(el("th", null, l)));
    thead.append(hr);
    const body = el("tbody");
    sc.shots.forEach((shot, i) => body.append(shotRow(root, project, sc, shot, index, i)));
    table.append(thead, body);

    const wrap = el("div", "table-wrap");
    wrap.append(table);
    const addShot = el("button", "link-btn add-shot", "Add shot");
    addShot.onclick = () => openShot(root, project, sc);
    section.append(head, sc.shots.length ? wrap : el("p", "hint", "No shots in this scene yet."), addShot);
    return section;
  }

  function shotRow(root, project, sc, shot, sceneIndex, shotIndex) {
    const tr = el("tr"); tr.tabIndex = 0; tr.dataset.no = `Scene ${sceneIndex + 1}, shot ${shotIndex + 1}`;
    tr.onclick = () => openShot(root, project, sc, shot);
    tr.onkeydown = e => { if (e.key === "Enter") tr.click(); };

    const pic = el("td");
    if (shot.src) { const img = el("img", "thumb"); img.src = shot.src; img.alt = ""; pic.append(img); }
    else pic.append(el("span", "thumb thumb-empty"));

    const desc = el("td");
    desc.append(el("div", null, shot.description || "Untitled shot"));
    const extra = [...shot.framing, ...shot.focus, shot.height].filter(Boolean).join(", ");
    if (extra) desc.append(el("div", "details", extra));

    const size = el("td", null, sizeLabel(shot.size)); size.title = shot.size;
    tr.append(pic, el("td", "num", String(sceneIndex + 1)), el("td", "num", String(shotIndex + 1)),
      desc, size, el("td", null, shot.lens), el("td", null, shot.movement));
    return tr;
  }

  /* ---------- shot dialog ---------- */
  function openShot(root, project, sc, shot = null) {
    const dialog = $("shot-dialog"), form = $("shot-form");
    draft = shot ? structuredClone(shot)
                 : { src: "", description: "", size: "", lens: "", movement: "", framing: [], focus: [], height: "" };
    $("shot-dialog-title").textContent = shot ? "Edit shot" : "Add shot";
    $("shot-delete").hidden = !shot;

    form.elements.description.value = draft.description;
    form.elements.lens.value = draft.lens;
    form.elements.movement.value = draft.movement;
    const isCustom = draft.size && !SHORT[draft.size];
    form.elements.customSize.value = isCustom ? draft.size : "";
    form.elements.customSize.oninput = () => { draft.size = ""; renderChips(); };
    renderImage(); renderChips();

    form.onsubmit = () => {
      Object.assign(draft, {
        description: form.elements.description.value.trim(), lens: form.elements.lens.value.trim(),
        movement: form.elements.movement.value.trim(),
        size: form.elements.customSize.value.trim() || draft.size,
      });
      if (shot) Object.assign(shot, draft);
      else sc.shots.push({ id: uid(), ...draft });
      Projects.persist(); render(root, project);
    };
    $("shot-delete").onclick = () => {
      sc.shots = sc.shots.filter(s => s !== shot);
      Projects.persist(); dialog.close(); render(root, project);
    };
    dialog.returnValue = "";
    Dialogs.review(dialog, Boolean(shot), { id: "shot-dialog-title", view: "Shot", edit: "Edit shot" });
    dialog.showModal();
  }

  function renderImage() {
    const box = $("shot-image"), pic = el("button", "pic");
    pic.type = "button";
    if (draft.src) { const img = el("img"); img.src = draft.src; img.alt = ""; pic.append(img); } else pic.textContent = "Add image";
    pic.onclick = () => Images.pick({ max: 480 }).then(([src]) => { if (src) { draft.src = src; renderImage(); } });
    box.replaceChildren(pic);
    if (draft.src) {
      const remove = el("button", "link-btn", "Remove image"); remove.type = "button";
      remove.onclick = () => { draft.src = ""; renderImage(); };
      box.append(remove);
    }
  }

  function chip(label, pressed, onClick) {
    const b = el("button", "chip", label); b.type = "button";
    b.setAttribute("aria-pressed", pressed); b.onclick = onClick;
    return b;
  }
  const toggle = (list, value) => list.includes(value) ? list.filter(v => v !== value) : [...list, value];

  function renderChips() {
    $("shot-sizes").replaceChildren(...SIZES.map(g => {
      const col = el("div", "chip-group"), chips = el("div", "chips");
      chips.append(...g.items.map(([name]) => chip(name, draft.size === name, () => {
        draft.size = draft.size === name ? "" : name;
        $("shot-form").elements.customSize.value = "";
        renderChips();
      })));
      col.append(el("h5", null, g.group), chips);
      return col;
    }));
    $("shot-framing").replaceChildren(...FRAMING.map(v => chip(v, draft.framing.includes(v), () => { draft.framing = toggle(draft.framing, v); renderChips(); })));
    $("shot-focus").replaceChildren(...FOCUS.map(v => chip(v, draft.focus.includes(v), () => { draft.focus = toggle(draft.focus, v); renderChips(); })));
    $("shot-height").replaceChildren(...HEIGHT.map(v => chip(v, draft.height === v, () => { draft.height = draft.height === v ? "" : v; renderChips(); })));
  }

  return { render };
})();
