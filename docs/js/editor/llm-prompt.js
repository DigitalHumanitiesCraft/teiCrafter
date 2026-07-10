/**
 * teiCrafter Editor -- LLM prompt assembly and response extraction (DOM-free, pure).
 *
 * Composes the generation prompt from the project's own voice: an optional
 * project system prompt, the fixed lossless-TEI task instruction, the project's
 * phenomenon-to-TEI mapping (a Markdown document ingested elsewhere, or the
 * built-in per-source-type default for bare files), and the source text verbatim.
 * Kept pure and exported so both the on-ramp (gen-modal.js) and any future
 * model-assisted step use ONE assembler, and so a headless proof can pin it (the
 * ai-suggest.js / llm.js testability precedent). The network call lives elsewhere.
 */

/**
 * Build the generation prompt. Order: [system prompt] [task] [mapping] [source text].
 * Empty parts are omitted. The source text is carried verbatim (never altered),
 * because the task itself demands character-exact preservation.
 *
 * @param {{ text?: string, systemPrompt?: string, mapping?: string }} opts
 * @returns {string}
 */
export function buildGenerationPrompt({ text, systemPrompt = "", mapping = "" } = {}) {
  const parts = [];
  if (systemPrompt && systemPrompt.trim()) parts.push(systemPrompt.trim(), "");
  parts.push(
    "You are a TEI-XML assistant. Convert the source text into a well-formed TEI P5 document.",
    "Rules:",
    '1. Output a complete <TEI xmlns="http://www.tei-c.org/ns/1.0"> with a minimal <teiHeader> and <text><body>.',
    "2. Preserve every character of the source text exactly. Do not paraphrase, translate, or omit anything.",
    "3. Apply the mapping rules below where they fit; do not invent markup beyond them.",
    "4. Return ONLY the XML inside a single ```xml code block, with no commentary.",
    "",
  );
  if (mapping && mapping.trim()) parts.push(mapping.trim(), "");
  parts.push("Source text:", String(text == null ? "" : text));
  return parts.join("\n");
}

/**
 * Extract the XML payload from a model reply: prefer a fenced ```xml block, then
 * any fenced block, else the raw text from the first "<". Returns the XML string,
 * or null when nothing starts with "<".
 *
 * @param {string} resp
 * @returns {string|null}
 */
export function extractXml(resp) {
  if (!resp) return null;
  const fenced = resp.match(/```xml\s*([\s\S]*?)```/i) || resp.match(/```\s*([\s\S]*?)```/);
  let xml = (fenced ? fenced[1] : resp).trim();
  const lt = xml.indexOf("<");
  if (lt > 0) xml = xml.slice(lt);
  return xml.startsWith("<") ? xml : null;
}
