/**
 * Provider adapter boundary for model calls. API keys and the custom endpoint
 * live only in this module's memory: never on window, in the DOM, in browser
 * storage or in exported state. Keys reach nothing but the fetch inside
 * complete(), and every request omits ambient browser credentials.
 */

export type AuthType = "none" | "optional-bearer" | "bearer" | "x-api-key" | "url-param";

export interface ProviderAdapter {
  name: string;
  endpoint: string;
  defaultModel: string;
  models: string[];
  allowCustomModel?: boolean;
  allowCustomEndpoint?: boolean;
  authType: AuthType;
  buildRequest(prompt: string, model: string): unknown;
  extractResponse(data: unknown): string;
}

export interface CompleteOptions {
  signal?: AbortSignal;
}

/** The one call a proposal or generation step needs; the offline fixture implements it too. */
export interface CompletionProvider {
  readonly id: string;
  complete(prompt: string, options?: CompleteOptions): Promise<string>;
}

export interface ProviderInfo {
  id: string;
  name: string;
  defaultModel: string;
  models: string[];
  allowCustomModel: boolean;
  allowCustomEndpoint: boolean;
  endpoint: string;
  hasKey: boolean;
  authType: AuthType;
}

function pick(value: unknown, ...path: (string | number)[]): unknown {
  let current = value;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}
const asText = (value: unknown): string => (typeof value === "string" ? value : "");

const chatRequest = (prompt: string, model: string) => ({
  model,
  messages: [{ role: "user", content: prompt }],
  temperature: 0.2,
});
const chatResponse = (data: unknown) => asText(pick(data, "choices", 0, "message", "content"));

const PROVIDERS: Record<string, ProviderAdapter> = {
  gemini: {
    name: "Google Gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    authType: "url-param",
    buildRequest: (prompt) => ({ contents: [{ parts: [{ text: prompt }] }] }),
    extractResponse: (data) => asText(pick(data, "candidates", 0, "content", "parts", 0, "text")),
  },
  openai: {
    name: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4.1-mini",
    models: ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "o4-mini", "o3"],
    authType: "bearer",
    buildRequest: chatRequest,
    extractResponse: chatResponse,
  },
  anthropic: {
    name: "Anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-haiku-4-5",
    models: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-haiku-4-5"],
    authType: "x-api-key",
    buildRequest: (prompt, model) => ({ model, max_tokens: 8192, messages: [{ role: "user", content: prompt }] }),
    extractResponse: (data) => asText(pick(data, "content", 0, "text")),
  },
  deepseek: {
    name: "DeepSeek",
    endpoint: "https://api.deepseek.com/chat/completions",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    authType: "bearer",
    buildRequest: chatRequest,
    extractResponse: chatResponse,
  },
  qwen: {
    name: "Qwen (DashScope)",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    defaultModel: "qwen-plus",
    models: ["qwen-max", "qwen-plus", "qwen-turbo"],
    authType: "bearer",
    buildRequest: chatRequest,
    extractResponse: chatResponse,
  },
  ollama: {
    name: "Ollama (local)",
    endpoint: "http://localhost:11434/api/chat",
    defaultModel: "llama3.3",
    models: ["llama3.3", "qwen2.5", "mistral", "gemma2", "phi4"],
    allowCustomModel: true,
    authType: "none",
    buildRequest: (prompt, model) => ({ model, messages: [{ role: "user", content: prompt }], stream: false }),
    extractResponse: (data) => asText(pick(data, "message", "content")),
  },
  custom: {
    name: "Custom OpenAI-compatible endpoint",
    endpoint: "",
    defaultModel: "model",
    models: [],
    allowCustomModel: true,
    allowCustomEndpoint: true,
    authType: "optional-bearer",
    buildRequest: chatRequest,
    extractResponse: chatResponse,
  },
};
const BUILT_IN = new Set(Object.keys(PROVIDERS));
const AUTH_TYPES = new Set<AuthType>(["none", "optional-bearer", "bearer", "x-api-key", "url-param"]);
const KEYLESS = new Set<AuthType>(["none", "optional-bearer"]);

const apiKeys = new Map<string, string>();
let currentProvider = "gemini";
let currentModel: string | null = null;
let customEndpoint = "";

/** HTTP or HTTPS only, and no credentials embedded in the URL. */
function safeEndpoint(candidate: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
  return parsed.href;
}

/**
 * Register a bundled adapter for a nonstandard JSON protocol. Built-in ids stay
 * immutable, and only application code can call this: a project manifest has
 * no path to executable adapters.
 */
