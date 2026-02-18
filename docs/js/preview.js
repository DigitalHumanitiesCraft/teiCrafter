/**
 * teiCrafter – Interactive Preview & Review
 * Renders annotated TEI-XML as inline-highlighted HTML.
 * Supports inline review (hover → Accept/Edit/Reject) and
 * batch keyboard review (N/P/A/R/E/Escape).
 */

import { escHtml } from './utils/dom.js';
import { CONFIDENCE, REVIEW_STATUS, ENTITY_TYPES, ANNOTATION_TAGS } from './utils/constants.js';

/**
 * Create an interactive preview panel.
 *
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {string} options.xml - TEI-XML string
 * @param {Map<string, string>} [options.confidenceMap] - elementId → confidence category
 * @param {Map<string, string>} [options.reviewStatusMap] - elementId → review status
 * @param {function} [options.onReview] - Called with { elementId, action, tagName, text }
 * @param {function} [options.onFocus] - Called with { elementId } when an annotation is focused
 * @returns {PreviewInstance}
 *
 * @typedef {Object} PreviewInstance
 * @property {function} destroy
 * @property {function(string)} updateXml - Re-render with new XML
 * @property {function(Map)} updateConfidence - Update confidence display
 * @property {function(Map)} updateReviewStatus - Update review status display
 * @property {function} startBatchReview - Enter batch review mode
 * @property {function} stopBatchReview - Exit batch review mode
 * @property {function(string)} focusAnnotation - Scroll to and highlight a specific annotation
 * @property {function(): Object} getStats - Get current review statistics
 */
