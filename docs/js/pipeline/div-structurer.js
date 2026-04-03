/**
 * teiCrafter Pipeline -- div Structurer (P.4)
 *
 * Heading-based heuristic for wrapping body elements in <div> sections.
 * Deterministic -- no LLM needed for simple cases.
 *
 * Rules:
 * 1. No <head> elements: wrap everything in one <div>
 * 2. Elements before first <head>: introductory <div> (without head)
 * 3. Each <head> starts a new <div>
 * 4. <pb/> before a <head> goes into the new <div>
 * 5. Single <head> for entire document: one <div> with that head
 */

import { renderElement } from './page-to-body.js';

/**
 * Structure a flat element list into nested <div> sections.
 *
 * @param {import('./page-to-body.js').BodyElement[]} elements
 * @param {Object} [opts]
 * @param {string} [opts.divType] - Value for div/@type (e.g. 'chapter', 'letter')
 * @returns {string} XML body content (indented, ready for <body>)
 */
export function structureDivs(elements, opts = {}) {
    if (!elements.length) return '';

    // Letters and short documents: single div (headings are envelope/letterhead, not chapters)
    if (opts.divType === 'letter' || !elements.some(e => e.tag === 'head')) {
        return renderDiv(elements, opts.divType);
    }

    // Split elements at each <head> boundary
    const groups = splitAtHeads(elements);

    return groups
        .filter(g => g.length > 0)
        .map(g => renderDiv(g, opts.divType))
        .join('\n');
}

/**
 * Split elements into groups, each starting with a <head>.
 * Elements before the first <head> form their own group.
 * <pb/> immediately before a <head> moves to the new group.
 */
function splitAtHeads(elements) {
    const groups = [];
    let current = [];

    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];

        if (el.tag === 'head' && current.length > 0) {
            // Move trailing <pb/> elements to the new group
            const pendingPbs = [];
            while (current.length && current[current.length - 1].tag === 'pb') {
                pendingPbs.unshift(current.pop());
            }

            // Only push current group if it has content (not just pbs)
            if (current.length > 0) {
                groups.push(current);
            }

            current = [...pendingPbs, el];
        } else {
            current.push(el);
        }
    }

    if (current.length > 0) {
        groups.push(current);
    }

    return groups;
}

/**
 * Render a single <div> containing the given elements.
 */
function renderDiv(elements, divType) {
    const typeAttr = divType ? ` type="${divType}"` : '';
    const inner = elements
        .map(el => renderElement(el, 8))
        .join('\n');

    return `      <div${typeAttr}>\n${inner}\n      </div>`;
}

/**
 * Determine div type from document metadata.
 * @param {string} documentType - source.document_type from Page-JSON
 * @returns {string|undefined}
 */
export function inferDivType(documentType) {
    switch (documentType) {
        case 'letter': return 'letter';
        case 'manuscript': return 'chapter';
        default: return undefined;
    }
}
