/**
 * teiCrafter -- Constants
 *
 * Trimmed to what the editor-first build uses: the LLM provider ids (llm.js),
 * the source-type labels shown in the "New from text (LLM)" modal, and the
 * default TEI mapping rules per source type that seed the generation prompt.
 */

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
