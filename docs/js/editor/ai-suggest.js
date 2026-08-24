/**
 * teiCrafter Editor -- AI annotation-proposal helpers (DOM-free, pure).
 *
 * Builds the prompt sent to the in-browser LLM (services/llm.js) and parses its
 * reply into normalised annotation proposals. General by design: a proposal is not
 * only a named entity but any TEI construct the project's mapping declares (markup,
 * textual criticism, an editorial note), so the layer serves editions, dictionaries,
 * corpora alike. Kept free of DOM and project imports so the parser is provable
 * headless; the network call lives in the integrator, and proposal-apply.js turns a
 * parsed proposal into a lossless, resp-marked engine edit. Every proposal is
 * inserted as resp="#ai" (AI-proposed, unverified) and confirmed or rejected by a
 * human.
 */

// Map a model's free-form type label onto a teiCrafter entity type, or undefined.
export const SUGGEST_TYPE = Object.freeze({
  person: "person", persons: "person", people: "person", per: "person",
  place: "place", places: "place", location: "place", loc: "place", geo: "place",
  org: "org", orgs: "org", organisation: "org", organization: "org",
  work: "work", works: "work", title: "work", bibl: "work",
  event: "event", events: "event",
});

export const PROPOSAL_KINDS = Object.freeze(["entity", "markup", "criticism", "note"]);
const CRIT_KINDS = new Set(["unclear", "del", "add", "gap"]);
// XML name (NCName approximation): enough to reject injection, not a full spec.
const RE_XML_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/**
 * The proposal prompt: extract the project's declared TEI constructs that ACTUALLY
 * appear in the text, as a JSON array. opts carries the project voice: systemPrompt
 * (the project's editorial instructions), mapping (its Markdown phenomenon-to-TEI
 * guidance), and vocabulary (the markup elements the project allows). All optional.
 */
export function buildSuggestPrompt(text, opts = {}) {
  const { systemPrompt = "", mapping = "", vocabulary = [] } = opts;
  const parts = [];
  if (systemPrompt && systemPrompt.trim()) parts.push(systemPrompt.trim(), "");
  parts.push(
    "You assist a TEI editor. From the transcribed text below, propose the TEI",
    "annotations that ACTUALLY appear in it. Do not invent or infer anything that is",
    "not present. Use the exact surface form as written for each span.",
    "Every span must be non-empty and contained within one text line. Copy it",
    "verbatim, including capitalization and punctuation; never cross a line break.",
    "",
    "Return ONLY a JSON array, no prose and no code fence. Each element is one of:",
    '  {"kind":"entity","type":"person|place|org|work|event","name":"<canonical>","span":"<surface form>"}',
    '  {"kind":"markup","element":"<TEI element>","attributes":{"when":"1879"},"span":"<surface form>"}',
    '  {"kind":"criticism","critKind":"unclear|del|add|gap","span":"<surface form>"}',
    '  {"kind":"note","text":"<editorial note>","span":"<surface form>"}',
    "If there is nothing to propose, return [].",
    "",
  );
  if (Array.isArray(vocabulary) && vocabulary.length) {
    parts.push("Allowed markup elements (use only these for kind=markup): " + vocabulary.join(", "), "");
  }
  if (mapping && mapping.trim()) parts.push("Mapping guidance:", mapping.trim(), "");
  parts.push("TEXT:", String(text == null ? "" : text));
  return parts.join("\n");
}

const str = (v) => String(v == null ? "" : v).trim();

function normEntity(item) {
  const type = SUGGEST_TYPE[str(item.type).toLowerCase()];
  const name = str(item.name);
  if (!type || !name) return null;
  return { kind: "entity", type, name, span: str(item.span) || name };
}
function normMarkup(item) {
  const element = str(item.element);
  const span = str(item.span);
  if (!RE_XML_NAME.test(element) || !span) return null;
  const attributes = {};
  if (item.attributes && typeof item.attributes === "object" && !Array.isArray(item.attributes)) {
    for (const [k, v] of Object.entries(item.attributes)) {
      if (RE_XML_NAME.test(k) && (typeof v === "string" || typeof v === "number")) attributes[k] = String(v);
    }
  }
  return { kind: "markup", element, attributes, span };
}
function normCriticism(item) {
  const critKind = str(item.critKind || item.element || item.tag).toLowerCase();
  const span = str(item.span);
  if (!CRIT_KINDS.has(critKind) || !span) return null;
  const out = { kind: "criticism", critKind, span };
  if (str(item.reason)) out.reason = str(item.reason);
  return out;
}
function normNote(item) {
  const text = str(item.text);
  const span = str(item.span);
  if (!text || !span) return null;
  return { kind: "note", text, span };
}

/**
 * Parse an LLM reply into normalised proposals [{ kind, span, ... }]. Tolerates a
 * surrounding code fence and leading/trailing prose, infers kind "entity" for a
 * legacy {type,name} item (back-compat), drops malformed or unknown items, and
 * de-duplicates. Never throws: returns [] on anything it cannot read.
 */
export function parseSuggestions(raw) {
  if (raw == null) return [];
  let s = String(raw).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const i = s.indexOf("[");
  const j = s.lastIndexOf("]");
  if (i === -1 || j === -1 || j < i) return [];
  let arr;
  try { arr = JSON.parse(s.slice(i, j + 1)); } catch { return []; }
  if (!Array.isArray(arr)) return [];

  const out = [];
  const seen = new Set();
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    let kind = str(item.kind).toLowerCase();
    if (!PROPOSAL_KINDS.includes(kind)) kind = item.type != null ? "entity" : "";
    let p = null;
    if (kind === "entity") p = normEntity(item);
    else if (kind === "markup") p = normMarkup(item);
    else if (kind === "criticism") p = normCriticism(item);
    else if (kind === "note") p = normNote(item);
    if (!p) continue;
    const tag = p.type || p.element || p.critKind || "note";
    const key = `${p.kind}|${tag}|${p.span.toLowerCase()}|${(p.name || p.text || "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
