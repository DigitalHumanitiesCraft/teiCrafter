/** Human-readable terminology for source-specific navigation channels. */

const LABELS = Object.freeze({
  pages: ["page", "pages"],
  "corpus-members": ["corpus member", "corpus members"],
  entries: ["entry", "entries"],
  "speech-turns": ["speech turn", "speech turns"],
  "table-rows": ["table row", "table rows"],
  records: ["record", "records"],
  "source-documents": ["source document", "source documents"],
  sections: ["section", "sections"],
  surfaces: ["surface", "surfaces"],
  document: ["document", "documents"],
});

export function unitTerms(sourceProfile) {
  const id = sourceProfile?.navigation?.primary?.id || "document";
  const [singular, plural] = LABELS[id] || ["unit", "units"];
  return { id, singular, plural };
}

export function unitPositionLabel(state, index) {
  const terms = unitTerms(state?.sourceProfile);
  const units = state?.folios || [];
  const unit = units[index] || null;
  const sourceLabel = unit?.navigationUnit?.label || unit?.n || null;
  const position = `${terms.singular} ${index + 1}/${units.length}`;
  if (!sourceLabel || sourceLabel.toLowerCase() === `${terms.singular} ${index + 1}`) return position;
  return `${position} (${sourceLabel})`;
}
