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

// --- Model catalog (pricing in USD per 1M tokens) ---
const MODEL_CATALOG = Object.freeze({
    // Google Gemini
    'gemini-2.5-flash':  { name: 'Gemini 2.5 Flash',  input: 0.15,  output: 0.60,  context: 1048576, reasoning: false },
    'gemini-2.5-pro':    { name: 'Gemini 2.5 Pro',     input: 1.25,  output: 10.00, context: 1048576, reasoning: true  },
    'gemini-2.0-flash':  { name: 'Gemini 2.0 Flash',   input: 0.10,  output: 0.40,  context: 1048576, reasoning: false },

    // OpenAI
    'gpt-4.1':           { name: 'GPT-4.1',            input: 2.00,  output: 8.00,  context: 1047576, reasoning: false },
    'gpt-4.1-mini':      { name: 'GPT-4.1 Mini',       input: 0.40,  output: 1.60,  context: 1047576, reasoning: false },
    'gpt-4.1-nano':      { name: 'GPT-4.1 Nano',       input: 0.10,  output: 0.40,  context: 1047576, reasoning: false },
    'o4-mini':            { name: 'o4 Mini',             input: 1.10,  output: 4.40,  context: 200000,  reasoning: true  },
    'o3':                 { name: 'o3',                  input: 2.00,  output: 8.00,  context: 200000,  reasoning: true  },

    // Anthropic
    'claude-sonnet-4-5-20250514': { name: 'Claude Sonnet 4.5', input: 3.00, output: 15.00, context: 200000, reasoning: true  },
    'claude-haiku-3-5-20241022':  { name: 'Claude Haiku 3.5',  input: 0.80, output: 4.00,  context: 200000, reasoning: false },

    // DeepSeek
    'deepseek-chat':      { name: 'DeepSeek V3',        input: 0.27,  output: 1.10,  context: 131072, reasoning: false },
    'deepseek-reasoner':  { name: 'DeepSeek R1',        input: 0.55,  output: 2.19,  context: 131072, reasoning: true  },

    // Qwen (DashScope)
    'qwen-max':           { name: 'Qwen Max',           input: 1.60,  output: 6.40,  context: 131072, reasoning: false },
    'qwen-plus':          { name: 'Qwen Plus',          input: 0.40,  output: 1.20,  context: 131072, reasoning: false },
    'qwen-turbo':         { name: 'Qwen Turbo',         input: 0.10,  output: 0.30,  context: 131072, reasoning: false },
});

// --- Provider configurations ---
const PROVIDER_CONFIGS = Object.freeze({
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
        defaultModel: 'claude-sonnet-4-5-20250514',
        models: ['claude-sonnet-4-5-20250514', 'claude-haiku-3-5-20241022'],
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
        name: 'Ollama (lokal)',
        endpoint: 'http://localhost:11434/api/chat',
        defaultModel: 'llama3.3',
        models: ['llama3.3', 'qwen2.5', 'mistral', 'gemma2', 'phi4'],
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
            models: cfg.models || [],
            hasKey: hasApiKey(id),
            authType: cfg.authType
        };
    }
    return configs;
}

/**
 * Get the model catalog with metadata (pricing, context, reasoning).
 * @returns {Object} MODEL_CATALOG
 */
export function getModelCatalog() {
    return MODEL_CATALOG;
}

/**
 * Get available models for a provider.
 * @param {string} provider
 * @returns {string[]}
 */
export function getModelsForProvider(provider) {
    return PROVIDER_CONFIGS[provider]?.models ?? [];
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
        throw new Error(config.name + ' API error ' + response.status + ': ' + errorText.slice(0, 200));
    }

    const data = await response.json();
    const text = config.extractResponse(data);

    if (!text) {
        throw new Error('Empty response from ' + config.name);
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
