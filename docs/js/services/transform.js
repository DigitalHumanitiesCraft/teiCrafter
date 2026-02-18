/**
 * teiCrafter – Transform Service
 * Dreischichten-Prompt-Assemblierung (Basis + Kontext + Mapping)
 * Response parsing: XML extraction, confidence mapping.
 */

import { complete } from './llm.js';
import { ANNOTATION_TAGS } from '../utils/constants.js';

// --- Basisschicht (generisch, von teiCrafter vorgegeben) ---
const BASE_PROMPT = `You are a TEI-XML annotation assistant. Your task is to annotate the given text with TEI-XML markup.

RULES:
1. Produce well-formed TEI-XML output
2. Do NOT alter, add, or remove any text content — preserve every character exactly
3. Add @confidence="high", "medium", or "low" to each annotation element
4. Add @resp="#machine" to each annotation element
5. Prioritize precision over recall — only annotate what you are confident about
6. Preserve any existing annotations unchanged
7. Return ONLY the annotated XML, wrapped in a markdown code block (\`\`\`xml ... \`\`\`)
8. Do not add explanations before or after the code block`;

/**
 * Assemble the three-layer prompt.
 *
 * @param {Object} params
 * @param {string} params.xmlContent - Current TEI-XML body content
 * @param {string} params.sourceType - e.g. 'correspondence', 'print', 'recipe'
 * @param {Object} params.context - { language, epoch, project }
 * @param {string} params.mappingRules - Markdown mapping rules
 * @param {string[]} [params.selectedTypes] - If set, only these annotation types
 * @returns {string} The assembled prompt
 */
export function assemblePrompt({ xmlContent, sourceType, context, mappingRules, selectedTypes }) {
    const parts = [];

    // Layer 1: Basis
    parts.push(BASE_PROMPT);

    // Layer 2: Kontext
    parts.push('\n\n--- CONTEXT ---');
    parts.push('Source type: ' + (sourceType || 'generic'));
    if (context?.language) parts.push('Language: ' + context.language);
    if (context?.epoch) parts.push('Period: ' + context.epoch);
    if (context?.project) parts.push('Project: ' + context.project);

    // Layer 3: Mapping
    if (mappingRules) {
        let rules = mappingRules;

        // Filter by selected types if provided
        if (selectedTypes && selectedTypes.length > 0) {
            const filteredLines = rules.split('\n').filter(line => {
                const trimmed = line.trim();
                if (!trimmed.startsWith('*')) return true; // Keep non-rule lines
                return selectedTypes.some(type => trimmed.includes('<' + type + '>') || trimmed.includes('<' + type + ' '));
            });
            rules = filteredLines.join('\n');
        }

        parts.push('\n\n--- MAPPING RULES ---');
        parts.push(rules);
    }

    // Content to annotate
    parts.push('\n\n--- TEXT TO ANNOTATE ---');
    parts.push(xmlContent);

    return parts.join('\n');
}

/**
 * Get the three prompt layers as separate objects (for prompt preview UI).
 */
export function getPromptLayers({ sourceType, context, mappingRules, selectedTypes }) {
    let filteredMapping = mappingRules || '';
    if (selectedTypes && selectedTypes.length > 0 && mappingRules) {
        const filteredLines = mappingRules.split('\n').filter(line => {
            const trimmed = line.trim();
            if (!trimmed.startsWith('*')) return true;
            return selectedTypes.some(type => trimmed.includes('<' + type + '>') || trimmed.includes('<' + type + ' '));
        });
        filteredMapping = filteredLines.join('\n');
    }

    return {
        basis: BASE_PROMPT,
        kontext: [
            'Source type: ' + (sourceType || 'generic'),
            context?.language ? 'Language: ' + context.language : null,
            context?.epoch ? 'Period: ' + context.epoch : null,
            context?.project ? 'Project: ' + context.project : null
        ].filter(Boolean).join('\n'),
        mapping: filteredMapping
    };
}

