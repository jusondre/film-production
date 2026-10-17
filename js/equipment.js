/* Equipment tab: a searchable list of gear with its details. Saved with the project in the database. */
const Equipment = (() => {
  const { $, el, uid } = Dom;
  const CATEGORIES = ["Camera", "Lens", "Lighting", "Grip", "Audio", "Power", "Media & storage", "Monitoring", "Props", "Wardrobe", "Other"];
  const SOURCES = ["Owned", "Rented", "Borrowed", "To buy"];
  const STATUSES = ["Needed", "Reserved", "Confirmed", "Returned"];
  const TEXT = ["name", "supplier", "cost", "notes"];
  let query = ""; // search text, kept while switching tabs

  function render(root, project) {
    project.equipment ||= [];
    const count = project.equipment.length;

    const title = el("div", "crew-title");
    title.append(el("h3", null, "Equipment"), el("span", "crew-count", count === 1 ? "1 item" : `${count} items`));
    const search = el("input", "search");
    search.type = "search"; search.value = query; search.ariaLabel = "Search equipment";
    search.placeholder = "Search equipment";
    const add = el("button", "btn btn-primary", "Add equipment");
    add.onclick = () => openDialog(root, project);
    const head = el("div", "crew-head");
    head.append(title, el("span", "spacer"), search, add);

    const list = el("div", "eq-list");
    search.oninput = () => { query = search.value; drawList(list, root, project); };
    drawList(list, root, project);
    root.replaceChildren(head, list);
  }

  function drawList(list, root, project) {
    const q = query.trim().toLowerCase();
    if (!project.equipment.length) {
      const empty = el("div", "empty");
      empty.append(el("h3", null, "What gear do you need?"),
        el("p", null, "List cameras, lenses, lights, sound gear and anything else, with who supplies it and where it stands."));
      return list.replaceChildren(empty);
    }
    const items = project.equipment.filter(i =>
      [i.name, i.category, i.source, i.status, i.supplier, i.cost, i.notes].join(" ").toLowerCase().includes(q));
    if (!items.length) return list.replaceChildren(el("p", "hint", `Nothing matches “${query.trim()}”.`));

    const labels = el("div", "eq-row eq-labels");
    ["Item", "Qty", "Source", "Status", "Supplier or owner"].forEach(l => labels.append(el("span", null, l)));
    list.replaceChildren(labels, ...items.map(i => row(root, project, i)));
  }

  const cell = (text, cls) => text ? el("span", cls, text) : el("span", "eq-none", "–");

  function row(root, project, item) {
    const r = el("div", "eq-row"); r.tabIndex = 0; r.role = "button";
    const info = el("span", "crew-info");
    info.append(el("strong", null, item.name), el("small", null, item.category || "No category"));
    const status = el("span", "eq-status", item.status || "Needed");
    status.dataset.status = item.status || "Needed";
    r.append(info, el("span", "eq-qty", String(item.quantity || 1)), cell(item.source), status, cell(item.supplier));
    r.onclick = () => openDialog(root, project, item);
    r.onkeydown = e => { if (e.key === "Enter" && e.target === r) openDialog(root, project, item); };
    return r;
  }

  function openDialog(root, project, item = null) {
    const dialog = $("equipment-dialog"), form = $("equipment-form"), f = form.elements;
    $("equipment-dialog-title").textContent = item ? "Edit equipment" : "Add equipment";
    $("equipment-delete").hidden = !item;
    const fill = (select, values) => select.replaceChildren(...values.map(v => new Option(v, v)));
    fill(f.category, CATEGORIES); fill(f.source, SOURCES); fill(f.status, STATUSES);

    for (const key of TEXT) f[key].value = item?.[key] || "";
    f.category.value = item?.category || CATEGORIES[0];
    f.source.value = item?.source || SOURCES[0];
    f.status.value = item?.status || STATUSES[0];
    f.quantity.value = item?.quantity || 1;

    form.onsubmit = () => {
      const fields = Object.fromEntries(TEXT.map(k => [k, f[k].value.trim()]));
      Object.assign(fields, {
        category: f.category.value, source: f.source.value, status: f.status.value,
        quantity: Math.max(1, parseInt(f.quantity.value, 10) || 1),
      });
      if (item) Object.assign(item, fields);
      else project.equipment.push({ id: uid(), ...fields });
      Projects.persist(true); render(root, project);
    };
    $("equipment-delete").onclick = () => {
      project.equipment = project.equipment.filter(i => i !== item);
      Projects.persist(true); dialog.close(); render(root, project);
    };
    dialog.returnValue = "";
    dialog.showModal();
  }

  return { render };
})();
