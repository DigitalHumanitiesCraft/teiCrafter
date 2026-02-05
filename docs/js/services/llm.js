/**
 * teiCrafter – Multi-Provider LLM Service
 *
 * SECURITY: API keys are stored ONLY in a module-scoped Map.
 * Never on window, DOM, localStorage, cookies, or IndexedDB.
 * Keys are only used inside fetch() calls within complete().
 * All fetch calls use credentials: 'omit'.
 */

import { LLM_PROVIDERS } from '../utils/constants.js';
import { getSetting, setSetting } from './storage.js';

// --- Module-scoped secrets (never exported, never on window) ---
const apiKeys = new Map();

// --- Provider configurations ---
const PROVIDER_CONFIGS = Object.freeze({
    [LLM_PROVIDERS.GEMINI]: {
        name: 'Google Gemini',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
        defaultModel: 'gemini-2.0-flash',
        authType: 'url-param', // ?key=...
        buildRequest(prompt) {
            return {
                contents: [{ parts: [{ text: prompt }] }]
            };
        },
        extractResponse(data) {
            return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
    },
    [LLM_PROVIDERS.OPENAI]: {
        name: 'OpenAI',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        defaultModel: 'gpt-4o',
        authType: 'bearer',
        buildRequest(prompt, model) {
            return {
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.2
            };
        },
        extractResponse(data) {
            return data?.choices?.[0]?.message?.content || '';
        }
    },
    [LLM_PROVIDERS.ANTHROPIC]: {
        name: 'Anthropic',
        endpoint: 'https://api.anthropic.com/v1/messages',
        defaultModel: 'claude-sonnet-4-5-20250929',
        authType: 'x-api-key',
        buildRequest(prompt, model) {
            return {
                model,
                max_tokens: 8192,
                messages: [{ role: 'user', content: prompt }]
            };
        },
        extractResponse(data) {
            return data?.content?.[0]?.text || '';
        }
    },
    [LLM_PROVIDERS.OLLAMA]: {
        name: 'Ollama (lokal)',
        endpoint: 'http://localhost:11434/api/chat',
        defaultModel: 'llama3.1',
        authType: 'none',
        buildRequest(prompt, model) {
            return {
                model,
                messages: [{ role: 'user', content: prompt }],
                stream: false
            };
        },
        extractResponse(data) {
            return data?.message?.content || '';
        }
    }
});

// --- State ---
let currentProvider = getSetting('provider', LLM_PROVIDERS.GEMINI);
let currentModel = getSetting('model', null);

// --- Public API ---

/**
 * Set the API key for a provider. Validates input.
 * @param {string} provider
 * @param {string} key
 * @returns {boolean} true if valid
 */
export function setApiKey(provider, key) {
    if (!PROVIDER_CONFIGS[provider]) return false;

    // Validate: max 256 chars, printable ASCII only
    if (typeof key !== 'string' || key.length > 256) return false;
    if (!/^[\x20-\x7E]*$/.test(key)) return false;

    if (key.trim() === '') {
        apiKeys.delete(provider);
    } else {
        apiKeys.set(provider, key.trim());
    }
    return true;
}

/**
 * Check if a provider has an API key set.
 * @param {string} [provider]
 * @returns {boolean}
 */
export function hasApiKey(provider = currentProvider) {
    if (PROVIDER_CONFIGS[provider]?.authType === 'none') return true;
    return apiKeys.has(provider) && apiKeys.get(provider).length > 0;
}

/**
 * Set the active provider.
 * @param {string} provider
 */
export function setProvider(provider) {
    if (!PROVIDER_CONFIGS[provider]) return;
    currentProvider = provider;
    setSetting('provider', provider);

    // Reset model to provider default if not explicitly set
    if (!currentModel) {
        currentModel = PROVIDER_CONFIGS[provider].defaultModel;
    }
}

/**
 * Get the active provider.
 * @returns {string}
 */
export function getProvider() {
    return currentProvider;
}

/**
 * Set the model name.
 * @param {string} model
 */
export function setModel(model) {
    currentModel = model;
    setSetting('model', model);
}

/**
 * Get the model name.
 * @returns {string}
 */
export function getModel() {
    return currentModel || PROVIDER_CONFIGS[currentProvider]?.defaultModel || '';
}

/**
 * Get all provider configs (without secrets).
 * @returns {Object}
 */
export function getProviderConfigs() {
    const configs = {};
    for (const [id, cfg] of Object.entries(PROVIDER_CONFIGS)) {
        configs[id] = {
            name: cfg.name,
            defaultModel: cfg.defaultModel,
            hasKey: hasApiKey(id),
            authType: cfg.authType
        };
    }
    return configs;
}

/**
 * Send a prompt to the current LLM provider.
 * @param {string} prompt
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<string>} The LLM response text
 * @throws {Error} On network error, auth error, or invalid response
 */
export async function complete(prompt, options = {}) {
    const { signal } = options;
    const config = PROVIDER_CONFIGS[currentProvider];
    if (!config) throw new Error('Unbekannter Provider: ' + currentProvider);

    const model = currentModel || config.defaultModel;
    const key = apiKeys.get(currentProvider) || '';

    // Auth check (except for Ollama)
    if (config.authType !== 'none' && !key) {
        throw new Error('Kein API-Key f\u00fcr ' + config.name + ' konfiguriert.');
    }

    // Build URL
    let url = config.endpoint.replace('{model}', encodeURIComponent(model));
    if (config.authType === 'url-param') {
        url += (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(key);
    }

    // Build headers
    const headers = { 'Content-Type': 'application/json' };
    if (config.authType === 'bearer') {
        headers['Authorization'] = 'Bearer ' + key;
    } else if (config.authType === 'x-api-key') {
        headers['x-api-key'] = key;
        headers['anthropic-version'] = '2023-06-01';
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    // Build body
    const body = JSON.stringify(config.buildRequest(prompt, model));

    // Fetch
    const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        credentials: 'omit',
        signal
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(config.name + ' API Fehler ' + response.status + ': ' + errorText.slice(0, 200));
    }

    const data = await response.json();
    const text = config.extractResponse(data);

    if (!text) {
        throw new Error('Leere Antwort von ' + config.name);
    }

    return text;
}

/**
 * Test the connection to the current provider with a minimal prompt.
 * @returns {Promise<{success: boolean, message: string, model: string}>}
 */
export async function testConnection() {
    try {
        const response = await complete('Respond with exactly: OK');
        return {
            success: true,
            message: 'Verbindung erfolgreich',
            model: getModel()
        };
    } catch (e) {
        return {
            success: false,
            message: e.message,
            model: getModel()
        };
    }
}
