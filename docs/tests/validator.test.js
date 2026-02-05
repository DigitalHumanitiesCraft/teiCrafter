/**
 * teiCrafter – Validator Tests
 * Tests for plaintext comparison, well-formedness, schema validation.
 */

import { validate, checkWellFormedness, checkPlaintext, checkSchema, checkUnreviewed } from '../js/services/validator.js';
import * as schema from '../js/services/schema.js';

const { describe, it, assert, assertEqual } = window.__test;

// --- Well-formedness Tests ---

describe('Validator: Well-formedness (Level 2)', () => {

    it('accepts well-formed XML', () => {
        const { doc, errors } = checkWellFormedness('<TEI><text><body><p>Hello</p></body></text></TEI>');
        assert(doc !== null, 'should return parsed document');
        assert(errors.some(e => e.source === 'wellformed' && e.level === 'info'), 'should have info message');
    });

    it('rejects malformed XML', () => {
        const { doc, errors } = checkWellFormedness('<TEI><text><body><p>Unclosed');
        assert(doc === null, 'should return null doc');
        assert(errors.some(e => e.source === 'wellformed' && e.level === 'error'), 'should have error');
    });

    it('rejects empty string', () => {
        const messages = validate({ xml: '' });
        assert(messages.some(e => e.level === 'error'), 'should report error for empty');
    });

    it('rejects null XML', () => {
        const messages = validate({ xml: null });
        assert(messages.some(e => e.level === 'error'), 'should report error for null');
    });
});

// --- Plaintext Comparison Tests ---

describe('Validator: Plaintext Comparison (Level 1)', () => {

    it('reports identical plaintext', () => {
        const xml = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>Hello World</p></body></text></TEI>';
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const messages = checkPlaintext(doc, 'Hello World');
        assert(messages.some(e => e.source === 'plaintext' && e.level === 'info'), 'should report identical');
    });

    it('detects plaintext deviation', () => {
        const xml = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>Hello Changed World</p></body></text></TEI>';
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const messages = checkPlaintext(doc, 'Hello Original World');
        assert(messages.some(e => e.source === 'plaintext' && (e.level === 'warning' || e.level === 'error')),
            'should report deviation');
    });

    it('normalises whitespace in comparison', () => {
        const xml = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>Hello   World</p></body></text></TEI>';
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const messages = checkPlaintext(doc, 'Hello World');
        assert(messages.some(e => e.source === 'plaintext' && e.level === 'info'),
            'should treat normalised whitespace as identical');
    });

    it('warns when no body element', () => {
        const xml = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text></text></TEI>';
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const messages = checkPlaintext(doc, 'Some text');
        assert(messages.some(e => e.source === 'plaintext' && e.level === 'warning'),
            'should warn about missing body');
    });
});

// --- Unreviewed Check Tests ---

describe('Validator: Unreviewed Check (Level 5)', () => {

    it('reports unreviewed annotations', () => {
        const map = new Map([['persName-1', 'offen'], ['placeName-1', 'akzeptiert']]);
        const messages = checkUnreviewed(map);
        assert(messages.some(e => e.source === 'expert' && e.level === 'warning'), 'should warn about unreviewed');
        assert(messages[0].message.includes('1 Annotation'), 'should mention count');
    });

    it('reports all reviewed', () => {
        const map = new Map([['persName-1', 'akzeptiert'], ['placeName-1', 'verworfen']]);
        const messages = checkUnreviewed(map);
        assert(messages.some(e => e.source === 'expert' && e.level === 'info'), 'should report all reviewed');
    });

    it('handles empty map', () => {
        const messages = checkUnreviewed(new Map());
        assertEqual(messages.length, 0, 'should return no messages for empty map');
    });
});

// --- Integration Tests ---

describe('Validator: Full validate()', () => {

    it('validates well-formed XML with matching plaintext', () => {
        const xml = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>Test content</p></body></text></TEI>';
        const messages = validate({ xml, originalPlaintext: 'Test content' });
        const errors = messages.filter(m => m.level === 'error');
        assertEqual(errors.length, 0, 'should have no errors');
        assert(messages.some(m => m.source === 'wellformed' && m.level === 'info'), 'should confirm well-formedness');
        assert(messages.some(m => m.source === 'plaintext' && m.level === 'info'), 'should confirm plaintext match');
    });

    it('reports both malformed XML and skips plaintext', () => {
        const xml = '<TEI><unclosed>';
        const messages = validate({ xml, originalPlaintext: 'Some text' });
        assert(messages.some(m => m.source === 'wellformed' && m.level === 'error'), 'should report XML error');
        assert(!messages.some(m => m.source === 'plaintext'), 'should skip plaintext check for malformed XML');
    });
});
