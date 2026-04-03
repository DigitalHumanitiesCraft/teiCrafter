/**
 * teiCrafter Pipeline -- PAGE-to-Body Mapping (P.3)
 *
 * Deterministic mapping from Page-JSON v0.2 pages (with optional
 * layout regions) to a flat list of TEI body elements.
 *
 * Region type mapping:
 *   paragraph  -> <p>
 *   heading    -> <head>
 *   table      -> <table>
 *   marginalia -> <note type="marginalia">
 *   list       -> <p>  (simplified for Minimal-TEI)
 *   header     -> <fw type="header">
 *   footer     -> <fw type="footer">
 *   other      -> <p>
 */

import { esc, formatAttrs } from './utils.js';

/**
 * @typedef {Object} BodyElement
 * @property {string} tag - TEI element name (p, head, pb, table, note, fw)
 * @property {string|null} text - Text content (null for self-closing)
 * @property {Object} [attrs] - XML attributes
 * @property {boolean} [selfClosing] - True for <pb/>
 */

/**
 * Convert Page-JSON pages to a flat array of TEI body elements.
 * Handles pages with and without layout regions.
 *
 * @param {Array} pages - pageJson.pages array
 * @param {Array} images - pageJson.source.images array (for facs URIs)
 * @returns {BodyElement[]}
 */
export function buildBodyElements(pages, images) {
    const elements = [];

    for (const page of pages) {
        // <pb/> for every page
        const facs = images?.[page.page - 1] || null;
        elements.push({
            tag: 'pb',
            text: null,
            attrs: { n: String(page.page), facs },
            selfClosing: true
        });

        // Skip blank and color_chart pages
        if (page.type !== 'content') continue;
        if (!page.text?.trim()) continue;

        if (page.regions?.length) {
            elements.push(...regionsToElements(page));
        } else {
            elements.push(...textToElements(page.text));
        }
    }

    return elements;
}

/**
 * Distribute page text across layout regions and map to TEI elements.
 * Lines are allocated proportionally based on each region's `lines` count.
 */
function regionsToElements(page) {
    const elements = [];
    const textLines = page.text.split('\n');
    const sorted = [...page.regions].sort((a, b) => (a.reading_order || 0) - (b.reading_order || 0));

    let lineIdx = 0;

    for (const region of sorted) {
        const count = region.lines || 1;
        const chunk = textLines.slice(lineIdx, lineIdx + count);
        lineIdx += count;

        const text = chunk.join('\n').trim();
        if (!text) continue;

        elements.push(regionToElement(region.type, text));
    }

    // Leftover lines (text beyond what regions account for)
    if (lineIdx < textLines.length) {
        const leftover = textLines.slice(lineIdx).join('\n').trim();
        if (leftover) {
            elements.push({ tag: 'p', text: leftover });
        }
    }

    return elements;
}

/**
 * Map a region type to a TEI element.
 * @param {string} type - Region type from layout analysis
 * @param {string} text - Region text content
 * @returns {BodyElement}
 */
function regionToElement(type, text) {
    switch (type) {
        case 'heading':
            return { tag: 'head', text };
        case 'paragraph':
            return { tag: 'p', text };
        case 'table':
            return { tag: 'table', text, attrs: {} };
        case 'marginalia':
            return { tag: 'note', text, attrs: { type: 'marginalia', place: 'margin' } };
        case 'header':
            return { tag: 'fw', text, attrs: { type: 'header', place: 'top' } };
        case 'footer':
            return { tag: 'fw', text, attrs: { type: 'footer', place: 'bottom' } };
        default:
            // list, unknown types -> paragraph
            return { tag: 'p', text };
    }
}

/**
 * Split plain text (no regions) into paragraph elements.
 * Double newlines mark paragraph boundaries.
 */
function textToElements(text) {
    return text
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => ({ tag: 'p', text: p }));
}

/**
 * Render a single BodyElement to XML string.
 * @param {BodyElement} elem
 * @param {number} indent - Number of spaces
 * @returns {string}
 */
export function renderElement(elem, indent) {
    const pad = ' '.repeat(indent);
    const attrStr = formatAttrs(elem.attrs);

    if (elem.selfClosing || elem.text == null) {
        return `${pad}<${elem.tag}${attrStr}/>`;
    }

    // Table gets special wrapping
    if (elem.tag === 'table') {
        const rows = elem.text.split('\n').filter(Boolean);
        const inner = rows.map(r => `${pad}  <row><cell>${esc(r)}</cell></row>`).join('\n');
        return `${pad}<table${attrStr}>\n${inner}\n${pad}</table>`;
    }

    return `${pad}<${elem.tag}${attrStr}>${esc(elem.text)}</${elem.tag}>`;
}
