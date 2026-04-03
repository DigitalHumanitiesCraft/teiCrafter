/**
 * teiCrafter Pipeline -- TEI Assembler (P.5)
 *
 * Combines teiHeader and body into a complete, valid TEI-XML document.
 * Orchestrates P.2 (header), P.3 (body elements), P.4 (div structure).
 */

import { buildTeiHeader } from './mods-to-header.js';
import { buildBodyElements } from './page-to-body.js';
import { structureDivs, inferDivType } from './div-structurer.js';

/**
 * Assemble a complete Minimal-TEI document from Page-JSON v0.2.
 *
 * @param {Object} pageJson - Full Page-JSON v0.2 object
 * @returns {string} Complete TEI-XML document
 */
export function assemble(pageJson) {
    const header = buildTeiHeader(pageJson);
    const elements = buildBodyElements(
        pageJson.pages || [],
        pageJson.source?.images || []
    );
    const divType = inferDivType(pageJson.source?.document_type);
    const body = structureDivs(elements, { divType })
        || '      <div/>'; // empty div for documents with no content pages

    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<TEI xmlns="http://www.tei-c.org/ns/1.0">',
        header,
        '  <text>',
        '    <body>',
        body,
        '    </body>',
        '  </text>',
        '</TEI>',
        '' // trailing newline
    ];

    return lines.join('\n');
}
