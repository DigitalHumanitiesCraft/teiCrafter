/** Explicit creation templates. Existing XML is never converted to a template. */
import { teiFromPlaintext } from "./plaintext-import.js";
import { escapeText, parseDocument, spliceDocument, walk, isTeiElement } from "./tei-document.js";

export const STARTER_PROFILES = Object.freeze([
  { id: "generic", label: "Plain transcription", help: "Blank lines separate paragraphs. |2| starts the next page. No genre-specific markup is inferred." },
  { id: "letter", label: "Letter", help: "Create a letter division and record only the correspondence facts you supply. Salutation and signature remain in the transcription." },
  { id: "charter", label: "Charter", help: "Create a charter division. Abbreviations, witnesses and diplomatic structure can then be encoded from the source." },
  { id: "legal", label: "Historical legal source", help: "Create a legal-source division. Use Metadata and Index to describe and annotate the source." },
  { id: "dictionary", label: "Dictionary entries", entries: true, help: "Separate entries with a blank line. The first line is the headword; following lines are its definition. Creates TEI entry/form/sense structures." },
  { id: "articles", label: "Encyclopedia articles", entries: true, help: "Separate articles with a blank line. The first line is the heading; following lines are its text. Creates TEI div/head/p structures." },
]);

export function starterEntries(text) {
  return String(text).replace(/\r\n|\r/g, "\n").split(/\n[ \t]*\n+/)
    .filter((part) => part.trim()).map((part) => {
      const [headword, ...lines] = part.split("\n");
      return { headword, text: lines.join("\n") };
    });
}

const find = (doc, name) => {
  let found = null;
  walk(doc.root, (node) => { if (!found && isTeiElement(node, name)) found = node; });
  return found;
};

export function draftFilename(title) {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Strip characters forbidden in portable filenames.
  let base = String(title || "untitled").replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").replace(/[. ]+$/, "").trim();
  base = base.replace(/\.xml$/i, "") || "untitled";
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base)) base = "document-" + base;
  return base + ".xml";
}

export function teiFromStarter({ text, title, profile = "generic", metadata = {}, images = [] }) {
  const template = STARTER_PROFILES.find((item) => item.id === profile);
  if (!template) throw new Error("Choose a supported document starter.");
  if (!String(text || "").trim()) throw new Error("Add a transcription or at least one entry.");
  if (template.entries && images.length) throw new Error("Remove page images before creating entries, or choose a page-based transcription starter.");
  let doc = parseDocument(teiFromPlaintext(text, title, { images }));
  const body = find(doc, "body");
  if (template.entries) {
    const entries = starterEntries(text).map((entry, index) => {
      const heading = escapeText(entry.headword);
      const content = escapeText(entry.text).replace(/\n/g, "<lb/>");
      return profile === "dictionary"
        ? `      <entry xml:id="entry_${index + 1}"><form type="lemma"><orth>${heading}</orth></form>${content ? `<sense><def>${content}</def></sense>` : ""}</entry>`
        : `      <div type="entry" xml:id="entry_${index + 1}"><head>${heading}</head><p>${content}</p></div>`;
    });
    doc = spliceDocument(doc, body.contentStart, body.contentEnd, "\n" + entries.join("\n") + "\n    ");
  } else if (profile !== "generic") {
    const type = profile === "legal" ? "legal-source" : profile;
    const content = doc.raw.slice(body.contentStart, body.contentEnd);
    doc = spliceDocument(doc, body.contentStart, body.contentEnd, `\n      <div type="${type}">${content}</div>\n    `);
  }
  if (metadata.source?.trim()) {
    const source = find(doc, "sourceDesc");
    doc = spliceDocument(doc, source.contentStart, source.contentEnd, `<p>${escapeText(metadata.source)}</p>`);
  }
  if (profile === "letter") {
    const field = (tag, value) => value?.trim() ? `<${tag}>${escapeText(value)}</${tag}>` : "";
    const sent = field("persName", metadata.sender) + field("placeName", metadata.place) + field("date", metadata.date);
    const received = field("persName", metadata.recipient);
    if (sent || received) {
      const header = find(doc, "teiHeader");
      const description = `<profileDesc><correspDesc>${sent ? `<correspAction type="sent">${sent}</correspAction>` : ""}${received ? `<correspAction type="received">${received}</correspAction>` : ""}</correspDesc></profileDesc>`;
      doc = spliceDocument(doc, header.contentEnd, header.contentEnd, `    ${description}\n  `);
    }
  }
  return doc.raw;
}
