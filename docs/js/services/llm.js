/**
 * teiCrafter, Multi-Provider LLM Service
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
const PROVIDER_CONFIGS = {
    [LLM_PROVIDERS.GEMINI]: {
        name: 'Google Gemini',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
        defaultModel: 'gemini-2.5-flash',
        models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
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
        defaultModel: 'gpt-4.1-mini',
        models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini', 'o3'],
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
        // claude-fable-5 is deliberately omitted: its API behaviour differs
        // (thinking always-on, different refusal handling and data retention).
        defaultModel: 'claude-haiku-4-5',
        models: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
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
    [LLM_PROVIDERS.DEEPSEEK]: {
        name: 'DeepSeek',
        endpoint: 'https://api.deepseek.com/chat/completions',
        defaultModel: 'deepseek-chat',
        models: ['deepseek-chat', 'deepseek-reasoner'],
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
    [LLM_PROVIDERS.QWEN]: {
        name: 'Qwen (DashScope)',
        endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        defaultModel: 'qwen-plus',
        models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
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
    [LLM_PROVIDERS.OLLAMA]: {
        name: 'Ollama (local)',
        endpoint: 'http://localhost:11434/api/chat',
        defaultModel: 'llama3.3',
        models: ['llama3.3', 'qwen2.5', 'mistral', 'gemma2', 'phi4'],
        allowCustomModel: true,
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
    },
    [LLM_PROVIDERS.CUSTOM]: {
        name: 'Custom OpenAI-compatible endpoint',
        endpoint: '',
        defaultModel: 'model',
        models: [],
        allowCustomModel: true,
        allowCustomEndpoint: true,
        authType: 'optional-bearer',
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
    }
};
const BUILT_IN_PROVIDERS = new Set(Object.keys(PROVIDER_CONFIGS));
const AUTH_TYPES = new Set(['none', 'optional-bearer', 'bearer', 'x-api-key', 'url-param']);

// --- State ---
let currentProvider = getSetting('provider', LLM_PROVIDERS.GEMINI);
let currentModel = getSetting('model', null);
let customEndpoint = getSetting('customLlmEndpoint', '');

// --- Public API ---

/**
 * Register a bundled provider protocol adapter without changing the generation UI.
 * Manifests cannot inject adapters: callers must supply executable application code.
 */
export function registerProviderAdapter(id, adapter) {
    const key = typeof id === 'string' ? id.trim() : '';
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(key) || BUILT_IN_PROVIDERS.has(key)
        || !adapter || typeof adapter !== 'object') return false;
    if (typeof adapter.name !== 'string' || !adapter.name.trim()
        || typeof adapter.endpoint !== 'string' || !adapter.endpoint.trim()
        || typeof adapter.defaultModel !== 'string' || !adapter.defaultModel.trim()
        || !AUTH_TYPES.has(adapter.authType)
        || typeof adapter.buildRequest !== 'function'
        || typeof adapter.extractResponse !== 'function') return false;
    const endpoint = adapter.endpoint.replace('{model}', 'model');
    let parsed;
    try { parsed = new URL(endpoint); } catch { return false; }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return false;
    PROVIDER_CONFIGS[key] = {
        name: adapter.name.trim(),
        endpoint: adapter.endpoint.trim(),
        defaultModel: adapter.defaultModel.trim(),
        models: Array.isArray(adapter.models) ? adapter.models.map(String) : [],
        allowCustomModel: adapter.allowCustomModel === true,
        allowCustomEndpoint: false,
        authType: adapter.authType,
        buildRequest: adapter.buildRequest,
        extractResponse: adapter.extractResponse,
    };
    return true;
}

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
    if (['none', 'optional-bearer'].includes(PROVIDER_CONFIGS[provider]?.authType)) return true;
    return apiKeys.has(provider) && apiKeys.get(provider).length > 0;
}

/** Configure a provider-owned endpoint when its adapter allows one. */
export function setEndpoint(provider, endpoint) {
    const config = PROVIDER_CONFIGS[provider];
    if (!config || config.allowCustomEndpoint !== true || typeof endpoint !== 'string') return false;
    const candidate = endpoint.trim();
    if (!candidate) return false;
    let parsed;
    try { parsed = new URL(candidate); } catch { return false; }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return false;
    customEndpoint = parsed.href;
    setSetting('customLlmEndpoint', customEndpoint);
    return true;
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
    const config = PROVIDER_CONFIGS[currentProvider];
    return config ? pickModel(config, currentModel) : '';
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
            models: cfg.models || [],
            allowCustomModel: cfg.allowCustomModel === true,
            allowCustomEndpoint: cfg.allowCustomEndpoint === true,
            endpoint: cfg.allowCustomEndpoint === true ? customEndpoint : '',
            hasKey: hasApiKey(id),
            authType: cfg.authType
        };
    }
    return configs;
}

// Anthropic model catalog, exported in a testable form. The values mirror the
// PROVIDER_CONFIGS entry above and exist so a proof can assert the catalog
// without reaching into the frozen private object.
export const ANTHROPIC_MODELS = PROVIDER_CONFIGS[LLM_PROVIDERS.ANTHROPIC].models;
export const ANTHROPIC_DEFAULT_MODEL = PROVIDER_CONFIGS[LLM_PROVIDERS.ANTHROPIC].defaultModel;

/**
 * The model id to actually send for a provider. Local providers may explicitly
 * accept any non-empty model id; catalog-bound providers accept listed ids only.
 * Empty or invalid values use the provider default.
 * @param {{ models?: string[], defaultModel: string, allowCustomModel?: boolean }} config
 * @param {string|null|undefined} stored
 * @returns {string}
 */
export function pickModel(config, stored) {
    const candidate = typeof stored === 'string' ? stored.trim() : '';
    if (!candidate) return config.defaultModel;
    if (config.allowCustomModel === true) return candidate;
    return Array.isArray(config.models) && config.models.includes(candidate)
        ? candidate : config.defaultModel;
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
    if (!config) throw new Error('Unknown provider: ' + currentProvider);

    const model = pickModel(config, currentModel);
    const key = apiKeys.get(currentProvider) || '';

    // Auth check (except for Ollama)
    if (!['none', 'optional-bearer'].includes(config.authType) && !key) {
        throw new Error('No API key configured for ' + config.name + '.');
    }

    // Build URL
    const endpoint = config.allowCustomEndpoint === true ? customEndpoint : config.endpoint;
    if (!endpoint) throw new Error('No endpoint configured for ' + config.name + '.');
    let url = endpoint.replace('{model}', encodeURIComponent(model));
    if (config.authType === 'url-param') {
        url += (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(key);
    }

    // Build headers
    const headers = { 'Content-Type': 'application/json' };
    if (config.authType === 'bearer' || (config.authType === 'optional-bearer' && key)) {
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
        throw new Error(config.name + ' API error ' + response.status + ': ' + errorText.slice(0, 200));
    }

    const data = await response.json();
    const text = config.extractResponse(data);

    if (!text) {
        throw new Error('Empty response from ' + config.name);
    }

    return text;
}
