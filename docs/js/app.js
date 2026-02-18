/**
 * teiCrafter – Application Shell (ES6 Module)
 * Stepper navigation, step routing, state management.
 */

import { DEMO_CONFIGS, ICONS, SOURCE_LABELS, MAX_FILE_SIZE, getDefaultMapping } from './utils/constants.js';
import { $, $$, escHtml, highlightXml, showToast } from './utils/dom.js';
import { transform } from './services/transform.js';
import { setApiKey, hasApiKey, getProvider, setProvider, getModel, setModel, getProviderConfigs, getModelCatalog, getModelsForProvider, testConnection } from './services/llm.js';
import { validate } from './services/validator.js';
import { loadSchema, isLoaded as isSchemaLoaded } from './services/schema.js';
import { prepareExport, getExportStats, downloadXml as downloadXmlService, copyToClipboard as copyToClipboardService, getExportFileName } from './services/export.js';

// ---------------------------------------------------------------------------
// Application State
// ---------------------------------------------------------------------------

const INITIAL_STATE = Object.freeze({
    currentStep: 1,
    inputContent: null,
    inputFormat: 'plaintext',
    fileName: null,
    demoId: null,
    sourceType: 'generic',
    mappingRules: null,
    context: { language: 'de', epoch: '19c', project: '' },
    outputXml: null,
    confidenceMap: null,
    transformStats: null,
    originalPlaintext: null
});

const AppState = {
    ...INITIAL_STATE,
    set(updates) { Object.assign(this, updates); },
    reset() { Object.assign(this, structuredClone(INITIAL_STATE)); }
};

let transformController = null;
let transformInProgress = false;
let stepCleanup = null;

// ---------------------------------------------------------------------------
// Step Rendering
// ---------------------------------------------------------------------------

async function renderStep(step) {
    stepCleanup?.();
    stepCleanup = null;

    const main = $('.app-main');
    main.classList.remove('step-1', 'step-2', 'step-3', 'step-4', 'step-5');
    main.classList.add('step-' + step);
    main.innerHTML = '';

    switch (step) {
        case 1: renderImportStep(main); break;
        case 2: renderMappingStep(main); break;
        case 3: renderTransformStep(main); break;
        case 4: await renderValidateStep(main); break;
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
            '<button class="btn-secondary btn-sm" data-action="load-demo">Laden</button>' +
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
                    '<button class="btn-primary" data-action="select-file">Datei ausw\u00e4hlen\u2026</button>' +
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

    // Drag-and-drop needs step-scoped listeners (cleaned up on step change)
    const dz = $('#dropzone');
    const fi = $('#file-input');
    const onDragover = e => { e.preventDefault(); dz.classList.add('drag-over'); };
    const onDragleave = () => dz.classList.remove('drag-over');
    const onDrop = async e => {
        e.preventDefault();
        dz.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) await processFile(e.dataTransfer.files[0]);
    };
    const onFileChange = async e => {
        if (e.target.files[0]) await processFile(e.target.files[0]);
    };

    dz.addEventListener('dragover', onDragover);
    dz.addEventListener('dragleave', onDragleave);
    dz.addEventListener('drop', onDrop);
    fi.addEventListener('change', onFileChange);

    stepCleanup = () => {
        dz.removeEventListener('dragover', onDragover);
        dz.removeEventListener('dragleave', onDragleave);
        dz.removeEventListener('drop', onDrop);
        fi.removeEventListener('change', onFileChange);
    };
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
    if (text.includes(' fl') || text.includes(' kr') || text.includes('Rechnung') || text.includes('Empfang Gelt')) return 'bookkeeping';
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
                    '<button class="btn-secondary" data-action="go-step-1">Zur\u00fcck</button>' +
                    '<button class="btn-primary btn-lg" data-action="save-mapping">Weiter</button>' +
                '</div>' +
            '</div>' +
        '</section>';
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
                '<button class="btn-primary btn-sm" data-action="transform">Transformieren</button>' +
            '</div>' +
            '<div class="panel-content">' +
                '<div class="editor-wrapper" id="editor-wrapper">' +
                    (hasOutput
                        ? '<pre class="xml-editor" id="xml-output" contenteditable="true">' + highlightXml(AppState.outputXml) + '</pre>'
                        : '<p class="placeholder-text">Klicken Sie "Transformieren" um TEI-XML zu generieren</p>') +
                '</div>' +
            '</div>' +
            '<div class="panel-footer"><span id="line-count">' + lineCount + ' Zeilen</span>' +
                (AppState.transformStats
                    ? '<span class="transform-stats">' +
                        AppState.transformStats.total + ' Annotationen: ' +
                        '<span class="stat-sicher">' + AppState.transformStats.sicher + ' sicher</span> · ' +
                        '<span class="stat-pruefenswert">' + AppState.transformStats.pruefenswert + ' prüfenswert</span> · ' +
                        '<span class="stat-problematisch">' + AppState.transformStats.problematisch + ' problematisch</span>' +
                      '</span>'
                    : '') +
            '</div>' +
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
                '<button class="btn-secondary btn-sm" data-action="go-step-2">Zur\u00fcck</button>' +
                '<button class="btn-primary btn-sm" data-action="go-step-4" ' + (hasOutput ? '' : 'disabled') + '>Weiter</button>' +
            '</div>' +
        '</section>';
}

