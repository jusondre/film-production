/* Dom: tiny helpers shared by every tab. */
const Dom = (() => {
  const $ = id => document.getElementById(id);
  const uid = () => crypto.randomUUID();
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  return { $, el, uid };
})();
