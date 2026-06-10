/**
 * teiCrafter Editor -- tiny shared DOM helpers.
 *
 * One source for the element builder and node clearing that editor-app.js,
 * index-panel.js and authority-form.js previously each carried as a local
 * copy. Pure DOM, no project imports.
 */

/**
 * Build an element. Recognised props: class, text, html, on<event> functions,
 * dataset (object); everything else becomes an attribute (null/undefined skipped).
 * Children: string (text node) or Node, single value or array, null skipped.
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "dataset") for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
    else if (v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

/** Remove all children of a node. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
