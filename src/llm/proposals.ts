/**
 * Model-assisted edit proposals for one selected XML range. The model sees the
 * selection with read-only context and answers in a delimited plain-text
 * format; the answer becomes a Proposal only when its replacement is a
 * well-formed fragment. Nothing here edits the document: applying stays a
 * human decision through src/core/proposal.js.
 */
import type { Proposal } from "../core/proposal.js";
import { parseDocument, tokenize } from "../core/tei-document.js";
import type { CompletionProvider } from "./provider";

export type { Proposal };

export interface EditRequest {
  raw: string;
  from: number;
  to: number;
  instruction: string;
  /** Characters of read-only context sent on each side of the selection. */
  contextChars?: number;
}

export interface ProposeEditInput extends EditRequest {
  provider: CompletionProvider;
  signal?: AbortSignal;
}

/** A refusal the editor should show as is, distinct from network or provider failures. */
export class ProposalError extends Error {
  override name = "ProposalError";
}

export const MODEL_ORIGIN = "model";
const DEFAULT_CONTEXT = 800;

// Plain marker lines cannot occur as a line of well-formed XML on their own,
// so they delimit the XML without escaping and survive a stray code fence.
const BEGIN_REPLACEMENT = "BEGIN REPLACEMENT";
const END_REPLACEMENT = "END REPLACEMENT";
const BEGIN_RATIONALE = "BEGIN RATIONALE";
const END_RATIONALE = "END RATIONALE";

