/**
 * Proof: the interaction-layer invariants that govern the selection-popover
 * lifecycle, expressed as PURE PREDICATES over an explicit state object, with no
 * DOM, no timers, and no event loop.
 *
 * Why a pure predicate and not a headless DOM simulation: the real handlers in
 * docs/js/editor/annotation-ui.js and editor-app.js read live DOM and selection
 * state at fire time (window.getSelection(), document.getElementById('ed-sel-pop')),
 * inside a setTimeout(0) that defers past the span-click handler. A faithful DOM
 * simulation would require a full event-ordering shim; the part that actually
 * carries the bug-or-no-bug decision is a small piece of boolean logic, and that
 * piece can be lifted out verbatim and proven here. The branches that depend on
 * real event ordering and real timer scheduling cannot be reduced to a pure
 * predicate without re-implementing the browser; those are named as manual gaps
 * (TAP '# manual:' comments) pointing at test/acceptance/BROWSER-CHECKS.md, never
 * silently dropped.
 *
 * shouldDismissPopover MIRRORS the dismissStale + deferred-mouseup logic at
 * docs/js/editor/annotation-ui.js:1030-1056. It is a copy, not an import: the
 * source lives in a contested, uncommitted file and exports nothing. The
 * follow-up is to export the predicate from annotation-ui.js and import it here so
 * the two cannot drift; until then this file pins the intended contract and any
 * change to the real branch order will surface as a divergence in manual VC-RACE.
 *
 * Run: node test/tools/interaction_check.mjs   (exit 0 = all pass)
 */

let passed = 0, failed = 0;
function check(cond, label) {
  if (cond) { passed++; console.log("  ok    " + label); }
  else { failed++; console.log("  FAIL  " + label); }
}

console.log("\nInteraction-layer invariant proof (selection popover lifecycle)");
console.log("=".repeat(64));

// --- shouldDismissPopover: pure mirror of dismissStale + deferred mouseup -----
//
// state fields, all read at the FIRE moment of the deferred handler:
//   popoverIdAtMouseup  identity of #ed-sel-pop captured at mouseup SCHEDULE time
//                       (the popAtUp const); null when no popover was showing.
//   currentPopoverId    identity of #ed-sel-pop NOW, at fire time. A span-click
//                       handler may have opened a FRESH popover between schedule
//                       and fire, giving this a new identity.
//   inReading           whether the mouseup target was inside #ed-reading
//                       (captured at schedule time as a const).
//   selectionCollapsed  window.getSelection().isCollapsed read live at fire time;
//                       true for a plain caret click, false for a real drag range.
//
// The real handler returns nothing; it either calls removeSelPopover() (dismiss),
// calls openSelPopover() (open a new one), or does neither. This predicate answers
// only the dismissal question: does the popover that was showing at mouseup get
// torn down? That is the decision the identity guard exists to make safe.
function shouldDismissPopover(state) {
  const { popoverIdAtMouseup, currentPopoverId, inReading, selectionCollapsed } = state;
  // The identity guard: dismissStale only removes when the popover showing NOW is
  // the SAME node captured at mouseup. A freshly opened popover (new identity)
  // must survive, even though a stale collapsed mouseup is still in flight.
  const sameIdentity = currentPopoverId !== null && currentPopoverId === popoverIdAtMouseup;
  if (!sameIdentity) return false;
  // Outside the reading pane: the stale popover is dismissed.
  if (!inReading) return true;
  // Inside the reading pane with a real (non-collapsed) range: this is a drag that
  // OPENS a popover, it does not dismiss. Only a collapsed selection dismisses.
  if (!selectionCollapsed) return false;
  // Inside the reading pane, collapsed, unchanged identity: a genuinely stale
  // dismissal.
  return true;
}

// 1. The bug this guard prevents: a late collapsed-selection mouseup arriving
//    AFTER a span click opened a fresh popover (different identity) must NOT
//    dismiss it. This is the regression the identity guard at line 1042 exists for.
check(
  shouldDismissPopover({
    popoverIdAtMouseup: "pop-A",
    currentPopoverId: "pop-B",   // span click replaced the node
    inReading: true,
    selectionCollapsed: true,
  }) === false,
  "fresh popover (new identity) survives a late stale collapsed mouseup"
);

