/**
 * teiCrafter – Overlay XML Editor
 * Textarea (transparent text, visible caret) overlaid on Pre (syntax-highlighted).
 * Scroll-synced, same CSS for both layers.
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

/**
 * Create an overlay editor inside a container element.
 *
 * @param {HTMLElement} container - The parent element
 * @param {Object} options
 * @param {string} [options.value=''] - Initial XML content
 * @param {boolean} [options.readOnly=false]
 * @param {function} [options.onChange] - Called with new value on input
 * @returns {{ textarea: HTMLTextAreaElement, destroy: function, getValue: function, setValue: function }}
 */
export function createOverlayEditor(container, options = {}) {
    const { value = '', readOnly = false, onChange = null } = options;

    // Clear container
    container.innerHTML = '';
    container.classList.add('editor-overlay');

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

    container.appendChild(pre);
    container.appendChild(textarea);

    // Highlight function
    function highlight(xml) {
        if (!xml) {
            pre.innerHTML = '\n'; // Ensure pre has height
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

        // Append a trailing newline so the pre matches textarea height
        pre.innerHTML = parts.join('') + '\n';
    }

    // Initial render
    textarea.value = value;
    highlight(value);

    // Scroll sync
    function syncScroll() {
        pre.scrollTop = textarea.scrollTop;
        pre.scrollLeft = textarea.scrollLeft;
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
    textarea.addEventListener('keydown', e => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + 2;
            onInput();
        }
    });

    return {
        textarea,
        destroy() {
            textarea.removeEventListener('scroll', syncScroll);
            textarea.removeEventListener('input', onInput);
            container.innerHTML = '';
            container.classList.remove('editor-overlay');
        },
        getValue() {
            return textarea.value;
        },
        setValue(xml) {
            textarea.value = xml;
            highlight(xml);
            syncScroll();
        }
    };
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
