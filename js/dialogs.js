/* Dialogs: a reusable "type a name" prompt. Resolves with the text, or null if cancelled. */
const Dialogs = (() => {
  function ask({ title, label, placeholder = "", confirm = "Create" }) {
    const { $ } = Dom;
    return new Promise(resolve => {
      const dialog = $("prompt-dialog"), form = $("prompt-form");
      $("prompt-title").textContent = title;
      $("prompt-label").textContent = label;
      $("prompt-ok").textContent = confirm;
      form.reset();
      form.elements.value.placeholder = placeholder;
      dialog.returnValue = "";
      dialog.onclose = () => resolve(dialog.returnValue === "ok" ? form.elements.value.value.trim() : null);
      dialog.showModal();
    });
  }
  /* Read mode. Existing items open locked: no typing, no cursor, a Close button, and for people who can edit an Edit button.
     New items open ready to type. title = { id, view, edit } swaps the heading between the two modes. */
  const titles = new WeakMap(), hooked = new WeakSet();

  function setLocked(dialog, locked) {
    dialog.classList.toggle("is-readonly", locked);
    dialog.querySelectorAll("input, select, textarea").forEach(c => {
      if (locked) { if (!c.disabled) { c.disabled = true; c.dataset.locked = "1"; } }   // only unlock what we locked
      else if (c.dataset.locked) { c.disabled = false; delete c.dataset.locked; }
    });
    const cancel = dialog.querySelector(".dialog-actions [data-cancel]");
    if (cancel) cancel.textContent = locked ? "Close" : "Cancel";
    const t = titles.get(dialog);
    if (t) t.node.textContent = locked ? t.view : t.edit;
  }

  function review(dialog, existing, title) {
    if (!hooked.has(dialog)) {
      hooked.add(dialog);
      dialog.addEventListener("close", () => { dialog.querySelector(".dialog-edit")?.remove(); setLocked(dialog, false); });
    }
    dialog.querySelector(".dialog-edit")?.remove();
    if (existing && title) titles.set(dialog, { node: document.getElementById(title.id), view: title.view, edit: title.edit });
    else titles.delete(dialog);
    if (!existing) return setLocked(dialog, false);

    setLocked(dialog, true);
    if (Projects.canEdit()) {
      const edit = Dom.el("button", "btn btn-primary dialog-edit", "Edit");
      edit.type = "button";
      edit.onclick = () => { setLocked(dialog, false); edit.remove(); };
      dialog.querySelector(".dialog-actions").append(edit);
    }
  }
  return { ask, review };
})();
