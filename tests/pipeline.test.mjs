#!/usr/bin/env node
/**
 * teiCrafter Pipeline -- Unit + Integration Tests
 *
 * Run: node tests/pipeline.test.mjs
 * No dependencies -- uses Node.js built-in assert.
 */

import { strict as assert } from 'assert';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { esc, el, elRaw, formatAttrs, langName } from '../docs/js/pipeline/utils.js';
import { buildTeiHeader } from '../docs/js/pipeline/mods-to-header.js';
import { buildBodyElements, renderElement } from '../docs/js/pipeline/page-to-body.js';
import { structureDivs, inferDivType } from '../docs/js/pipeline/div-structurer.js';
import { assemble } from '../docs/js/pipeline/tei-assembler.js';
import { validate, formatReport } from '../docs/js/pipeline/pipeline-validator.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  OK  ${name}`);
    } catch (e) {
        failed++;
        console.log(`  FAIL ${name}`);
        console.log(`       ${e.message}`);
    }
}

// ========================================
// 1. utils.js
// ========================================
console.log('\n--- utils.js ---');

test('esc: escapes &, <, >, "', () => {
    assert.equal(esc('a & b < c > d "e"'), 'a &amp; b &lt; c &gt; d &quot;e&quot;');
});

test('esc: handles null/undefined', () => {
    assert.equal(esc(null), '');
    assert.equal(esc(undefined), '');
    assert.equal(esc(''), '');
});

test('el: self-closing when content is null', () => {
    assert.equal(el('pb', { n: '1' }, null), '<pb n="1"/>');
});

test('el: text content is escaped', () => {
    assert.equal(el('title', null, 'A & B'), '<title>A &amp; B</title>');
});

test('el: attributes with null values are omitted', () => {
    assert.equal(el('idno', { type: 'shelfmark', ref: null }, 'X'), '<idno type="shelfmark">X</idno>');
});

test('el: attributes with empty string values are omitted', () => {
    assert.equal(el('repo', { ref: '' }, 'Lib'), '<repo>Lib</repo>');
});

test('formatAttrs: produces correct XML attributes', () => {
    assert.equal(formatAttrs({ a: '1', b: '2' }), ' a="1" b="2"');
    assert.equal(formatAttrs(null), '');
    assert.equal(formatAttrs({}), '');
});

test('langName: maps known codes', () => {
    assert.equal(langName('de'), 'Deutsch');
    assert.equal(langName('en'), 'English');
    assert.equal(langName('xx'), 'xx'); // fallback
});

// ========================================
// 2. mods-to-header.js
// ========================================
console.log('\n--- mods-to-header.js ---');

const RICH_PAGE_JSON = {
    source: {
        id: 'o_szd.100',
        title: 'Agreement Longmans, Green & Co. Inc.',
        language: 'en',
        shelfmark: 'SZ-AAP/L13.23',
        date: 'twelfth day of September, 1938',
        document_type: 'typescript',
        repository: 'Literaturarchiv Salzburg',
        descriptive_metadata: {
            creator: [
                { name: 'Stefan Zweig', role: 'author', gnd: 'http://d-nb.info/gnd/118637479' }
            ],
            subject: ['Verlagsvertraege'],
            origin_place: 'New York',
            extent: '1 Blatt',
            rights: 'CC-BY',
            holding: {
                repository: 'Literaturarchiv Salzburg',
                repository_gnd: 'http://d-nb.info/gnd/1047605287',
                country: 'Oesterreich',
                settlement: 'Salzburg'
            },
            provenance: ['Archiv Atrium Press'],
            physical_description: {
                writing_instrument: 'schwarze Tinte',
                writing_material: 'gelocht',
                hands: ['Stefan Zweig'],
                dimensions: '33x22 cm'
            }
        }
    },
    provenance: {
        model: 'gemini-3.1-flash-lite-preview',
        provider: 'google',
        created_at: '2026-04-03T14:41:36Z',
        prompt_layers: ['system', 'group_typoskript']
    },
    review: { status: 'approved', reviewed_by: 'Test', reviewed_at: '2026-04-03T15:00:00Z' }
};

const MINIMAL_PAGE_JSON = {
    source: {
        id: 'o_szd.999',
        title: 'Brief an X',
        language: 'de',
        document_type: 'letter',
        descriptive_metadata: { rights: 'CC-BY' }
    },
    provenance: { model: 'test-model', provider: 'test' },
    pages: []
};

