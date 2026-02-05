/**
 * teiCrafter – XML Tokenizer (State Machine)
 * Pure function: string → Array<Token>
 * Handles well-formed and malformed XML gracefully (no throw).
 */

export const TOKEN = Object.freeze({
    ELEMENT: 'element',
    ATTR_NAME: 'attrName',
    ATTR_VALUE: 'attrValue',
    DELIMITER: 'delimiter',
    COMMENT: 'comment',
    PI: 'pi',
    NAMESPACE: 'namespace',
    ENTITY: 'entity',
    TEXT: 'text'
});

/**
 * Tokenize an XML string into an array of tokens.
 * Each token: { type: string, value: string, start: number, end: number }
 * Invariant: tokens form a contiguous, non-overlapping coverage of the input.
 *
 * @param {string} xml
 * @returns {Array<{type: string, value: string, start: number, end: number}>}
 */
export function tokenize(xml) {
    if (!xml) return [];

    const tokens = [];
    const len = xml.length;
    let i = 0;

    while (i < len) {
        if (xml[i] === '<') {
            // Check for comment: <!-- ... -->
            if (xml.startsWith('<!--', i)) {
                const endIdx = xml.indexOf('-->', i + 4);
                if (endIdx !== -1) {
                    tokens.push({ type: TOKEN.COMMENT, value: xml.slice(i, endIdx + 3), start: i, end: endIdx + 3 });
                    i = endIdx + 3;
                } else {
                    // Unterminated comment: consume rest
                    tokens.push({ type: TOKEN.COMMENT, value: xml.slice(i), start: i, end: len });
                    i = len;
                }
                continue;
            }

            // Check for PI: <?...?>
            if (xml.startsWith('<?', i)) {
                const endIdx = xml.indexOf('?>', i + 2);
                if (endIdx !== -1) {
                    tokens.push({ type: TOKEN.PI, value: xml.slice(i, endIdx + 2), start: i, end: endIdx + 2 });
                    i = endIdx + 2;
                } else {
                    tokens.push({ type: TOKEN.PI, value: xml.slice(i), start: i, end: len });
                    i = len;
                }
                continue;
            }

            // Check for CDATA: <![CDATA[...]]>
            if (xml.startsWith('<![CDATA[', i)) {
                const endIdx = xml.indexOf(']]>', i + 9);
                if (endIdx !== -1) {
                    tokens.push({ type: TOKEN.TEXT, value: xml.slice(i, endIdx + 3), start: i, end: endIdx + 3 });
                    i = endIdx + 3;
                } else {
                    tokens.push({ type: TOKEN.TEXT, value: xml.slice(i), start: i, end: len });
                    i = len;
                }
                continue;
            }

            // Tag: opening, closing, or self-closing
            i = tokenizeTag(xml, i, len, tokens);
        } else if (xml[i] === '&') {
            // Entity reference
            const semi = xml.indexOf(';', i);
            if (semi !== -1 && semi - i < 12) {
                // Reasonable entity length
                tokens.push({ type: TOKEN.ENTITY, value: xml.slice(i, semi + 1), start: i, end: semi + 1 });
                i = semi + 1;
            } else {
                // Bare ampersand
                tokens.push({ type: TOKEN.TEXT, value: '&', start: i, end: i + 1 });
                i++;
            }
        } else {
            // Text content: consume until < or &
            const start = i;
            while (i < len && xml[i] !== '<' && xml[i] !== '&') i++;
            tokens.push({ type: TOKEN.TEXT, value: xml.slice(start, i), start, end: i });
        }
    }

    return tokens;
}

/**
 * Tokenize a single tag starting at position i (xml[i] === '<').
 * Returns the new position after the tag.
 */
function tokenizeTag(xml, i, len, tokens) {
    const tagStart = i;

    // Opening delimiter: < or </
    if (xml[i + 1] === '/') {
        tokens.push({ type: TOKEN.DELIMITER, value: '</', start: i, end: i + 2 });
        i += 2;
    } else {
        tokens.push({ type: TOKEN.DELIMITER, value: '<', start: i, end: i + 1 });
        i++;
    }

    // Element name (may include namespace prefix)
    const nameStart = i;
    while (i < len && !isWhitespace(xml[i]) && xml[i] !== '>' && xml[i] !== '/' && xml[i] !== '=') {
        i++;
    }

    if (i > nameStart) {
        const name = xml.slice(nameStart, i);
        // Check for namespace prefix (e.g., "tei:TEI")
        const colonIdx = name.indexOf(':');
        if (colonIdx > 0 && colonIdx < name.length - 1) {
            tokens.push({ type: TOKEN.NAMESPACE, value: name.slice(0, colonIdx + 1), start: nameStart, end: nameStart + colonIdx + 1 });
            tokens.push({ type: TOKEN.ELEMENT, value: name.slice(colonIdx + 1), start: nameStart + colonIdx + 1, end: i });
        } else {
            tokens.push({ type: TOKEN.ELEMENT, value: name, start: nameStart, end: i });
        }
    }

    // Attributes and closing
    while (i < len && xml[i] !== '>') {
        // Skip whitespace
        if (isWhitespace(xml[i])) {
            i++;
            continue;
        }

        // Self-closing />
        if (xml[i] === '/' && i + 1 < len && xml[i + 1] === '>') {
            tokens.push({ type: TOKEN.DELIMITER, value: '/>', start: i, end: i + 2 });
            return i + 2;
        }

        // Attribute name
        const attrStart = i;
        while (i < len && !isWhitespace(xml[i]) && xml[i] !== '=' && xml[i] !== '>' && xml[i] !== '/') {
            i++;
        }

        if (i > attrStart) {
            const attrName = xml.slice(attrStart, i);
            // Check for xmlns namespace declarations
            if (attrName === 'xmlns' || attrName.startsWith('xmlns:')) {
                tokens.push({ type: TOKEN.NAMESPACE, value: attrName, start: attrStart, end: i });
            } else {
                tokens.push({ type: TOKEN.ATTR_NAME, value: attrName, start: attrStart, end: i });
            }
        }

        // Skip whitespace around =
        while (i < len && isWhitespace(xml[i])) i++;

        // = sign
        if (i < len && xml[i] === '=') {
            tokens.push({ type: TOKEN.DELIMITER, value: '=', start: i, end: i + 1 });
            i++;

            // Skip whitespace after =
            while (i < len && isWhitespace(xml[i])) i++;

            // Attribute value
            if (i < len && (xml[i] === '"' || xml[i] === "'")) {
                const quote = xml[i];
                const valStart = i;
                i++; // skip opening quote
                while (i < len && xml[i] !== quote) i++;
                if (i < len) i++; // skip closing quote
                tokens.push({ type: TOKEN.ATTR_VALUE, value: xml.slice(valStart, i), start: valStart, end: i });
            }
        }
    }

    // Closing >
    if (i < len && xml[i] === '>') {
        tokens.push({ type: TOKEN.DELIMITER, value: '>', start: i, end: i + 1 });
        i++;
    }

    return i;
}

function isWhitespace(ch) {
    return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}
