/**
 * teiCrafter – DOM Utilities
 * Safe DOM helpers, HTML escaping, toast notifications, dialogs.
 */

import { TOAST_DURATION, TOAST_DURATION_ERROR } from './constants.js';

// --- Selectors ---

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => root.querySelectorAll(selector);

// --- HTML Escaping (XSS prevention) ---

const ESC_MAP = Object.freeze({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
});

export function escHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, ch => ESC_MAP[ch]);
}

// --- Regex-based XML Syntax Highlighting ---

export function highlightXml(xml) {
    return escHtml(xml)
        .replace(/(&lt;\/?[\w:-]+)/g, '<span class="xml-tag">$1</span>')
        .replace(/(&gt;)/g, '<span class="xml-tag">$1</span>')
        .replace(/(\s)([\w:-]+)(=)/g, '$1<span class="xml-attr">$2</span>$3')
        .replace(/(=)(&quot;[^&]*&quot;|"[^"]*")/g, '$1<span class="xml-value">$2</span>');
}

// --- Toast Notifications ---

let toastContainer = null;

function ensureToastContainer() {
    if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('aria-live', 'polite');
    toastContainer.setAttribute('role', 'status');
    document.body.appendChild(toastContainer);
    return toastContainer;
}

/**
 * Show a toast notification.
 * @param {string} message - Text content (will be escaped)
 * @param {'info'|'success'|'warning'|'error'} type
 */
export function showToast(message, type = 'info') {
    const container = ensureToastContainer();
    const duration = type === 'error' ? TOAST_DURATION_ERROR : TOAST_DURATION;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    const timer = setTimeout(() => removeToast(toast), duration);
    toast.addEventListener('click', () => {
        clearTimeout(timer);
        removeToast(toast);
    });
}

function removeToast(toast) {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    // Fallback if transition doesn't fire
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 400);
}

// --- Dialog ---

/**
 * Show a modal dialog. Returns a Promise that resolves to the clicked button's value.
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.body - HTML content (must be pre-sanitized)
 * @param {Array<{label: string, value: string, primary?: boolean}>} options.buttons
 * @returns {Promise<string>}
 */
export function showDialog({ title, body, buttons }) {
    return new Promise(resolve => {
        const backdrop = document.createElement('div');
        backdrop.className = 'dialog-backdrop';

        const dialog = document.createElement('div');
        dialog.className = 'dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', title);

        const titleEl = document.createElement('h3');
        titleEl.className = 'dialog-title';
        titleEl.textContent = title;

        const bodyEl = document.createElement('div');
        bodyEl.className = 'dialog-body';
        bodyEl.innerHTML = body;

        const actionsEl = document.createElement('div');
        actionsEl.className = 'dialog-actions';

        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = btn.primary ? 'btn-primary' : 'btn-secondary';
            button.textContent = btn.label;
            button.addEventListener('click', () => {
                backdrop.remove();
                resolve(btn.value);
            });
            actionsEl.appendChild(button);
        });

        dialog.appendChild(titleEl);
        dialog.appendChild(bodyEl);
        dialog.appendChild(actionsEl);
        backdrop.appendChild(dialog);

        // Close on backdrop click
        backdrop.addEventListener('click', e => {
            if (e.target === backdrop) {
                backdrop.remove();
                resolve(null);
            }
        });

        // Close on Escape
        const onKey = e => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', onKey);
                backdrop.remove();
                resolve(null);
            }
        };
        document.addEventListener('keydown', onKey);

        document.body.appendChild(backdrop);

        // Focus first button
        const firstBtn = dialog.querySelector('button');
        if (firstBtn) firstBtn.focus();
    });
}

// --- ARIA Live Region ---

let ariaLiveRegion = null;

export function setAriaLive(message) {
    if (!ariaLiveRegion) {
        ariaLiveRegion = document.createElement('div');
        ariaLiveRegion.setAttribute('role', 'status');
        ariaLiveRegion.setAttribute('aria-live', 'polite');
        ariaLiveRegion.className = 'sr-only';
        document.body.appendChild(ariaLiveRegion);
    }
    ariaLiveRegion.textContent = message;
}