export function registerProviderAdapter(id: string, adapter: ProviderAdapter): boolean {
  const key = typeof id === "string" ? id.trim() : "";
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(key) || BUILT_IN.has(key) || !adapter || typeof adapter !== "object") return false;
  if (typeof adapter.name !== "string" || !adapter.name.trim()
    || typeof adapter.endpoint !== "string" || !adapter.endpoint.trim()
    || typeof adapter.defaultModel !== "string" || !adapter.defaultModel.trim()
    || !AUTH_TYPES.has(adapter.authType)
    || typeof adapter.buildRequest !== "function"
    || typeof adapter.extractResponse !== "function") return false;
  if (!safeEndpoint(adapter.endpoint.replace("{model}", "model"))) return false;
  PROVIDERS[key] = {
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

/** Hold a key in memory; an empty key forgets it. Rejects non-printable or oversized input. */
export function setApiKey(provider: string, key: string): boolean {
  if (!PROVIDERS[provider]) return false;
  if (typeof key !== "string" || key.length > 256 || !/^[\x20-\x7E]*$/.test(key)) return false;
  if (key.trim() === "") apiKeys.delete(provider);
  else apiKeys.set(provider, key.trim());
  return true;
}

export function hasApiKey(provider: string = currentProvider): boolean {
  const config = PROVIDERS[provider];
  if (!config) return false;
  return KEYLESS.has(config.authType) || (apiKeys.get(provider) ?? "").length > 0;
}

/** Only an adapter that allows a custom endpoint accepts one. Held in memory. */
export function setEndpoint(provider: string, endpoint: string): boolean {
  const config = PROVIDERS[provider];
  if (!config || config.allowCustomEndpoint !== true || typeof endpoint !== "string") return false;
  const href = safeEndpoint(endpoint.trim());
  if (!href) return false;
  customEndpoint = href;
  return true;
}

export function setProvider(provider: string): boolean {
  if (!PROVIDERS[provider]) return false;
  currentProvider = provider;
  return true;
}

export function setModel(model: string | null): void {
  currentModel = model;
}

export function getProvider(): string {
  return currentProvider;
}

export function getModel(): string {
  const config = PROVIDERS[currentProvider];
  return config ? pickModel(config, currentModel) : "";
}

/**
 * Local providers accept any non-empty model id; catalogue-bound providers
 * accept listed ids only, so a stale choice cannot reach a paid endpoint.
 */
export function pickModel(
  config: Pick<ProviderAdapter, "models" | "defaultModel" | "allowCustomModel">,
  stored: string | null | undefined,
): string {
  const candidate = typeof stored === "string" ? stored.trim() : "";
  if (!candidate) return config.defaultModel;
  if (config.allowCustomModel === true) return candidate;
  return config.models.includes(candidate) ? candidate : config.defaultModel;
}

/** Provider descriptions without secrets. */
export function listProviders(): ProviderInfo[] {
  return Object.entries(PROVIDERS).map(([id, config]) => ({
    id,
    name: config.name,
    defaultModel: config.defaultModel,
    models: [...config.models],
    allowCustomModel: config.allowCustomModel === true,
    allowCustomEndpoint: config.allowCustomEndpoint === true,
    endpoint: config.allowCustomEndpoint === true ? customEndpoint : "",
    hasKey: hasApiKey(id),
    authType: config.authType,
  }));
}

/** Send one prompt to the active provider. An aborted signal rejects with an AbortError. */
export async function complete(prompt: string, options: CompleteOptions = {}): Promise<string> {
  const config = PROVIDERS[currentProvider];
  if (!config) throw new Error(`Unknown provider: ${currentProvider}`);
  const model = pickModel(config, currentModel);
  const key = apiKeys.get(currentProvider) ?? "";
  if (!KEYLESS.has(config.authType) && !key) throw new Error(`No API key configured for ${config.name}.`);

  const endpoint = config.allowCustomEndpoint === true ? customEndpoint : config.endpoint;
  if (!endpoint) throw new Error(`No endpoint configured for ${config.name}.`);
  let url = endpoint.replace("{model}", encodeURIComponent(model));
  if (config.authType === "url-param") url += `${url.includes("?") ? "&" : "?"}key=${encodeURIComponent(key)}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.authType === "bearer" || (config.authType === "optional-bearer" && key)) {
    headers.Authorization = `Bearer ${key}`;
  } else if (config.authType === "x-api-key") {
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(config.buildRequest(prompt, model)),
    credentials: "omit",
    signal: options.signal,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${config.name} API error ${response.status}: ${detail.slice(0, 200)}`);
  }
  const answer = config.extractResponse(await response.json());
  if (!answer) throw new Error(`Empty response from ${config.name}.`);
  return answer;
}

/** The active provider behind the CompletionProvider interface, so proposals stay independent of module state. */
export const modelProvider: CompletionProvider = { id: "model", complete };
