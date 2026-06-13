/**
 * teiCrafter Editor -- annotation UI on the reading text.
 *
 * Everything that opens at the text under the M2.10 editor paradigm: the
 * Oxygen-style right-click context menu, the evidence-first annotate popover
 * on a finished selection (M2.8), the annotation editor on a clicked mention
 * (with in-place authority editing, M2.11), and the word-profile entity
 * picker. Extracted from editor-app.js in the M2.13 module split; the
 * behaviour is unchanged. Every mutation routes through the integrator's
 * commitStandoff (lossless splice, SAME-doc no-op contract, exactly one
 * re-render on a real change).
 *
 * Contract:
 *   createAnnotationUi(ctx) -> {
 *     openContextMenu, openSelPopover, openAnnotationEditor,
 *     openAnnotationEditorFor, removeSelPopover, removeMenu,
 *   }
 *   ctx: {
 *     app,                        // shared mutable editor state
 *     setStatus(msg),
 *     commitStandoff(fn, { label, failPrefix, noopLabel }) -> bool,
 *     entityMetaMap(),            // id -> { name, kind, ai }
 *     entityUsage(),              // id -> { count, onPage }
 *     revealEntity(id),           // switch the right pane to the index, scrolled to an entry
 *     highlightMentions(entity),
 *     beginTextInput(span, cell), beginNote(span, cell), beginCritic(span, cell),
 *     ensureGuidelines() -> Promise<g|null>,  // lazy TEI vocabulary (null on failure)
 *     guidelinesNow() -> g|null,              // the loaded vocabulary, if any
 *   }
 *   Wires its own global listeners (mouseup selection, Escape, contextmenu).
 */

import { el, clear } from "./dom.js";
import * as standoff from "./standoff.js";
import { parseEdition, rawRangeForDisplay, unescapeXmlText, attrTargetForCell } from "./edition.js";
import { addAttr, editAttrValue, removeAttr } from "./tei-document.js";
import { elementByName, isW3cDateAttr, w3cDateReason } from "./tei-guidelines.js";
import { buildAuthorityForm } from "./authority-form.js";
import { runAuthorityLookup } from "./authority-picker.js";
import { requireCtx } from "./ctx.js";

const ENTITY_TYPE_LABELS = [
  ["person", "person"], ["place", "place"], ["org", "organisation"],
  ["work", "work"], ["event", "event"],
];

const TYPE_LABEL = { pers: "person", plc: "place", org: "organisation", wrk: "work", evt: "event" };

// Full-TEI markup wraps (no standOff entity): the scholarly elements first,
// then any element by name. Each build keeps the reading text byte-identical
// (enforced by standoff.wrapRange).
const MARKUP_WRAPS = [
  ["persName", (inner) => `<persName>${inner}</persName>`],
  ["persName + forename/surname", (inner) => {
    const m = inner.match(/^(\s*)([\s\S]*\S)(\s+)(\S+)(\s*)$/);
    if (!m) return `<persName>${inner}</persName>`;
    return `${m[1]}<persName><forename>${m[2]}</forename>${m[3]}<surname>${m[4]}</surname></persName>${m[5]}`;
  }],
  ["placeName", (inner) => `<placeName>${inner}</placeName>`],
  ["orgName", (inner) => `<orgName>${inner}</orgName>`],
  ["date", (inner) => `<date>${inner}</date>`],
  ["term", (inner) => `<term>${inner}</term>`],
  ["foreign", (inner) => `<foreign>${inner}</foreign>`],
  ["hi", (inner) => `<hi>${inner}</hi>`],
  ["title", (inner) => `<title>${inner}</title>`],
];

function allEntityIds(doc) {
  const all = standoff.readEntities(doc);
  return ["persons", "places", "orgs", "works", "events"]
    .flatMap((k) => (all[k] || []).map((e) => e.id));
}

// Persistent annotate highlight. The native selection stops being painted the
// moment the popover takes focus, so a focus-independent CSS Custom Highlight
// keeps the selected range visible (blue fill + underline, see ::highlight in
// editor.css) for as long as the popover is open. Cleared when the popover closes
// or a real change re-renders. Degrades silently where the API is absent (the
// Chromium target supports it); the range is cloned so it survives focus moving.
const HL_ANNOTATE = "ed-annotate";
function setAnnotateHighlight(range) {
  if (!range || typeof Highlight === "undefined" || !window.CSS || !CSS.highlights) return;
  try { CSS.highlights.set(HL_ANNOTATE, new Highlight(range)); } catch { /* unsupported range */ }
}
function clearAnnotateHighlight() {
  if (window.CSS && CSS.highlights) CSS.highlights.delete(HL_ANNOTATE);
}

