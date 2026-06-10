/**
 * teiCrafter Editor -- on-demand index overlay (M2.11).
 *
 * The toolbar "Index" button opens a filterable overlay over the text with
 * ALL standOff entities (mention-count badges, add/rename/delete, authority
 * forms); clicking an entry jumps to its first in-text mention. Day-to-day
 * authority work happens in the annotation popover on the text itself
 * (operator decision 2026-06-10). Every mutation goes through standoff.js
 * (lossless offset splice) and re-parses the edition so all offsets stay
 * correct. Extracted from editor-app.js in the M2.13 module split; the
 * behaviour is unchanged.
 *
 * Contract:
 *   createIndexOverlay(ctx) -> { renderIndex, open, close, revealEntity, runLookup }
 *   ctx: {
 *     app,                       // shared mutable editor state (state, folio)
 *     setStatus(msg), setDirty(d),
 *     refresh(),                 // re-render reading view + index after a standOff edit
 *     gotoFolio(i),              // page switch (jump-to-mention)
 *     highlightMentions(entity), // mark all of an entity's mentions on the page
 *     entityUsage(),             // id -> { count, onPage } over all mention cells
 *   }
 *   Wires its own listeners (toolbar toggle, close, backdrop, Escape, filter).
 */

import { el, clear } from "./dom.js";
import { createIndexPanel } from "./index-panel.js";
import * as standoff from "./standoff.js";
import { parseEdition } from "./edition.js";
import { lookup as authorityLookup } from "../services/authority-lookup.js";

const $ = (id) => document.getElementById(id);

export function createIndexOverlay(ctx) {
  const { app, setStatus, setDirty, refresh, gotoFolio, highlightMentions, entityUsage } = ctx;
  let indexPanel = null;

  /** Lazily create the single index panel bound to the overlay host, with its hooks. */
  function ensureIndexPanel() {
    if (indexPanel) return indexPanel;
    const host = $("ed-index-host");
    if (!host) return null;
    indexPanel = createIndexPanel(host, {
      onAdd: (type, { name }) => {
        try {
          app.state = parseEdition(standoff.addEntity(app.state.doc, type, { name }).raw);
          setDirty(true);
          refresh();
        } catch (err) {
          setStatus(`Could not add entity: ${err.message}`);
        }
      },
      onUpdate: (id, { name }) => {
        try {
          app.state = parseEdition(standoff.updateEntity(app.state.doc, id, { name }).raw);
          setDirty(true);
          refresh();
        } catch (err) {
          setStatus(`Could not rename entity: ${err.message}`);
        }
      },
      onDelete: (id) => {
        try {
          app.state = parseEdition(standoff.deleteEntity(app.state.doc, id).raw);
          setDirty(true);
          refresh();
        } catch (err) {
          setStatus(`Could not delete entity: ${err.message}`);
        }
      },
      onSelect: (entity) => jumpToEntity(entity),
      onSetAuthority: (id, { authority, value }) => {
        try {
          app.state = parseEdition(standoff.setAuthority(app.state.doc, id, authority, value).raw);
          setDirty(true);
          refresh();
        } catch (err) {
          setStatus(`Could not set authority id: ${err.message}`);
        }
      },
      onConfirm: (id) => {
        try {
          app.state = parseEdition(standoff.confirmEntity(app.state.doc, id).raw);
          setDirty(true);
          refresh();
          setStatus("AI suggestion confirmed");
        } catch (err) {
          setStatus(`Could not confirm entity: ${err.message}`);
        }
      },
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
  }

  function open() {
    if (!app.state) return;
    renderIndex();
    $("ed-idx-overlay").hidden = false;
    $("btn-index").classList.add("active");
    const f = $("idx-filter");
    f.value = "";
    applyFilter("");
    f.focus();
  }

  function close() {
    $("ed-idx-overlay").hidden = true;
    $("btn-index").classList.remove("active");
  }

  /** DOM-level filter over the rendered panel: rows by name/id, empty sections fold. */
  function applyFilter(q) {
    const f = q.trim().toLowerCase();
    for (const row of document.querySelectorAll("#ed-index-host .ed-idx-row")) {
      row.hidden = !!f && !row.textContent.toLowerCase().includes(f);
    }
    for (const sec of document.querySelectorAll("#ed-index-host .ed-idx-section")) {
      sec.hidden = !!f && !sec.querySelector(".ed-idx-row:not([hidden])");
    }
  }

  /**
   * Index row clicked: close the overlay and jump to the entity's first in-text
   * mention (switching the page when needed), then highlight all its mentions.
   */
  function jumpToEntity(entity) {
    close();
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

  /** Open the overlay scrolled to an entity's row and flash it. */
  function revealEntity(id) {
    open();
    if (indexPanel) indexPanel.setActive(id);
    const row = document.querySelector(`#ed-index-host .ed-idx-row[data-id="${CSS.escape(id)}"]`);
    if (!row) { setStatus(`No index entry for ${id}`); return; }
    row.scrollIntoView({ block: "center" });
    row.classList.add("ed-idx-row-flash");
    setTimeout(() => row.classList.remove("ed-idx-row-flash"), 1200);
  }

  // Wiring: toolbar toggle, close button, backdrop click, Escape, filter.
  $("btn-index").addEventListener("click", () => {
    if ($("ed-idx-overlay").hidden) open();
    else close();
  });
  $("idx-close").addEventListener("click", close);
  $("ed-idx-overlay").addEventListener("click", (e) => { if (e.target.id === "ed-idx-overlay") close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("ed-idx-overlay").hidden) close();
  });
  $("idx-filter").addEventListener("input", (e) => applyFilter(e.target.value));

  return { renderIndex, open, close, revealEntity, runLookup };
}
