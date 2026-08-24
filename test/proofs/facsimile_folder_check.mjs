/**
 * Proof: a separately selected local folder resolves bare graphic filenames
 * without turning those files into Save payloads.
 *
 * Run: node test/proofs/facsimile_folder_check.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPageImages } from "../../docs/js/editor/page-images.js";
import { check, finish, section } from "./_assert.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const EDITOR_HTML = readFileSync(join(REPO, "docs", "editor.html"), "utf8");
const EDITOR_APP = readFileSync(join(REPO, "docs", "js", "editor", "editor-app.js"), "utf8");

const image = new Blob(["image bytes"], { type: "image/jpeg" });
Object.defineProperty(image, "name", { value: "1000.jpg" });

const app = {
  state: {
    surfaces: [
      { graphic: "1000.jpg" },
      { graphic: "missing.jpg" },
      { graphic: "docs/images/1000.jpg" },
      { graphic: "https://example.org/remote.jpg" },
    ],
  },
  pageImages: new Map(),
  panel: "facs",
  projectFolder: null,
};
let rerenders = 0;
const store = createPageImages({ app, rerenderPanel: () => { rerenders++; } });

section("capability fallback");
const previousWindow = globalThis.window;
delete globalThis.window;
check("a browser without the directory picker is reported as unsupported", !store.supportsFolderAttachment());
const unsupported = await store.attachFolder();
check("unsupported attachment is a deterministic result", unsupported.supported === false && unsupported.found === 0);
globalThis.window = {
  showDirectoryPicker: async () => { throw new DOMException("Cancelled", "AbortError"); },
};
const cancelled = await store.attachFolder();
check("picker cancellation is reported without throwing", cancelled.supported && cancelled.cancelled);

section("read-only local attachment");
const directory = {
  name: "1000",
  async getFileHandle(name) {
    if (name !== "1000.jpg") throw new DOMException("Missing", "NotFoundError");
    return { getFile: async () => image };
  },
};
globalThis.window = { showDirectoryPicker: async () => directory };
check("the directory picker capability is detected", store.supportsFolderAttachment());
check("only bare graphic filenames are candidates", [...store.referencedNames()].join(",") === "1000.jpg,missing.jpg");
const attached = await store.attachFolder();
check("the selected folder is named in the result", attached.folderName === "1000");
check("the matching image resolves and the missing image is reported", attached.found === 1 && attached.missing[0] === "missing.jpg");
check("the active facsimile panel rerenders after resolution", rerenders === 1);
check("the surface resolves to a session-local object URL", store.resolve(app.state.surfaces[0]).startsWith("blob:"));
check("attached files are not pending Save payloads", store.countUnpersisted() === 0);
const persisted = await store.persist({ getFileHandle: async () => { throw new Error("must not copy"); } });
check("Save does not copy an attached facsimile file", persisted.written === 0 && persisted.failed === 0);
globalThis.window = {
  showDirectoryPicker: async () => ({
    name: "empty",
    async getFileHandle() { throw new DOMException("Missing", "NotFoundError"); },
  }),
};
const replaced = await store.attachFolder();
check("a newly attached folder replaces stale external image bindings",
  replaced.found === 0 && store.resolve(app.state.surfaces[0]) === "1000.jpg");
check("removing a stale external binding rerenders the facsimile panel", rerenders === 2);

section("editor action wiring");
check("the toolbar carries a separate facsimile-folder action", EDITOR_HTML.includes('id="btn-attach-facsimiles"'));
check("the action has a capability-gated controller", EDITOR_APP.includes("supportsFolderAttachment()"));
check("the unsupported-browser status keeps editing and download available",
  EDITOR_APP.includes("Editing and XML downloads remain available."));

store.revoke();
if (previousWindow === undefined) delete globalThis.window;
else globalThis.window = previousWindow;

finish("PASS: local facsimile folders resolve by bare filename without copying files.");
