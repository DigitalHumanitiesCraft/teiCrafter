/**
 * teiCrafter – Source Panel
 * Displays the original plaintext source with Plaintext/Digitalisat tabs.
 * Used in Transform and Validate steps.
 */

import { escHtml } from './utils/dom.js';

/**
 * Create a source panel inside a container.
 *
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {string} options.content - Source text content
 * @param {string} [options.fileName='']
 * @param {boolean} [options.showDigitalisat=true]
 * @returns {{ destroy: function, setContent: function }}
 */
export function createSourcePanel(container, options = {}) {
    const { content = '', fileName = '', showDigitalisat = true } = options;

    const tabs = showDigitalisat
        ? '<div class="tab-group">' +
              '<button class="tab active" data-tab="plaintext">Plaintext</button>' +
              '<button class="tab" data-tab="digitalisat">Digitalisat</button>' +
          '</div>'
        : '<span class="panel-label">Quelltext</span>';

    const digitalisatTab = showDigitalisat
        ? '<div class="tab-content" data-tab="digitalisat">' +
              '<p class="placeholder-text">Digitalisat-Ansicht (nicht verf\u00fcgbar)</p>' +
          '</div>'
        : '';

    container.innerHTML =
        '<div class="panel-header">' + tabs + '</div>' +
        '<div class="panel-content">' +
            '<div class="tab-content active" data-tab="plaintext">' +
                '<pre class="source-text" id="source-text">' + escHtml(content) + '</pre>' +
            '</div>' +
            digitalisatTab +
        '</div>' +
        '<div class="panel-footer"><span class="source-filename">' + escHtml(fileName) + '</span></div>';

    // Tab switching
    if (showDigitalisat) {
        container.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                container.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                tab.classList.add('active');
                const target = container.querySelector('.tab-content[data-tab="' + tab.dataset.tab + '"]');
                if (target) target.classList.add('active');
            });
        });
    }

    return {
        destroy() {
            container.innerHTML = '';
        },
        setContent(newContent) {
            const pre = container.querySelector('#source-text');
            if (pre) pre.textContent = newContent;
        }
    };
}
