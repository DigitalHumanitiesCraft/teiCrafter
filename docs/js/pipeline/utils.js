/**
 * teiCrafter Pipeline -- XML Utilities
 * Shared helpers for deterministic XML generation.
 * Pure ES6 -- works in Node.js and browser.
 */

/**
 * Escape XML special characters in text content.
 * @param {string} text
 * @returns {string}
 */
export function esc(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Build an XML element string.
 * @param {string} tag
 * @param {Object|null} attrs - Attributes (null/empty values omitted)
 * @param {string|null} content - Text content (escaped) or null for self-closing
 * @returns {string}
 */
export function el(tag, attrs, content) {
    const attrStr = formatAttrs(attrs);
    if (content == null) return `<${tag}${attrStr}/>`;
    return `<${tag}${attrStr}>${esc(content)}</${tag}>`;
}

/**
 * Build an XML element with raw (pre-escaped) inner XML.
 * @param {string} tag
 * @param {Object|null} attrs
 * @param {string} innerXml
 * @returns {string}
 */
export function elRaw(tag, attrs, innerXml) {
    const attrStr = formatAttrs(attrs);
    if (!innerXml) return `<${tag}${attrStr}/>`;
    return `<${tag}${attrStr}>${innerXml}</${tag}>`;
}

/**
 * Format attributes object to XML attribute string.
 * @param {Object|null} attrs
 * @returns {string} e.g. ' type="main" n="1"'
 */
export function formatAttrs(attrs) {
    if (!attrs) return '';
    return Object.entries(attrs)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => ` ${k}="${esc(String(v))}"`)
        .join('');
}

/**
 * Indent every non-empty line of text by N spaces.
 * @param {string} text
 * @param {number} spaces
 * @returns {string}
 */
export function ind(text, spaces) {
    const pad = ' '.repeat(spaces);
    return text.split('\n').map(l => l.trim() ? pad + l : '').join('\n');
}

/** ISO 639-1 code to language name. */
const LANG_NAMES = {
    de: 'Deutsch', en: 'English', fr: 'Fran\u00e7ais',
    it: 'Italiano', es: 'Espa\u00f1ol', la: 'Latina',
    pt: 'Portugu\u00eas', nl: 'Nederlands', pl: 'Polski',
    cs: 'Cesky', hu: 'Magyar'
};

/**
 * Get human-readable language name for ISO code.
 * @param {string} code
 * @returns {string}
 */
export function langName(code) {
    return LANG_NAMES[code] || code;
}
