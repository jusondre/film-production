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
  return { ask };
})();
