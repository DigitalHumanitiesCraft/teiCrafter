/**
 * The start page's gallery of editions built on teiCrafter, rendered from
 * data/derivations.json. Every string reaches the page through textContent;
 * an entry without a public URL gets no open link.
 */

export const FORM_LABELS = Object.freeze({
  base: "Base application",
  fork: "Fork that merges the base",
  standalone: "Standalone editor",
});

const KNOWLEDGE_URL = "https://github.com/DigitalHumanitiesCraft/teiCrafter/blob/main/knowledge/derivation.md";
const FIELDS = ["id", "title", "form", "data", "licence", "status", "caseAnchor"];

/**
 * Validated card descriptions; an entry that breaks the contract throws, so a
 * malformed file shows no gallery rather than a misleading one.
 * @param {unknown} entries Parsed derivations.json.
 */
export function galleryCards(entries) {
  if (!Array.isArray(entries)) throw new Error("derivations.json must hold an array");
  return entries.map((entry, index) => {
    for (const field of FIELDS) {
      if (typeof entry?.[field] !== "string" || !entry[field].trim()) throw new Error(`entry ${index} lacks ${field}`);
    }
    if (!(entry.form in FORM_LABELS)) throw new Error(`entry ${entry.id} has an unknown form ${entry.form}`);
    if (!Array.isArray(entry.demonstrates) || !entry.demonstrates.every((d) => typeof d === "string" && d.trim())) {
      throw new Error(`entry ${entry.id} needs a list of demonstrated capabilities`);
    }
    for (const field of ["url", "licenceNotice"]) {
      if (entry[field] !== null && (typeof entry[field] !== "string" || !entry[field].trim())) {
        throw new Error(`entry ${entry.id} has an invalid ${field}`);
      }
    }
    // Only same-site relative targets: the gallery never links a public visitor elsewhere unannounced.
    for (const field of ["url", "licenceNotice"]) {
      if (entry[field] && /^[a-z][a-z0-9+.-]*:|^\/\//i.test(entry[field])) throw new Error(`entry ${entry.id} has an absolute ${field}`);
    }
    return {
      id: entry.id,
      title: entry.title,
      formLabel: FORM_LABELS[entry.form],
      demonstrates: [...entry.demonstrates],
      data: entry.data,
      licence: entry.licence,
      licenceNotice: entry.licenceNotice,
      open: entry.url,
      status: entry.status,
      notes: `${KNOWLEDGE_URL}#${entry.caseAnchor}`,
    };
  });
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Replace the container's content with one card per entry. */
export function renderGallery(container, cards) {
  const items = cards.map((card) => {
    const item = element("li", "lp-ed");
    item.dataset.derivation = card.id;
    const head = element("div", "lp-ed-head");
    head.append(element("h3", "", card.title), element("span", "lp-ed-status", card.status));
    const list = element("ul", "lp-ed-shows");
    list.append(...card.demonstrates.map((text) => element("li", "", text)));
    const facts = element("dl", "lp-ed-facts");
    const licence = element("dd", "", card.licence);
    if (card.licenceNotice) {
      const notice = element("a", "", "licence notice");
      notice.href = card.licenceNotice;
      licence.append(", ", notice);
    }
    facts.append(element("dt", "", "Form"), element("dd", "", card.formLabel), element("dt", "", "Data"), element("dd", "", card.data), element("dt", "", "Licence"), licence);
    const links = element("p", "lp-ed-links");
    if (card.open) {
      const open = element("a", "lp-ed-open", "Open in the editor");
      open.href = card.open;
      links.append(open);
    }
    const notes = element("a", "", "Derivation notes on GitHub");
    notes.href = card.notes;
    notes.rel = "noopener";
    links.append(notes);
    item.append(head, list, facts, links);
    return item;
  });
  container.replaceChildren(...items);
}
