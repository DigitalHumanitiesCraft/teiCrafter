/**
 * teiCrafter Pipeline -- MODS-to-teiHeader Mapping (P.2)
 *
 * Deterministic mapping from Page-JSON v0.2 source metadata
 * to a TEI header. No LLM involved.
 *
 * Input:  pageJson.source, pageJson.provenance, pageJson.review
 * Output: teiHeader XML string
 */

import { esc, el, langName } from './utils.js';

/**
 * Build a complete <teiHeader> from Page-JSON v0.2 metadata.
 * @param {Object} pageJson - Full Page-JSON v0.2 object
 * @returns {string} XML string (indented, no outer newline)
 */
export function buildTeiHeader(pageJson) {
    const s = pageJson.source || {};
    const prov = pageJson.provenance || {};
    const review = pageJson.review || {};
    const dm = s.descriptive_metadata || {};

    const lines = [];
    lines.push('  <teiHeader>');
    lines.push(buildFileDesc(s, dm));
    lines.push(buildProfileDesc(s, dm));
    lines.push(buildEncodingDesc(prov));
    lines.push(buildRevisionDesc(prov, review));
    lines.push('  </teiHeader>');

    return lines.filter(Boolean).join('\n');
}

// --- fileDesc ---

function buildFileDesc(s, dm) {
    const lines = [];
    lines.push('    <fileDesc>');
    lines.push(buildTitleStmt(s, dm));
    lines.push(buildPublicationStmt(dm));
    lines.push(buildSourceDesc(s, dm));
    lines.push('    </fileDesc>');
    return lines.join('\n');
}

function buildTitleStmt(s, dm) {
    const lines = [];
    lines.push('      <titleStmt>');
    lines.push(`        ${el('title', null, s.title || 'Untitled')}`);

    if (dm.creator?.length) {
        for (const c of dm.creator) {
            const tag = c.role === 'editor' ? 'editor' : 'author';
            const attrs = c.gnd ? { ref: c.gnd } : null;
            lines.push(`        ${el(tag, attrs, c.name)}`);
        }
    }

    lines.push('      </titleStmt>');
    return lines.join('\n');
}

function buildPublicationStmt(dm) {
    const lines = [];
    lines.push('      <publicationStmt>');
    lines.push('        <publisher>Stefan Zweig Digital</publisher>');

    const rights = dm.rights || 'CC-BY 4.0';
    const target = rights.startsWith('CC-BY')
        ? 'https://creativecommons.org/licenses/by/4.0/'
        : null;
    lines.push('        <availability>');
    lines.push(`          ${el('licence', target ? { target } : null, rights)}`);
    lines.push('        </availability>');

    lines.push('      </publicationStmt>');
    return lines.join('\n');
}

function buildSourceDesc(s, dm) {
    const hold = dm.holding || {};
    const phys = dm.physical_description || {};

    const lines = [];
    lines.push('      <sourceDesc>');
    lines.push('        <msDesc>');

    // --- msIdentifier ---
    lines.push('          <msIdentifier>');
    const repo = hold.repository || s.repository || 'Literaturarchiv Salzburg';
    lines.push(`            ${el('repository', hold.repository_gnd ? { ref: hold.repository_gnd } : null, repo)}`);
    if (hold.country) lines.push(`            ${el('country', null, hold.country)}`);
    if (hold.settlement) lines.push(`            ${el('settlement', null, hold.settlement)}`);
    if (s.shelfmark) lines.push(`            ${el('idno', { type: 'shelfmark' }, s.shelfmark)}`);
    lines.push(`            ${el('idno', { type: 'PID' }, s.id || 'unknown')}`);
    lines.push('          </msIdentifier>');

    // --- physDesc (only if data exists) ---
    const hasSupport = phys.writing_material || dm.extent || phys.dimensions;
    const hasHands = phys.writing_instrument || phys.hands?.length;

    if (hasSupport || hasHands) {
        lines.push('          <physDesc>');

        if (hasSupport) {
            lines.push('            <objectDesc>');
            lines.push('              <supportDesc>');
            if (phys.writing_material) lines.push(`                ${el('support', null, phys.writing_material)}`);
            if (dm.extent) lines.push(`                ${el('extent', null, dm.extent)}`);
            if (phys.dimensions) lines.push(`                ${el('extent', { type: 'dimensions' }, phys.dimensions)}`);
            lines.push('              </supportDesc>');
            lines.push('            </objectDesc>');
        }

        if (hasHands) {
            lines.push('            <handDesc>');
            if (phys.writing_instrument) {
                lines.push(`              ${el('handNote', null, phys.writing_instrument)}`);
            }
            if (phys.hands?.length) {
                for (const hand of phys.hands) {
                    lines.push(`              ${el('handNote', { scribe: hand }, hand)}`);
                }
            }
            lines.push('            </handDesc>');
        }

        lines.push('          </physDesc>');
    }

    // --- history (only if data exists) ---
    if (s.date || dm.origin_place || dm.provenance?.length) {
        lines.push('          <history>');

        if (s.date || dm.origin_place) {
            lines.push('            <origin>');
            if (dm.origin_place) lines.push(`              ${el('origPlace', null, dm.origin_place)}`);
            if (s.date) {
                const isoDate = tryParseIsoDate(s.date);
                lines.push(`              ${el('origDate', isoDate ? { when: isoDate } : null, s.date)}`);
            }
            lines.push('            </origin>');
        }

        if (dm.provenance?.length) {
            for (const p of dm.provenance) {
                lines.push(`            ${el('provenance', null, p)}`);
            }
        }

        lines.push('          </history>');
    }

    // --- additional/notes ---
    if (dm.notes) {
        lines.push('          <additional>');
        lines.push(`            <adminInfo><note>${esc(dm.notes)}</note></adminInfo>`);
        lines.push('          </additional>');
    }

    lines.push('        </msDesc>');
    lines.push('      </sourceDesc>');
    return lines.join('\n');
}