async function performTransform() {
    if (transformInProgress) return;
    transformInProgress = true;

    const btn = $('[data-action="transform"]');
    btn.disabled = true;
    btn.textContent = 'Transformiere…';

    try {
        // Demo mode: fetch expected output directly
        if (AppState.demoId && DEMO_CONFIGS[AppState.demoId]) {
            const resp = await fetch(DEMO_CONFIGS[AppState.demoId].files.expectedOutput);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const xml = await resp.text();
            AppState.set({ outputXml: xml, originalPlaintext: AppState.inputContent });
            transformInProgress = false;
            renderStep(3);
            return;
        }

        // Real mode: check API key
        if (!hasApiKey()) {
            showToast('Bitte zuerst LLM-Provider konfigurieren.', 'warning');
            await openSettingsDialog();
            transformInProgress = false;
            btn.disabled = false;
            btn.textContent = 'Transformieren';
            return;
        }

        // Show loading UI
        const wrapper = $('#editor-wrapper');
        if (wrapper) {
            wrapper.innerHTML =
                '<div class="transform-loading">' +
                    '<div class="spinner"></div>' +
                    '<p>LLM-Transformation läuft…</p>' +
                    '<button class="btn-secondary btn-sm" data-action="cancel-transform">Abbrechen</button>' +
                '</div>';
        }

        // Set up AbortController
        transformController = new AbortController();

        // Save original plaintext for validation later
        AppState.set({ originalPlaintext: AppState.inputContent });

        // Call transform service
        const result = await transform({
            xmlContent: AppState.inputContent,
            sourceType: AppState.sourceType,
            context: AppState.context,
            mappingRules: AppState.mappingRules
        }, { signal: transformController.signal });

        AppState.set({
            outputXml: result.xml,
            confidenceMap: result.confidenceMap,
            transformStats: result.stats
        });
        transformController = null;
        transformInProgress = false;
        renderStep(3);

    } catch (e) {
        transformController = null;
        transformInProgress = false;
        if (e.name === 'AbortError') {
            showToast('Transformation abgebrochen.', 'warning');
        } else {
            console.error('Transform failed:', e);
            showToast('Transformation fehlgeschlagen: ' + e.message, 'error');
        }
        btn.disabled = false;
        btn.textContent = 'Transformieren';
    }
}

// ---------------------------------------------------------------------------
// Step 4: Validate
// ---------------------------------------------------------------------------