// 2. An unchanged-identity collapsed mouseup inside the reading pane DOES dismiss:
//    nothing reopened, the caret click is a genuine dismissal gesture.
check(
  shouldDismissPopover({
    popoverIdAtMouseup: "pop-A",
    currentPopoverId: "pop-A",   // same node still showing
    inReading: true,
    selectionCollapsed: true,
  }) === true,
  "unchanged-identity collapsed mouseup in reading dismisses the stale popover"
);

// 3. The non-reading branch: a collapsed mouseup outside #ed-reading, same
//    identity, dismisses (dismissStale fires before the inReading check returns).
check(
  shouldDismissPopover({
    popoverIdAtMouseup: "pop-A",
    currentPopoverId: "pop-A",
    inReading: false,
    selectionCollapsed: true,
  }) === true,
  "non-reading collapsed mouseup (same identity) dismisses"
);

// 4. The non-reading branch with a DIFFERENT identity still does not dismiss: the
//    identity guard runs first regardless of where the mouseup landed.
check(
  shouldDismissPopover({
    popoverIdAtMouseup: "pop-A",
    currentPopoverId: "pop-B",
    inReading: false,
    selectionCollapsed: true,
  }) === false,
  "non-reading mouseup with a new identity does not dismiss (guard runs first)"
);

// 5. A real drag range inside the reading pane (non-collapsed) does NOT dismiss:
//    this path opens a popover, it must not tear one down on the same gesture.
check(
  shouldDismissPopover({
    popoverIdAtMouseup: "pop-A",
    currentPopoverId: "pop-A",
    inReading: true,
    selectionCollapsed: false,
  }) === false,
  "non-collapsed drag in reading does not dismiss (it opens, not closes)"
);

// 6. No popover was showing at mouseup (popAtUp === null): there is nothing to
//    dismiss, and a later-opened popover (non-null current) keeps its identity
//    distinct, so the guard never fires.
check(
  shouldDismissPopover({
    popoverIdAtMouseup: null,
    currentPopoverId: "pop-B",
    inReading: true,
    selectionCollapsed: true,
  }) === false,
  "nothing showing at mouseup: a later-opened popover is never dismissed"
);

// 7. Both null (no popover at any point): trivially no dismissal.
check(
  shouldDismissPopover({
    popoverIdAtMouseup: null,
    currentPopoverId: null,
    inReading: true,
    selectionCollapsed: true,
  }) === false,
  "no popover present at all: no dismissal"
);

// --- Manual gaps: confirmed re-entry surfaces that are NOT pure-extractable ----
//
// The surface map (annotation-ui.js:1030-1056, :365-377; authority-picker.js:42-67;
// facsimile.js:174-184; source-view.js:190-197) lists deferred handlers whose
// correctness depends on real event ordering and real timer/await scheduling.
// Those cannot be reduced to a pure predicate without re-implementing the browser
// event loop. The CONFIRMED-RACES set handed to this proof is empty, so none is
// asserted here as a headless predicate. The timing-dependent re-entry points that
// the map flags as deferred are named below as manual checks so the gap is
// explicit rather than silent:
console.log("# manual: deferred-mouseup-vs-span-click ordering -> see test/acceptance/BROWSER-CHECKS.md VC-RACE-POPOVER");
console.log("# manual: maybeAutoReconcile 400ms lookup after popover teardown -> see test/acceptance/BROWSER-CHECKS.md VC-RACE-RECON");
console.log("# manual: authority lookup await resolving after reopen -> see test/acceptance/BROWSER-CHECKS.md VC-RACE-LOOKUP");
console.log("# manual: OSD addZoneOverlays firing against a stale surface -> see test/acceptance/BROWSER-CHECKS.md VC-RACE-FACS");

// --- summary -----------------------------------------------------------------

console.log("=".repeat(64));
if (failed === 0) {
  console.log(`PASSED (${passed}/${passed})`);
  console.log("Selection-popover dismissal honours the identity guard; timing-dependent re-entry is named in BROWSER-CHECKS.md.");
  process.exit(0);
} else {
  console.log(`FAILED (${passed}/${passed + failed}, ${failed} failing)`);
  process.exit(1);
}
