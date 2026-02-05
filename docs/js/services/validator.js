/**
 * teiCrafter – Validator Service
 * Multi-level validation for TEI-XML documents.
 *
 * Level 1: Plaintext comparison (original vs. transformed)
 * Level 2: Well-formedness (DOMParser)
 * Level 3: Schema validation (JSON profile)
 * Level 4: XPath rules (future – Phase 3)
 * Level 5: Expert-in-the-Loop (= review workflow)
 */

import * as schema from './schema.js';

/**
 * @typedef {Object} ValidationMessage
 * @property {'error'|'warning'|'info'} level
 * @property {'plaintext'|'wellformed'|'schema'|'xpath'|'expert'} source
 * @property {string} message
 * @property {number} [line] - 1-based line number
 * @property {string} [elementId]
 */

/**
 * Run all available validation levels on a TEI-XML document.
 *
 * @param {Object} params
 * @param {string} params.xml - Current TEI-XML string
 * @param {string} [params.originalPlaintext] - Original plaintext for comparison
 * @param {Map<string, string>} [params.reviewStatusMap] - elementId → status
 * @returns {ValidationMessage[]}
 */
export function validate({ xml, originalPlaintext, reviewStatusMap }) {
    const messages = [];

    if (!xml) {
        messages.push({
            level: 'error',
            source: 'wellformed',
            message: 'Kein XML-Dokument vorhanden.'
        });
        return messages;
    }

    // Level 2: Well-formedness
    const { doc, errors: wfErrors } = checkWellFormedness(xml);
    messages.push(...wfErrors);

    // Level 1: Plaintext comparison
    if (originalPlaintext && doc) {
        messages.push(...checkPlaintext(doc, originalPlaintext));
    }

    // Level 3: Schema validation
    if (doc && schema.isLoaded()) {
        messages.push(...checkSchema(doc, xml));
    }

    // Level 5: Expert review (unreviewed annotations)
    if (reviewStatusMap) {
        messages.push(...checkUnreviewed(reviewStatusMap));
    }

    return messages;
}

/**
 * Level 2: Check XML well-formedness.
 * @param {string} xml
 * @returns {{ doc: Document|null, errors: ValidationMessage[] }}
 */
export function checkWellFormedness(xml) {
    const errors = [];
    try {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const parseError = doc.querySelector('parsererror');

        if (parseError) {
            errors.push({
                level: 'error',
                source: 'wellformed',
                message: 'XML ist nicht wohlgeformt: ' + parseError.textContent.substring(0, 200)
            });
            return { doc: null, errors };
        }

        errors.push({
            level: 'info',
            source: 'wellformed',
            message: 'XML ist wohlgeformt.'
        });

        return { doc, errors };
    } catch (e) {
        errors.push({
            level: 'error',
            source: 'wellformed',
            message: 'XML-Parsing fehlgeschlagen: ' + e.message
        });
        return { doc: null, errors };
    }
}

/**
 * Level 1: Compare plaintext content.
 * Extracts text from the body element and compares with original.
 *
 * @param {Document} doc
 * @param {string} originalPlaintext
 * @returns {ValidationMessage[]}
 */
export function checkPlaintext(doc, originalPlaintext) {
    const messages = [];

    const body = doc.querySelector('body');
    if (!body) {
        messages.push({
            level: 'warning',
            source: 'plaintext',
            message: 'Kein body-Element gefunden \u2013 Plaintext-Vergleich nicht m\u00f6glich.'
        });
        return messages;
    }

    const extracted = (body.textContent || '').replace(/\s+/g, ' ').trim();
    const original = originalPlaintext.replace(/\s+/g, ' ').trim();

    if (extracted === original) {
        messages.push({
            level: 'info',
            source: 'plaintext',
            message: 'Plaintext identisch \u2013 kein Textinhalt ver\u00e4ndert.'
        });
    } else {
        // Calculate word-level similarity
        const similarity = wordSimilarity(original, extracted);
        const level = similarity >= 95 ? 'warning' : 'error';

        messages.push({
            level,
            source: 'plaintext',
            message: 'Plaintext-Abweichung erkannt (' + similarity + '% \u00c4hnlichkeit). ' +
                'Der Textinhalt wurde m\u00f6glicherweise durch die Transformation ver\u00e4ndert.'
        });
    }

    return messages;
}

