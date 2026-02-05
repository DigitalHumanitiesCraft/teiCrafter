/**
 * teiCrafter – Tokenizer Unit Tests
 */

import { tokenize, TOKEN } from '../js/tokenizer.js';

const { describe, it, assert, assertEqual } = window.__test;

describe('Tokenizer: Basic', () => {
    it('empty string returns empty array', () => {
        assertEqual(tokenize('').length, 0, 'empty');
        assertEqual(tokenize(null).length, 0, 'null');
        assertEqual(tokenize(undefined).length, 0, 'undefined');
    });

    it('plain text returns single TEXT token', () => {
        const tokens = tokenize('Hello World');
        assertEqual(tokens.length, 1, 'count');
        assertEqual(tokens[0].type, TOKEN.TEXT, 'type');
        assertEqual(tokens[0].value, 'Hello World', 'value');
        assertEqual(tokens[0].start, 0, 'start');
        assertEqual(tokens[0].end, 11, 'end');
    });

    it('simple element <p>Hello</p>', () => {
        const tokens = tokenize('<p>Hello</p>');
        // < p > Hello </ p >
        assert(tokens.length >= 7, 'at least 7 tokens: got ' + tokens.length);

        assertEqual(tokens[0].type, TOKEN.DELIMITER, 'open <');
        assertEqual(tokens[0].value, '<', '< value');
        assertEqual(tokens[1].type, TOKEN.ELEMENT, 'element p');
        assertEqual(tokens[1].value, 'p', 'p value');
        assertEqual(tokens[2].type, TOKEN.DELIMITER, 'close >');
        assertEqual(tokens[2].value, '>', '> value');
        assertEqual(tokens[3].type, TOKEN.TEXT, 'text');
        assertEqual(tokens[3].value, 'Hello', 'Hello value');
    });

    it('self-closing element <br/>', () => {
        const tokens = tokenize('<br/>');
        assertEqual(tokens[0].type, TOKEN.DELIMITER, '<');
        assertEqual(tokens[1].type, TOKEN.ELEMENT, 'br');
        assertEqual(tokens[2].type, TOKEN.DELIMITER, '/>');
        assertEqual(tokens[2].value, '/>', '/> value');
    });
});

describe('Tokenizer: Attributes', () => {
    it('element with attributes', () => {
        const tokens = tokenize('<div type="chapter">');
        // < div type = "chapter" >
        const types = tokens.map(t => t.type);
        assert(types.includes(TOKEN.ATTR_NAME), 'has attr name');
        assert(types.includes(TOKEN.ATTR_VALUE), 'has attr value');

        const attrName = tokens.find(t => t.type === TOKEN.ATTR_NAME);
        assertEqual(attrName.value, 'type', 'attr name value');

        const attrValue = tokens.find(t => t.type === TOKEN.ATTR_VALUE);
        assertEqual(attrValue.value, '"chapter"', 'attr value with quotes');
    });

    it('multiple attributes', () => {
        const tokens = tokenize('<date when="1879-08-23" confidence="high">');
        const attrNames = tokens.filter(t => t.type === TOKEN.ATTR_NAME);
        assertEqual(attrNames.length, 2, 'two attr names');
        assertEqual(attrNames[0].value, 'when', 'first attr');
        assertEqual(attrNames[1].value, 'confidence', 'second attr');
    });

    it('single-quoted attributes', () => {
        const tokens = tokenize("<p class='test'>");
        const attrValue = tokens.find(t => t.type === TOKEN.ATTR_VALUE);
        assertEqual(attrValue.value, "'test'", 'single-quoted value');
    });
});

