/**
 * teiCrafter – Overlay XML Editor
 * Textarea (transparent text, visible caret) overlaid on Pre (syntax-highlighted).
 * Scroll-synced, same CSS for both layers.
 * Gutter with line numbers and confidence markers.
 */

import { tokenize, TOKEN } from './tokenizer.js';

// CSS class mapping for token types
const TOKEN_CLASS = Object.freeze({
    [TOKEN.ELEMENT]:    'xml-element',
    [TOKEN.ATTR_NAME]:  'xml-attr',
    [TOKEN.ATTR_VALUE]: 'xml-value',
    [TOKEN.DELIMITER]:  'xml-delimiter',
    [TOKEN.COMMENT]:    'xml-comment',
    [TOKEN.PI]:         'xml-pi',
    [TOKEN.NAMESPACE]:  'xml-namespace',
    [TOKEN.ENTITY]:     'xml-entity',
    [TOKEN.TEXT]:        ''  // no wrapper needed
});

// Confidence → CSS modifier for gutter markers
const CONFIDENCE_PRIORITY = ['problematisch', 'pruefenswert', 'sicher', 'manuell'];

/**
 * Create an overlay editor inside a container element.
 *
 * @param {HTMLElement} container - The parent element
 * @param {Object} options
 * @param {string} [options.value=''] - Initial XML content
 * @param {boolean} [options.readOnly=false]
 * @param {function} [options.onChange] - Called with new value on input
 * @param {boolean} [options.showGutter=true] - Show line numbers and confidence markers
 * @returns {EditorInstance}
 *
 * @typedef {Object} EditorInstance
 * @property {HTMLTextAreaElement} textarea
 * @property {function} destroy
 * @property {function(): string} getValue
 * @property {function(string): void} setValue
 * @property {function(Map<number, string>): void} setLineConfidence - Map of lineNumber → confidence
 * @property {function(): number} getLineCount
 */
export function createOverlayEditor(container, options = {}) {
    const { value = '', readOnly = false, onChange = null, showGutter = true } = options;

    // Clear container
    container.innerHTML = '';
    container.classList.add('editor-overlay');
    if (showGutter) container.classList.add('editor-has-gutter');

    // Gutter
    let gutter = null;
    if (showGutter) {
        gutter = document.createElement('div');
        gutter.className = 'editor-gutter';
        gutter.setAttribute('aria-hidden', 'true');
        container.appendChild(gutter);
    }

    // Editor area (contains pre + textarea)
    const editorArea = document.createElement('div');
    editorArea.className = 'editor-area';
    container.appendChild(editorArea);

    // Pre (highlighted layer)
    const pre = document.createElement('pre');
    pre.className = 'editor-pre';
    pre.setAttribute('aria-hidden', 'true');

    // Textarea (input layer)
    const textarea = document.createElement('textarea');
    textarea.className = 'editor-textarea';
    textarea.spellcheck = false;
    textarea.autocomplete = 'off';
    textarea.autocorrect = 'off';
    textarea.autocapitalize = 'off';
    textarea.setAttribute('data-gramm', 'false'); // Grammarly
    textarea.wrap = 'off';
    textarea.readOnly = readOnly;

    editorArea.appendChild(pre);
    editorArea.appendChild(textarea);

    // Line confidence state
    let lineConfidenceMap = new Map();

    // Highlight function
    function highlight(xml) {
        if (!xml) {
            pre.innerHTML = '\n';
            updateGutter(1);
            return;
        }

        const tokens = tokenize(xml);
        const parts = [];

        for (const token of tokens) {
            const escaped = escapeForPre(token.value);
            const cls = TOKEN_CLASS[token.type];
            if (cls) {
                parts.push('<span class="' + cls + '">' + escaped + '</span>');
            } else {
                parts.push(escaped);
            }
        }

        pre.innerHTML = parts.join('') + '\n';
        updateGutter(xml.split('\n').length);
    }

    // Gutter rendering
    function updateGutter(lineCount) {
        if (!gutter) return;

        const lines = [];
        for (let i = 1; i <= lineCount; i++) {
            const conf = lineConfidenceMap.get(i) || '';
            const markerClass = conf ? ' gutter-marker-' + conf : '';
            lines.push(
                '<div class="gutter-line' + markerClass + '">' +
                    '<span class="gutter-number">' + i + '</span>' +
                '</div>'
            );
        }
        gutter.innerHTML = lines.join('');
    }

    // Initial render
    textarea.value = value;
    highlight(value);

    // Scroll sync (gutter, pre, and textarea)
    function syncScroll() {
        pre.scrollTop = textarea.scrollTop;
        pre.scrollLeft = textarea.scrollLeft;
        if (gutter) {
            gutter.scrollTop = textarea.scrollTop;
        }
    }

    textarea.addEventListener('scroll', syncScroll);

    // Input handler
    let rafPending = false;

    function onInput() {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(() => {
            rafPending = false;
            highlight(textarea.value);
            if (onChange) onChange(textarea.value);
        });
    }

    textarea.addEventListener('input', onInput);

    // Tab key: insert 2 spaces
    function onKeydown(e) {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + 2;
            onInput();
        }
    }

    textarea.addEventListener('keydown', onKeydown);

    return {
        textarea,
        destroy() {
            textarea.removeEventListener('scroll', syncScroll);
            textarea.removeEventListener('input', onInput);
            textarea.removeEventListener('keydown', onKeydown);
            container.innerHTML = '';
            container.classList.remove('editor-overlay', 'editor-has-gutter');
        },
        getValue() {
            return textarea.value;
        },
        setValue(xml) {
            textarea.value = xml;
            highlight(xml);
            syncScroll();
        },
        setLineConfidence(map) {
            lineConfidenceMap = map;
            updateGutter(textarea.value.split('\n').length);
        },
        getLineCount() {
            return textarea.value.split('\n').length;
        }
    };
}

/**
 * Compute line-level confidence from a per-element confidence map and XML string.
 * Returns a Map<lineNumber, dominantConfidence> where the dominant confidence
 * follows priority: problematisch > pruefenswert > sicher > manuell.
 *
 * @param {string} xml
 * @param {Map<string, string>} confidenceMap - elementId → confidence
 * @returns {Map<number, string>}
 */
export function computeLineConfidence(xml, confidenceMap) {
    const lineMap = new Map();
    if (!xml || confidenceMap.size === 0) return lineMap;

    // Parse XML to find elements with confidence
    try {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.querySelector('parsererror')) return lineMap;

        // Walk all elements, find their line positions
        const lines = xml.split('\n');
        for (const [elementId, conf] of confidenceMap) {
            // Find line containing this element (simple: search by id or tag occurrence)
            // For now, this is a placeholder that maps conf to line 0
            // Full implementation will use element position tracking
        }
    } catch (e) {
        // Ignore parsing errors
    }

    return lineMap;
}

/**
 * Escape HTML entities for display in the pre layer.
 */
function escapeForPre(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
