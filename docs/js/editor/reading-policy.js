import { getUnqualifiedAttr, isTeiElement, walk } from "./tei-document.js";

const whitespaceCache = new WeakMap();

/** Each alternative is retained in source; the reading shows one branch per container. */
export function readingCellVisible(cell, variant = "dipl") {
  let child = cell.node;
  for (let parent = child?.parent; parent; child = parent, parent = parent.parent) {
    if (!isTeiElement(parent) || !["choice", "app"].includes(parent.localName)) continue;
    const branches = (parent.children || []).filter((node) => isTeiElement(node));
    const priority = parent.localName === "app" ? ["lem", "rdg"]
      : variant === "norm" ? ["reg", "corr", "expan", "orig", "sic", "abbr"]
        : ["orig", "sic", "abbr", "reg", "corr", "expan"];
    const selected = priority.map((name) => branches.find((node) => node.localName === name)).find(Boolean) || branches[0];
    if (child !== selected) return false;
  }
  return true;
}

function token(cell) {
  for (let node = cell?.node?.parent; node; node = node.parent) {
    if (isTeiElement(node) && ["w", "pc"].includes(node.localName)) return node;
  }
  return null;
}

/** Prose keeps source adjacency. Encoded word tokens supply implicit word boundaries. */
export function readingSeparator(doc, previous, cell, variant = "dipl") {
  if (!previous || /\s$/.test(previous.text) || /^\s/.test(cell.text)) return "";
  if (!whitespaceCache.has(doc)) {
    const nodes = [];
    walk(doc.root, (node) => {
      if (node.type === "text" && /^\s+$/.test(doc.raw.slice(node.start, node.end))) nodes.push(node);
    });
    whitespaceCache.set(doc, nodes);
  }
  const nodes = whitespaceCache.get(doc);
  let low = 0, high = nodes.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (nodes[mid].start < previous.end) low = mid + 1;
    else high = mid;
  }
  for (let index = low; index < nodes.length && nodes[index].end <= cell.start; index++) {
    if (readingCellVisible({ node: nodes[index] }, variant)) return " ";
  }
  const left = token(previous), right = token(cell);
  if (!left || !right || left === right || right.localName === "pc") return "";
  if (["right", "both"].includes(getUnqualifiedAttr(left, "join"))
    || ["left", "both"].includes(getUnqualifiedAttr(right, "join"))) return "";
  return " ";
}