/**
 * Level 3: Schema validation against the loaded JSON profile.
 *
 * @param {Document} doc
 * @param {string} xml - Original XML string (for line number calculation)
 * @returns {ValidationMessage[]}
 */
export function checkSchema(doc, xml) {
    const messages = [];
    const lines = xml.split('\n');

    // Walk all elements
    const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_ELEMENT);

    let elementCount = 0;
    let errorCount = 0;

    let node = walker.currentNode;
    while (node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.localName;
            elementCount++;

            // Check if element is known
            if (!schema.isKnownElement(tag)) {
                errorCount++;
                messages.push({
                    level: 'warning',
                    source: 'schema',
                    message: 'Unbekanntes Element <' + tag + '>',
                    line: findLineOfElement(tag, lines)
                });
            }

            // Check parent-child relationship
            if (node.parentNode && node.parentNode.nodeType === Node.ELEMENT_NODE) {
                const parentTag = node.parentNode.localName;
                if (schema.isKnownElement(parentTag) && !schema.isChildAllowed(parentTag, tag)) {
                    errorCount++;
                    messages.push({
                        level: 'warning',
                        source: 'schema',
                        message: '<' + tag + '> ist kein erlaubtes Kind von <' + parentTag + '>',
                        line: findLineOfElement(tag, lines)
                    });
                }
            }

            // Check attributes
            if (node.attributes) {
                for (const attr of node.attributes) {
                    const attrName = attr.name;
                    if (!schema.isAttributeKnown(tag, attrName)) {
                        errorCount++;
                        messages.push({
                            level: 'warning',
                            source: 'schema',
                            message: 'Unbekanntes Attribut @' + attrName + ' an <' + tag + '>',
                            line: findLineOfElement(tag, lines)
                        });
                    }
                }
            }
        }

        node = walker.nextNode();
    }

    // Summary
    if (errorCount === 0) {
        messages.push({
            level: 'info',
            source: 'schema',
            message: 'Schema-Validierung: ' + elementCount + ' Elemente gepr\u00fcft, keine Fehler.'
        });
    } else {
        messages.push({
            level: 'warning',
            source: 'schema',
            message: 'Schema-Validierung: ' + errorCount + ' Hinweise bei ' + elementCount + ' Elementen.'
        });
    }

    return messages;
}

/**
 * Level 5: Check for unreviewed annotations.
 * @param {Map<string, string>} reviewStatusMap
 * @returns {ValidationMessage[]}
 */
export function checkUnreviewed(reviewStatusMap) {
    const messages = [];
    let unreviewed = 0;

    for (const [, status] of reviewStatusMap) {
        if (status === 'offen') unreviewed++;
    }

    if (unreviewed > 0) {
        messages.push({
            level: 'warning',
            source: 'expert',
            message: unreviewed + ' Annotation' + (unreviewed !== 1 ? 'en' : '') + ' noch nicht gepr\u00fcft.'
        });
    } else if (reviewStatusMap.size > 0) {
        messages.push({
            level: 'info',
            source: 'expert',
            message: 'Alle ' + reviewStatusMap.size + ' Annotationen gepr\u00fcft.'
        });
    }

    return messages;
}

// --- Helpers ---

/**
 * Calculate word-level similarity between two strings.
 * @param {string} a
 * @param {string} b
 * @returns {number} Percentage (0-100)
 */
function wordSimilarity(a, b) {
    if (!a && !b) return 100;
    if (!a || !b) return 0;

    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));

    let common = 0;
    for (const w of wordsA) {
        if (wordsB.has(w)) common++;
    }

    return Math.round((common / Math.max(wordsA.size, wordsB.size)) * 100);
}

/**
 * Find the approximate line number of an element in XML text.
 * @param {string} tagName
 * @param {string[]} lines
 * @returns {number|undefined}
 */
function findLineOfElement(tagName, lines) {
    const pattern = '<' + tagName;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(pattern)) {
            return i + 1; // 1-based
        }
    }
    return undefined;
}
