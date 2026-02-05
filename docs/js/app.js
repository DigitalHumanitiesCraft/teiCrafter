/**
 * teiCrafter – Application Shell (ES6 Module)
 * Stepper navigation, step routing, state management.
 */

import { DEMO_CONFIGS, ICONS, SOURCE_LABELS, MAX_FILE_SIZE, getDefaultMapping } from './utils/constants.js';
import { $, $$, escHtml, highlightXml, showToast } from './utils/dom.js';

// ---------------------------------------------------------------------------
// Application State
// ---------------------------------------------------------------------------

const AppState = {
    currentStep: 1,
    inputContent: null,
    inputFormat: 'plaintext',
    fileName: null,
    demoId: null,
    sourceType: 'generic',
    mappingRules: null,
    context: { language: 'de', epoch: '19c', project: '' },
    outputXml: null,

    set(updates) { Object.assign(this, updates); },

    reset() {
        this.currentStep = 1;
        this.inputContent = null;
        this.inputFormat = 'plaintext';
        this.fileName = null;
        this.demoId = null;
        this.sourceType = 'generic';
        this.mappingRules = null;
        this.context = { language: 'de', epoch: '19c', project: '' };
        this.outputXml = null;
    }
};

// ---------------------------------------------------------------------------
// Step Rendering
// ---------------------------------------------------------------------------

function renderStep(step) {
    const main = $('.app-main');
    main.classList.remove('step-1', 'step-2', 'step-3', 'step-4', 'step-5');
    main.classList.add('step-' + step);
    main.innerHTML = '';

    switch (step) {
        case 1: renderImportStep(main); break;
        case 2: renderMappingStep(main); break;
        case 3: renderTransformStep(main); break;
        case 4: renderValidateStep(main); break;
        case 5: renderExportStep(main); break;
    }

    updateStepper(step);
    updateFooter(step);
}

// ---------------------------------------------------------------------------
// Step 1: Import
// ---------------------------------------------------------------------------

function renderImportStep(container) {
    const cards = Object.entries(DEMO_CONFIGS).map(([id, cfg]) =>
        '<article class="demo-card" data-demo="' + escHtml(id) + '">' +
            '<div class="demo-icon">' + ICONS[cfg.icon] + '</div>' +
            '<h3 class="demo-title">' + escHtml(cfg.name) + '</h3>' +
            '<p class="demo-source">' + escHtml(cfg.subtitle) + '</p>' +
            '<p class="demo-type">' + escHtml(cfg.desc) + '</p>' +
            '<button class="btn-secondary btn-sm btn-load-demo">Laden</button>' +
        '</article>'
    ).join('');

    container.innerHTML =
        '<section class="import-center">' +
            '<div class="import-card">' +
                '<div class="dropzone" id="dropzone">' +
                    ICONS.upload +
                    '<h2 class="dropzone-title">Dokument importieren</h2>' +
                    '<p class="dropzone-hint">Datei hierher ziehen oder klicken</p>' +
                    '<input type="file" id="file-input" accept=".txt,.md,.xml,.docx" hidden>' +
                    '<button class="btn-primary" id="btn-select-file">Datei ausw\u00e4hlen\u2026</button>' +
                '</div>' +
                '<div class="format-info">' +
                    '<p class="format-title">Formate:</p>' +
                    '<div class="format-list">' +
                        '<span class="format-badge txt">TXT</span> ' +
                        '<span class="format-badge md">MD</span> ' +
                        '<span class="format-badge xml">XML</span> ' +
                        '<span class="format-badge docx">DOCX</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="demo-section">' +
                '<p class="demo-divider"><span>oder Demo w\u00e4hlen</span></p>' +
                '<div class="demo-cards">' + cards + '</div>' +
            '</div>' +
        '</section>';

    initImportHandlers();
}

function initImportHandlers() {
    const dz = $('#dropzone');
    const fi = $('#file-input');
    const bs = $('#btn-select-file');

    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', async e => {
        e.preventDefault();
        dz.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) await processFile(e.dataTransfer.files[0]);
    });

    bs.addEventListener('click', () => fi.click());
    fi.addEventListener('change', async e => {
        if (e.target.files[0]) await processFile(e.target.files[0]);
    });

    $$('.btn-load-demo').forEach(b =>
        b.addEventListener('click', async e => {
            await loadDemo(e.target.closest('.demo-card').dataset.demo);
        })
    );
}

