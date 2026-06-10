/**
 * teiCrafter Editor -- annotation UI on the reading text.
 *
 * Everything that opens at the text under the M2.10 editor paradigm: the
 * Oxygen-style right-click context menu, the evidence-first annotate popover
 * on a finished selection (M2.8), the annotation editor on a clicked mention
 * (with in-place authority editing, M2.11), and the word-profile entity
 * picker. Extracted from editor-app.js in the M2.13 module split; the
 * behaviour is unchanged. Every mutation routes through the integrator's
 * applyDocFn (lossless splice, SAME-doc no-op contract).
 *
 * Contract:
 *   createAnnotationUi(ctx) -> {
 *     openContextMenu, openSelPopover, openAnnotationEditor,
 *     openAnnotationEditorFor, removeSelPopover, removeMenu,
 *   }
 *   ctx: {
 *     app,                        // shared mutable editor state
 *     setStatus(msg), setDirty(d),
 *     applyDocFn(fn, label, failPrefix, noopLabel),
 *     refresh(),                  // re-render reading view + index
 *     entityMetaMap(),            // id -> { name, kind, ai }
 *     entityUsage(),              // id -> { count, onPage }
 *     indexNotes(raw),            // wordId -> note text (after a raw change)
 *     runLookup(authority, query, anchor, onPick),
 *     revealEntity(id),           // switch the right pane to the index, scrolled to an entry
 *     highlightMentions(entity),
 *     beginTextInput(span, cell), beginNote(span, cell), beginCritic(span, cell),
 *   }
 *   Wires its own global listeners (mouseup selection, Escape, contextmenu).
 */

import { el, clear } from "./dom.js";
import * as standoff from "./standoff.js";
import { parseEdition, rawRangeForDisplay, unescapeXmlText } from "./edition.js";
import { buildAuthorityForm } from "./authority-form.js";

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