test('header: contains teiHeader open/close', () => {
    const h = buildTeiHeader(RICH_PAGE_JSON);
    assert.ok(h.includes('<teiHeader>'));
    assert.ok(h.includes('</teiHeader>'));
});

test('header: title is escaped', () => {
    const h = buildTeiHeader(RICH_PAGE_JSON);
    assert.ok(h.includes('Agreement Longmans, Green &amp; Co. Inc.'));
});

test('header: author with GND ref', () => {
    const h = buildTeiHeader(RICH_PAGE_JSON);
    assert.ok(h.includes('<author ref="http://d-nb.info/gnd/118637479">Stefan Zweig</author>'));
});

test('header: msIdentifier has repository, shelfmark, PID', () => {
    const h = buildTeiHeader(RICH_PAGE_JSON);
    assert.ok(h.includes('<repository ref="http://d-nb.info/gnd/1047605287">'));
    assert.ok(h.includes('<idno type="shelfmark">SZ-AAP/L13.23</idno>'));
    assert.ok(h.includes('<idno type="PID">o_szd.100</idno>'));
});

test('header: physDesc with support, extent, handNote', () => {
    const h = buildTeiHeader(RICH_PAGE_JSON);
    assert.ok(h.includes('<support>gelocht</support>'));
    assert.ok(h.includes('<extent>1 Blatt</extent>'));
    assert.ok(h.includes('<handNote>schwarze Tinte</handNote>'));
});

test('header: history with origPlace, origDate, provenance', () => {
    const h = buildTeiHeader(RICH_PAGE_JSON);
    assert.ok(h.includes('<origPlace>New York</origPlace>'));
    assert.ok(h.includes('origDate'));
    assert.ok(h.includes('1938'));
    assert.ok(h.includes('<provenance>Archiv Atrium Press</provenance>'));
});

test('header: langUsage', () => {
    const h = buildTeiHeader(RICH_PAGE_JSON);
    assert.ok(h.includes('<language ident="en">English</language>'));
});

test('header: encodingDesc with model info', () => {
    const h = buildTeiHeader(RICH_PAGE_JSON);
    assert.ok(h.includes('gemini-3.1-flash-lite-preview'));
    assert.ok(h.includes('projectDesc'));
});

test('header: revisionDesc with pipeline and review changes', () => {
    const h = buildTeiHeader(RICH_PAGE_JSON);
    assert.ok(h.includes('<change when="2026-04-03">'));
    assert.ok(h.includes('Review: approved'));
});

test('header: minimal metadata produces valid header', () => {
    const h = buildTeiHeader(MINIMAL_PAGE_JSON);
    assert.ok(h.includes('<title>Brief an X</title>'));
    assert.ok(h.includes('<idno type="PID">o_szd.999</idno>'));
    assert.ok(h.includes('<language ident="de">Deutsch</language>'));
    // No physDesc, history when missing
    assert.ok(!h.includes('<physDesc>'));
    assert.ok(!h.includes('<history>'));
});

// ========================================
// 3. page-to-body.js
// ========================================
console.log('\n--- page-to-body.js ---');

test('body: blank/color_chart pages produce only pb', () => {
    const pages = [
        { page: 1, type: 'blank', text: '' },
        { page: 2, type: 'color_chart', text: '' }
    ];
    const elems = buildBodyElements(pages, ['img1', 'img2']);
    assert.equal(elems.length, 2);
    assert.ok(elems.every(e => e.tag === 'pb'));
});

test('body: content page without regions splits by double-newline', () => {
    const pages = [{ page: 1, type: 'content', text: 'Para one.\n\nPara two.\n\nPara three.' }];
    const elems = buildBodyElements(pages, ['img1']);
    // 1 pb + 3 paragraphs
    assert.equal(elems.length, 4);
    assert.equal(elems[0].tag, 'pb');
    assert.equal(elems[1].tag, 'p');
    assert.equal(elems[1].text, 'Para one.');
    assert.equal(elems[3].text, 'Para three.');
});

test('body: content page with regions maps types correctly', () => {
    const pages = [{
        page: 1, type: 'content',
        text: 'Title\nPara line 1\nPara line 2\nMargin note',
        regions: [
            { type: 'heading', reading_order: 1, lines: 1 },
            { type: 'paragraph', reading_order: 2, lines: 2 },
            { type: 'marginalia', reading_order: 3, lines: 1 }
        ]
    }];
    const elems = buildBodyElements(pages, ['img1']);
    // pb + head + p + note
    assert.equal(elems.length, 4);
    assert.equal(elems[1].tag, 'head');
    assert.equal(elems[1].text, 'Title');
    assert.equal(elems[2].tag, 'p');
    assert.equal(elems[3].tag, 'note');
    assert.deepEqual(elems[3].attrs, { type: 'marginalia', place: 'margin' });
});