async function processFile(file) {
    // Size validation
    if (file.size > MAX_FILE_SIZE) {
        showToast('Datei zu gro\u00df (max. 10 MB).', 'error');
        return;
    }

    const ext = file.name.split('.').pop().toLowerCase();

    // Extension validation
    if (!['txt', 'md', 'xml', 'docx'].includes(ext)) {
        showToast('Nicht unterst\u00fctztes Dateiformat.', 'error');
        return;
    }

    let txt, format;

    if (ext === 'docx') {
        txt = await extractDocxText(file);
        format = 'docx';
    } else {
        txt = await file.text();
        format = ext === 'xml' ? 'xml' : (ext === 'md' ? 'markdown' : 'plaintext');
    }

    if (!txt) return;

    // XML well-formedness check
    if (format === 'xml' && !isWellFormedXml(txt)) {
        showToast('XML ist nicht wohlgeformt. Bitte korrigieren und erneut laden.', 'error');
        return;
    }

    AppState.set({
        inputContent: txt,
        inputFormat: format,
        fileName: file.name,
        demoId: null,
        sourceType: detectType(txt)
    });
    goToStep(2);
}

async function extractDocxText(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        // Dynamic import for JSZip
        const JSZip = window.JSZip;
        if (!JSZip) {
            showToast('DOCX-Import ben\u00f6tigt JSZip. Bitte TXT oder MD verwenden.', 'error');
            return '';
        }
        const archive = await JSZip.loadAsync(arrayBuffer);
        const docEntry = archive.file('word/document.xml');
        if (!docEntry) {
            showToast('Ung\u00fcltige DOCX-Datei: word/document.xml nicht gefunden.', 'error');
            return '';
        }
        const docXml = await docEntry.async('string');
        // Extract text via DOMParser for safety (no regex on raw XML)
        const doc = new DOMParser().parseFromString(docXml, 'application/xml');
        return (doc.body?.textContent || doc.documentElement.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (e) {
        console.error('DOCX extraction failed:', e);
        showToast('DOCX konnte nicht gelesen werden.', 'error');
        return '';
    }
}

async function loadDemo(id) {
    const cfg = DEMO_CONFIGS[id];
    if (!cfg) return;
    try {
        const [plaintext, mapping] = await Promise.all([
            fetch(cfg.files.plaintext).then(r => {
                if (!r.ok) throw new Error('Plaintext: ' + r.status);
                return r.text();
            }),
            fetch(cfg.files.mapping).then(r => {
                if (!r.ok) throw new Error('Mapping: ' + r.status);
                return r.text();
            })
        ]);
        AppState.set({
            inputContent: plaintext,
            inputFormat: 'plaintext',
            fileName: cfg.files.plaintext.split('/').pop(),
            demoId: id,
            sourceType: cfg.sourceType,
            mappingRules: mapping
        });
        goToStep(2);
    } catch (e) {
        console.error('Demo load failed:', e);
        showToast('Demo konnte nicht geladen werden: ' + e.message, 'error');
    }
}

function detectType(text) {
    if (text.includes('Gruss') || text.includes('ergebener') || text.includes('College')) return 'correspondence';
    if (text.includes('Kapitel') || text.includes('ERSTES')) return 'print';
    if (text.includes('Nym') || text.includes('pfunt') || text.includes('zucker')) return 'recipe';
    return 'generic';
}

// ---------------------------------------------------------------------------
// Step 2: Mapping
// ---------------------------------------------------------------------------

function renderMappingStep(container) {
    const label = SOURCE_LABELS[AppState.sourceType] || 'Dokument';
    const rules = AppState.mappingRules || getDefaultMapping(AppState.sourceType);

    const sourceTypeOptions = ['correspondence', 'print', 'recipe', 'generic'].map(type =>
        '<option value="' + type + '"' + (AppState.sourceType === type ? ' selected' : '') + '>' +
            escHtml(SOURCE_LABELS[type]) +
        '</option>'
    ).join('');

    container.innerHTML =
        '<section class="panel panel-source-narrow">' +
            '<div class="panel-header"><span class="panel-label">Quelltext</span></div>' +
            '<div class="panel-content"><pre class="source-preview">' + escHtml(AppState.inputContent || '') + '</pre></div>' +
            '<div class="panel-footer"><span>' + escHtml(AppState.fileName || '-') + '</span></div>' +
        '</section>' +
        '<section class="panel panel-mapping">' +
            '<div class="panel-header"><span class="panel-label">Mapping-Konfiguration</span></div>' +
            '<div class="panel-content mapping-content">' +
                '<div class="mapping-section">' +
                    '<h3 class="section-title">Quellentyp</h3>' +
                    '<div class="source-type-card">' +
                        '<div class="source-type-info"><span class="source-type-name">' + escHtml(label) + '</span></div>' +
                        '<select class="source-type-select" id="source-type-select">' + sourceTypeOptions + '</select>' +
                    '</div>' +
                '</div>' +
                '<div class="mapping-section">' +
                    '<h3 class="section-title">Mapping-Regeln</h3>' +
                    '<textarea class="mapping-textarea" id="mapping-rules" rows="12">' + escHtml(rules) + '</textarea>' +
                '</div>' +
                '<div class="mapping-section">' +
                    '<h3 class="section-title">Kontext</h3>' +
                    '<div class="context-fields">' +
                        '<div class="context-field">' +
                            '<label>Sprache</label>' +
                            '<select id="ctx-language">' +
                                '<option value="de" selected>Deutsch</option>' +
                                '<option value="la">Latein</option>' +
                                '<option value="mhd">Mittelhochdeutsch</option>' +
                            '</select>' +
                        '</div>' +
                        '<div class="context-field">' +
                            '<label>Epoche</label>' +
                            '<select id="ctx-epoch">' +
                                '<option value="19c" selected>19. Jh.</option>' +
                                '<option value="18c">18. Jh.</option>' +
                                '<option value="medieval">Mittelalter</option>' +
                            '</select>' +
                        '</div>' +
                        '<div class="context-field">' +
                            '<label>Projekt</label>' +
                            '<input type="text" id="ctx-project" placeholder="z.B. HSA">' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="mapping-actions">' +
                    '<button class="btn-secondary" id="btn-back-import">Zur\u00fcck</button>' +
                    '<button class="btn-primary btn-lg" id="btn-start-transform">Weiter</button>' +
                '</div>' +
            '</div>' +
        '</section>';

    $('#btn-back-import').addEventListener('click', () => goToStep(1));
    $('#btn-start-transform').addEventListener('click', () => {
        AppState.set({
            mappingRules: $('#mapping-rules').value,
            sourceType: $('#source-type-select').value,
            context: {
                language: $('#ctx-language').value,
                epoch: $('#ctx-epoch').value,
                project: $('#ctx-project').value
            }
        });
        goToStep(3);
    });
}

// ---------------------------------------------------------------------------
// Step 3: Transform
// ---------------------------------------------------------------------------

function renderTransformStep(container) {
    const hasOutput = !!AppState.outputXml;
    const lineCount = hasOutput ? AppState.outputXml.split('\n').length : 0;

    container.innerHTML =
        '<section class="panel panel-source">' +
            '<div class="panel-header">' +
                '<div class="tab-group">' +
                    '<button class="tab active" data-tab="plaintext">Plaintext</button>' +
                    '<button class="tab" data-tab="digitalisat">Digitalisat</button>' +
                '</div>' +
            '</div>' +
            '<div class="panel-content">' +
                '<div class="tab-content active" data-tab="plaintext">' +
                    '<pre class="source-text">' + escHtml(AppState.inputContent || '') + '</pre>' +
                '</div>' +
                '<div class="tab-content" data-tab="digitalisat">' +
                    '<p class="placeholder-text">Digitalisat-Ansicht (nicht verf\u00fcgbar)</p>' +
                '</div>' +
            '</div>' +
            '<div class="panel-footer"><span>' + escHtml(AppState.fileName || '-') + '</span></div>' +
        '</section>' +
        '<section class="panel panel-editor">' +
            '<div class="panel-header">' +
                '<span class="panel-label">TEI-XML Editor</span>' +
                '<button class="btn-primary btn-sm" id="btn-transform">Transformieren</button>' +
            '</div>' +
            '<div class="panel-content">' +
                '<div class="editor-wrapper" id="editor-wrapper">' +
                    (hasOutput
                        ? '<pre class="xml-editor" id="xml-output" contenteditable="true">' + highlightXml(AppState.outputXml) + '</pre>'
                        : '<p class="placeholder-text">Klicken Sie "Transformieren" um TEI-XML zu generieren</p>') +
                '</div>' +
            '</div>' +
            '<div class="panel-footer"><span id="line-count">' + lineCount + ' Zeilen</span></div>' +
        '</section>' +
        '<section class="panel panel-preview">' +
            '<div class="panel-header">' +
                '<div class="tab-group">' +
                    '<button class="tab active" data-tab="preview">Vorschau</button>' +
                    '<button class="tab" data-tab="entities">Entit\u00e4ten</button>' +
                '</div>' +
            '</div>' +
            '<div class="panel-content">' +
                '<div class="tab-content active" data-tab="preview">' +
                    (hasOutput ? transformTeiToHtml(AppState.outputXml) : '<p class="placeholder-text">Vorschau erscheint nach Transformation</p>') +
                '</div>' +
                '<div class="tab-content" data-tab="entities">' +
                    (hasOutput ? renderEntityList(AppState.outputXml) : '<p class="placeholder-text">Entit\u00e4ten erscheinen nach Transformation</p>') +
                '</div>' +
            '</div>' +
            '<div class="panel-footer">' +
                '<button class="btn-secondary btn-sm" id="btn-back-mapping">Zur\u00fcck</button>' +
                '<button class="btn-primary btn-sm" id="btn-to-validate" ' + (hasOutput ? '' : 'disabled') + '>Weiter</button>' +
            '</div>' +
        '</section>';

    initTabHandlers();
    $('#btn-transform').addEventListener('click', performTransform);
    $('#btn-back-mapping').addEventListener('click', () => goToStep(2));
    $('#btn-to-validate').addEventListener('click', () => goToStep(4));
}

async function performTransform() {
    const btn = $('#btn-transform');
    btn.disabled = true;
    btn.textContent = 'Transformiere\u2026';

    try {
        let xml;
        if (AppState.demoId && DEMO_CONFIGS[AppState.demoId]) {
            const resp = await fetch(DEMO_CONFIGS[AppState.demoId].files.expectedOutput);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            xml = await resp.text();
        } else {
            xml = generateBasicTei(AppState.inputContent, AppState.sourceType);
        }
        AppState.set({ outputXml: xml });
        renderStep(3);
    } catch (e) {
        console.error('Transform failed:', e);
        showToast('Transformation fehlgeschlagen: ' + e.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Transformieren';
    }
}

function generateBasicTei(txt, type) {
    const lines = txt.split('\n').map(l => '        <p>' + escHtml(l) + '</p>').join('\n');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<TEI xmlns="http://www.tei-c.org/ns/1.0">\n' +
        '  <teiHeader>\n' +
        '    <fileDesc>\n' +
        '      <titleStmt><title>Untitled Document</title></titleStmt>\n' +
        '      <publicationStmt><p>Generated by teiCrafter</p></publicationStmt>\n' +
        '      <sourceDesc><p>Transformed from plaintext</p></sourceDesc>\n' +
        '    </fileDesc>\n' +
        '  </teiHeader>\n' +
        '  <text>\n' +
        '    <body>\n' +
        '      <div type="' + escHtml(type) + '">\n' +
        lines + '\n' +
        '      </div>\n' +
        '    </body>\n' +
        '  </text>\n' +
        '</TEI>';
}

// ---------------------------------------------------------------------------
// Step 4: Validate
// ---------------------------------------------------------------------------

function renderValidateStep(container) {
    const origText = AppState.inputContent || '';
    const extracted = extractPlaintext(AppState.outputXml || '');
    const similarity = calculateSimilarity(origText, extracted);
    const wellformed = isWellFormedXml(AppState.outputXml || '');
    const lineCount = AppState.outputXml ? AppState.outputXml.split('\n').length : 0;

    const simClass = similarity >= 90 ? 'valid' : 'warning';
    const simIcon = similarity >= 90 ? '&#10003;' : '!';
    const xmlClass = wellformed ? 'valid' : 'error';
    const xmlIcon = wellformed ? '&#10003;' : '&#10007;';

    container.innerHTML =
        '<section class="panel panel-compare">' +
            '<div class="panel-header"><span class="panel-label">Plaintext-Vergleich</span></div>' +
            '<div class="panel-content compare-content">' +
                '<div class="compare-box"><h4>Original</h4><pre class="compare-text">' +
                    escHtml(origText.substring(0, 500)) + (origText.length > 500 ? '\u2026' : '') +
                '</pre></div>' +
                '<div class="compare-box"><h4>Extrahiert</h4><pre class="compare-text">' +
                    escHtml(extracted.substring(0, 500)) + (extracted.length > 500 ? '\u2026' : '') +
                '</pre></div>' +
            '</div>' +
            '<div class="panel-footer"><span>\u00c4hnlichkeit: ' + similarity + '%</span></div>' +
        '</section>' +
        '<section class="panel panel-editor">' +
            '<div class="panel-header"><span class="panel-label">TEI-XML (readonly)</span></div>' +
            '<div class="panel-content"><pre class="xml-readonly">' + highlightXml(AppState.outputXml || '') + '</pre></div>' +
            '<div class="panel-footer"><span>' + lineCount + ' Zeilen</span></div>' +
        '</section>' +
        '<section class="panel panel-validation">' +
            '<div class="panel-header"><span class="panel-label">Validierung</span></div>' +
            '<div class="panel-content validation-list">' +
                '<div class="validation-item ' + simClass + '">' +
                    '<span class="validation-icon">' + simIcon + '</span>' +
                    '<div class="validation-info"><strong>Plaintext-Vergleich</strong><p>' + similarity + '% \u00dcbereinstimmung</p></div>' +
                '</div>' +
                '<div class="validation-item ' + xmlClass + '">' +
                    '<span class="validation-icon">' + xmlIcon + '</span>' +
                    '<div class="validation-info"><strong>XML-Syntax</strong><p>' + (wellformed ? 'Wohlgeformt' : 'Syntaxfehler') + '</p></div>' +
                '</div>' +
                '<div class="validation-item info">' +
                    '<span class="validation-icon">?</span>' +
                    '<div class="validation-info"><strong>Schema-Validierung</strong><p>TEI-All (nicht gepr\u00fcft)</p></div>' +
                '</div>' +
            '</div>' +
            '<div class="panel-footer">' +
                '<button class="btn-secondary btn-sm" id="btn-back-transform">Zur\u00fcck</button>' +
                '<button class="btn-primary btn-sm" id="btn-to-export" ' + (wellformed ? '' : 'disabled') + '>Weiter</button>' +
            '</div>' +
        '</section>';

    $('#btn-back-transform').addEventListener('click', () => goToStep(3));
    $('#btn-to-export').addEventListener('click', () => goToStep(5));
}

// ---------------------------------------------------------------------------
// Step 5: Export
// ---------------------------------------------------------------------------

function renderExportStep(container) {
    const xml = AppState.outputXml || '';
    const lineCount = xml.split('\n').length;
    const entities = countEntities(xml);

    container.innerHTML =
        '<section class="export-center">' +
            '<div class="export-card">' +
                '<div class="export-success">' +
                    ICONS.success +
                    '<h2>Transformation erfolgreich</h2>' +
                '</div>' +
                '<div class="export-stats">' +
                    '<div class="stat"><span class="stat-label">Dokument</span><span class="stat-value">' + escHtml(AppState.fileName || 'document.xml') + '</span></div>' +
                    '<div class="stat"><span class="stat-label">Zeilen</span><span class="stat-value">' + lineCount + '</span></div>' +
                    '<div class="stat"><span class="stat-label">Entit\u00e4ten</span><span class="stat-value">' + entities.total + ' (' + entities.persons + ' Personen, ' + entities.places + ' Orte)</span></div>' +
                '</div>' +
                '<div class="export-format">' +
                    '<h3>Export-Format</h3>' +
                    '<label class="radio-option"><input type="radio" name="export-format" value="full" checked> TEI-XML vollst\u00e4ndig</label>' +
                    '<label class="radio-option"><input type="radio" name="export-format" value="body"> TEI-XML nur Body</label>' +
                '</div>' +
                '<div class="export-actions">' +
                    '<button class="btn-primary btn-lg" id="btn-download">Download TEI-XML</button>' +
                '</div>' +
                '<div class="export-secondary">' +
                    '<button class="btn-secondary" id="btn-copy">In Zwischenablage kopieren</button>' +
                    '<button class="btn-secondary" id="btn-new-doc">Neues Dokument</button>' +
                '</div>' +
            '</div>' +
        '</section>';

    $('#btn-download').addEventListener('click', downloadTei);
    $('#btn-copy').addEventListener('click', copyToClipboard);
    $('#btn-new-doc').addEventListener('click', () => { AppState.reset(); goToStep(1); });
}

function getExportContent() {
    const format = $('input[name="export-format"]:checked')?.value || 'full';
    let content = AppState.outputXml || '';
    if (format === 'body') {
        const m = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        content = m ? m[1].trim() : content;
    }
    return content;
}

function downloadTei() {
    const content = getExportContent();
    const blob = new Blob([content], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (AppState.fileName || 'document').replace(/\.[^.]+$/, '') + '-tei.xml';
    a.click();
    URL.revokeObjectURL(url);
}

function copyToClipboard() {
    const content = getExportContent();
    navigator.clipboard.writeText(content)
        .then(() => showToast('In Zwischenablage kopiert!', 'success'))
        .catch(e => showToast('Kopieren fehlgeschlagen: ' + e.message, 'error'));
}

// ---------------------------------------------------------------------------
// Shared Helpers (XML utilities)
// ---------------------------------------------------------------------------

function transformTeiToHtml(xml) {
    try {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        if (doc.querySelector('parsererror')) return '<p class="placeholder-text">XML-Parsing-Fehler</p>';
        const body = doc.querySelector('body');
        if (!body) return '<p class="placeholder-text">Kein body-Element gefunden</p>';
        let html = body.innerHTML
            .replace(/<head[^>]*>/g, '<h3 class="tei-head">').replace(/<\/head>/g, '</h3>')
            .replace(/<p[^>]*>/g, '<p class="tei-p">').replace(/<\/p>/g, '</p>')
            .replace(/<persName[^>]*>/g, '<mark class="entity person">').replace(/<\/persName>/g, '</mark>')
            .replace(/<placeName[^>]*>/g, '<mark class="entity place">').replace(/<\/placeName>/g, '</mark>')
            .replace(/<date[^>]*>/g, '<mark class="entity date">').replace(/<\/date>/g, '</mark>')
            .replace(/<pb[^>]*\/>/g, '<hr class="tei-pb">')
            .replace(/<lb[^>]*\/>/g, '<br>');
        return '<div class="tei-preview">' + html + '</div>';
    } catch (e) {
        return '<p class="placeholder-text">Vorschau-Fehler</p>';
    }
}

function renderEntityList(xml) {
    const entities = [];
    const re = /<(persName|placeName|date|name)[^>]*>([^<]+)<\/\1>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
        entities.push({ type: m[1], text: m[2] });
    }
    if (!entities.length) return '<p class="placeholder-text">Keine Entit\u00e4ten gefunden</p>';
    return '<ul class="entity-list">' +
        entities.map(e =>
            '<li class="entity-item ' + escHtml(e.type) + '">' +
                '<span class="entity-type">' + escHtml(e.type) + '</span>' +
                escHtml(e.text) +
            '</li>'
        ).join('') +
    '</ul>';
}

function extractPlaintext(xml) {
    try {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        return (doc.querySelector('body')?.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (e) { return ''; }
}

function calculateSimilarity(a, b) {
    a = a.replace(/\s+/g, ' ').trim().toLowerCase();
    b = b.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!a || !b) return 0;
    const words1 = new Set(a.split(' '));
    const words2 = new Set(b.split(' '));
    let common = 0;
    words1.forEach(w => { if (words2.has(w)) common++; });
    return Math.round((common / Math.max(words1.size, words2.size)) * 100);
}

function isWellFormedXml(xml) {
    try {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        return !doc.querySelector('parsererror');
    } catch (e) { return false; }
}

function countEntities(xml) {
    const persons = (xml.match(/<persName/g) || []).length;
    const places = (xml.match(/<placeName/g) || []).length;
    const dates = (xml.match(/<date/g) || []).length;
    return { persons, places, dates, total: persons + places + dates };
}

// ---------------------------------------------------------------------------
// Tab Handlers
// ---------------------------------------------------------------------------

function initTabHandlers() {
    $$('.tab-group').forEach(tg => {
        tg.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const panel = tab.closest('.panel');
                panel.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                panel.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                tab.classList.add('active');
                const target = panel.querySelector('.tab-content[data-tab="' + tab.dataset.tab + '"]');
                if (target) target.classList.add('active');
            });
        });
    });
}

// ---------------------------------------------------------------------------
// Stepper + Footer
// ---------------------------------------------------------------------------

function updateStepper(step) {
    $$('.stepper-step').forEach((s, i) => {
        s.classList.remove('active', 'completed');
        if (i + 1 < step) s.classList.add('completed');
        if (i + 1 === step) s.classList.add('active');
    });
}

function updateFooter(step) {
    const footerLeft = $('.footer-left');
    if (!footerLeft) return;
    const statusEl = $('#footer-status');
    if (statusEl) statusEl.textContent = 'Schritt ' + step + ' von 5';
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function goToStep(step) {
    if (step < 1 || step > 5) return;
    AppState.set({ currentStep: step });
    renderStep(step);
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

renderStep(1);
