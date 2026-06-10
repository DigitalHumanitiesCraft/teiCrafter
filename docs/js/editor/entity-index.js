/**
 * teiCrafter Editor -- entity index panel (M2.11 overlay, a right-pane context
 * panel since the M2.14 dual view).
 *
 * Lives in the right pane's panel registry next to the facsimile: ALL standOff
 * entities, filterable, with mention-count badges, add/rename/delete and
 * authority forms; clicking an entry jumps to its first in-text mention while
 * the index stays visible. Day-to-day authority work happens in the annotation
 * popover on the text itself (operator decision 2026-06-10). Every mutation
 * routes through the integrator's commitStandoff (lossless offset splice,
 * SAME-doc no-op contract, exactly one re-render on a real change).
 *
 * Contract:
 *   createEntityIndex(ctx) -> { renderIndex, open, revealEntity, runLookup }
 *   ctx: {
 *     app,                       // shared mutable editor state (state, folio)
 *     setStatus(msg),
 *     commitStandoff(fn, { label, failPrefix, noopLabel }) -> bool,
 *     gotoFolio(i),              // page switch (jump-to-mention)
 *     highlightMentions(entity), // mark all of an entity's mentions on the page
 *     entityUsage(),             // id -> { count, onPage } over all mention cells
 *     showPanel(id),             // switch the right pane to a registry panel
 *   }
 *   Wires its own filter listener; the panel tab itself is the integrator's.
 */

import { el, clear } from "./dom.js";
import { createIndexPanel } from "./index-panel.js";
import * as standoff from "./standoff.js";
import { lookup as authorityLookup } from "../services/authority-lookup.js";

const $ = (id) => document.getElementById(id);

