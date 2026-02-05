/**
 * teiCrafter – Schema Service
 * Loads and queries a hardcoded JSON schema profile.
 * Used by the Validator for structural checks.
 */

let schemaProfile = null;

/**
 * Load the schema profile from a JSON file.
 * @param {string} [url='../schemas/dtabf.json']
 * @returns {Promise<void>}
 */
export async function loadSchema(url = '../schemas/dtabf.json') {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Schema laden fehlgeschlagen: ' + resp.status);
    schemaProfile = await resp.json();
}

/**
 * Check if the schema is loaded.
 * @returns {boolean}
 */
export function isLoaded() {
    return schemaProfile !== null;
}

/**
 * Get the schema profile name.
 * @returns {string}
 */
export function getSchemaName() {
    return schemaProfile?.name || 'Unbekannt';
}

/**
 * Check if an element name is known in the schema.
 * @param {string} tagName
 * @returns {boolean}
 */
export function isKnownElement(tagName) {
    if (!schemaProfile) return true; // Permissive if no schema loaded
    return tagName in schemaProfile.elements;
}

/**
 * Check if a child element is allowed inside a parent.
 * @param {string} parentTag
 * @param {string} childTag
 * @returns {boolean}
 */
export function isChildAllowed(parentTag, childTag) {
    if (!schemaProfile) return true;
    const parentDef = schemaProfile.elements[parentTag];
    if (!parentDef) return true; // Unknown parent → permissive
    return parentDef.allowedChildren.includes(childTag) || parentDef.allowedChildren.includes('#text');
}

/**
 * Check if an attribute is known for an element.
 * @param {string} tagName
 * @param {string} attrName
 * @returns {boolean}
 */
export function isAttributeKnown(tagName, attrName) {
    if (!schemaProfile) return true;
    const def = schemaProfile.elements[tagName];
    if (!def) return true;
    // Always allow xml:id, xml:lang, xmlns, and n
    if (['xml:id', 'xml:lang', 'xmlns', 'n'].includes(attrName)) return true;
    return attrName in def.attributes;
}

/**
 * Get allowed children for an element.
 * @param {string} tagName
 * @returns {string[]}
 */
export function getAllowedChildren(tagName) {
    if (!schemaProfile) return [];
    const def = schemaProfile.elements[tagName];
    return def ? [...def.allowedChildren] : [];
}

/**
 * Get the element definition from the schema.
 * @param {string} tagName
 * @returns {Object|null}
 */
export function getElementDef(tagName) {
    if (!schemaProfile) return null;
    return schemaProfile.elements[tagName] || null;
}