const NAME = /^[\p{L}_:][\p{L}\p{N}_.:-]*$/u;
const ATTRIBUTE = /\s+([^\s=/>"']+)\s*=\s*("[^"<]*"|'[^'<]*')/g;
// A fragment carries no DTD, so only the predefined entities and character references resolve.
const UNRESOLVED_REFERENCE = /&(?!(?:lt|gt|quot|apos|amp|#\d+|#x[0-9a-fA-F]+);)/;
const FRAGMENT_ROOT = "teicrafter-fragment";

/**
 * Well-formedness of an XML fragment without a DOM, so it runs in Node and in
 * workers. The tokenizer in tei-document.js is lenient by design; this check
 * adds the strictness it leaves out (tag balance, attribute syntax, entity
 * references, unterminated constructs). Returns null when the fragment is
 * well-formed, else a message naming the first problem.
 */
export function checkFragment(xml: string): string | null {
  const stack: string[] = [];
  for (const token of tokenize(xml)) {
    const source = xml.slice(token.start, token.end);
    switch (token.t) {
      case "text":
        if (UNRESOLVED_REFERENCE.test(source)) return "Text contains an unescaped & or an undefined entity.";
        if (source.includes("]]>")) return "Text contains the sequence ]]>.";
        break;
      case "comment":
        if (!source.endsWith("-->") || source.slice(4, -3).includes("--")) return "A comment is malformed or unterminated.";
        break;
      case "cdata":
        if (!source.endsWith("]]>")) return "A CDATA section is unterminated.";
        break;
      case "pi":
        if (!source.endsWith("?>")) return "A processing instruction is unterminated.";
        break;
      case "decl":
      case "doctype":
        return "A fragment may not contain an XML declaration or DOCTYPE.";
      case "etag": {
        const match = /^<\/([^\s>]+)\s*>$/.exec(source);
        if (!match) return "An end tag is malformed or unterminated.";
        const open = stack.pop();
        if (open !== match[1]) {
          return open ? `</${match[1]}> closes <${open}>.` : `</${match[1]}> has no matching start tag.`;
        }
        break;
      }
      default: {
        const problem = checkStartTag(source, token.name ?? "");
        if (problem) return problem;
        if (token.t === "stag") stack.push(token.name ?? "");
      }
    }
  }
  if (stack.length) return `<${stack[stack.length - 1]}> is not closed.`;
  // The lenient tree must agree: one wrapper element that closes at the very end.
  const wrapped = `<${FRAGMENT_ROOT}>${xml}</${FRAGMENT_ROOT}>`;
  const top = parseDocument(wrapped).root.children ?? [];
  if (top.length !== 1 || top[0].etagEnd !== wrapped.length) return "The fragment does not nest as one balanced unit.";
  return null;
}

function checkStartTag(source: string, name: string): string | null {
  if (!source.endsWith(">")) return `<${name}> is unterminated.`;
  if (!NAME.test(name)) return `"${name}" is not an XML name.`;
  const body = source.slice(1 + name.length, source.endsWith("/>") ? -2 : -1);
  const seen = new Set<string>();
  let invalid = false;
  const rest = body.replace(ATTRIBUTE, (_all, attr: string, value: string) => {
    if (!NAME.test(attr) || seen.has(attr) || UNRESOLVED_REFERENCE.test(value)) invalid = true;
    seen.add(attr);
    return "";
  });
  if (invalid) return `<${name}> has an invalid, duplicate or unescaped attribute.`;
  if (rest.trim() !== "") return `<${name}> has malformed attribute syntax.`;
  return null;
}

/** The prompt for one edit; exported so a caller can show exactly what is sent. */
export function buildEditPrompt({ raw, from, to, instruction, contextChars = DEFAULT_CONTEXT }: EditRequest): string {
  const before = raw.slice(Math.max(0, from - contextChars), from);
  const after = raw.slice(to, to + contextChars);
  return [
    "You assist a TEI XML editor. Rewrite only the SELECTED XML according to the instruction.",
    "Rules:",
    "1. Return the exact replacement XML for the selected XML only. Never repeat the context before or after it.",
    "2. The replacement must be a well-formed fragment: every element it opens it also closes, and it closes nothing it did not open.",
    "3. Keep every character of text content unless the instruction asks to change it. Do not add a DOCTYPE or XML declaration.",
    "4. Give a rationale of exactly one sentence.",
    "Answer in exactly this format, with nothing before or after it:",
    BEGIN_REPLACEMENT,
    "<the replacement XML>",
    END_REPLACEMENT,
    BEGIN_RATIONALE,
    "<one sentence>",
    END_RATIONALE,
    "",
    "INSTRUCTION:",
    instruction.trim(),
    "",
    "CONTEXT BEFORE (read-only):",
    before,
    "",
    "SELECTED XML:",
    raw.slice(from, to),
    "",
    "CONTEXT AFTER (read-only):",
    after,
  ].join("\n");
}

function block(answer: string, begin: string, end: string): string | null {
  const open = new RegExp(`^[ \\t]*${begin}[ \\t]*\\n`, "m").exec(answer);
  if (!open) return null;
  const startAt = open.index + open[0].length;
  const close = new RegExp(`\\n?^[ \\t]*${end}[ \\t]*$`, "m").exec(answer.slice(startAt));
  return close ? answer.slice(startAt, startAt + close.index) : null;
}

/** Parse a model answer into replacement and rationale, tolerating CRLF and a code fence around the XML. */
export function parseEditAnswer(answer: string): { replacement: string; rationale: string } {
  const normalized = String(answer ?? "").replace(/\r\n?/g, "\n");
  let replacement = block(normalized, BEGIN_REPLACEMENT, END_REPLACEMENT);
  const rationale = block(normalized, BEGIN_RATIONALE, END_RATIONALE)?.replace(/\s+/g, " ").trim();
  if (replacement === null) throw new ProposalError("The model answer has no replacement block.");
  if (!rationale) throw new ProposalError("The model answer has no rationale.");
  const fenced = /^```[\w-]*\n([\s\S]*?)\n?```$/.exec(replacement.trim());
  if (fenced) replacement = fenced[1];
  return { replacement, rationale };
}

/**
 * Ask the provider for a replacement of raw[from, to). Refuses before the call
 * when the selection is not itself a balanced fragment, because splicing a
 * balanced replacement over an unbalanced range would break the document.
 * Refuses after the call when the replacement is not a well-formed fragment or
 * changes nothing.
 */
export async function proposeEdit(input: ProposeEditInput): Promise<Proposal> {
  const { raw, from, to, instruction, provider, signal } = input;
  if (!(Number.isInteger(from) && Number.isInteger(to) && 0 <= from && from < to && to <= raw.length)) {
    throw new ProposalError("Select a non-empty range of the document first.");
  }
  if (!instruction?.trim()) throw new ProposalError("Describe the change you want proposed.");
  const slice = raw.slice(from, to);
  const sliceProblem = checkFragment(slice);
  if (sliceProblem) throw new ProposalError(`The selection is not a complete XML fragment: ${sliceProblem}`);

  const answer = await provider.complete(buildEditPrompt(input), { signal });
  const { replacement, rationale } = parseEditAnswer(answer);
  const problem = checkFragment(replacement);
  if (problem) throw new ProposalError(`The proposed replacement is not well-formed: ${problem}`);
  if (replacement === slice) throw new ProposalError("The model proposed no change.");
  return { from, to, replacement, rationale, origin: MODEL_ORIGIN };
}