async function renderValidateStep(container) {
    const origText = AppState.originalPlaintext || AppState.inputContent || '';
    const extracted = extractPlaintext(AppState.outputXml || '');
    const lineCount = AppState.outputXml ? AppState.outputXml.split('\n').length : 0;

    // Lazy-load schema
    if (!isSchemaLoaded()) {
        try { await loadSchema(); } catch (e) {
            console.warn('Schema could not be loaded:', e);
        }
    }

    // Run validation via validator.js
    let messages = [];
    try {
        messages = validate({
            xml: AppState.outputXml || '',
            originalPlaintext: origText,
            reviewStatusMap: null
        });
    } catch (e) {
        console.error('Validation failed:', e);
        messages = [{ level: 'error', source: 'system', message: 'Validierung fehlgeschlagen: ' + e.message }];
    }

    // Count by level
    const errors = messages.filter(m => m.level === 'error');
    const warnings = messages.filter(m => m.level === 'warning');
    const infos = messages.filter(m => m.level === 'info');
    const hasErrors = errors.length > 0;

    // Render validation items
    function renderMessages(msgs) {
        if (!msgs.length) return '<div class="validation-item success"><span class="validation-icon">&#10003;</span><div class="validation-info"><strong>Alle Prüfungen bestanden</strong></div></div>';
        return msgs.map(m => {
            const cls = m.level === 'error' ? 'error' : (m.level === 'warning' ? 'warning' : 'success');
            const icon = m.level === 'error' ? '&#10007;' : (m.level === 'warning' ? '!' : '&#10003;');
            return '<div class="validation-item ' + cls + '">' +
                '<span class="validation-icon">' + icon + '</span>' +
                '<div class="validation-info">' +
                    '<strong>' + escHtml(m.source) + '</strong>' +
                    '<p>' + escHtml(m.message) + '</p>' +
                    (m.line ? '<span class="validation-line">Zeile ' + m.line + '</span>' : '') +
                '</div>' +
            '</div>';
        }).join('');
    }

    container.innerHTML =
        '<section class="panel panel-compare">' +
            '<div class="panel-header"><span class="panel-label">Plaintext-Vergleich</span></div>' +
            '<div class="panel-content compare-content">' +
                '<div class="compare-box"><h4>Original</h4><pre class="compare-text">' +
                    escHtml(origText.substring(0, 500)) + (origText.length > 500 ? '…' : '') +
                '</pre></div>' +
                '<div class="compare-box"><h4>Extrahiert</h4><pre class="compare-text">' +
                    escHtml(extracted.substring(0, 500)) + (extracted.length > 500 ? '…' : '') +
                '</pre></div>' +
            '</div>' +
            '<div class="panel-footer"><span>' + origText.split(/\s+/).length + ' Wörter original</span></div>' +
        '</section>' +
        '<section class="panel panel-editor">' +
            '<div class="panel-header"><span class="panel-label">TEI-XML (readonly)</span></div>' +
            '<div class="panel-content"><pre class="xml-readonly">' + highlightXml(AppState.outputXml || '') + '</pre></div>' +
            '<div class="panel-footer"><span>' + lineCount + ' Zeilen</span></div>' +
        '</section>' +
        '<section class="panel panel-validation">' +
            '<div class="panel-header"><span class="panel-label">Validierung (' + errors.length + ' Fehler, ' + warnings.length + ' Warnungen)</span></div>' +
            '<div class="panel-content validation-list">' +
                renderMessages(messages) +
            '</div>' +
            '<div class="panel-footer">' +
                '<button class="btn-secondary btn-sm" data-action="go-step-3">Zurück</button>' +
                '<button class="btn-primary btn-sm" data-action="go-step-5" ' + (hasErrors ? 'disabled' : '') + '>Weiter</button>' +
            '</div>' +
        '</section>';
}

// ---------------------------------------------------------------------------
// Step 5: Export
// ---------------------------------------------------------------------------