export function createEntityIndex(ctx) {
  const { app, setStatus, commitStandoff, gotoFolio, highlightMentions, entityUsage, showPanel } = ctx;
  let indexPanel = null;

  /** Lazily create the single index panel bound to the panel host, with its hooks. */
  function ensureIndexPanel() {
    if (indexPanel) return indexPanel;
    const host = $("ed-index-host");
    if (!host) return null;
    indexPanel = createIndexPanel(host, {
      onAdd: (type, { name }) => commitStandoff(
        (doc) => standoff.addEntity(doc, type, { name }),
        { label: "Entity added", failPrefix: "Add entity" }),
      onUpdate: (id, { name }) => commitStandoff(
        (doc) => standoff.updateEntity(doc, id, { name }),
        { label: "Entity renamed", failPrefix: "Rename entity" }),
      onDelete: (id) => commitStandoff(
        (doc) => standoff.deleteEntity(doc, id),
        { label: "Entity deleted", failPrefix: "Delete entity" }),
      onSelect: (entity) => jumpToEntity(entity),
      onSetAuthority: (id, { authority, value }) => commitStandoff(
        (doc) => standoff.setAuthority(doc, id, authority, value),
        { label: "Authority id updated", failPrefix: "Set authority id" }),
      onConfirm: (id) => commitStandoff(
        (doc) => standoff.confirmEntity(doc, id),
        { label: "AI suggestion confirmed", failPrefix: "Confirm entity" }),
      onLookup: (id, { authority, query, anchor, onPick }) => runLookup(authority, query, anchor, onPick),
    });
    return indexPanel;
  }

  /**
   * M3.3 live lookup: query an authority register and show the hits in a small
   * popover anchored to the entity's id form. Picking one fills the id field via
   * onPick (which commits through onSetAuthority). The human chooses the match.
   */
  async function runLookup(authority, query, anchor, onPick) {
    if (!anchor) return;
    let pop = anchor.querySelector(".ed-idx-lookupresults");
    if (pop) pop.remove();
    if (!query) { setStatus("Type a name (or name the entity) before looking up"); return; }
    pop = el("div", { class: "ed-idx-lookupresults" });
    pop.appendChild(el("div", { class: "ed-idx-lookupmsg", text: `Searching ${authority}...` }));
    anchor.appendChild(pop);
    try {
      const hits = await authorityLookup(authority, query, { limit: 7 });
      // If a newer lookup replaced this popover, or the index re-rendered while we
      // awaited, this node is detached: drop the stale result instead of writing to
      // an orphaned element. isConnected (not parentElement) is required, since a
      // re-render detaches the whole subtree while the local parent link survives.
      if (!pop.isConnected) return;
      clear(pop);
      if (!hits.length) {
        pop.appendChild(el("div", { class: "ed-idx-lookupmsg", text: `No ${authority} match for "${query}"` }));
        return;
      }
      for (const h of hits) {
        pop.appendChild(el("button", {
          class: "ed-idx-lookuphit", type: "button",
          title: h.description || h.id,
          onclick: () => { pop.remove(); onPick(h.id); },
        }, [
          el("span", { class: "ed-idx-lookuplabel", text: h.label || h.id }),
          el("span", { class: "ed-idx-lookupid", text: h.id }),
          h.description ? el("span", { class: "ed-idx-lookupdesc", text: h.description }) : null,
        ]));
      }
    } catch (err) {
      if (!pop.isConnected) return;
      clear(pop);
      pop.appendChild(el("div", { class: "ed-idx-lookupmsg", text: err.message }));
    }
  }

  /** Render the entity index from the current document, with mention counts. */
  function renderIndex() {
    const panel = ensureIndexPanel();
    if (!panel || !app.state) return;
    const all = standoff.readEntities(app.state.doc);
    const usage = entityUsage();
    for (const k of ["persons", "places", "orgs", "works", "events"]) {
      for (const e of all[k] || []) e.count = (usage.get(e.id) || {}).count || 0;
    }
    panel.render(all);
    applyFilter($("idx-filter") ? $("idx-filter").value : "");
  }

  /** Switch the right pane to the index panel (renders via the registry). */
  function open() {
    if (!app.state) return;
    showPanel("index");
  }

  /** DOM-level filter over the rendered panel: rows by name/id, empty sections fold. */
  function applyFilter(q) {
    const f = (q || "").trim().toLowerCase();
    for (const row of document.querySelectorAll("#ed-index-host .ed-idx-row")) {
      row.hidden = !!f && !row.textContent.toLowerCase().includes(f);
    }
    for (const sec of document.querySelectorAll("#ed-index-host .ed-idx-section")) {
      sec.hidden = !!f && !sec.querySelector(".ed-idx-row:not([hidden])");
    }
  }

  /**
   * Index row clicked: jump to the entity's first in-text mention (switching
   * the page when needed), then highlight all its mentions. The index panel
   * stays open; in the dual view the text and the index are visible together.
   */
  function jumpToEntity(entity) {
    let targetFolio = -1;
    let targetCellId = null;
    outer: for (let fi = 0; fi < app.state.folios.length; fi++) {
      for (const line of app.state.folios[fi].lines) {
        for (const c of line.cells) {
          if (c.mention === entity.id) { targetFolio = fi; targetCellId = c.id; break outer; }
        }
      }
    }
    if (targetFolio < 0) {
      setStatus(`${entity.name}: no in-text mentions on any folio`);
      return;
    }
    if (targetFolio !== app.folio) gotoFolio(targetFolio);
    highlightMentions(entity);
    const span = document.querySelector(`#ed-reading .ed-w[data-id="${CSS.escape(targetCellId)}"]`);
    if (span) span.scrollIntoView({ block: "center" });
  }

  /** Switch to the index panel scrolled to an entity's row and flash it. */
  function revealEntity(id) {
    open();
    if (indexPanel) indexPanel.setActive(id);
    const row = document.querySelector(`#ed-index-host .ed-idx-row[data-id="${CSS.escape(id)}"]`);
    if (!row) { setStatus(`No index entry for ${id}`); return; }
    row.scrollIntoView({ block: "center" });
    row.classList.add("ed-idx-row-flash");
    setTimeout(() => row.classList.remove("ed-idx-row-flash"), 1200);
  }

  $("idx-filter").addEventListener("input", (e) => applyFilter(e.target.value));

  return { renderIndex, open, revealEntity, runLookup };
}
