# Security

teiCrafter is a browser-based editor for TEI-XML. This document states what the
tool does with your data and how to report a vulnerability.

## Client-only

teiCrafter runs entirely in the browser. There is no server and no backend: the
deployment is a set of static files served from GitHub Pages. The tool makes no
request to any teiCrafter-operated service, because none exists.

The document you edit stays on your machine. A file is opened either through the
File System Access API (a directory handle you grant once, used to read and write
the project folder) or through a file picker, and saved back to the same local
location. The file contents are not uploaded anywhere.

## Optional LLM features

teiCrafter has an optional on-ramp that drafts an initial TEI document from
plaintext with a language model. These features are gated behind the
`FEATURES.llmOnRamp` build flag (`docs/js/utils/constants.js`) and a per-user
opt-in; no model provider is contacted unless you enable the on-ramp and initiate
a request.

When the LLM features are used, requests go directly from your browser to the
model provider's API. The handling of your API key is constrained by design:

- The key is held only in a module-scoped map (`docs/js/services/llm.js`) for the
  duration of the page session. It is never written to `localStorage`, cookies,
  `IndexedDB`, the DOM, or the global `window` object.
- API requests are sent with `credentials: 'omit'`, so browser cookies are not
  attached to provider requests.
- Nothing is persisted: the key is gone when the page is closed or reloaded, and
  it is not exported or logged.
- There is no telemetry. teiCrafter does not collect usage data or send analytics.

The only values teiCrafter persists are non-secret user settings (the selected
provider and model name), stored in `localStorage`. API keys are never among them.

## Reporting a vulnerability

If you find a security issue, please report it by email to office@dhcraft.org.
Include enough detail to reproduce the problem. Please do not open a public issue
for an unpatched vulnerability.
