export const MAPPING_ROLES = [
  "structure.dateline", "structure.opening_salutation", "structure.closing_formula",
  "structure.signature_line", "metadata.sender", "metadata.recipient", "metadata.date", "metadata.place",
];

const escapeXml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\r/g, "&#13;");
const validXml = (value) => [...String(value)].every((character) => {
  const point = character.codePointAt(0);
  return point === 9 || point === 10 || point === 13 || (point >= 32 && point <= 0xd7ff)
    || (point >= 0xe000 && point <= 0xfffd) || (point >= 0x10000 && point <= 0x10ffff);
});
const splitsSurrogate = (text, offset) => offset > 0 && offset < text.length
  && /[\uD800-\uDBFF]/.test(text[offset - 1]) && /[\uDC00-\uDFFF]/.test(text[offset]);

/** Validate exact UTF-16 spans against the immutable page transcription. */
export function validateDecisions(page, decisions) {
  const errors = [];
  if (!page || typeof page.text !== "string" || !page.text.length) return ["Page text is empty or missing."];
  if (!validXml(page.text)) errors.push("Page text contains characters that XML 1.0 cannot represent.");
  for (const key of ["id", "objectId", "pageNumber", "sourceHash"]) {
    if (page[key] == null || String(page[key]).length === 0 || !validXml(page[key])) errors.push(`Invalid page ${key}.`);
  }
  if (page.image != null && (typeof page.image !== "string"
    || !/^data\/editor\/szd-mapping-local\/[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(?:jpg|jpeg|png|webp)$/i.test(page.image)
    || page.image.includes(".."))) errors.push("Page image must be a safe local mapping image path.");
  if (!decisions || typeof decisions !== "object" || Array.isArray(decisions)) return [...errors, "Decisions must be an object."];
  for (const [role, decision] of Object.entries(decisions)) {
    if (role === "doc_type") {
      if (typeof decision !== "string" || !decision.trim() || !validXml(decision)) {
        errors.push("Document type must be a nonempty XML-compatible string.");
      }
      continue;
    }
    if (!MAPPING_ROLES.includes(role)) { errors.push(`Unknown mapping role: ${role}.`); continue; }
    if (!decision || !["present", "absent", "unresolved"].includes(decision.status)) {
      errors.push(`${role}: invalid decision status.`); continue;
    }
    if (!["rules", "jev", "manual"].includes(decision.origin) || typeof decision.reviewed !== "boolean") {
      errors.push(`${role}: origin and review status are required.`);
    }
    if (!validXml(JSON.stringify(decision))) errors.push(`${role}: invalid XML characters.`);
    if (decision.status !== "present") {
      if (decision.start != null || decision.end != null || (decision.value != null && decision.value !== "")) {
        errors.push(`${role}: absent or unresolved decisions cannot carry a text span.`);
      }
      continue;
    }
    const { start, end, value } = decision;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > page.text.length
      || splitsSurrogate(page.text, start) || splitsSurrogate(page.text, end)) {
      errors.push(`${role}: span offsets are empty, out of range, or split a Unicode character.`);
    } else if (typeof value !== "string" || page.text.slice(start, end) !== value) {
      errors.push(`${role}: span value does not match the source text.`);
    }
  }
  return errors;
}

/** Export a page draft with overlapping roles represented by stand-off spans. */
export function buildTei(page, decisions) {
  const errors = validateDecisions(page, decisions);
  if (errors.length) throw new Error(errors.join("\n"));
  const spans = Object.entries(decisions).filter(([role, decision]) => MAPPING_ROLES.includes(role) && decision.status === "present");
  const offsets = [...new Set(spans.flatMap(([, decision]) => [decision.start, decision.end]))].sort((a, b) => a - b);
  let body = "", previous = 0;
  for (const offset of offsets) {
    body += `${escapeXml(page.text.slice(previous, offset))}<anchor xml:id="offset-${offset}"/>`;
    previous = offset;
  }
  body += escapeXml(page.text.slice(previous));
  const records = Object.entries(decisions).map(([role, decision]) =>
    `        <note type="mapping-decision" subtype="${escapeXml(role)}">${escapeXml(JSON.stringify(decision))}</note>`).join("\n");
  const groups = spans.map(([role, decision]) =>
    `    <spanGrp type="${role}"><span from="#offset-${decision.start}" to="#offset-${decision.end}" resp="#origin-${decision.origin}">${escapeXml(decision.value)}</span></spanGrp>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt>
        <title>SZD local mapping draft: ${escapeXml(page.id)}</title>
        <respStmt xml:id="origin-rules"><resp>Rule-based proposal</resp><name>SZD mapping rules</name></respStmt>
        <respStmt xml:id="origin-jev"><resp>Imported proposal</resp><name>JEV</name></respStmt>
        <respStmt xml:id="origin-manual"><resp>Manual mapping decision</resp><name>Local editor</name></respStmt>
      </titleStmt>
      <publicationStmt><p>Unreviewed local draft. No complete letter structure is asserted.</p></publicationStmt>
      <notesStmt>
        <note type="draft-status">Unreviewed local draft; individual decisions retain their own review status.</note>
${records}
      </notesStmt>
      <sourceDesc><bibl><title>${escapeXml(page.objectId)}</title><idno type="page">${escapeXml(page.id)}</idno><idno type="source-hash">${escapeXml(page.sourceHash)}</idno></bibl></sourceDesc>
    </fileDesc>
  </teiHeader>
${groups ? `  <standOff>\n${groups}\n  </standOff>\n` : ""}${page.image ? `  <facsimile><surface xml:id="page-surface"><graphic url="${escapeXml(page.image)}"/></surface></facsimile>\n` : ""}  <text><body><pb n="${escapeXml(page.pageNumber)}"${page.image ? ' facs="#page-surface"' : ""}/><ab xml:space="preserve">${body}</ab></body></text>
</TEI>
`;
}
