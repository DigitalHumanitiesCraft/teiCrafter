/**
 * teiCrafter – Constants and Configuration
 * Shared enums, demo configs, icons, and design tokens.
 */

// --- Enums ---

export const CONFIDENCE = Object.freeze({
    SICHER: 'sicher',
    PRUEFENSWERT: 'pruefenswert',
    PROBLEMATISCH: 'problematisch',
    MANUELL: 'manuell'
});

export const REVIEW_STATUS = Object.freeze({
    OFFEN: 'offen',
    AKZEPTIERT: 'akzeptiert',
    EDITIERT: 'editiert',
    VERWORFEN: 'verworfen'
});

export const ENTITY_TYPES = Object.freeze({
    PERS_NAME: 'persName',
    PLACE_NAME: 'placeName',
    ORG_NAME: 'orgName',
    DATE: 'date',
    BIBL: 'bibl',
    TERM: 'term'
});

export const LLM_PROVIDERS = Object.freeze({
    GEMINI: 'gemini',
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
    DEEPSEEK: 'deepseek',
    QWEN: 'qwen',
    OLLAMA: 'ollama'
});

// --- Annotation Tags ---

export const ANNOTATION_TAGS = Object.freeze([
    'persName', 'placeName', 'orgName', 'date', 'name',
    'bibl', 'term', 'measure', 'foreign'
]);

// --- Limits ---

export const MAX_UNDO = 100;
export const KEYSTROKE_DEBOUNCE = 500;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const TOAST_DURATION = 4000;
export const TOAST_DURATION_ERROR = 8000;

// --- Source Types ---

export const SOURCE_LABELS = Object.freeze({
    correspondence: 'Correspondence',
    bookkeeping: 'Account Book',
    print: 'Print',
    recipe: 'Recipe',
    generic: 'Document'
});

// --- Demo Configurations ---

export const DEMO_CONFIGS = Object.freeze({
    'bookkeeping': {
        name: 'Account Book',
        subtitle: 'DEPCHA',
        desc: 'Financial document',
        icon: 'book',
        sourceType: 'bookkeeping',
        files: {
            plaintext: '../data/demo/plaintext/rentrechnung-1718.txt',
            mapping: '../data/demo/mappings/bookkeeping-depcha.md',
            expectedOutput: '../data/demo/expected-output/rentrechnung-1718-tei.xml'
        }
    },
    'recipe': {
        name: 'Recipe',
        subtitle: 'DoCTA',
        desc: 'Medieval',
        icon: 'recipe',
        sourceType: 'recipe',
        files: {
            plaintext: '../data/demo/plaintext/recipe-medieval.txt',
            mapping: '../data/demo/mappings/recipe-docta.md',
            expectedOutput: '../data/demo/expected-output/recipe-medieval-tei.xml'
        }
    }
});

// --- SVG Icons ---

export const ICONS = Object.freeze({
    letter: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    book: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    recipe: '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    upload: '<svg class="dropzone-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="12" y2="12"/><line x1="15" y1="15" x2="12" y2="12"/></svg>',
    success: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>'
});

// --- Default Mapping Rules ---

const DEFAULT_MAPPINGS = Object.freeze({
    correspondence: 'Mapping rules:\n* <div> Entire letter\n* <pb> Page breaks "|{n}|"\n* <dateline> Date reference\n* <persName> Person\n* <placeName> Place\n* <date> when={YYYY-MM-DD}',
    bookkeeping: 'Mapping rules:\n* <div type="account" ana="bk:account"> Account\n* <head> Account heading\n* <persName> Person\n* <placeName> Place\n* <measure ana="bk:money" unit="fl|kr" quantity="N"> Amount\n* <date when="YYYY-MM-DD"> Date',
    print: 'Mapping rules:\n* <div> Chapter\n* <head> Heading\n* <p> Paragraphs\n* <pb> Page breaks\n* <persName> Person\n* <placeName> Place',
    recipe: 'Mapping rules:\n* <div type="recipe"> Recipe\n* <head> Title\n* <p> Instructions\n* <name type="ingredient"> Ingredients\n* <measure> Quantities',
    generic: 'Mapping rules:\n* <div> Division\n* <p> Paragraphs\n* <persName> Person\n* <placeName> Place'
});

export function getDefaultMapping(sourceType) {
    return DEFAULT_MAPPINGS[sourceType] || DEFAULT_MAPPINGS.generic;
}