export function createPreview(container, options = {}) {
    let {
        xml = '',
        confidenceMap = new Map(),
        reviewStatusMap = new Map(),
        onReview = null,
        onFocus = null
    } = options;

    // Internal state
    let annotations = [];       // Array<{ id, tagName, text, confidence, reviewStatus }>
    let batchMode = false;
    let batchIndex = -1;
    let currentHoverId = null;

    // Build DOM structure
    container.innerHTML = '';
    container.classList.add('preview-container');

    // Batch review bar (hidden initially)
    const batchBar = document.createElement('div');
    batchBar.className = 'batch-review-bar';
    batchBar.setAttribute('aria-live', 'polite');
    batchBar.style.display = 'none';
    container.appendChild(batchBar);

    // Preview content
    const contentEl = document.createElement('div');
    contentEl.className = 'preview-body';
    container.appendChild(contentEl);

    // Hover bar (floats near annotation)
    const hoverBar = document.createElement('div');
    hoverBar.className = 'review-hover-bar';
    hoverBar.style.display = 'none';
    hoverBar.innerHTML =
        '<button class="hover-btn hover-accept" data-action="akzeptiert" title="Accept (A)">&#10003; Accept</button>' +
        '<button class="hover-btn hover-edit" data-action="editiert" title="Edit (E)">&#9998; Edit</button>' +
        '<button class="hover-btn hover-reject" data-action="verworfen" title="Reject (R)">&#10005; Reject</button>';
    container.appendChild(hoverBar);

    // Hover bar click handler
    hoverBar.addEventListener('click', e => {
        const btn = e.target.closest('.hover-btn');
        if (!btn || !currentHoverId) return;
        const action = btn.dataset.action;
        performReview(currentHoverId, action);
        hideHoverBar();
    });

    // --- Rendering ---

    function render() {
        if (!xml) {
            contentEl.innerHTML = '<p class="placeholder-text">Vorschau erscheint nach Transformation</p>';
            annotations = [];
            return;
        }

        try {
            const doc = new DOMParser().parseFromString(xml, 'application/xml');
            if (doc.querySelector('parsererror')) {
                contentEl.innerHTML = '<p class="placeholder-text">XML-Parsing-Fehler</p>';
                annotations = [];
                return;
            }

            const body = doc.querySelector('body');
            if (!body) {
                contentEl.innerHTML = '<p class="placeholder-text">Kein body-Element gefunden</p>';
                annotations = [];
                return;
            }

            annotations = [];
            const html = convertNode(body);
            contentEl.innerHTML = '<div class="tei-preview">' + html + '</div>';

            // Attach listeners to annotation spans
            contentEl.querySelectorAll('.entity[data-entity-id]').forEach(el => {
                el.addEventListener('mouseenter', onAnnotationHover);
                el.addEventListener('mouseleave', onAnnotationLeave);
                el.addEventListener('click', onAnnotationClick);
            });

        } catch (e) {
            contentEl.innerHTML = '<p class="placeholder-text">Vorschau-Fehler</p>';
            annotations = [];
        }
    }

    /**
     * Convert an XML node to HTML string, recursively.
     * Annotation elements become <span class="entity ..."> with data attributes.
     */
    function convertNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return escHtml(node.textContent);
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const tag = node.localName;

        // Handle annotation elements
        if (ANNOTATION_TAGS.includes(tag)) {
            const id = getElementId(node, tag);
            const conf = confidenceMap.get(id) || CONFIDENCE.PRUEFENSWERT;
            const status = reviewStatusMap.get(id) || REVIEW_STATUS.OFFEN;
            const text = node.textContent;

            annotations.push({ id, tagName: tag, text, confidence: conf, reviewStatus: status });

            const confClass = 'conf-' + conf;
            const statusClass = 'status-' + status;
            const children = Array.from(node.childNodes).map(convertNode).join('');

            return '<span class="entity ' + escHtml(tag) + ' ' + confClass + ' ' + statusClass + '"' +
                ' data-entity-id="' + escHtml(id) + '"' +
                ' data-tag="' + escHtml(tag) + '"' +
                ' data-confidence="' + escHtml(conf) + '"' +
                ' data-status="' + escHtml(status) + '"' +
                ' title="&lt;' + escHtml(tag) + '&gt; — ' + escHtml(conf) + '"' +
                '>' + children + '</span>';
        }

        // Structural elements
        switch (tag) {
            case 'p':
                return '<p class="tei-p">' + childrenHtml(node) + '</p>';
            case 'head':
                return '<h3 class="tei-head">' + childrenHtml(node) + '</h3>';
            case 'div':
                return '<div class="tei-div">' + childrenHtml(node) + '</div>';
            case 'pb':
                return '<hr class="tei-pb">';
            case 'lb':
                return '<br>';
            case 'opener':
            case 'closer':
            case 'salute':
            case 'signed':
            case 'dateline':
                return '<div class="tei-' + tag + '">' + childrenHtml(node) + '</div>';
            default:
                return childrenHtml(node);
        }
    }

    function childrenHtml(node) {
        return Array.from(node.childNodes).map(convertNode).join('');
    }

    let idCounter = 0;
    function getElementId(node, tagName) {
        // Try xml:id first, then generate one
        const xmlId = node.getAttribute('xml:id') || node.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'id');
        if (xmlId) return xmlId;
        idCounter++;
        return tagName + '-' + idCounter;
    }

    // --- Hover bar ---

    function onAnnotationHover(e) {
        if (batchMode) return; // In batch mode, hover bar is suppressed
        const el = e.currentTarget;
        const id = el.dataset.entityId;
        const status = reviewStatusMap.get(id) || REVIEW_STATUS.OFFEN;

        // Only show hover bar for non-accepted (reviewable) annotations
        if (status === REVIEW_STATUS.AKZEPTIERT) return;

        currentHoverId = id;
        showHoverBar(el);
    }

    function onAnnotationLeave(e) {
        // Delay hiding to allow mouse to reach the hover bar
        setTimeout(() => {
            if (!hoverBar.matches(':hover') && !e.currentTarget.matches(':hover')) {
                hideHoverBar();
            }
        }, 150);
    }

    function onAnnotationClick(e) {
        const id = e.currentTarget.dataset.entityId;
        if (onFocus) onFocus({ elementId: id });
    }

    function showHoverBar(targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        hoverBar.style.display = 'flex';
        hoverBar.style.top = (rect.bottom - containerRect.top + container.scrollTop + 4) + 'px';
        hoverBar.style.left = (rect.left - containerRect.left) + 'px';
    }

    function hideHoverBar() {
        currentHoverId = null;
        hoverBar.style.display = 'none';
    }

    // Keep hover bar alive when hovering over it
    hoverBar.addEventListener('mouseleave', hideHoverBar);

    // --- Review action ---

    function performReview(elementId, action) {
        // Update local state
        reviewStatusMap.set(elementId, action);

        // If accept, upgrade confidence to sicher
        if (action === REVIEW_STATUS.AKZEPTIERT) {
            confidenceMap.set(elementId, CONFIDENCE.SICHER);
        } else if (action === REVIEW_STATUS.EDITIERT) {
            confidenceMap.set(elementId, CONFIDENCE.MANUELL);
        }

        // Update DOM element
        const el = contentEl.querySelector('[data-entity-id="' + CSS.escape(elementId) + '"]');
        if (el) {
            // Remove old status classes
            el.classList.remove('status-offen', 'status-akzeptiert', 'status-editiert', 'status-verworfen');
            el.classList.add('status-' + action);

            // Update confidence class too
            const newConf = confidenceMap.get(elementId);
            if (newConf) {
                el.classList.remove('conf-sicher', 'conf-pruefenswert', 'conf-problematisch', 'conf-manuell');
                el.classList.add('conf-' + newConf);
                el.dataset.confidence = newConf;
            }
            el.dataset.status = action;
        }

        // Notify caller
        const ann = annotations.find(a => a.id === elementId);
        if (onReview) {
            onReview({
                elementId,
                action,
                tagName: ann?.tagName || '',
                text: ann?.text || ''
            });
        }

        // Update batch bar if in batch mode
        if (batchMode) updateBatchBar();
    }

    // --- Batch review mode ---

    function startBatchReview() {
        batchMode = true;
        batchIndex = -1;
        hideHoverBar();
        batchBar.style.display = 'flex';
        updateBatchBar();
        nextReviewable();

        // Add keyboard listener
        document.addEventListener('keydown', onBatchKeydown);
    }

    function stopBatchReview() {
        batchMode = false;
        batchIndex = -1;
        batchBar.style.display = 'none';
        unfocusAll();
        document.removeEventListener('keydown', onBatchKeydown);
    }

    function onBatchKeydown(e) {
        if (!batchMode) return;

        switch (e.key.toLowerCase()) {
            case 'n':
                e.preventDefault();
                nextReviewable();
                break;
            case 'p':
                e.preventDefault();
                prevReviewable();
                break;
            case 'a':
                e.preventDefault();
                if (batchIndex >= 0 && batchIndex < annotations.length) {
                    performReview(annotations[batchIndex].id, REVIEW_STATUS.AKZEPTIERT);
                    nextReviewable();
                }
                break;
            case 'r':
                e.preventDefault();
                if (batchIndex >= 0 && batchIndex < annotations.length) {
                    performReview(annotations[batchIndex].id, REVIEW_STATUS.VERWORFEN);
                    nextReviewable();
                }
                break;
            case 'e':
                e.preventDefault();
                if (batchIndex >= 0 && batchIndex < annotations.length) {
                    performReview(annotations[batchIndex].id, REVIEW_STATUS.EDITIERT);
                    nextReviewable();
                }
                break;
            case 'escape':
                e.preventDefault();
                stopBatchReview();
                break;
        }
    }

    function nextReviewable() {
        const start = batchIndex + 1;
        for (let i = start; i < annotations.length; i++) {
            const status = reviewStatusMap.get(annotations[i].id) || REVIEW_STATUS.OFFEN;
            if (status === REVIEW_STATUS.OFFEN) {
                focusBatchAnnotation(i);
                return;
            }
        }
        // No more reviewable: show completion message
        updateBatchBar();
    }

    function prevReviewable() {
        const start = batchIndex - 1;
        for (let i = start; i >= 0; i--) {
            const status = reviewStatusMap.get(annotations[i].id) || REVIEW_STATUS.OFFEN;
            if (status === REVIEW_STATUS.OFFEN) {
                focusBatchAnnotation(i);
                return;
            }
        }
    }

    function focusBatchAnnotation(index) {
        unfocusAll();
        batchIndex = index;
        const ann = annotations[index];
        if (!ann) return;

        const el = contentEl.querySelector('[data-entity-id="' + CSS.escape(ann.id) + '"]');
        if (el) {
            el.classList.add('annotation-focused');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        if (onFocus) onFocus({ elementId: ann.id });
        updateBatchBar();
    }

    function unfocusAll() {
        contentEl.querySelectorAll('.annotation-focused').forEach(el => {
            el.classList.remove('annotation-focused');
        });
    }

    function updateBatchBar() {
        const stats = getStats();
        const current = batchIndex >= 0 ? annotations[batchIndex] : null;

        let html = '<div class="batch-progress">' +
            '<span class="batch-count">Review: ' + stats.reviewed + ' / ' + stats.total + ' gepr\u00fcft</span>' +
            '<div class="batch-progress-bar">' +
                '<div class="batch-progress-fill" style="width:' + (stats.total > 0 ? Math.round(stats.reviewed / stats.total * 100) : 0) + '%"></div>' +
            '</div>' +
        '</div>';

        if (current) {
            html += '<div class="batch-current">' +
                '<span class="batch-tag">&lt;' + escHtml(current.tagName) + '&gt;</span> ' +
                '<span class="batch-text">' + escHtml(current.text.substring(0, 40)) + '</span>' +
            '</div>';
        } else if (stats.remaining === 0) {
            html += '<div class="batch-complete">Alle Annotationen gepr\u00fcft!</div>';
        }

        html += '<div class="batch-keys">' +
            '<kbd>N</kbd> N\u00e4chste <kbd>P</kbd> Vorige ' +
            '<kbd>A</kbd> Accept <kbd>R</kbd> Reject <kbd>E</kbd> Edit ' +
            '<kbd>Esc</kbd> Beenden' +
        '</div>';

        batchBar.innerHTML = html;
    }

    // --- Stats ---

    function getStats() {
        let total = annotations.length;
        let reviewed = 0;
        let sicher = 0, pruefenswert = 0, problematisch = 0;

        for (const ann of annotations) {
            const status = reviewStatusMap.get(ann.id) || REVIEW_STATUS.OFFEN;
            if (status !== REVIEW_STATUS.OFFEN) reviewed++;

            const conf = confidenceMap.get(ann.id) || CONFIDENCE.PRUEFENSWERT;
            if (conf === CONFIDENCE.SICHER) sicher++;
            else if (conf === CONFIDENCE.PRUEFENSWERT) pruefenswert++;
            else if (conf === CONFIDENCE.PROBLEMATISCH) problematisch++;
        }

        return { total, reviewed, remaining: total - reviewed, sicher, pruefenswert, problematisch };
    }

    // --- Public API ---

    // Initial render
    render();

    return {
        destroy() {
            stopBatchReview();
            container.innerHTML = '';
            container.classList.remove('preview-container');
        },

        updateXml(newXml) {
            xml = newXml;
            idCounter = 0;
            render();
        },

        updateConfidence(newMap) {
            confidenceMap = new Map(newMap);
            // Update DOM in-place where possible
            for (const [id, conf] of confidenceMap) {
                const el = contentEl.querySelector('[data-entity-id="' + CSS.escape(id) + '"]');
                if (el) {
                    el.classList.remove('conf-sicher', 'conf-pruefenswert', 'conf-problematisch', 'conf-manuell');
                    el.classList.add('conf-' + conf);
                    el.dataset.confidence = conf;
                }
            }
        },

        updateReviewStatus(newMap) {
            reviewStatusMap = new Map(newMap);
            for (const [id, status] of reviewStatusMap) {
                const el = contentEl.querySelector('[data-entity-id="' + CSS.escape(id) + '"]');
                if (el) {
                    el.classList.remove('status-offen', 'status-akzeptiert', 'status-editiert', 'status-verworfen');
                    el.classList.add('status-' + status);
                    el.dataset.status = status;
                }
            }
        },

        startBatchReview,
        stopBatchReview,

        focusAnnotation(elementId) {
            unfocusAll();
            const idx = annotations.findIndex(a => a.id === elementId);
            if (idx >= 0) {
                focusBatchAnnotation(idx);
            }
        },

        getStats,

        get annotations() { return [...annotations]; }
    };
}
