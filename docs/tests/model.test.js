/**
 * teiCrafter – DocumentModel Unit Tests
 */

import { DocumentModel } from '../js/model.js';

const { describe, it, assert, assertEqual } = window.__test;

describe('DocumentModel: XML Layer', () => {
    it('initial XML is empty string', () => {
        const model = new DocumentModel();
        assertEqual(model.xml, '', 'initial xml');
    });

    it('setXml updates xml and fires documentChanged', () => {
        const model = new DocumentModel();
        let fired = false;
        model.addEventListener('documentChanged', e => { fired = true; });
        model.setXml('<p>Hello</p>');
        assertEqual(model.xml, '<p>Hello</p>', 'xml value');
        assert(fired, 'event fired');
    });

    it('setXml with same value does not fire event', () => {
        const model = new DocumentModel();
        model.setXml('<p>Test</p>', { undoable: false });
        let fired = false;
        model.addEventListener('documentChanged', () => { fired = true; });
        model.setXml('<p>Test</p>');
        assert(!fired, 'no event for same value');
    });
});

describe('DocumentModel: Undo/Redo', () => {
    it('canUndo is false initially', () => {
        const model = new DocumentModel();
        assert(!model.canUndo, 'no undo initially');
        assert(!model.canRedo, 'no redo initially');
    });

    it('undo restores previous state', () => {
        const model = new DocumentModel();
        model.setXml('<p>A</p>');
        model.setXml('<p>B</p>');
        assertEqual(model.xml, '<p>B</p>', 'before undo');
        model.undo();
        assertEqual(model.xml, '<p>A</p>', 'after undo');
    });

    it('redo restores undone state', () => {
        const model = new DocumentModel();
        model.setXml('<p>A</p>');
        model.setXml('<p>B</p>');
        model.undo();
        assertEqual(model.xml, '<p>A</p>', 'after undo');
        model.redo();
        assertEqual(model.xml, '<p>B</p>', 'after redo');
    });

    it('new edit after undo clears redo stack', () => {
        const model = new DocumentModel();
        model.setXml('<p>A</p>');
        model.setXml('<p>B</p>');
        model.undo();
        model.setXml('<p>C</p>');
        assert(!model.canRedo, 'redo cleared after new edit');
    });

    it('undo fires undoRedo event', () => {
        const model = new DocumentModel();
        model.setXml('<p>A</p>');
        model.setXml('<p>B</p>');
        let action = null;
        model.addEventListener('undoRedo', e => { action = e.detail.action; });
        model.undo();
        assertEqual(action, 'undo', 'undoRedo event');
    });

    it('max undo stack respects MAX_UNDO', () => {
        const model = new DocumentModel();
        // Push 105 edits
        for (let i = 0; i < 105; i++) {
            model.setXml('<p>' + i + '</p>');
        }
        // Undo all — should stop at 100
        let undoCount = 0;
        while (model.canUndo) {
            model.undo();
            undoCount++;
            if (undoCount > 200) break; // safety
        }
        assert(undoCount <= 100, 'max undo is 100, got ' + undoCount);
    });
});

describe('DocumentModel: Keystroke Grouping', () => {
    it('keystroke does not immediately push to undo stack', () => {
        const model = new DocumentModel();
        model.keystroke('<p>H</p>');
        model.keystroke('<p>He</p>');
        model.keystroke('<p>Hel</p>');
        // Without flushing, only keystroke snapshot should exist
        assert(model.canUndo, 'can undo keystroke group');
    });

    it('keystroke group is undone as one unit', async () => {
        const model = new DocumentModel();
        model.setXml('<p>Start</p>');
        model.keystroke('<p>A</p>');
        model.keystroke('<p>AB</p>');
        model.keystroke('<p>ABC</p>');
        // Force flush by waiting
        await new Promise(r => setTimeout(r, 600));
        assertEqual(model.xml, '<p>ABC</p>', 'current state');
        model.undo();
        assertEqual(model.xml, '<p>Start</p>', 'undone to before keystroke group');
    });
});

describe('DocumentModel: Confidence Layer', () => {
    it('setConfidence and getConfidence', () => {
        const model = new DocumentModel();
        model.setConfidence('e1', 'sicher');
        assertEqual(model.getConfidence('e1'), 'sicher', 'confidence value');
    });

    it('setConfidenceMap replaces all', () => {
        const model = new DocumentModel();
        model.setConfidence('e1', 'sicher');
        model.setConfidenceMap(new Map([['e2', 'pruefenswert']]));
        assertEqual(model.getConfidence('e1'), null, 'e1 gone');
        assertEqual(model.getConfidence('e2'), 'pruefenswert', 'e2 set');
    });

    it('fires confidenceChanged event', () => {
        const model = new DocumentModel();
        let fired = false;
        model.addEventListener('confidenceChanged', () => { fired = true; });
        model.setConfidence('e1', 'problematisch');
        assert(fired, 'event fired');
    });
});

describe('DocumentModel: Review Layer', () => {
    it('initial review status is offen', () => {
        const model = new DocumentModel();
        assertEqual(model.getReviewStatus('e1'), 'offen');
    });

    it('setReviewStatus creates undo entry', () => {
        const model = new DocumentModel();
        model.setReviewStatus('e1', 'akzeptiert');
        assertEqual(model.getReviewStatus('e1'), 'akzeptiert');
        assert(model.canUndo, 'can undo review action');
    });

    it('undo restores review status', () => {
        const model = new DocumentModel();
        model.setReviewStatus('e1', 'akzeptiert');
        model.undo();
        assertEqual(model.getReviewStatus('e1'), 'offen');
    });

    it('reviewStats counts correctly', () => {
        const model = new DocumentModel();
        model.setReviewStatus('e1', 'akzeptiert');
        model.setReviewStatus('e2', 'offen');
        model.setReviewStatus('e3', 'verworfen');
        const stats = model.reviewStats;
        assertEqual(stats.total, 3, 'total');
        assertEqual(stats.reviewed, 2, 'reviewed');
        assertEqual(stats.remaining, 1, 'remaining');
    });
});

describe('DocumentModel: Validation Layer', () => {
    it('initial validation messages empty', () => {
        const model = new DocumentModel();
        assertEqual(model.validationMessages.length, 0);
    });

    it('setValidationMessages fires validationComplete', () => {
        const model = new DocumentModel();
        let msgs = null;
        model.addEventListener('validationComplete', e => { msgs = e.detail.messages; });
        model.setValidationMessages([{ level: 'error', source: 'schema', message: 'Test', line: 1 }]);
        assertEqual(msgs.length, 1, 'received messages');
    });
});

describe('DocumentModel: Reset', () => {
    it('reset clears all state', () => {
        const model = new DocumentModel();
        model.setXml('<p>Hello</p>');
        model.setConfidence('e1', 'sicher');
        model.setReviewStatus('e1', 'akzeptiert');
        model.reset();
        assertEqual(model.xml, '', 'xml cleared');
        assertEqual(model.getConfidence('e1'), null, 'confidence cleared');
        assertEqual(model.getReviewStatus('e1'), 'offen', 'review cleared');
        assert(!model.canUndo, 'undo cleared');
    });
});
