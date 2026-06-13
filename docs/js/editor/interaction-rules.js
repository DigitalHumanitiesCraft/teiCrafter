/**
 * teiCrafter Editor -- pure interaction-layer rules.
 *
 * DOM-free decision logic lifted out of the event handlers so the part that
 * carries a bug-or-no-bug decision can be proven headlessly
 * (test/tools/interaction_check.mjs) and cannot drift from the handler that uses
 * it. The DOM and timing around these rules (which handler fires when, what the
 * live selection is) stay in the handlers and are covered by the named manual
 * checks in test/acceptance/BROWSER-CHECKS.md.
 */

/**
 * Should the selection popover that was showing at mouseup time be dismissed?
 *
 * The deferred document mouseup runs after the span-click handler, which may have
 * replaced #ed-sel-pop with a fresh popover. The identity guard is the core: only
 * dismiss when the popover showing NOW is the SAME node captured at mouseup, so a
 * collapsed-selection click never tears down the popover it just opened.
 *
 * @param {{ popoverIdAtMouseup: *, currentPopoverId: *, inReading: boolean, selectionCollapsed: boolean }} state
 *   popoverIdAtMouseup: the #ed-sel-pop identity captured at mouseup (null if none);
 *   currentPopoverId: the #ed-sel-pop identity now, at fire time (null if none);
 *   inReading: whether the mouseup landed inside the reading pane;
 *   selectionCollapsed: whether the live selection is collapsed (a caret, not a drag).
 * @returns {boolean} True when the stale popover should be removed.
 */
export function shouldDismissPopover({ popoverIdAtMouseup, currentPopoverId, inReading, selectionCollapsed }) {
  // The identity guard: only the popover captured at mouseup is dismissed. A
  // freshly opened popover (new identity) survives a stale collapsed mouseup.
  const sameIdentity = currentPopoverId !== null && currentPopoverId === popoverIdAtMouseup;
  if (!sameIdentity) return false;
  // Outside the reading pane the stale popover is dismissed.
  if (!inReading) return true;
  // A real (non-collapsed) range inside the reading pane is a drag that OPENS a
  // popover, not a dismissal; only a collapsed caret click dismisses.
  if (!selectionCollapsed) return false;
  return true;
}
