/**
 * teiCrafter – Storage Service
 * Persists user settings (provider, model name) to localStorage.
 * API keys are NEVER stored (only in-memory in llm.js).
 */

const STORAGE_PREFIX = 'teiCrafter_';

/**
 * Get a persisted setting value.
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
export function getSetting(key, defaultValue = null) {
    try {
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        if (raw === null) return defaultValue;
        return JSON.parse(raw);
    } catch (e) {
        return defaultValue;
    }
}

/**
 * Persist a setting value.
 * @param {string} key
 * @param {*} value
 */
export function setSetting(key, value) {
    try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (e) {
        console.warn('Storage write failed:', e);
    }
}

/**
 * Remove a persisted setting.
 * @param {string} key
 */
export function removeSetting(key) {
    try {
        localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (e) {
        // Ignore
    }
}

/**
 * Get all teiCrafter settings as an object.
 * @returns {Object}
 */
export function getAllSettings() {
    const settings = {};
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX)) {
                const shortKey = key.slice(STORAGE_PREFIX.length);
                settings[shortKey] = JSON.parse(localStorage.getItem(key));
            }
        }
    } catch (e) {
        // Ignore
    }
    return settings;
}
