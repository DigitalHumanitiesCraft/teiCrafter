/**
 * teiCrafter -- Constants
 *
 * Trimmed to what the editor-first build uses: the LLM provider ids (llm.js),
 * the source-type labels shown in the "New from text (LLM)" modal, and the
 * default TEI mapping rules per source type that seed the generation prompt.
 */

import { getSetting } from "../services/storage.js";

// True on a local development host (loopback or a file: URL).
const IS_LOCAL_DEV = typeof location !== "undefined" &&
  (["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) ||
    location.protocol === "file:");

// Feature flags. llmOnRamp shows or hides the "New from text (LLM)" entries;
// the landing-page card in index.html is static and changes with this flag.
// examples gates the built-in demo surfaces (landing cards, Load... menu
// entries, the #example deep link): visible during local development, hidden
// on the public deployment. This gates UI only; committed files under
// docs/data/ remain fetchable by URL.
export const FEATURES = Object.freeze({
  llmOnRamp: true,
  examples: IS_LOCAL_DEV,
});

// The single LLM capability gate, read at every AI entry point. AI is on only
// when the build allows it (FEATURES.llmOnRamp, the deployment default) AND the
// per-user runtime preference is not switched off. "Off" is therefore a coherent
// standalone editor: no AI surfaces at all, everything else deterministic and
// unchanged. getSetting is headless-safe (no localStorage yields the default), so
// this also evaluates outside the browser for the proofs.
export function llmEnabled() {
  return FEATURES.llmOnRamp && getSetting("llmEnabled", true) !== false;
}

// LLM provider ids (keys of the provider catalog in services/llm.js).
export const LLM_PROVIDERS = Object.freeze({
  GEMINI: 'gemini',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  DEEPSEEK: 'deepseek',
  QWEN: 'qwen',
  OLLAMA: 'ollama',
});

// Source types offered in the LLM on-ramp; each selects a default mapping below.
export const SOURCE_LABELS = Object.freeze({
  correspondence: 'Correspondence',
  print: 'Print',
  recipe: 'Recipe',
  bookkeeping: 'Account Book',
  wenzelsbibel: 'Wenzelsbibel (word-level)',
  generic: 'Document',
});

// Default mapping rules per source type. Plain-text guidance injected into the
// generation prompt; the user can refine the result in the editor afterwards.
const DEFAULT_MAPPINGS = Object.freeze({
  correspondence: 'Mapping rules:\n* <div> Entire letter\n* <pb> Page breaks\n* <dateline> Date reference\n* <persName> Person\n* <placeName> Place\n* <date when="YYYY-MM-DD"> Date',
  print: 'Mapping rules:\n* <div> Chapter\n* <head> Heading\n* <p> Paragraphs\n* <pb> Page breaks\n* <persName> Person\n* <placeName> Place',
  recipe: 'Mapping rules:\n* <div type="recipe"> Recipe\n* <head> Title\n* <p> Instructions\n* <name type="ingredient"> Ingredients\n* <measure> Quantities',
  bookkeeping: 'Mapping rules:\n* <div type="account"> Account\n* <head> Account heading\n* <persName> Person\n* <placeName> Place\n* <measure unit="fl|kr" quantity="N"> Amount\n* <date when="YYYY-MM-DD"> Date',
  wenzelsbibel: 'Mapping rules:\n* <pb facs="#surface_n"/> Folio break linked to facsimile\n* <l n="N"> Verse line\n* <lb/> Physical line break\n* <w xml:id="w_s_n"> Word token with stable id\n* <facsimile>/<surface>/<zone> Image zones\n* <standOff><note target="#w..."> Apparatus anchored to words',
  generic: 'Mapping rules:\n* <div> Division\n* <p> Paragraphs\n* <persName> Person\n* <placeName> Place',
});

export function getDefaultMapping(sourceType) {
  return DEFAULT_MAPPINGS[sourceType] || DEFAULT_MAPPINGS.generic;
}