export function createAnnotationUi(ctx) {
  requireCtx("createAnnotationUi", ctx,
    ["setStatus", "commitStandoff", "entityMetaMap", "entityUsage",
     "revealEntity", "highlightMentions", "beginTextInput", "beginNote", "beginCritic",
     "ensureGuidelines", "guidelinesNow"], ["app", "author"]);
  const {
    app, setStatus, commitStandoff,
    entityMetaMap, entityUsage, revealEntity,
    highlightMentions, beginTextInput, beginNote, beginCritic,
    ensureGuidelines, guidelinesNow, author,
  } = ctx;

  const reading = () => document.getElementById("ed-reading");

  // A project manifest's markup list replaces the built-in wraps; it binds to
  // the document's type within the project (resolved at load into app.markup,
  // same [label, build] shape, produced by project-manifest.js).
  const markupWraps = () => app.markup || MARKUP_WRAPS;

  function removeMenu() {
    const old = document.getElementById("ed-menu");
    if (old) old.remove();
  }

  function removeSelPopover() {
    clearAnnotateHighlight();
    const old = document.getElementById("ed-sel-pop");
    if (old) old.remove();
  }

  /** The full entity record for an id, or null. */
  function findEntity(id) {
    const all = standoff.readEntities(app.state.doc);
    return ["persons", "places", "orgs", "works", "events"]
      .flatMap((k) => all[k] || [])
      .find((e) => e.id === id) || null;
  }

  /** Anchor a popover at a viewport rect, inside the scrolling reading pane. */
  function anchorPopAt(pop, rect, host) {
    const hostRect = host.getBoundingClientRect();
    host.appendChild(pop);
    pop.style.left = Math.max(0, Math.min(rect.left - hostRect.left, host.clientWidth - pop.offsetWidth - 8)) + "px";
    pop.style.top = (rect.bottom - hostRect.top + host.scrollTop + 6) + "px";
  }

  /**
   * Oxygen-style right-click menu on the reading text. Contextual: a live
   * selection offers annotation; an annotated element offers its editor; every
   * cell offers edit / note / mark. Closes on click elsewhere or Escape.
   */
  function openContextMenu(x, y, span, cell) {
    removeMenu();
    removeSelPopover();
    const menu = el("div", { class: "ed-menu", id: "ed-menu" });
    const item = (label, fn, opts = {}) => {
      const b = el("button", { class: "ed-menu-item", text: label });
      if (opts.disabled) { b.disabled = true; if (opts.title) b.title = opts.title; }
      else b.addEventListener("click", (e) => { e.stopPropagation(); removeMenu(); fn(); });
      menu.appendChild(b);
    };

    // The normalized display text does not map to raw offsets, so a selection
    // wrap would splice the wrong bytes: drop the selection-derived entry in the
    // normalized variant; the word-anchored entries below stay available.
    const target = app.readingVariant === "norm" ? null : selectionTarget();
    if (target) {
      const shortText = target.text.length > 28 ? target.text.slice(0, 28) + "..." : target.text;
      item(`Annotate "${shortText}"...`, () => openSelPopover());
    }
    if (cell) {
      const c = () => app.state.cellById.get(cell.id);
      if (cell.mention) item("Edit annotation...", () => { if (c()) openAnnotationEditor(span, c()); });
      if (!cell.gap) {
        item(app.state.profile === "word" ? "Edit word" : "Edit line", () => { if (c()) beginTextInput(span, c()); });
        item("Add note...", () => { if (c()) beginNote(span, c()); });
        item("Mark: unclear / deleted / added / gap...", () => { if (c()) beginCritic(span, c()); });
        if (attrTargetForCell(cell)) {
          item("Edit element attributes...", () => { if (c()) openAttrEditor(span, c()); });
        }
        if (app.state.profile === "word") {
          item("Link this word to an entity...", () => { if (c()) openEntityPickerFor(span, c()); });
        }
      } else {
        item("Remove gap...", () => { if (c()) beginCritic(span, c()); });
      }
    }

    // Structure (Author mode): element-structure acts on the cell's line, kept as
    // a visually separated group of neutral chrome (never the violet --color-ai).
    // Split and insert act at the right-click point; merge and delete on the line.
    // Delete is enabled only when the line element is empty (deleteElement refuses
    // non-empty content). Absent when there is no structural cell to act on.
    if (cell && !cell.gap && author) {
      const c = () => app.state.cellById.get(cell.id);
      menu.appendChild(el("div", { class: "ed-menu-sep ed-menu-group", text: "Structure" }));
      item("Split line here", () => { const cc = c(); if (cc) author.splitLine(x, y, cc); });
      item("Merge with previous", () => { const cc = c(); if (cc) author.mergePrev(cc); });
      item("Insert line break", () => { const cc = c(); if (cc) author.insertLb(x, y, cc); });
      const canDelete = author.isEmpty(cell);
      item("Delete", () => { const cc = c(); if (cc) author.deleteElement(cc); },
        canDelete ? {} : { disabled: true, title: "only an empty element can be deleted" });
    }

    if (!menu.childElementCount) return;

    document.body.appendChild(menu);
    menu.style.left = Math.min(x, window.innerWidth - menu.offsetWidth - 8) + "px";
    menu.style.top = Math.min(y, window.innerHeight - menu.offsetHeight - 8) + "px";
    const onAway = (e) => {
      if (!(e.target instanceof Element && e.target.closest("#ed-menu"))) {
        removeMenu();
        document.removeEventListener("mousedown", onAway, true);
      }
    };
    document.addEventListener("mousedown", onAway, true);
    const onKey = (e) => {
      if (e.key === "Escape") { removeMenu(); document.removeEventListener("keydown", onKey); }
      if (!document.getElementById("ed-menu")) document.removeEventListener("keydown", onKey);
    };
    document.addEventListener("keydown", onKey);
  }

  /** Word-profile whole-cell link via a small anchored entity picker. */
  function openEntityPickerFor(span, cell) {
    const host = reading();
    removeSelPopover();
    const pop = el("div", { class: "ed-sel-pop", id: "ed-sel-pop" });
    pop.appendChild(el("span", { class: "ed-sel-pop-title", text: `link "${cell.text.trim()}"` }));
    buildEntityChoiceRows(pop, cell.text.trim(), (entId) => {
      removeSelPopover();
      commitStandoff(
        (doc) => standoff.linkMention(doc, cell.node, entId),
        { label: `Linked "${cell.text.trim()}" to ${entId}`, failPrefix: "Link",
          noopLabel: "Already linked to this entity" },
      );
    }, null);
    const xBtn = el("button", { class: "ed-act-btn", text: "x", title: "cancel" });
    xBtn.addEventListener("click", (e) => { e.stopPropagation(); removeSelPopover(); });
    pop.appendChild(xBtn);
    anchorPopAt(pop, span.getBoundingClientRect(), host);
  }

  /**
   * Commit a standOff edit from inside the annotation editor, then reopen the
   * editor on the same cell (a real change rebuilds the reading pane, which
   * removes the popover; the cell id is stable across standOff-region edits),
   * so adding several authority ids in a row stays one uninterrupted gesture.
   */
  function commitAndReopen(fn, label, cellId) {
    commitStandoff(fn, { label });
    const c = app.state.cellById.get(cellId);
    const s = c && document.querySelector(`#ed-reading .ed-w[data-id="${CSS.escape(c.id)}"]`);
    if (c && s && c.mention) openAnnotationEditor(s, c);
  }

  /**
   * Clicking an annotated element edits the annotation in place: what it is
   * linked to, the entity's authority ids (add / remove / live lookup, moved
   * here from the index pane, operator decision 2026-06-10), its occurrences,
   * confirm for AI proposals, relink, or remove the link (lossless unwrap).
   */
  function openAnnotationEditor(span, cell) {
    removeSelPopover();
    const host = reading();
    const meta = entityMetaMap().get(cell.mention) || null;
    const entity = findEntity(cell.mention);
    const pop = el("div", { class: "ed-sel-pop", id: "ed-sel-pop" });
    pop.appendChild(el("span", {
      class: "ed-sel-pop-title",
      text: meta
        ? `linked to ${meta.name || "(unnamed)"} (${cell.mention})${meta.ai ? "; AI-proposed, unverified" : ""}`
        : `linked to a missing entity (${cell.mention})`,
    }));

    if (entity) pop.appendChild(buildAuthorityEditor(entity, cell));

    const row = el("div", { class: "ed-sel-pop-row" });
    const btn = (text, title, fn, cls) => {
      const b = el("button", { class: "ed-act-btn" + (cls ? " " + cls : ""), text, title });
      b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
      row.appendChild(b);
    };
    if (entity) {
      const u = entityUsage().get(entity.id);
      const n = u ? u.count : 0;
      btn(`occurrences (${n})`, "highlight every mention of this entity; the first one on another page is reachable via the Index", () => {
        removeSelPopover();
        highlightMentions(entity);
      });
      if (meta && meta.ai) {
        btn("confirm", "accept this AI proposal as verified (removes the violet marking)", () => {
          commitAndReopen(
            (doc) => standoff.confirmEntity(doc, entity.id),
            `Confirmed ${entity.name || entity.id}`,
            cell.id,
          );
        }, "ed-btn-ai");
      }
    }
    btn("open in index", "show this entity in the full index overlay", () => {
      removeSelPopover();
      revealEntity(cell.mention);
    });
    if (entity && meta) {
      // Fix a wrong-type annotation in one step (e.g. "Wien" tagged person, but
      // Q1741 is the city): move the entity to another list, keeping its id and
      // authority ids; the mentions stay linked (they point at the xml:id).
      const KIND_TO_TYPE = { pers: "person", plc: "place", org: "org", wrk: "work", evt: "event" };
      const curType = KIND_TO_TYPE[meta.kind];
      btn("change type...", "make this a different type (person, place, ...), keeping its id and authority ids", () => {
        clear(row);
        row.appendChild(el("span", { class: "ed-act-group", text: "change type to" }));
        for (const [type, label] of [["person", "person"], ["place", "place"], ["org", "organisation"], ["work", "work"], ["event", "event"]]) {
          if (type === curType) continue;
          const b = el("button", { class: "ed-act-btn", text: label,
            title: `Make this a ${label}; id and authority ids stay, mentions stay linked` });
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            commitAndReopen(
              (doc) => standoff.retypeEntity(doc, entity.id, type),
              `Changed ${entity.name || entity.id} to ${label}`,
              cell.id,
            );
          });
          row.appendChild(b);
        }
      });
    }
    btn("relink...", "point this text at a different entity", () => {
      clear(row);
      buildEntityChoiceRows(row, cell.text.trim(), (entId) => {
        removeSelPopover();
        commitStandoff(
          (doc) => standoff.linkMention(doc, cell.node, entId),
          { label: `Relinked "${cell.text.trim()}" to ${entId}`, failPrefix: "Relink",
            noopLabel: "Already linked to this entity" },
        );
      }, cell.mention);
    });
    btn("remove link", "unwrap the <name> around this text (the text itself survives)", () => {
      removeSelPopover();
      commitStandoff(
        (doc) => standoff.unwrapMention(doc, cell.node),
        { label: `Removed the link on "${cell.text.trim()}" (index entry kept)`, failPrefix: "Unlink" },
      );
    });
    btn("x", "close", () => removeSelPopover());
    pop.appendChild(row);
    anchorPopAt(pop, span.getBoundingClientRect(), host);
  }

  /**
   * Authority ids (GND / GeoNames / Wikidata) of the linked entity, editable at
   * the mention: the shared form (authority-form.js, same UI as in the index
   * overlay), committing losslessly and reopening the editor on the same cell.
   *
   * The explicit "find" routes through the shared candidate picker; the human
   * always confirms by clicking a candidate (onPick fills the id field and
   * commits). When the active project opts into reconciliation.auto, the same
   * query fires automatically (debounced) on open and on name changes, querying
   * ONLY the project's declared registers. Auto never applies a candidate: it
   * surfaces the same confirm-by-click list. No network call ever fires without
   * either the explicit click or the project's declared opt-in.
   */
  function buildAuthorityEditor(entity, cell) {
    const applyPick = (authority) => (id) => commitAndReopen(
      (doc) => standoff.setAuthority(doc, entity.id, authority, id),
      `Set ${authority} id on ${entity.name || entity.id}`,
      cell.id,
    );
    const form = buildAuthorityForm(entity, {
      onSet: (authority, value) => commitAndReopen(
        (doc) => standoff.setAuthority(doc, entity.id, authority, value),
        value
          ? `Set ${authority} id on ${entity.name || entity.id}`
          : `Removed ${authority} id from ${entity.name || entity.id}`,
        cell.id,
      ),
      onLookup: (authority, query, anchor, onPick) =>
        runAuthorityLookup(authority, query, anchor, onPick, { onError: setStatus }),
    });
    form.classList.add("ed-sel-auth");
    maybeAutoReconcile(form, entity.name || "", applyPick);
    return form;
  }

  /**
   * Stage 2 auto-reconciliation: when the active project declares
   * reconciliation.auto, fire the candidate lookup for each declared register
   * the moment the authority form is shown, anchored to the add row. Debounced
   * and one-shot per open (the name does not change inside this read-only form);
   * the operator still confirms every match by clicking a candidate.
   */
  function maybeAutoReconcile(form, name, applyPick) {
    const recon = app.project && app.project.reconciliation;
    if (!recon || !recon.auto || !name.trim()) return;
    const anchor = form.querySelector(".ed-idx-authadd");
    if (!anchor) return;
    const register = recon.registers[0];
    if (!register) return;
    clearTimeout(form._reconTimer);
    form._reconTimer = setTimeout(() => {
      if (!anchor.isConnected) return;
      runAuthorityLookup(register, name.trim(), anchor, applyPick(register), { onError: setStatus });
    }, 400);
  }

  // ---- attribute editor -----------------------------------------------------
  // Edits the attributes of a cell's innermost wrapping element (w, an inline
  // wrapper, l). Works entirely on the engine primitives (addAttr,
  // editAttrValue, removeAttr) through commitStandoff. The TEI vocabulary, when
  // loaded, contributes name and closed-value suggestions plus a plain-text
  // description; it never enforces anything, and without it the editor is a
  // fully working free-text attribute editor (the degradation contract).

  function openAttrEditor(span, cell, targetEl) {
    removeMenu();
    removeSelPopover();
    // Default to the cell's innermost wrapping element; the overlap inspector passes
    // an explicit element to edit the attributes of an OUTER layer (e.g. the seg
    // around a persName), not just the innermost wrapper.
    const target = targetEl || attrTargetForCell(cell);
    if (!target) return;
    const host = reading();
    const g = guidelinesNow();
    if (!g) ensureGuidelines(); // arrives for the next open; this one stays free-text
    const spec = g ? elementByName(g, target.localName) : null;
    const attDef = (name) => (spec ? spec.attributes.find((a) => a.ident === name) || null : null);

    // After a real change the reading pane re-rendered (popover gone): reopen
    // on the same cell id so several attribute edits stay one gesture.
    const commitAttr = (fn, opts) => {
      if (!commitStandoff(fn, opts)) return;
      // Reopening on the same cell keeps several attribute edits one gesture, but
      // only for the innermost target: an outer layer's element node is stale after
      // the re-parse, so an explicit-target edit is one-shot (re-inspect to chain).
      if (targetEl) return;
      const c = app.state.cellById.get(cell.id);
      const s = c && document.querySelector(`#ed-reading .ed-w[data-id="${CSS.escape(c.id)}"]`);
      if (c && s) openAttrEditor(s, c);
    };

    const pop = el("div", { class: "ed-sel-pop", id: "ed-sel-pop" });
    pop.appendChild(el("span", { class: "ed-sel-pop-title", text: `attributes of <${target.qname}>` }));

    // Non-blocking validity hint: a date-typed value (@when and the other W3C
    // date attributes) that does not parse shows a warning, but the commit stays
    // enabled (the free-text contract: the editor warns, the human decides).
    const dateReason = (name, def, value) =>
      isW3cDateAttr(name, def) ? w3cDateReason(value) : null;
    const syncWarn = (warn, name, def, value) => {
      const r = dateReason(name, def, value);
      warn.textContent = r ? `! ${r}` : "";
      warn.hidden = !r;
    };

    for (const attr of target.attrs || []) {
      const def = attDef(attr.name);
      const row = el("div", { class: "ed-sel-pop-row ed-attr-row" });
      row.appendChild(el("span", {
        class: "ed-attr-name", text: attr.name,
        title: def && def.desc ? def.desc : "",
      }));
      const input = el("input", { class: "ed-attr-input", type: "text", value: attr.value });
      const warn = el("div", { class: "ed-attr-warn" });
      syncWarn(warn, attr.name, def, attr.value);
      input.addEventListener("input", () => syncWarn(warn, attr.name, def, input.value));
      const apply = () => commitAttr(
        (doc) => editAttrValue(doc, attr, input.value),
        { label: `Set @${attr.name} on <${target.qname}>`, failPrefix: "Set attribute",
          noopLabel: "Attribute unchanged" },
      );
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } });
      row.appendChild(input);
      const setBtn = el("button", { class: "ed-act-btn", text: "set", title: "apply this value" });
      setBtn.addEventListener("click", (e) => { e.stopPropagation(); apply(); });
      row.appendChild(setBtn);
      const rmBtn = el("button", { class: "ed-act-btn", text: "remove", title: "remove this attribute" });
      rmBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        commitAttr(
          (doc) => removeAttr(doc, target, attr.localName),
          { label: `Removed @${attr.name} from <${target.qname}>`, failPrefix: "Remove attribute" },
        );
      });
      row.appendChild(rmBtn);
      pop.appendChild(row);
      pop.appendChild(warn);
    }

    // Add row: free text always works; with the vocabulary loaded the name
    // field suggests the element's resolved attributes and a closed value list
    // suggests its items (hints, never enforcement).
    const nameList = el("datalist", { id: "ed-attr-namelist" });
    if (spec) for (const a of spec.attributes) nameList.appendChild(el("option", { value: a.ident }));
    const valueList = el("datalist", { id: "ed-attr-valuelist" });
    const caption = el("div", { class: "ed-attr-caption" });
    const addRow = el("div", { class: "ed-sel-pop-row ed-attr-row" });
    const nameInput = el("input", {
      class: "ed-attr-input ed-attr-key", type: "text",
      placeholder: "attribute", list: "ed-attr-namelist",
    });
    const valueInput = el("input", {
      class: "ed-attr-input", type: "text",
      placeholder: "value", list: "ed-attr-valuelist",
    });
    const addWarn = el("div", { class: "ed-attr-warn" });
    const syncAddWarn = () => {
      const nm = nameInput.value.trim();
      syncWarn(addWarn, nm, attDef(nm), valueInput.value);
    };
    const syncCaption = () => {
      clear(valueList);
      caption.textContent = "";
      const def = attDef(nameInput.value.trim());
      if (!def) return;
      if (def.valList) for (const it of def.valList.items) valueList.appendChild(el("option", { value: it.ident }));
      const usage = def.usage === "req" ? "required" : def.usage === "rec" ? "recommended" : "optional";
      caption.textContent = `${usage}${def.datatype ? `, ${def.datatype}` : ""}${def.desc ? `: ${def.desc}` : ""}`;
    };
    syncAddWarn();
    nameInput.addEventListener("input", () => { syncCaption(); syncAddWarn(); });
    valueInput.addEventListener("input", syncAddWarn);
    const doAdd = () => {
      const nm = nameInput.value.trim();
      if (!nm) return;
      commitAttr(
        (doc) => addAttr(doc, target, nm, valueInput.value),
        { label: `Added @${nm} to <${target.qname}>`, failPrefix: "Add attribute",
          noopLabel: "Nothing added (attribute exists or the name is invalid)" },
      );
    };
    for (const inp of [nameInput, valueInput]) {
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doAdd(); } });
    }
    const addBtn = el("button", { class: "ed-act-btn", text: "add", title: "add this attribute" });
    addBtn.addEventListener("click", (e) => { e.stopPropagation(); doAdd(); });
    addRow.append(nameInput, valueInput, addBtn);
    pop.append(nameList, valueList, addRow, addWarn, caption);

    const closeRow = el("div", { class: "ed-sel-pop-row" });
    const xBtn = el("button", { class: "ed-act-btn", text: "x", title: "close" });
    xBtn.addEventListener("click", (e) => { e.stopPropagation(); removeSelPopover(); });
    closeRow.appendChild(xBtn);
    pop.appendChild(closeRow);

    anchorPopAt(pop, span.getBoundingClientRect(), host);
    nameInput.focus();
  }

  /**
   * Overlap inspector: a click on a cell whose text carries two or more nested
   * annotation layers (cell.layers, innermost-first) opens this list instead of
   * guessing one editor. Each row names the element (and the linked entity for a
   * mention) and routes: the innermost mention to its annotation editor, any layer
   * to the attribute editor TARGETING that layer's own element. This is how the
   * editor answers "what is here" for overlapping/nested markup.
   */
  function openLayersInspector(span, cell) {
    removeMenu();
    removeSelPopover();
    const host = reading();
    const meta = entityMetaMap();
    const pop = el("div", { class: "ed-sel-pop ed-layers-pop", id: "ed-sel-pop" });

    const titleRow = el("div", { class: "ed-sel-pop-titlerow" });
    const short = cell.text.trim();
    titleRow.appendChild(el("span", { class: "ed-sel-pop-title",
      text: `annotations on "${short.length > 32 ? short.slice(0, 32) + "..." : short}"` }));
    const closeBtn = el("button", { class: "ed-sel-pop-close", text: "×", title: "close", "aria-label": "close", type: "button" });
    closeBtn.addEventListener("click", (e) => { e.stopPropagation(); removeSelPopover(); });
    titleRow.appendChild(closeBtn);
    pop.appendChild(titleRow);

    const KIND_LABEL = { mention: "entity", critical: "criticism", markup: "markup" };
    (cell.layers || []).forEach((layer, i) => {
      const row = el("div", { class: "ed-layers-row ed-layer-" + layer.kind });
      const m = layer.kind === "mention" && layer.ref ? meta.get(layer.ref) : null;
      const label = layer.kind === "mention"
        ? `<${layer.localName}> ${m ? (m.name || "(unnamed)") : layer.ref}`
        : `<${layer.localName}>`;
      row.appendChild(el("span", { class: "ed-layer-label", text: label,
        title: `${KIND_LABEL[layer.kind] || "markup"}${i === 0 ? ", innermost" : ""}` }));
      const c = () => app.state.cellById.get(cell.id);
      if (layer.kind === "mention" && i === 0 && cell.mention) {
        const b = el("button", { class: "ed-act-btn", text: "edit link", title: "edit this entity annotation" });
        b.addEventListener("click", (e) => { e.stopPropagation(); const cc = c(); if (cc) openAnnotationEditor(span, cc); });
        row.appendChild(b);
      }
      if (layer.el) {
        const b = el("button", { class: "ed-act-btn", text: "edit attributes", title: `edit the attributes of <${layer.localName}>` });
        b.addEventListener("click", (e) => { e.stopPropagation(); const cc = c(); if (cc) openAttrEditor(span, cc, layer.el); });
        row.appendChild(b);
      }
      pop.appendChild(row);
    });

    anchorPopAt(pop, span.getBoundingClientRect(), host);
  }

  // ---- selection annotation (M2.8) ----------------------------------------
  // Select any words inside a line with the mouse and annotate exactly that
  // text. The wrap is a lossless sub-range splice (standoff.linkMentionRange);
  // afterwards the annotation editor opens on the fresh mention so authority
  // ids are attachable in place.

  /** Resolve the current selection to { cell, relFrom, relTo, text } or null. */
  function selectionTarget() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !app.state) return null;
    const range = sel.getRangeAt(0);
    const spanOf = (node) => {
      const elNode = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      return elNode ? elNode.closest("#ed-reading .ed-w") : null;
    };
    const startSpan = spanOf(range.startContainer);
    const endSpan = spanOf(range.endContainer);
    if (!startSpan || startSpan !== endSpan) return null; // one segment at a time
    const cell = app.state.cellById.get(startSpan.dataset.id);
    if (!cell || cell.gap) return null;
    // Display offsets inside the span's single text node, trimmed to the words.
    let dFrom = Math.min(range.startOffset, range.endOffset);
    let dTo = Math.max(range.startOffset, range.endOffset);
    const shown = startSpan.textContent;
    while (dFrom < dTo && /\s/.test(shown[dFrom])) dFrom++;
    while (dTo > dFrom && /\s/.test(shown[dTo - 1])) dTo--;
    if (dFrom >= dTo) return null;
    const rel = rawRangeForDisplay(cell.rawText, dFrom, dTo);
    if (!rel) return null;
    const text = shown.slice(dFrom, dTo);
    // Safety: the mapped raw slice must decode to exactly the selected text,
    // otherwise refuse rather than wrap the wrong bytes.
    if (unescapeXmlText(cell.rawText.slice(rel[0], rel[1])) !== text) return null;
    return { cell, span: startSpan, relFrom: rel[0], relTo: rel[1], text };
  }

  /** Apply: optionally create the entity, then wrap the selected sub-range. */
  function annotateSelection(target, entityId, createType) {
    try {
      let doc = app.state.doc;
      let id = entityId;
      if (createType) {
        const before = new Set(allEntityIds(doc));
        doc = standoff.addEntity(doc, createType, { name: target.text });
        id = allEntityIds(doc).find((x) => !before.has(x));
        if (!id) throw new Error("could not resolve the new entity's id");
      }
      // Re-locate the cell: addEntity shifted offsets, but the cell id is stable
      // and the relative offsets address the unchanged node content.
      const st = parseEdition(doc.raw);
      const c = st.cellById.get(target.cell.id);
      if (!c) throw new Error("the selected line is no longer addressable");
      const next = standoff.linkMentionRange(doc, c.node, target.relFrom, target.relTo, id);
      // Commit only the finished doc: the multi-stage offset work above stays
      // here, the state adoption and the single re-render are commitStandoff's.
      const changed = commitStandoff(() => next, {
        label: `Annotated "${target.text}" (${id})`,
        failPrefix: "Annotate",
        noopLabel: "Nothing annotated (the text may already sit inside a link)",
      });
      // Continue in place: open the annotation editor on the fresh mention so
      // authority ids (GND, Wikidata, GeoNames) are attachable without leaving
      // the text (the index logic lives where the annotating happens).
      if (changed) openAnnotationEditorFor(id);
    } catch (err) {
      setStatus(`Annotate failed: ${err.message}`);
    }
  }

  /** Open the annotation editor on the current folio's first mention of an entity. */
  function openAnnotationEditorFor(id) {
    const folio = app.state.folios[app.folio];
    if (!folio) return;
    for (const line of folio.lines) {
      for (const c of line.cells) {
        if (c.mention !== id) continue;
        const span = document.querySelector(`#ed-reading .ed-w[data-id="${CSS.escape(c.id)}"]`);
        if (span) openAnnotationEditor(span, c);
        return;
      }
    }
  }

  /**
   * Classify the index against the selected text: suggestions with hard evidence
   * (an index entry with exactly this name, or this exact text already annotated
   * elsewhere) and the rest, deduplicated so an entity never appears in both.
   * The single source of truth for the matching, shared by the annotate popover,
   * relink and the word-profile picker.
   */
  function entityMatches(selText, excludeId) {
    const all = standoff.readEntities(app.state.doc);
    const entities = ["persons", "places", "orgs", "works", "events"]
      .flatMap((k) => all[k] || [])
      .filter((ent) => ent.id !== excludeId);
    const norm = (s) => (s || "").trim().toLowerCase();
    const want = norm(selText);
    const suggested = [];
    const seen = new Set();
    if (want) {
      for (const ent of entities) {
        if (norm(ent.name) === want) { suggested.push({ ent, why: "index entry with exactly this name" }); seen.add(ent.id); }
      }
      for (const folio of app.state.folios) {
        for (const line of folio.lines) {
          for (const c of line.cells) {
            if (!c.mention || seen.has(c.mention)) continue;
            if (norm(c.text) !== want) continue;
            const ent = entities.find((x) => x.id === c.mention);
            if (ent) { suggested.push({ ent, why: "this exact text is already annotated with it" }); seen.add(ent.id); }
          }
        }
      }
    }
    const rest = entities.filter((ent) => !seen.has(ent.id));
    return { entities, suggested, rest };
  }

  /** A single entity-choice button (name + kind, provenance in the title). */
  function entChoiceBtn(ent, why, onPick, meta, usage) {
    const m = meta.get(ent.id);
    const u = usage.get(ent.id);
    const kindLabel = m ? TYPE_LABEL[m.kind] : "entity";
    const b = el("button", {
      class: "ed-act-btn" + (m && m.ai ? " ed-btn-ai" : ""),
      text: `${ent.name || "(unnamed)"} (${kindLabel})`,
      title: `${ent.id}${why ? "; " + why : ""}${u ? `; ${u.count} mention(s) in this document` : "; no mentions yet"}`,
    });
    b.addEventListener("click", (e) => { e.stopPropagation(); if (e.detail > 1) return; onPick(ent.id); });
    return b;
  }

  /**
   * Render the rest of the index grouped by provenance (this page / this document
   * / index only), filtered by name or id. subLevel marks the headings as a
   * sub-level (used inside the popover disclosure). meta/usage are captured once
   * by the caller so a large index does not rebuild them per button.
   */
  function renderProvenanceGroups(host, rest, filterStr, onPick, meta, usage, opts = {}) {
    clear(host);
    const norm = (s) => (s || "").trim().toLowerCase();
    const f = norm(filterStr);
    const groups = [
      ["annotated on this page", (ent) => { const u = usage.get(ent.id); return u && u.onPage; }],
      ["annotated in this document", (ent) => { const u = usage.get(ent.id); return u && !u.onPage; }],
      ["in the index, not yet linked", (ent) => !usage.get(ent.id)],
    ];
    const headCls = "ed-act-group" + (opts.subLevel ? " ed-sel-prov-group" : "");
    for (const [label, match] of groups) {
      const items = rest.filter((ent) => match(ent) && (!f || norm(ent.name).includes(f) || ent.id.toLowerCase().includes(f)));
      if (!items.length) continue;
      host.appendChild(el("span", { class: headCls, text: label }));
      const row = el("div", { class: "ed-sel-pop-row" });
      for (const ent of items) row.appendChild(entChoiceBtn(ent, label, onPick, meta, usage));
      host.appendChild(row);
    }
    if (!host.childElementCount && f) {
      host.appendChild(el("span", { class: "ed-act-empty", text: "no entity matches the filter" }));
    }
  }

  /**
   * Shared entity-choice list with provenance: suggestions first, then the rest
   * grouped by provenance with a filter once the list grows. onPick(entityId)
   * applies; excludeId hides the entity the text is currently linked to. Used by
   * relink and the word-profile picker; the annotate popover composes the same
   * parts differently (suggestions inline, the rest behind a disclosure).
   */
  function buildEntityChoiceRows(container, selText, onPick, excludeId) {
    const meta = entityMetaMap();
    const usage = entityUsage();
    const { entities, suggested, rest } = entityMatches(selText, excludeId);
    if (!entities.length) {
      container.appendChild(el("span", { class: "ed-act-empty", text: "no entities yet" }));
      return;
    }
    if (suggested.length) {
      container.appendChild(el("span", { class: "ed-act-group", text: "suggested (matches this text)" }));
      const sugRow = el("div", { class: "ed-sel-pop-row" });
      for (const { ent, why } of suggested) sugRow.appendChild(entChoiceBtn(ent, why, onPick, meta, usage));
      container.appendChild(sugRow);
    }
    const listHost = el("div", {});
    if (rest.length > 8) {
      const filter = el("input", { class: "ed-sel-filter", type: "text", placeholder: `filter ${rest.length} entities...` });
      filter.addEventListener("input", () => renderProvenanceGroups(listHost, rest, filter.value, onPick, meta, usage));
      filter.addEventListener("mouseup", (e) => e.stopPropagation());
      container.appendChild(filter);
    }
    renderProvenanceGroups(listHost, rest, "", onPick, meta, usage);
    container.appendChild(listHost);
  }

  function applyMarkupWrap(target, build, label, attrValue) {
    commitStandoff(
      (doc) => standoff.wrapRange(doc, target.cell.node, target.relFrom, target.relTo, (inner) => build(inner, attrValue)),
      { label: `Marked "${target.text}" as ${label}`, failPrefix: "Annotate",
        noopLabel: "Nothing changed (invalid range or text would be lost)" },
    );
  }

  /**
   * The annotate popover on a finished selection: ONE flat, filterable list,
   * grouped under small headings visible at once (Entities, Markup, Criticism,
   * Note). A filter input on top narrows every group by label substring; empty
   * groups hide while filtering. ArrowDown/ArrowUp move through the visible
   * activatable items and Enter activates the focused one. Every commit path
   * (entity link/create, markup wrap, criticism, note) is unchanged in behaviour;
   * this is a presentation restructure. A markup wrap that declares an attrField
   * reveals an inline input + Apply (one commit wraps with the attribute; an
   * empty input wraps without it).
   */
  function openSelPopover() {
    removeSelPopover();
    removeMenu();
    const target = selectionTarget();
    if (!target) return;
    if (target.cell.mention) {
      setStatus("This text already sits inside a link; click it to edit the annotation.");
      return;
    }
    // Capture the selection range now (before focus moves to the filter) and paint
    // it with the persistent highlight, so the marked region stays visible while
    // the popover is open. Reused as the popover's anchor rect.
    const sel = window.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    setAnnotateHighlight(range);
    const host = reading();
    const pop = el("div", { class: "ed-sel-pop ed-annotate-pop", id: "ed-sel-pop" });

    // Title row: the selection label and a top-right close button. Cancel only
    // removes the popover (no reading-pane re-render), so look-and-cancel keeps
    // the scroll and facsimile state.
    const titleRow = el("div", { class: "ed-sel-pop-titlerow" });
    titleRow.appendChild(el("span", { class: "ed-sel-pop-title", text: `annotate "${target.text.length > 40 ? target.text.slice(0, 40) + "..." : target.text}"` }));
    const closeBtn = el("button", { class: "ed-sel-pop-close", text: "×", title: "cancel", "aria-label": "cancel", type: "button" });
    closeBtn.addEventListener("click", (e) => { e.stopPropagation(); removeSelPopover(); });
    titleRow.appendChild(closeBtn);
    pop.appendChild(titleRow);

    // Filter input: type to narrow every group by label substring (case
    // insensitive). Escape clears a non-empty filter, then closes the popover.
    const filter = el("input", { class: "ed-sel-filter", type: "text", placeholder: "filter actions..." });
    filter.addEventListener("mouseup", (e) => e.stopPropagation());
    pop.appendChild(filter);

    // The scrollable list host; rebuilt on every filter keystroke.
    const listHost = el("div", { class: "ed-sel-list" });
    pop.appendChild(listHost);

    // Disclosure open-state, persisted across re-renders within this open popover.
    const open = new Set();

    // Relevance-led order: suggestions (evidence) and "new entity" lead and stay
    // visible; the rest of the index sits behind a disclosure. Markup, Criticism
    // and Note stay flat with every label directly visible.
    const render = (raw) => {
      clear(listHost);
      const f = raw.trim().toLowerCase();
      const match = (label) => !f || label.toLowerCase().includes(f);

      const groupHead = (label) => el("span", { class: "ed-act-group", text: label });
      const actBtn = (label, title, fn, cls) => {
        const b = el("button", { class: "ed-act-btn" + (cls ? " " + cls : ""), text: label, title });
        b.addEventListener("click", (e) => { e.stopPropagation(); fn(); });
        return b;
      };

      // Entities: evidence-first. Suggestions inline and open; the five "new
      // entity" actions visible; the rest of the index behind a disclosure.
      const meta = entityMetaMap();
      const usage = entityUsage();
      const { entities, suggested, rest } = entityMatches(target.text, null);
      const norm = (s) => (s || "").trim().toLowerCase();
      const sugMatches = suggested.filter(({ ent }) => match(ent.name || ""));
      const newItems = ENTITY_TYPE_LABELS.filter(([, label]) => match(`new ${label}`));
      const restHits = f ? rest.filter((e) => norm(e.name).includes(f) || e.id.toLowerCase().includes(f)) : rest;
      const showExisting = rest.length > 0 && (!f || restHits.length > 0);
      if (sugMatches.length || newItems.length || showExisting) {
        listHost.appendChild(groupHead("Entities"));
        if (sugMatches.length) {
          const sugRow = el("div", { class: "ed-sel-pop-row" });
          for (const { ent, why } of sugMatches) {
            sugRow.appendChild(entChoiceBtn(ent, why, (entId) => {
              removeSelPopover();
              annotateSelection(target, entId, null);
            }, meta, usage));
          }
          listHost.appendChild(sugRow);
        }
        if (newItems.length) {
          const newRow = el("div", { class: "ed-sel-pop-row" });
          listHost.appendChild(newRow);
          for (const [type, label] of newItems) {
            newRow.appendChild(actBtn(`new ${label}`, `create a ${label} named "${target.text}", link this text, then add authority ids right here`, () => {
              removeSelPopover();
              annotateSelection(target, null, type);
            }));
          }
        }
        if (showExisting) {
          // A non-empty filter with entity hits force-opens the disclosure so the
          // matches show; otherwise it honours the per-popover open state.
          const key = "existing-entities";
          const isOpen = (!!f && restHits.length > 0) || open.has(key);
          const head = el("button", { class: "ed-sel-sec-head", type: "button",
            text: `link to an existing entity (${rest.length})`, "aria-expanded": String(isOpen) });
          head.addEventListener("click", (e) => {
            e.stopPropagation();
            if (open.has(key)) open.delete(key); else open.add(key);
            rerender(filter.value);
          });
          listHost.appendChild(head);
          if (isOpen) {
            const body = el("div", { class: "ed-sel-sec-body" });
            renderProvenanceGroups(body, rest, raw, (entId) => {
              removeSelPopover();
              annotateSelection(target, entId, null);
            }, meta, usage, { subLevel: true });
            listHost.appendChild(body);
          }
        }
      }

      // Markup: the resolved wrap list (or the built-in wraps), each by its label.
      // A wrap with an attrField reveals an inline input + Apply on click.
      const wraps = markupWraps().filter(([label]) => match(label));
      if (wraps.length) {
        listHost.appendChild(groupHead("Markup"));
        const muRow = el("div", { class: "ed-sel-pop-row" });
        listHost.appendChild(muRow);
        for (const [label, build, , attrField] of wraps) {
          const elName = label.split(" ")[0];
          if (!attrField) {
            const b = actBtn(label, `wrap the selection in <${elName}>`, () => {
              removeSelPopover();
              applyMarkupWrap(target, build, label);
            });
            muRow.appendChild(b);
            continue;
          }
          // attrField: clicking reveals an inline field row instead of committing.
          const b = actBtn(label, `wrap the selection in <${elName}> and set @${attrField.name}`, () => {
            const fieldRow = el("div", { class: "ed-sel-pop-row ed-attr-row" });
            const input = el("input", { class: "ed-attr-input", type: "text", placeholder: attrField.placeholder, title: attrField.label });
            input.setAttribute("aria-label", attrField.label);
            input.addEventListener("mouseup", (e) => e.stopPropagation());
            const commitWrap = () => {
              removeSelPopover();
              applyMarkupWrap(target, build, label, input.value);
            };
            input.addEventListener("keydown", (e) => {
              if (e.key === "Enter") { e.preventDefault(); commitWrap(); }
              else if (e.key === "Escape") { e.stopPropagation(); fieldRow.remove(); }
            });
            const apply = el("button", { class: "ed-act-btn", text: "Apply", title: `wrap in <${elName}> with @${attrField.name} (leave empty to wrap without it)` });
            apply.addEventListener("click", (e) => { e.stopPropagation(); commitWrap(); });
            fieldRow.append(el("span", { class: "ed-attr-name", text: attrField.label }), input, apply);
            muRow.insertAdjacentElement("afterend", fieldRow);
            input.focus();
          });
          muRow.appendChild(b);
        }
      }
      // Any element by name (the full-TEI escape hatch), part of Markup.
      if (!f || match("any element")) {
        if (!wraps.length) listHost.appendChild(groupHead("Markup"));
        const freeWrap = el("div", { class: "ed-sel-pop-row" });
        const freeInput = el("input", { class: "ed-sel-filter", type: "text", placeholder: "any element name..." });
        freeInput.addEventListener("mouseup", (e) => e.stopPropagation());
        const freeBtn = el("button", { class: "ed-act-btn", text: "wrap", title: "wrap the selection in the named element" });
        const freeApply = () => {
          const tag = freeInput.value.trim();
          if (!/^[A-Za-z_][\w.-]*$/.test(tag)) { setStatus("Not a valid element name"); return; }
          removeSelPopover();
          applyMarkupWrap(target, (inner) => `<${tag}>${inner}</${tag}>`, `<${tag}>`);
        };
        freeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); freeApply(); } });
        freeBtn.addEventListener("click", (e) => { e.stopPropagation(); freeApply(); });
        freeWrap.append(freeInput, freeBtn);
        listHost.appendChild(freeWrap);
      }

      // Criticism: mark the selected text as unclear / deleted / added / gap.
      // Routed through beginCritic on the cell, the established commit path.
      const critActions = [
        ["unclear", "mark the selection as unclear"],
        ["deleted", "mark the selection as deleted"],
        ["added", "mark the selection as added"],
        ["gap", "mark the selection as a gap"],
      ].filter(([label]) => match(label));
      if (critActions.length) {
        listHost.appendChild(groupHead("Criticism"));
        const critRow = el("div", { class: "ed-sel-pop-row" });
        listHost.appendChild(critRow);
        for (const [label, title] of critActions) {
          const b = actBtn(label, title, () => {
            removeSelPopover();
            const c = app.state.cellById.get(target.cell.id);
            const s = c && document.querySelector(`#ed-reading .ed-w[data-id="${CSS.escape(c.id)}"]`);
            if (c && s) beginCritic(s, c);
          });
          critRow.appendChild(b);
        }
      }

      // Note: add an editorial note on the selected segment, via beginNote.
      if (match("note")) {
        listHost.appendChild(groupHead("Note"));
        const noteRow = el("div", { class: "ed-sel-pop-row" });
        listHost.appendChild(noteRow);
        const b = actBtn("note", "add an editorial note on this text", () => {
          removeSelPopover();
          const c = app.state.cellById.get(target.cell.id);
          const s = c && document.querySelector(`#ed-reading .ed-w[data-id="${CSS.escape(c.id)}"]`);
          if (c && s) beginNote(s, c);
        });
        noteRow.appendChild(b);
      }

      if (!listHost.childElementCount) {
        listHost.appendChild(el("span", { class: "ed-act-empty", text: "no action matches the filter" }));
      }
    };

    // Keyboard navigation across the visible activatable controls (action buttons
    // and disclosure headers), collected from the DOM after each render so the
    // suggestion and disclosure-revealed entity buttons are reachable too.
    let navItems = [];
    let navIndex = -1;
    const collectNav = () => { navItems = Array.from(listHost.querySelectorAll(".ed-act-btn, .ed-sel-sec-head")); };
    const rerender = (raw) => { render(raw); collectNav(); navIndex = -1; };
    const focusNav = (i) => {
      if (!navItems.length) return;
      navIndex = (i + navItems.length) % navItems.length;
      navItems[navIndex].focus();
    };
    rerender("");
    filter.addEventListener("input", () => rerender(filter.value));
    pop.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); focusNav(navIndex + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); focusNav(navIndex - 1); }
      else if (e.key === "Enter" && document.activeElement &&
               (document.activeElement.classList.contains("ed-act-btn") || document.activeElement.classList.contains("ed-sel-sec-head"))) {
        e.preventDefault(); document.activeElement.click();
      } else if (e.key === "Escape") {
        if (filter.value) { e.stopPropagation(); filter.value = ""; rerender(""); filter.focus(); }
        else removeSelPopover();
      }
    });

    anchorPopAt(pop, (range || window.getSelection().getRangeAt(0)).getBoundingClientRect(), host);
    filter.focus();
  }

  // Selection handling: a finished mouse DRAG selection inside the reading pane
  // opens the annotate popover; Escape or a click elsewhere closes it. A
  // double-click (e.detail > 1) belongs to direct text editing, not annotation.
  document.addEventListener("mouseup", (e) => {
    if (!app.state || app.sourceMode) return;
    if (e.detail > 1) return;
    const inReading = e.target instanceof Element && e.target.closest("#ed-reading");
    const inPop = e.target instanceof Element && (e.target.closest("#ed-sel-pop") || e.target.closest("#ed-menu"));
    if (inPop) return;
    // A plain click on an annotated element opens its popover from the span's
    // own click handler, which fires after this mouseup but before the deferred
    // check below. Capture the popover showing now and only dismiss that same
    // one, so a collapsed-selection click never kills the popover it just opened
    // (openAnnotationEditor replaces #ed-sel-pop with a fresh node).
    const popAtUp = document.getElementById("ed-sel-pop");
    const dismissStale = () => { if (document.getElementById("ed-sel-pop") === popAtUp) removeSelPopover(); };
    setTimeout(() => {
      if (!inReading) { dismissStale(); return; }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { dismissStale(); return; }
      // The normalized display text does not map to raw offsets, so a selection
      // wrap would splice the wrong bytes: annotate in the diplomatic view.
      if (app.readingVariant === "norm") {
        removeSelPopover();
        setStatus("Select in the diplomatic view to annotate.");
        return;
      }
      openSelPopover();
    }, 0);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("ed-sel-pop")) removeSelPopover();
  });
  // Right-click: the Oxygen-style context menu, on words and on selections.
  reading().addEventListener("contextmenu", (e) => {
    if (!app.state || app.sourceMode) return;
    e.preventDefault();
    const span = e.target instanceof Element ? e.target.closest(".ed-w") : null;
    const cell = span ? app.state.cellById.get(span.dataset.id) : null;
    openContextMenu(e.clientX, e.clientY, span, cell || null);
  });

  return {
    openContextMenu, openSelPopover, openAnnotationEditor,
    openAnnotationEditorFor, openAttrEditor, openLayersInspector,
    removeSelPopover, removeMenu,
  };
}
