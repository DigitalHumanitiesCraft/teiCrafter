/**
 * teiCrafter Editor -- shared authority candidate picker.
 *
 * One source for the live authority-lookup result list, so the entity-index
 * panel and the annotation popover show the same candidate UX (label, short
 * description, id) with identical wording. The human always confirms by
 * clicking a candidate; nothing is applied automatically. A network call fires
 * only from an explicit invocation here (an operator click, or a project's
 * declared reconciliation.auto opt-in upstream).
 *
 * runAuthorityLookup(authority, query, anchor, onPick, opts) appends a results
 * popover to anchor (replacing any previous one), queries the register, and
 * renders the hits as buttons; picking one removes the popover and calls
 * onPick(id). Errors (network, GeoNames username missing) surface as a short
 * inline message in the same popover. The result node is the rendered popover,
 * or null when there was nothing to query.
 *
 * Pure-ish DOM: the only side effect besides rendering is the authority fetch
 * (authority-lookup.js, browser-verified). No project imports.
 */

import { el, clear } from "./dom.js";
import { lookup as authorityLookup } from "../services/authority-lookup.js";

/**
 * @param opts.limit   max hits to request (default 7, matching the index panel)
 * @param opts.onError optional (message) handler for the no-query / error case,
 *                     in addition to the inline message
 */
export async function runAuthorityLookup(authority, query, anchor, onPick, opts = {}) {
  if (!anchor) return null;
  const existing = anchor.querySelector(".ed-idx-lookupresults");
  if (existing) existing.remove();
  if (!query) {
    if (typeof opts.onError === "function") opts.onError("Type a name (or name the entity) before looking up");
    return null;
  }
  const pop = el("div", { class: "ed-idx-lookupresults" });
  pop.appendChild(el("div", { class: "ed-idx-lookupmsg", text: `Searching ${authority}...` }));
  anchor.appendChild(pop);
  try {
    const hits = await authorityLookup(authority, query, { limit: opts.limit || 7 });
    // A newer lookup or a re-render may have detached this popover while we
    // awaited: isConnected (not parentElement) is required, since a re-render
    // detaches the whole subtree while the local parent link survives.
    if (!pop.isConnected) return pop;
    clear(pop);
    if (!hits.length) {
      pop.appendChild(el("div", { class: "ed-idx-lookupmsg", text: `No ${authority} match for "${query}"` }));
      return pop;
    }
    for (const h of hits) {
      pop.appendChild(el("button", {
        class: "ed-idx-lookuphit", type: "button",
        title: h.description || h.id,
        onclick: (e) => { e.stopPropagation(); pop.remove(); onPick(h.id); },
      }, [
        el("span", { class: "ed-idx-lookuplabel", text: h.label || h.id }),
        el("span", { class: "ed-idx-lookupid", text: h.id }),
        h.description ? el("span", { class: "ed-idx-lookupdesc", text: h.description }) : null,
      ]));
    }
    return pop;
  } catch (err) {
    if (!pop.isConnected) return pop;
    clear(pop);
    pop.appendChild(el("div", { class: "ed-idx-lookupmsg", text: err.message }));
    if (typeof opts.onError === "function") opts.onError(err.message);
    return pop;
  }
}