test('body: table region renders with row/cell', () => {
    const elem = { tag: 'table', text: 'Row 1\nRow 2', attrs: {} };
    const xml = renderElement(elem, 0);
    assert.ok(xml.includes('<row><cell>Row 1</cell></row>'));
    assert.ok(xml.includes('<row><cell>Row 2</cell></row>'));
});

test('body: facs URI from images array', () => {
    const pages = [{ page: 1, type: 'blank', text: '' }];
    const elems = buildBodyElements(pages, ['https://gams.uni-graz.at/o:szd.100/IMG.1']);
    assert.equal(elems[0].attrs.facs, 'https://gams.uni-graz.at/o:szd.100/IMG.1');
});

// ========================================
// 4. div-structurer.js
// ========================================
console.log('\n--- div-structurer.js ---');

test('div: no elements produces empty string', () => {
    assert.equal(structureDivs([]), '');
});

test('div: no heads wraps in single div', () => {
    const elems = [
        { tag: 'pb', text: null, attrs: { n: '1' }, selfClosing: true },
        { tag: 'p', text: 'Hello' }
    ];
    const xml = structureDivs(elems);
    assert.ok(xml.includes('<div>'));
    assert.ok(xml.includes('</div>'));
    assert.equal(xml.match(/<div/g).length, 1);
});

test('div: heads split into multiple divs', () => {
    const elems = [
        { tag: 'head', text: 'Chapter 1' },
        { tag: 'p', text: 'Text 1' },
        { tag: 'head', text: 'Chapter 2' },
        { tag: 'p', text: 'Text 2' }
    ];
    const xml = structureDivs(elems);
    assert.equal(xml.match(/<div>/g).length, 2);
    assert.equal(xml.match(/<\/div>/g).length, 2);
});

test('div: letters use single div regardless of heads', () => {
    const elems = [
        { tag: 'head', text: 'Wohlgeboren' },
        { tag: 'p', text: 'Address' },
        { tag: 'head', text: 'STEFAN ZWEIG' },
        { tag: 'p', text: 'Dear friend...' }
    ];
    const xml = structureDivs(elems, { divType: 'letter' });
    assert.equal(xml.match(/<div/g).length, 1);
    assert.ok(xml.includes('type="letter"'));
});

test('div: pb before head moves to new div', () => {
    const elems = [
        { tag: 'p', text: 'Intro' },
        { tag: 'pb', text: null, attrs: { n: '2' }, selfClosing: true },
        { tag: 'head', text: 'Chapter' },
        { tag: 'p', text: 'Content' }
    ];
    const xml = structureDivs(elems);
    // pb should be in the second div (before <head>), not trailing in the first
    const secondDiv = xml.split('</div>')[1];
    assert.ok(secondDiv.includes('n="2"'));
});

test('inferDivType: letter and manuscript', () => {
    assert.equal(inferDivType('letter'), 'letter');
    assert.equal(inferDivType('manuscript'), 'chapter');
    assert.equal(inferDivType('typescript'), undefined);
});

// ========================================
// 5. tei-assembler.js
// ========================================
console.log('\n--- tei-assembler.js ---');