describe('Tokenizer: Special Constructs', () => {
    it('XML comment', () => {
        const tokens = tokenize('<!-- This is a comment -->');
        assertEqual(tokens.length, 1, 'single token');
        assertEqual(tokens[0].type, TOKEN.COMMENT, 'comment type');
        assertEqual(tokens[0].value, '<!-- This is a comment -->', 'full comment');
    });

    it('processing instruction', () => {
        const tokens = tokenize('<?xml version="1.0" encoding="UTF-8"?>');
        assertEqual(tokens.length, 1, 'single token');
        assertEqual(tokens[0].type, TOKEN.PI, 'PI type');
    });

    it('entity reference', () => {
        const tokens = tokenize('Tom &amp; Jerry');
        assertEqual(tokens.length, 3, 'three tokens');
        assertEqual(tokens[0].type, TOKEN.TEXT, 'text 1');
        assertEqual(tokens[0].value, 'Tom ', 'text 1 value');
        assertEqual(tokens[1].type, TOKEN.ENTITY, 'entity');
        assertEqual(tokens[1].value, '&amp;', 'entity value');
        assertEqual(tokens[2].type, TOKEN.TEXT, 'text 2');
        assertEqual(tokens[2].value, ' Jerry', 'text 2 value');
    });

    it('bare ampersand treated as text', () => {
        const tokens = tokenize('A & B');
        assert(tokens.length >= 1, 'has tokens');
        // The & should not crash the tokenizer
    });

    it('namespace prefix', () => {
        const tokens = tokenize('<tei:TEI>');
        const ns = tokens.find(t => t.type === TOKEN.NAMESPACE);
        assert(ns, 'has namespace token');
        assertEqual(ns.value, 'tei:', 'namespace value');

        const el = tokens.find(t => t.type === TOKEN.ELEMENT);
        assertEqual(el.value, 'TEI', 'element after namespace');
    });

    it('xmlns attribute treated as namespace', () => {
        const tokens = tokenize('<TEI xmlns="http://www.tei-c.org/ns/1.0">');
        const ns = tokens.find(t => t.type === TOKEN.NAMESPACE);
        assert(ns, 'xmlns is namespace');
        assertEqual(ns.value, 'xmlns', 'xmlns value');
    });
});

describe('Tokenizer: Coverage Invariant', () => {
    it('tokens cover input without gaps', () => {
        const xml = '<?xml version="1.0"?>\n<TEI xmlns="http://www.tei-c.org/ns/1.0">\n  <text><body><p>Hello &amp; World</p></body></text>\n</TEI>';
        const tokens = tokenize(xml);

        // Check contiguous coverage
        let pos = 0;
        for (const token of tokens) {
            assertEqual(token.start, pos, 'gap at position ' + pos + ', token starts at ' + token.start);
            pos = token.end;
        }
        assertEqual(pos, xml.length, 'tokens cover full input');
    });

    it('tokens cover malformed XML', () => {
        const xml = '<p attr=>text</p';
        const tokens = tokenize(xml);

        let pos = 0;
        for (const token of tokens) {
            assertEqual(token.start, pos, 'gap at ' + pos);
            pos = token.end;
        }
        assertEqual(pos, xml.length, 'full coverage for malformed XML');
    });

    it('unterminated comment does not crash', () => {
        const tokens = tokenize('<!-- unterminated');
        assertEqual(tokens.length, 1);
        assertEqual(tokens[0].type, TOKEN.COMMENT);
    });
});

describe('Tokenizer: Performance', () => {
    it('tokenizes 500-line document in < 50ms', () => {
        // Generate a 500-line TEI document
        const lines = [];
        lines.push('<?xml version="1.0" encoding="UTF-8"?>');
        lines.push('<TEI xmlns="http://www.tei-c.org/ns/1.0">');
        lines.push('  <teiHeader><fileDesc><titleStmt><title>Test</title></titleStmt></fileDesc></teiHeader>');
        lines.push('  <text><body>');
        for (let i = 0; i < 496; i++) {
            lines.push('    <p>Line ' + i + ' with <persName ref="#p' + i + '">Person ' + i + '</persName> in <placeName>Place</placeName></p>');
        }
        lines.push('  </body></text>');
        lines.push('</TEI>');
        const xml = lines.join('\n');

        const start = performance.now();
        const tokens = tokenize(xml);
        const elapsed = performance.now() - start;

        assert(tokens.length > 0, 'produced tokens');
        assert(elapsed < 50, 'completed in ' + elapsed.toFixed(1) + 'ms (limit: 50ms)');
    });
});
