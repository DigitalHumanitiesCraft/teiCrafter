/**
 * teiCrafter – Reactive Document Model
 * Single Source of Truth for TEI-XML document state.
 * 4 state layers: Document + Confidence + Validation + Review
 * Snapshot-based Undo/Redo with keystroke grouping.
 */

import { MAX_UNDO, KEYSTROKE_DEBOUNCE } from './utils/constants.js';

export class DocumentModel extends EventTarget {

    // --- State Layers ---
    #xmlString = '';
    #confidenceMap = new Map();      // elementId → 'sicher'|'pruefenswert'|'problematisch'|'manuell'
    #validationMessages = [];        // Array<{ level, source, message, line, elementId? }>
    #reviewStatus = new Map();       // elementId → 'offen'|'akzeptiert'|'editiert'|'verworfen'

    // --- Undo/Redo ---
    #undoStack = [];   // Array<Snapshot>
    #redoStack = [];
    #keystrokeTimer = null;
    #lastKeystrokeSnapshot = null;

    // --- Metadata ---
    #fileName = null;
    #sourceType = 'generic';

    constructor() {
        super();
    }

    // =========================================================================
    // Document Layer
    // =========================================================================

    get xml() { return this.#xmlString; }

    /**
     * Set the XML content. Creates an undo snapshot.
     * @param {string} xml
     * @param {Object} [options]
     * @param {string} [options.label='Edit']
     * @param {boolean} [options.undoable=true]
     */
    setXml(xml, options = {}) {
        const { label = 'Edit', undoable = true } = options;
        if (xml === this.#xmlString) return;

        if (undoable) {
            this.#pushUndo(label);
        }

        this.#xmlString = xml;
        this.#redoStack = [];
        this.#emit('documentChanged', { xml });
    }

    /**
     * Record a keystroke edit. Groups rapid keystrokes into one undo unit.
     * @param {string} xml
     */
    keystroke(xml) {
        if (xml === this.#xmlString) return;

        // First keystroke in a group: snapshot before the change
        if (!this.#lastKeystrokeSnapshot) {
            this.#lastKeystrokeSnapshot = this.#snapshot('Typing');
        }

        this.#xmlString = xml;
        this.#redoStack = [];

        // Reset debounce timer
        clearTimeout(this.#keystrokeTimer);
        this.#keystrokeTimer = setTimeout(() => this.#flushKeystroke(), KEYSTROKE_DEBOUNCE);

        this.#emit('documentChanged', { xml });
    }

    #flushKeystroke() {
        if (this.#lastKeystrokeSnapshot) {
            this.#undoStack.push(this.#lastKeystrokeSnapshot);
            if (this.#undoStack.length > MAX_UNDO) this.#undoStack.shift();
            this.#lastKeystrokeSnapshot = null;
        }
    }

    // =========================================================================
    // Confidence Layer
    // =========================================================================

    get confidenceMap() { return new Map(this.#confidenceMap); }

    setConfidence(elementId, level) {
        this.#confidenceMap.set(elementId, level);
        this.#emit('confidenceChanged', { elementId, level });
    }

    setConfidenceMap(map) {
        this.#confidenceMap = new Map(map);
        this.#emit('confidenceChanged', { bulk: true });
    }

    getConfidence(elementId) {
        return this.#confidenceMap.get(elementId) || null;
    }

    // =========================================================================
    // Validation Layer
    // =========================================================================

    get validationMessages() { return [...this.#validationMessages]; }

    setValidationMessages(messages) {
        this.#validationMessages = [...messages];
        this.#emit('validationComplete', { messages: this.#validationMessages });
    }

    // =========================================================================
    // Review Layer
    // =========================================================================

    get reviewStatus() { return new Map(this.#reviewStatus); }

    setReviewStatus(elementId, status) {
        const prevStatus = this.#reviewStatus.get(elementId);
        if (prevStatus === status) return;

        this.#pushUndo('Review: ' + status);
        this.#reviewStatus.set(elementId, status);
        this.#redoStack = [];
        this.#emit('reviewAction', { elementId, status, prevStatus });
    }

    getReviewStatus(elementId) {
        return this.#reviewStatus.get(elementId) || 'offen';
    }

    get reviewStats() {
        let total = 0, reviewed = 0;
        for (const [, status] of this.#reviewStatus) {
            total++;
            if (status !== 'offen') reviewed++;
        }
        return { total, reviewed, remaining: total - reviewed };
    }

    // =========================================================================
    // Metadata
    // =========================================================================

    get fileName() { return this.#fileName; }
    set fileName(name) { this.#fileName = name; }

    get sourceType() { return this.#sourceType; }
    set sourceType(type) { this.#sourceType = type; }

    // =========================================================================
    // Undo / Redo
    // =========================================================================

    get canUndo() { return this.#undoStack.length > 0 || this.#lastKeystrokeSnapshot !== null; }
    get canRedo() { return this.#redoStack.length > 0; }

    undo() {
        // Flush any pending keystroke group first
        if (this.#lastKeystrokeSnapshot) {
            this.#flushKeystroke();
        }

        if (this.#undoStack.length === 0) return;

        const snapshot = this.#undoStack.pop();
        this.#redoStack.push(this.#snapshot('Redo'));
        this.#restore(snapshot);
        this.#emit('undoRedo', { action: 'undo', label: snapshot.label });
    }

    redo() {
        if (this.#redoStack.length === 0) return;

        const snapshot = this.#redoStack.pop();
        this.#undoStack.push(this.#snapshot('Undo'));
        this.#restore(snapshot);
        this.#emit('undoRedo', { action: 'redo', label: snapshot.label });
    }

    // =========================================================================
    // Reset
    // =========================================================================

    reset() {
        this.#xmlString = '';
        this.#confidenceMap.clear();
        this.#validationMessages = [];
        this.#reviewStatus.clear();
        this.#undoStack = [];
        this.#redoStack = [];
        this.#lastKeystrokeSnapshot = null;
        clearTimeout(this.#keystrokeTimer);
        this.#fileName = null;
        this.#sourceType = 'generic';
    }

    // =========================================================================
    // Internal: Snapshots
    // =========================================================================

    #snapshot(label) {
        return {
            label,
            xmlString: this.#xmlString,
            confidenceMap: new Map(this.#confidenceMap),
            reviewStatus: new Map(this.#reviewStatus)
        };
    }

    #restore(snapshot) {
        this.#xmlString = snapshot.xmlString;
        this.#confidenceMap = new Map(snapshot.confidenceMap);
        this.#reviewStatus = new Map(snapshot.reviewStatus);

        this.#emit('documentChanged', { xml: this.#xmlString });
        this.#emit('confidenceChanged', { bulk: true });
        this.#emit('reviewAction', { bulk: true });
    }

    #pushUndo(label) {
        // Flush keystroke group if active
        if (this.#lastKeystrokeSnapshot) {
            this.#flushKeystroke();
        }

        this.#undoStack.push(this.#snapshot(label));
        if (this.#undoStack.length > MAX_UNDO) {
            this.#undoStack.shift();
        }
    }

    // =========================================================================
    // Internal: Events
    // =========================================================================

    #emit(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail }));
    }
}