/**
 * Execute a transform: assemble prompt, call LLM, parse response.
 *
 * @param {Object} params - Same as assemblePrompt
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<TransformResult>}
 *
 * @typedef {Object} TransformResult
 * @property {string} xml - The annotated XML
 * @property {Map<string, string>} confidenceMap - elementId → confidence
 * @property {Object} stats - { total, sicher, pruefenswert, problematisch }
 */
export async function transform(params, options = {}) {
    const prompt = assemblePrompt(params);
    const response = await complete(prompt, options);

    // Extract XML from markdown code block
    const xml = extractXmlFromResponse(response);

    if (!xml) {
        throw new Error('Keine g\u00fcltige XML-Antwort erhalten.');
    }

    // Validate well-formedness
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) {
        throw new Error('LLM-Antwort ist kein wohlgeformtes XML: ' +
            doc.querySelector('parsererror').textContent.slice(0, 200));
    }

    // Extract confidence map
    const confidenceMap = extractConfidenceMap(doc);

    // Compute stats
    const stats = { total: 0, sicher: 0, pruefenswert: 0, problematisch: 0 };
    for (const [, conf] of confidenceMap) {
        stats.total++;
        if (conf === 'sicher') stats.sicher++;
        else if (conf === 'pruefenswert') stats.pruefenswert++;
        else if (conf === 'problematisch') stats.problematisch++;
    }

    return { xml, confidenceMap, stats };
}

/**
 * Extract XML from a markdown code block in the LLM response.
 * Tries ```xml ... ```, then ``` ... ```, then raw XML.
 */
export function extractXmlFromResponse(response) {
    if (!response) return null;

    // Try markdown code block with xml tag
    const xmlBlockMatch = response.match(/```xml\s*\n([\s\S]*?)```/);
    if (xmlBlockMatch) return xmlBlockMatch[1].trim();

    // Try generic code block
    const genericBlockMatch = response.match(/```\s*\n([\s\S]*?)```/);
    if (genericBlockMatch) return genericBlockMatch[1].trim();

    // Try raw XML (starts with < or <?xml)
    const trimmed = response.trim();
    if (trimmed.startsWith('<')) {
        return trimmed;
    }

    return null;
}

/**
 * Extract confidence map from a parsed XML document.
 * Maps @confidence attributes to categorical values.
 *
 * | LLM value   | Category      |
 * |-------------|---------------|
 * | "high"      | sicher        |
 * | "medium"    | pruefenswert  |
 * | "low"       | problematisch |
 * | (missing)   | pruefenswert  |
 *
 * @param {Document} doc - Parsed XML document
 * @returns {Map<string, string>} elementId → confidence category
 */
export function extractConfidenceMap(doc) {
    const map = new Map();
    const annotationTags = ANNOTATION_TAGS;

    let counter = 0;
    for (const tagName of annotationTags) {
        const elements = doc.getElementsByTagName(tagName);
        for (const el of elements) {
            counter++;
            const id = el.getAttribute('xml:id') || tagName + '-' + counter;
            const rawConf = (el.getAttribute('confidence') || '').toLowerCase();

            let category;
            switch (rawConf) {
                case 'high': category = 'sicher'; break;
                case 'medium': category = 'pruefenswert'; break;
                case 'low': category = 'problematisch'; break;
                default: category = 'pruefenswert'; // conservative default
            }

            map.set(id, category);
        }
    }

    return map;
}

/**
 * Compare plaintext content between original and transformed XML.
 * Returns true if the text content is identical.
 */
export function compareText(originalPlaintext, transformedXml) {
    try {
        const doc = new DOMParser().parseFromString(transformedXml, 'application/xml');
        const body = doc.querySelector('body');
        const extractedText = (body?.textContent || '').replace(/\s+/g, ' ').trim();
        const normalizedOriginal = originalPlaintext.replace(/\s+/g, ' ').trim();
        return extractedText === normalizedOriginal;
    } catch (e) {
        return false;
    }
}
