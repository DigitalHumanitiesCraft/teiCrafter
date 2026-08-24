/**
 * Proof: public page shell assets and editor-level source tabs are present.
 *
 * Run: node test/proofs/page_shell_check.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check, finish } from "./_assert.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = resolve(HERE, "..", "..", "docs");
const FAVICON = join(DOCS, "assets", "favicon.svg");

check("the local favicon asset exists", existsSync(FAVICON));
check("the favicon is an SVG carrying the official embedded image",
  /^<svg\b/.test(readFileSync(FAVICON, "utf8")) &&
  /data:image\/png;base64,/.test(readFileSync(FAVICON, "utf8")));

for (const page of ["index.html", "editor.html", "about.html"]) {
  const html = readFileSync(join(DOCS, page), "utf8");
  check(`${page} declares the local favicon`,
    html.includes('<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">'));
  check(`${page} declares a Content Security Policy`,
    html.includes('http-equiv="Content-Security-Policy"'));
  check(`${page} loads no third-party scripts or webfonts`,
    !/<script[^>]+src=["']https?:/i.test(html) &&
    !/fonts\.(?:googleapis|gstatic)\.com/i.test(html));
}

const editorHtml = readFileSync(join(DOCS, "editor.html"), "utf8");
check("the editor exposes a dedicated metadata source tab",
  /id="view-metadata"[^>]*role="tab"/.test(editorHtml));
check("the scrollable reading tabpanel participates in keyboard focus order",
  /id="ed-reading"[^>]*role="tabpanel"[^>]*aria-labelledby="view-reading"[^>]*tabindex="0"/.test(editorHtml));
check("the editor exposes an annotation-coverage page map",
  /id="ed-ann-summary"/.test(editorHtml) && /id="ed-ann-popover"/.test(editorHtml));
check("the pane splitter is one complete separator control",
  /id="ed-splitter"[^>]*role="separator"[^>]*aria-valuemin="10"[^>]*aria-valuemax="90"[^>]*aria-valuenow="52"/.test(editorHtml)
    && !/id="ed-splitter"[\s\S]*?id="ed-collapse-btn"/.test(editorHtml));
check("the editor uses the vendored OpenSeadragon distribution",
  editorHtml.includes('src="vendor/openseadragon/openseadragon.min.js"') &&
  existsSync(join(DOCS, "vendor", "openseadragon", "LICENSE.txt")));
check("the repository contains the pinned TEI All schema and browser validator",
  existsSync(join(DOCS, "schemas", "tei-p5-4.11.0", "tei_all.rng")) &&
  existsSync(join(DOCS, "vendor", "libxml2-wasm", "LICENSE.txt")));

finish("PASS: public page shells, metadata, and annotation coverage entries are present.");