test('assemble: produces valid XML structure', () => {
    const tei = assemble({
        source: { id: 'test', title: 'Test', language: 'de', descriptive_metadata: {} },
        provenance: { model: 'test', provider: 'test' },
        pages: [{ page: 1, type: 'content', text: 'Hello world' }]
    });
    assert.ok(tei.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.ok(tei.includes('<TEI xmlns="http://www.tei-c.org/ns/1.0">'));
    assert.ok(tei.includes('</TEI>'));
    assert.ok(tei.includes('<teiHeader>'));
    assert.ok(tei.includes('<body>'));
    assert.ok(tei.includes('<div>'));
    assert.ok(tei.includes('Hello world'));
});

test('assemble: empty pages produce valid TEI with empty div', () => {
    const tei = assemble({
        source: { id: 'empty', title: 'Empty', descriptive_metadata: {} },
        provenance: { model: 'test', provider: 'test' },
        pages: []
    });
    assert.ok(tei.includes('<div/>'));
    assert.ok(tei.includes('<body>'));
});

// ========================================
// 6. pipeline-validator.js
// ========================================
console.log('\n--- pipeline-validator.js ---');

test('validate: well-formed XML passes', () => {
    const tei = assemble({
        source: { id: 'v', title: 'V', descriptive_metadata: {} },
        provenance: { model: 't', provider: 't' },
        pages: [{ page: 1, type: 'content', text: 'Test text here' }]
    });
    const msgs = validate(tei, {
        pages: [{ page: 1, type: 'content', text: 'Test text here' }]
    });
    const errors = msgs.filter(m => m.level === 'error');
    assert.equal(errors.length, 0, `Unexpected errors: ${errors.map(e => e.message).join('; ')}`);
});

test('validate: detects mismatched tags', () => {
    const bad = '<?xml version="1.0"?><TEI><teiHeader></teiHeader><text><body><div></body></text></TEI>';
    const msgs = validate(bad, { pages: [] });
    const errors = msgs.filter(m => m.level === 'error' && m.source === 'wellformed');
    assert.ok(errors.length > 0, 'Should detect mismatched tags');
});

test('validate: detects missing required elements', () => {
    const minimal = '<?xml version="1.0"?><TEI><text><body><p>Hi</p></body></text></TEI>';
    const msgs = validate(minimal, { pages: [] });
    const structural = msgs.filter(m => m.source === 'structure' && m.level === 'error');
    assert.ok(structural.length > 0, 'Should detect missing teiHeader etc.');
});

test('validate: plaintext preservation check', () => {
    const tei = assemble({
        source: { id: 'p', title: 'P', descriptive_metadata: {} },
        provenance: { model: 't', provider: 't' },
        pages: [{ page: 1, type: 'content', text: 'Specific unique words preservation test alpha beta gamma' }]
    });
    const msgs = validate(tei, {
        pages: [{ page: 1, type: 'content', text: 'Specific unique words preservation test alpha beta gamma' }]
    });
    const ptMsgs = msgs.filter(m => m.source === 'plaintext');
    assert.ok(ptMsgs.some(m => m.level === 'info'), 'Should pass plaintext check');
});

// ========================================
// 7. Integration: real Page-JSON files
// ========================================
console.log('\n--- Integration Tests ---');

const SZD_RESULTS = 'C:/Users/Chrisi/Documents/GitHub/szd-htr/results';

function loadPageJson(path) {
    try {
        return JSON.parse(readFileSync(path, 'utf-8'));
    } catch {
        return null;
    }
}

const testFiles = [
    { path: `${SZD_RESULTS}/lebensdokumente/o_szd.100_page.json`, label: 'o_szd.100 (rich metadata, regions)' },
    { path: `${SZD_RESULTS}/korrespondenzen/o_szd.1079_page.json`, label: 'o_szd.1079 (letter, minimal metadata)' },
    { path: `${SZD_RESULTS}/aufsatzablage/o_szd.2305_page.json`, label: 'o_szd.2305 (no regions)' }
];

for (const { path: filePath, label } of testFiles) {
    const pj = loadPageJson(filePath);
    if (!pj) {
        test(`integration: ${label}`, () => { assert.fail(`File not found: ${filePath}`); });
        continue;
    }

    test(`integration: ${label} -- assembles without error`, () => {
        const tei = assemble(pj);
        assert.ok(tei.length > 100);
    });

    test(`integration: ${label} -- validates clean`, () => {
        const tei = assemble(pj);
        const msgs = validate(tei, pj);
        const errors = msgs.filter(m => m.level === 'error');
        assert.equal(errors.length, 0, `Errors: ${errors.map(e => e.message).join('; ')}`);
    });

    test(`integration: ${label} -- title preserved`, () => {
        const tei = assemble(pj);
        const escapedTitle = esc(pj.source.title);
        assert.ok(tei.includes(escapedTitle), `Title not found: ${pj.source.title}`);
    });

    test(`integration: ${label} -- PID in msIdentifier`, () => {
        const tei = assemble(pj);
        assert.ok(tei.includes(`<idno type="PID">${pj.source.id}</idno>`));
    });

    test(`integration: ${label} -- correct page count`, () => {
        const tei = assemble(pj);
        const pbCount = (tei.match(/<pb /g) || []).length;
        assert.equal(pbCount, pj.pages.length, `Expected ${pj.pages.length} <pb/>, got ${pbCount}`);
    });
}

// ========================================
// Summary
// ========================================
console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
