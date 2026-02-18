/**
 * teiCrafter – Export Service
 * Attribute cleanup, download, clipboard, format options.
 *
 * Removes teiCrafter-internal attributes (@confidence, @resp="#machine")
 * or optionally retains them with transformed values.
 */

import { ANNOTATION_TAGS } from '../utils/constants.js';

/**
 * @typedef {Object} ExportOptions
 * @property {'full'|'body'} format - Full TEI or body-only
 * @property {boolean} keepConfidence - Retain @confidence attributes
 * @property {boolean} keepResp - Retain @resp (transformed to #teiCrafter)
 */

/** Default export options */
const DEFAULTS = Object.freeze({
    format: 'full',
    keepConfidence: false,
    keepResp: false
});

/**
 * Prepare XML for export by cleaning up internal attributes.
 *
 * @param {string} xml - Raw TEI-XML from the document model
 * @param {ExportOptions} [options]
 * @returns {string} Cleaned XML ready for export
 */
export function prepareExport(xml, options = {}) {
    const opts = { ...DEFAULTS, ...options };

    if (!xml) return '';

    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) {
        // Return as-is if we can't parse
        return xml;
    }

    // Walk all elements
    const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;

    while (node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            // Handle @confidence
            if (node.hasAttribute('confidence')) {
                if (!opts.keepConfidence) {
                    node.removeAttribute('confidence');
                }
            }

            // Handle @resp
            if (node.hasAttribute('resp')) {
                const resp = node.getAttribute('resp');
                if (resp === '#machine') {
                    if (opts.keepResp) {
                        node.setAttribute('resp', '#teiCrafter');
                    } else {
                        node.removeAttribute('resp');
                    }
                }
            }
        }
        node = walker.nextNode();
    }

    // Serialize
    let result = new XMLSerializer().serializeToString(doc);

    // Extract body-only if requested
    if (opts.format === 'body') {
        const bodyMatch = result.match(/<body[^>]*>([\s\S]*)<\/body>/);
        if (bodyMatch) {
            result = bodyMatch[1].trim();
        }
    }

    return result;
}

/**
 * Get export statistics for the UI.
 *
 * @param {string} xml
 * @returns {Object} { lineCount, entityCounts, hasUnreviewed }
 */
export function getExportStats(xml) {
    if (!xml) return { lineCount: 0, entityCounts: {}, totalEntities: 0 };

    const lineCount = xml.split('\n').length;
    const entityCounts = {};
    const tags = ANNOTATION_TAGS;

    let totalEntities = 0;
    for (const tag of tags) {
        const re = new RegExp('<' + tag + '[\\s>]', 'g');
        const count = (xml.match(re) || []).length;
        if (count > 0) {
            entityCounts[tag] = count;
            totalEntities += count;
        }
    }

    return { lineCount, entityCounts, totalEntities };
}

/**
 * Download XML as a file.
 *
 * @param {string} content - XML string
 * @param {string} fileName - Suggested file name
 */
export function downloadXml(content, fileName) {
    const blob = new Blob([content], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Copy XML to clipboard.
 *
 * @param {string} content
 * @returns {Promise<boolean>} true if successful
 */
export async function copyToClipboard(content) {
    try {
        await navigator.clipboard.writeText(content);
        return true;
    } catch (e) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.style.cssText = 'position:fixed;left:-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
    }
}

/**
 * Generate a clean export filename from the original filename.
 *
 * @param {string} originalName
 * @returns {string}
 */
export function getExportFileName(originalName) {
    if (!originalName) return 'document-tei.xml';
    // Strip path components to prevent path traversal
    const basename = originalName.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '');
    const safe = basename.replace(/[^a-zA-Z0-9_\-. ]/g, '').trim();
    return (safe || 'document') + '-tei.xml';
}