function renderExportStep(container) {
    const xml = AppState.outputXml || '';
    const stats = getExportStats(xml);
    const exportFileName = getExportFileName(AppState.fileName || 'document.xml');

    // Build entity summary
    const entityParts = [];
    if (stats.entityCounts) {
        for (const [tag, count] of Object.entries(stats.entityCounts)) {
            if (count > 0) entityParts.push(count + ' ' + escHtml(tag));
        }
    }
    const entitySummary = entityParts.length ? entityParts.join(', ') : 'keine';

    container.innerHTML =
        '<section class="export-center">' +
            '<div class="export-card">' +
                '<div class="export-success">' +
                    ICONS.success +
                    '<h2>Transformation erfolgreich</h2>' +
                '</div>' +
                '<div class="export-stats">' +
                    '<div class="stat"><span class="stat-label">Dokument</span><span class="stat-value">' + escHtml(exportFileName) + '</span></div>' +
                    '<div class="stat"><span class="stat-label">Zeilen</span><span class="stat-value">' + stats.lineCount + '</span></div>' +
                    '<div class="stat"><span class="stat-label">Entitäten</span><span class="stat-value">' + stats.totalEntities + ' (' + entitySummary + ')</span></div>' +
                '</div>' +
                '<div class="export-format">' +
                    '<h3>Export-Format</h3>' +
                    '<label class="radio-option"><input type="radio" name="export-format" value="full" checked> TEI-XML vollständig</label>' +
                    '<label class="radio-option"><input type="radio" name="export-format" value="body"> TEI-XML nur Body</label>' +
                '</div>' +
                '<div class="export-options">' +
                    '<label><input type="checkbox" id="opt-keep-confidence"> Konfidenz-Attribute beibehalten</label>' +
                    '<label><input type="checkbox" id="opt-keep-resp"> Resp-Attribute beibehalten</label>' +
                '</div>' +
                '<div class="export-actions">' +
                    '<button class="btn-primary btn-lg" data-action="download-export">Download TEI-XML</button>' +
                '</div>' +
                '<div class="export-secondary">' +
                    '<button class="btn-secondary" data-action="copy-export">In Zwischenablage kopieren</button>' +
                    '<button class="btn-secondary" data-action="new-document">Neues Dokument</button>' +
                '</div>' +
            '</div>' +
        '</section>';
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

function isWellFormedXml(xml) {
    try {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        return !doc.querySelector('parsererror');
    } catch (e) { return false; }
}

// ---------------------------------------------------------------------------
// Export Helpers
// ---------------------------------------------------------------------------

function getExportOptions() {
    return {
        format: $('input[name="export-format"]:checked')?.value || 'full',
        keepConfidence: $('#opt-keep-confidence')?.checked || false,
        keepResp: $('#opt-keep-resp')?.checked || false
    };
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
// LLM Settings Dialog
// ---------------------------------------------------------------------------

function updateModelBadge() {
    const el = $('#model-name');
    if (!el) return;
    const provider = getProvider();
    const model = getModel();
    if (provider && hasApiKey()) {
        el.textContent = model || provider;
        el.closest('.model-badge')?.classList.add('connected');
    } else {
        el.textContent = 'Kein Modell';
        el.closest('.model-badge')?.classList.remove('connected');
    }
}

function buildModelOptions(providerId, selectedModel) {
    const catalog = getModelCatalog();
    const models = getModelsForProvider(providerId);
    const isOllama = providerId === 'ollama';

    return models.map(mid => {
        const meta = catalog[mid];
        let label = mid;
        if (meta) {
            const ctx = meta.context >= 1000000 ? (meta.context / 1000000) + 'M' : Math.round(meta.context / 1000) + 'k';
            label = meta.name + ' – $' + meta.input.toFixed(2) + '/$' + meta.output.toFixed(2) + ' · ' + ctx;
            if (meta.reasoning) label += ' · Reasoning';
        } else if (isOllama) {
            label = mid + ' (lokal)';
        }
        return '<option value="' + escHtml(mid) + '"' + (mid === selectedModel ? ' selected' : '') + '>' +
            escHtml(label) + '</option>';
    }).join('');
}

function getProviderInfo(providerId) {
    if (providerId === 'ollama') return 'Lokal · Kostenlos · Ollama muss laufen (localhost:11434)';
    return 'API-Key erforderlich · Kosten pro Nutzung';
}

function buildSettingsHtml(configs, curProvider, curModel) {
    const providerOptions = Object.entries(configs).map(([id, cfg]) =>
        '<option value="' + escHtml(id) + '"' + (id === curProvider ? ' selected' : '') + '>' +
            escHtml(cfg.name) +
        '</option>'
    ).join('');

    const isOllama = curProvider === 'ollama';

    return '<h3 class="dialog-title">LLM-Einstellungen</h3>' +
        '<div class="dialog-body">' +
            '<div class="settings-grid">' +
                '<label for="settings-provider">Provider</label>' +
                '<select id="settings-provider">' + providerOptions + '</select>' +
                '<div></div><div class="provider-info" id="provider-info">' + escHtml(getProviderInfo(curProvider)) + '</div>' +
                '<label for="settings-model">Modell</label>' +
                '<select id="settings-model">' + buildModelOptions(curProvider, curModel) + '</select>' +
                '<label for="settings-custom-model" id="settings-custom-label"' + (!isOllama ? ' style="display:none"' : '') + '>Custom</label>' +
                '<input type="text" id="settings-custom-model" placeholder="Eigene Modell-ID"' + (!isOllama ? ' style="display:none"' : '') + '>' +
                '<label for="settings-apikey">API-Key</label>' +
                '<input type="password" id="settings-apikey" placeholder="' +
                    (isOllama ? 'Nicht benötigt (lokal)' : hasApiKey(curProvider) ? '••••••• (gesetzt)' : 'API-Key eingeben') + '"' +
                    (isOllama ? ' disabled' : '') + '>' +
            '</div>' +
            '<div class="settings-info" id="settings-info"></div>' +
        '</div>' +
        '<div class="dialog-actions">' +
            '<button class="btn-secondary" id="settings-test">Verbindung testen</button>' +
            '<button class="btn-secondary" id="settings-cancel">Abbrechen</button>' +
            '<button class="btn-primary" id="settings-save">Speichern</button>' +
        '</div>';
}

function attachSettingsListeners(dialog, backdrop, configs) {
    const providerSelect = dialog.querySelector('#settings-provider');
    const modelSelect = dialog.querySelector('#settings-model');
    const customModelInput = dialog.querySelector('#settings-custom-model');
    const customModelLabel = dialog.querySelector('#settings-custom-label');
    const keyInput = dialog.querySelector('#settings-apikey');
    const infoEl = dialog.querySelector('#settings-info');
    const providerInfoEl = dialog.querySelector('#provider-info');

    function getSelectedModel() {
        const pid = providerSelect.value;
        const cfg = configs[pid];
        if (cfg?.authType === 'none' && customModelInput.value.trim()) {
            return customModelInput.value.trim();
        }
        return modelSelect.value;
    }

    providerSelect.addEventListener('change', () => {
        const pid = providerSelect.value;
        const cfg = configs[pid];
        const pidIsOllama = cfg?.authType === 'none';

        modelSelect.innerHTML = buildModelOptions(pid, cfg?.defaultModel || '');
        customModelInput.style.display = pidIsOllama ? '' : 'none';
        customModelLabel.style.display = pidIsOllama ? '' : 'none';
        customModelInput.value = '';
        providerInfoEl.textContent = getProviderInfo(pid);

        keyInput.value = '';
        if (pidIsOllama) {
            keyInput.placeholder = 'Nicht benötigt (lokal)';
            keyInput.disabled = true;
        } else {
            keyInput.placeholder = hasApiKey(pid) ? '••••••• (gesetzt)' : 'API-Key eingeben';
            keyInput.disabled = false;
        }
    });

    dialog.querySelector('#settings-test').addEventListener('click', async () => {
        const pid = providerSelect.value;
        setProvider(pid);
        setModel(getSelectedModel());
        if (keyInput.value) setApiKey(pid, keyInput.value);

        infoEl.textContent = 'Teste Verbindung…';
        infoEl.className = 'settings-info';
        try {
            const result = await testConnection();
            infoEl.textContent = (result.success ? '\u2713 ' : '\u2717 ') + result.message;
            infoEl.className = 'settings-info ' + (result.success ? 'settings-success' : 'settings-error');
        } catch (e) {
            infoEl.textContent = '\u2717 ' + e.message;
            infoEl.className = 'settings-info settings-error';
        }
    });

    dialog.querySelector('#settings-cancel').addEventListener('click', () => backdrop.remove());

    dialog.querySelector('#settings-save').addEventListener('click', () => {
        const pid = providerSelect.value;
        setProvider(pid);
        setModel(getSelectedModel());
        if (keyInput.value) setApiKey(pid, keyInput.value);
        updateModelBadge();
        backdrop.remove();
        showToast('Einstellungen gespeichert.', 'success');
    });

    backdrop.addEventListener('click', e => {
        if (e.target === backdrop) backdrop.remove();
    });
}

async function openSettingsDialog() {
    const configs = getProviderConfigs();
    const curProvider = getProvider() || 'gemini';
    const curModel = getModel() || configs[curProvider]?.defaultModel || '';

    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'dialog dialog-settings';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'LLM-Einstellungen');

    dialog.innerHTML = buildSettingsHtml(configs, curProvider, curModel);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    attachSettingsListeners(dialog, backdrop, configs);
}

// ---------------------------------------------------------------------------
// Event Delegation (single listener on .app-main)
// ---------------------------------------------------------------------------

function handleAction(action, e) {
    // Navigation
    if (/^go-step-(\d)$/.test(action)) {
        const step = parseInt(action.charAt(action.length - 1), 10);
        goToStep(step);
        return;
    }

    switch (action) {
        // Step 1: Import
        case 'select-file':
            $('#file-input')?.click();
            break;
        case 'load-demo': {
            const card = e.target.closest('.demo-card');
            if (card?.dataset.demo) loadDemo(card.dataset.demo);
            break;
        }

        // Step 2: Mapping
        case 'save-mapping':
            AppState.set({
                mappingRules: $('#mapping-rules')?.value,
                sourceType: $('#source-type-select')?.value,
                context: {
                    language: $('#ctx-language')?.value || 'de',
                    epoch: $('#ctx-epoch')?.value || '19c',
                    project: $('#ctx-project')?.value || ''
                }
            });
            goToStep(3);
            break;

        // Step 3: Transform
        case 'transform':
            performTransform();
            break;
        case 'cancel-transform':
            transformController?.abort();
            break;

        // Step 5: Export
        case 'download-export': {
            const opts = getExportOptions();
            const xml = AppState.outputXml || '';
            const content = prepareExport(xml, opts);
            downloadXmlService(content, getExportFileName(AppState.fileName || 'document.xml'));
            break;
        }
        case 'copy-export': {
            const opts = getExportOptions();
            const xml = AppState.outputXml || '';
            const content = prepareExport(xml, opts);
            copyToClipboardService(content).then(ok => {
                showToast(ok ? 'In Zwischenablage kopiert!' : 'Kopieren fehlgeschlagen.', ok ? 'success' : 'error');
            });
            break;
        }
        case 'new-document':
            AppState.reset();
            goToStep(1);
            break;
    }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

const main = $('.app-main');

// Delegated click handler for data-action buttons
main.addEventListener('click', e => {
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) {
        handleAction(actionEl.dataset.action, e);
        return;
    }

    // Delegated tab handler
    const tab = e.target.closest('.tab[data-tab]');
    if (tab) {
        const panel = tab.closest('.panel');
        if (!panel) return;
        panel.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        panel.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        const target = panel.querySelector('.tab-content[data-tab="' + tab.dataset.tab + '"]');
        if (target) target.classList.add('active');
    }
});

$('#btn-settings')?.addEventListener('click', openSettingsDialog);
updateModelBadge();
renderStep(1);