// --- profileDesc ---

function buildProfileDesc(s, dm) {
    if (!s.language && !dm.subject?.length && s.document_type !== 'letter') return '';

    const lines = [];
    lines.push('    <profileDesc>');

    if (s.language) {
        lines.push('      <langUsage>');
        lines.push(`        ${el('language', { ident: s.language }, langName(s.language))}`);
        lines.push('      </langUsage>');
    }

    if (dm.subject?.length) {
        lines.push('      <textClass>');
        for (const subj of dm.subject) {
            lines.push(`        ${el('classCode', { scheme: '#szd' }, subj)}`);
        }
        lines.push('      </textClass>');
    }

    lines.push('    </profileDesc>');
    return lines.join('\n');
}

// --- encodingDesc ---

function buildEncodingDesc(prov) {
    const model = prov.model || 'unknown';
    const provider = prov.provider || 'unknown';
    const layers = prov.prompt_layers?.join(', ') || '';

    const desc = `Automatisch generiert durch teiCrafter Pipeline aus szd-htr Page-JSON v0.2. ` +
        `Modell: ${esc(model)}, Provider: ${esc(provider)}` +
        (layers ? `, Prompt-Layers: ${esc(layers)}` : '') + '.';

    const lines = [];
    lines.push('    <encodingDesc>');
    lines.push('      <projectDesc>');
    lines.push(`        <p>${desc}</p>`);
    lines.push('      </projectDesc>');
    lines.push('    </encodingDesc>');
    return lines.join('\n');
}

// --- revisionDesc ---

function buildRevisionDesc(prov, review) {
    const when = prov.created_at ? prov.created_at.substring(0, 10) : today();
    const model = prov.model || 'unknown';

    const lines = [];
    lines.push('    <revisionDesc>');
    lines.push(`      ${el('change', { when }, 'Pipeline-Export aus szd-htr (' + model + ')')}`);

    if (review.status) {
        const rWhen = review.reviewed_at ? review.reviewed_at.substring(0, 10) : when;
        const reviewer = review.reviewed_by || 'unknown';
        lines.push(`      ${el('change', { when: rWhen }, 'Review: ' + review.status + ' (' + reviewer + ')')}`);
    }

    lines.push('    </revisionDesc>');
    return lines.join('\n');
}

// --- Helpers ---

/**
 * Try to extract an ISO date (YYYY-MM-DD) from a date string.
 * Returns the ISO date if found, null otherwise.
 */
function tryParseIsoDate(dateStr) {
    if (!dateStr) return null;
    const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    // Try "YYYY" alone
    const y = dateStr.match(/\b(\d{4})\b/);
    if (y) return y[1];
    return null;
}

function today() {
    return new Date().toISOString().substring(0, 10);
}