export function createAnnotationUi(ctx) {
  const {
    app, setStatus, setDirty, applyDocFn, refresh,
    entityMetaMap, entityUsage, indexNotes, runLookup, revealEntity,
    highlightMentions, beginTextInput, beginNote, beginCritic,
  } = ctx;

  const reading = () => document.getElementById("ed-reading");

  // A project manifest's markup list replaces the built-in wraps project-wide
  // (same [label, build] shape, produced by project-manifest.js).
  const markupWraps = () => (app.project && app.project.markup) || MARKUP_WRAPS;

  function removeMenu() {
    const old = document.getElementById("ed-menu");
    if (old) old.remove();
  }

  function removeSelPopover() {
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
    const item = (label, fn) => {
      const b = el("button", { class: "ed-menu-item", text: label });
      b.addEventListener("click", (e) => { e.stopPropagation(); removeMenu(); fn(); });
      menu.appendChild(b);
    };

    const target = selectionTarget();
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
        if (app.state.profile === "word") {
          item("Link this word to an entity...", () => { if (c()) openEntityPickerFor(span, c()); });
        }
      } else {
        item("Remove gap...", () => { if (c()) beginCritic(span, c()); });
      }
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
      applyDocFn(
        (doc) => standoff.linkMention(doc, cell.node, entId),
        `Linked "${cell.text.trim()}" to ${entId}`,
        "Link",
        "Already linked to this entity",
      );
      refresh();
    }, null);
    const xBtn = el("button", { class: "ed-act-btn", text: "x", title: "cancel" });
    xBtn.addEventListener("click", (e) => { e.stopPropagation(); removeSelPopover(); });
    pop.appendChild(xBtn);
    anchorPopAt(pop, span.getBoundingClientRect(), host);
  }

  /**
   * Commit a standOff edit from inside the annotation editor, then reopen the
   * editor on the same cell (refresh() rebuilds the reading pane, which removes
   * the popover; the cell id is stable across standOff-region edits), so adding
   * several authority ids in a row stays one uninterrupted gesture.
   */
  function commitAndReopen(fn, label, cellId) {
    applyDocFn(fn, label, "Edit");
    refresh();
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
    btn("relink...", "point this text at a different entity", () => {
      clear(row);
      buildEntityChoiceRows(row, cell.text.trim(), (entId) => {
        removeSelPopover();
        applyDocFn(
          (doc) => standoff.linkMention(doc, cell.node, entId),
          `Relinked "${cell.text.trim()}" to ${entId}`,
          "Relink",
          "Already linked to this entity",
        );
        refresh();
      }, cell.mention);
    });
    btn("remove link", "unwrap the <name> around this text (the text itself survives)", () => {
      removeSelPopover();
      applyDocFn(
        (doc) => standoff.unwrapMention(doc, cell.node),
        `Removed the link on "${cell.text.trim()}" (index entry kept)`,
        "Unlink",
      );
      refresh();
    });
    btn("x", "close", () => removeSelPopover());
    pop.appendChild(row);
    anchorPopAt(pop, span.getBoundingClientRect(), host);
  }

  /**
   * Authority ids (GND / GeoNames / Wikidata) of the linked entity, editable at
   * the mention: the shared form (authority-form.js, same UI as in the index
   * overlay), committing losslessly and reopening the editor on the same cell.
   */
  function buildAuthorityEditor(entity, cell) {
    const form = buildAuthorityForm(entity, {
      onSet: (authority, value) => commitAndReopen(
        (doc) => standoff.setAuthority(doc, entity.id, authority, value),
        value
          ? `Set ${authority} id on ${entity.name || entity.id}`
          : `Removed ${authority} id from ${entity.name || entity.id}`,
        cell.id,
      ),
      onLookup: runLookup,
    });
    form.classList.add("ed-sel-auth");
    return form;
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
      if (next === doc && !createType) {
        setStatus("Nothing annotated (the text may already sit inside a link)");
        return;
      }
      app.state = parseEdition(next.raw);
      app.noteByWord = indexNotes(app.state.raw);
      setDirty(true);
      setStatus(`Annotated "${target.text}" (${id})`);
      refresh();
      // Continue in place: open the annotation editor on the fresh mention so
      // authority ids (GND, Wikidata, GeoNames) are attachable without leaving
      // the text (the index logic lives where the annotating happens).
      openAnnotationEditorFor(id);
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
   * Shared entity-choice list with provenance: suggestions first (same name as
   * the selection, or the same text already annotated), then groups "annotated
   * on this page" / "annotated in this document" / "in the index (not yet
   * linked)", with a filter once the list grows. onPick(entityId) applies;
   * excludeId hides the entity the text is currently linked to.
   */
  function buildEntityChoiceRows(container, selText, onPick, excludeId) {
    const meta = entityMetaMap();
    const usage = entityUsage();
    const all = standoff.readEntities(app.state.doc);
    const entities = ["persons", "places", "orgs", "works", "events"]
      .flatMap((k) => all[k] || [])
      .filter((ent) => ent.id !== excludeId);
    if (!entities.length) {
      container.appendChild(el("span", { class: "ed-act-empty", text: "no entities yet" }));
      return;
    }
    const norm = (s) => (s || "").trim().toLowerCase();
    const want = norm(selText);

    const entBtn = (ent, why) => {
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
    };

    // Suggestions: hard evidence only (name equals the selection, or the exact
    // selected text is already annotated with this entity somewhere).
    const suggested = new Set();
    const sugRow = el("div", { class: "ed-sel-pop-row" });
    for (const ent of entities) {
      if (norm(ent.name) === want && want) { suggested.add(ent.id); sugRow.appendChild(entBtn(ent, "index entry with exactly this name")); }
    }
    for (const folio of app.state.folios) {
      for (const line of folio.lines) {
        for (const c of line.cells) {
          if (!c.mention || suggested.has(c.mention)) continue;
          if (norm(c.text) !== want || !want) continue;
          const ent = entities.find((x) => x.id === c.mention);
          if (ent) { suggested.add(ent.id); sugRow.appendChild(entBtn(ent, "this exact text is already annotated with it")); }
        }
      }
    }
    if (sugRow.childElementCount) {
      container.appendChild(el("span", { class: "ed-act-group", text: "suggested (matches this text)" }));
      container.appendChild(sugRow);
    }

    // Provenance groups for the rest, filterable when long.
    const rest = entities.filter((ent) => !suggested.has(ent.id));
    const groups = [
      ["annotated on this page", (ent) => { const u = usage.get(ent.id); return u && u.onPage; }],
      ["annotated in this document", (ent) => { const u = usage.get(ent.id); return u && !u.onPage; }],
      ["in the index, not yet linked", (ent) => !usage.get(ent.id)],
    ];
    const listHost = el("div", {});
    const renderGroups = (filter) => {
      clear(listHost);
      const f = norm(filter);
      for (const [label, match] of groups) {
        const items = rest.filter((ent) => match(ent) && (!f || norm(ent.name).includes(f) || ent.id.toLowerCase().includes(f)));
        if (!items.length) continue;
        listHost.appendChild(el("span", { class: "ed-act-group", text: label }));
        const row = el("div", { class: "ed-sel-pop-row" });
        for (const ent of items) row.appendChild(entBtn(ent, label));
        listHost.appendChild(row);
      }
      if (!listHost.childElementCount && f) {
        listHost.appendChild(el("span", { class: "ed-act-empty", text: "no entity matches the filter" }));
      }
    };
    if (rest.length > 8) {
      const filter = el("input", { class: "ed-sel-filter", type: "text", placeholder: `filter ${rest.length} entities...` });
      filter.addEventListener("input", () => renderGroups(filter.value));
      filter.addEventListener("mouseup", (e) => e.stopPropagation());
      container.appendChild(filter);
    }
    renderGroups("");
    container.appendChild(listHost);
  }

  function applyMarkupWrap(target, build, label) {
    applyDocFn(
      (doc) => standoff.wrapRange(doc, target.cell.node, target.relFrom, target.relTo, build),
      `Marked "${target.text}" as ${label}`,
      "Annotate",
      "Nothing changed (invalid range or text would be lost)",
    );
    refresh();
  }

  /**
   * The annotate popover on a finished selection. Evidence first (suggestions
   * with provenance), then collapsed sections: link an existing entity, create a
   * new index entity, or apply plain TEI markup (full flexibility, no entity).
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
    const host = reading();
    const pop = el("div", { class: "ed-sel-pop", id: "ed-sel-pop" });
    pop.appendChild(el("span", { class: "ed-sel-pop-title", text: `annotate "${target.text.length > 40 ? target.text.slice(0, 40) + "..." : target.text}"` }));

    // Collapsible section helper: header toggles the body.
    const section = (label, open) => {
      const body = el("div", { class: "ed-sel-sec-body" });
      body.hidden = !open;
      const head = el("button", { class: "ed-sel-sec-head", text: label, type: "button" });
      head.addEventListener("click", (e) => { e.stopPropagation(); body.hidden = !body.hidden; });
      pop.appendChild(head);
      pop.appendChild(body);
      return body;
    };

    // 1. Entities: suggestions (always visible inside) + provenance groups.
    const all = standoff.readEntities(app.state.doc);
    const haveEntities = ["persons", "places", "orgs", "works", "events"].some((k) => (all[k] || []).length);
    if (haveEntities) {
      const entBody = section("link to an index entity", true);
      buildEntityChoiceRows(entBody, target.text, (entId) => {
        removeSelPopover();
        annotateSelection(target, entId, null);
      }, null);
    }

    // 2. New index entity from the selection (collapsed when entities exist:
    //    not every selection is an entity, so this must not be the loudest offer).
    const newBody = section("new index entity from this text", !haveEntities);
    const newRow = el("div", { class: "ed-sel-pop-row" });
    for (const [type, label] of ENTITY_TYPE_LABELS) {
      const b = el("button", { class: "ed-act-btn", text: label, title: `create a ${label} named "${target.text}", link this text, then add authority ids right here` });
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        removeSelPopover();
        annotateSelection(target, null, type);
      });
      newRow.appendChild(b);
    }
    newBody.appendChild(newRow);

    // 3. Plain TEI markup (full flexibility, no index entry).
    const muBody = section("TEI markup (no index entry)", false);
    const muRow = el("div", { class: "ed-sel-pop-row" });
    for (const [label, build] of markupWraps()) {
      const b = el("button", { class: "ed-act-btn", text: label, title: `wrap the selection in <${label.split(" ")[0]}>` });
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        removeSelPopover();
        applyMarkupWrap(target, build, label);
      });
      muRow.appendChild(b);
    }
    // Any element by name (the full-TEI escape hatch).
    const freeWrap = el("div", { class: "ed-sel-pop-row" });
    const freeInput = el("input", { class: "ed-sel-filter", type: "text", placeholder: "any element name..." });
    freeInput.addEventListener("mouseup", (e) => e.stopPropagation());
    const freeBtn = el("button", { class: "ed-act-btn", text: "wrap", title: "wrap the selection in the named element" });
    freeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const tag = freeInput.value.trim();
      if (!/^[A-Za-z_][\w.-]*$/.test(tag)) { setStatus("Not a valid element name"); return; }
      removeSelPopover();
      applyMarkupWrap(target, (inner) => `<${tag}>${inner}</${tag}>`, `<${tag}>`);
    });
    freeWrap.appendChild(freeInput);
    freeWrap.appendChild(freeBtn);
    muBody.appendChild(muRow);
    muBody.appendChild(freeWrap);

    const xBtn = el("button", { class: "ed-act-btn", text: "x", title: "cancel" });
    xBtn.addEventListener("click", (e) => { e.stopPropagation(); removeSelPopover(); });
    pop.appendChild(xBtn);

    anchorPopAt(pop, window.getSelection().getRangeAt(0).getBoundingClientRect(), host);
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
    setTimeout(() => {
      if (!inReading) { removeSelPopover(); return; }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { removeSelPopover(); return; }
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
    openAnnotationEditorFor, removeSelPopover, removeMenu,
  };
}
