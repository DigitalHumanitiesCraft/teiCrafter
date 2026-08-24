# Security and data handling

teiCrafter is a static browser application for editing TEI-XML. This document
describes its local storage, its external network requests, and how to report a
vulnerability.

## Scope

teiCrafter has no application backend, user account system, telemetry, or
teiCrafter-operated data service. The deployed application consists of static
files served from GitHub Pages. Opening, editing, and saving an edition uses the
local browser and file system. Optional features can still send data directly
from the browser to external services.

## External data flows

| Action | Data sent | Destination | Trigger |
|--------|-----------|-------------|---------|
| Open, edit, and save TEI | No edition content is sent to teiCrafter or a model provider | Local file system or browser download | User opens or saves a file |
| New from text (LLM) | Pasted source text, project or built-in mapping instructions, the selected model request, and the provider credential where required | The selected LLM provider, or a locally configured Ollama endpoint | User enables AI features and submits the generation form |
| Propose (AI) | Text from the current folio, the project prompt, mapping, allowed annotation vocabulary, the selected model request, and the provider credential where required | The selected LLM provider, or a locally configured Ollama endpoint | User enables AI features and selects Propose (AI) |
| Authority lookup | The search term and register-specific options, including the GeoNames username when used | Wikidata, lobid/GND, or GeoNames | User runs a lookup; a project manifest can enable automatic querying when the lookup interface opens |
| Facsimile display | Image or IIIF requests and normal HTTP request metadata | The image host or IIIF service referenced by the document or project | The facsimile viewer loads a remote image source |

The application code, fonts and OpenSeadragon viewer are served from the same
origin as teiCrafter. A Content Security Policy prevents third-party scripts
from running in the editor context. Remote connections remain available for
the explicit LLM, authority and facsimile actions listed above.

LLM and authority requests use `credentials: 'omit'`, so browser cookies are
not attached to those requests. Data sent to an external provider is governed
by that provider's terms and data-handling policy.

## Local browser storage

| Data | Storage | Retention and purpose |
|------|---------|-----------------------|
| API keys | Memory only | Held in a module-scoped map for the page session and cleared by a reload or tab close. Keys are sent only with requests to the selected provider. |
| AI preferences | `localStorage` | Selected provider, model, and the AI-enabled preference. No API key is included. |
| Editor preferences | `localStorage` | Global text zoom and per-document layout state, including pane split, collapsed state, active panel, and reading mode. The document name forms part of the layout key. |
| Unsaved draft recovery | `localStorage` | One plaintext-derived draft with its raw TEI, source and document names, and timestamp. Drafts over 4,000,000 characters are not stored. The slot is cleared when that draft is saved or explicitly discarded. |
| Recent files | `IndexedDB` | Up to five file names, timestamps, and File System Access handles. File contents are not stored in this list. The browser requests permission again when a recent file is reopened. |
| Open document and page images | Page memory and local file handles | Used during the current editing session. A project-folder save writes the TEI and page images uploaded through the text-and-images on-ramp to the selected project folder. A separately selected facsimile folder remains read-only and its images are not copied by Save. |

Browser storage is local to the browser profile and origin. Other people or
software with access to that profile may be able to inspect it. Clear the
recovery entry from the empty editor and clear site data in the browser when
working on a shared device.

## Machine-generated content

The AI on-ramp marks a generated draft as machine-generated and unreviewed.
Propose (AI) inserts individual proposals with `resp="#ai"` and renders them in
the AI colour. Inline proposals provide confirm and reject controls in the layers
inspector; proposed standOff notes provide the same controls at their note marker.
These markings communicate review state and do not validate the model output.

## Reporting a vulnerability

Report security issues by email to office@dhcraft.org and include enough detail
to reproduce the problem. Avoid opening a public issue for an unpatched
vulnerability.
