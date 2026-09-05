/**
 * teiCrafter Editor -- project folder (M2.9).
 *
 * A project folder is granted once via the File System Access directory picker
 * (Chromium-based browsers) and holds TEI files, optional plaintext files and
 * an optional manifest (teicrafter.project.json). Files stay in the visible
 * file system (git-able, readable by other tools); nothing is copied into
 * browser storage. A .txt opens as a deterministic line-level TEI draft; the
 * first save creates the .xml next to the source (finalizeSaveTarget).
 *
 * Contract:
 *   createProjectFolder(ctx) -> {
 *     renderProjectPanel, openProjectFolder, newProject, finalizeSaveTarget,
 *   }
 *   ctx: {
 *     app,                       // shared mutable editor state (projectFolder, docName, saveTarget, fileHandle)
 *     setStatus(msg), setDirty(d),
 *     load(raw, name, handle, project, opts) -> Promise<boolean>,
 *     showPanel(id), updatePanels(),
 *     teiVocabularyLine() -> string|null,  // the project's TEI scope and load state
 *     getProjectPanelHost() -> Element,  // the project panel's (possibly created) host
 *   }
 */

import { el, clear } from "./dom.js";
import { parseManifest, typeForFile, mappingFiles, MANIFEST_FILENAME } from "./project-manifest.js";
import { teiFromPlaintext } from "./plaintext-import.js";
import { parseEdition } from "./edition.js";
import { annotationPageSummary } from "./annotation-progress.js";
import { noteIndex } from "./standoff.js";
import { decodeXmlBytes } from "./file-encoding.js";
import { fileVersion } from "./file-version.js";
import { createUnusedFile, existingFile } from "./file-target.js";
import { loadProjectSchemaFiles } from "./project-schema-files.js";
import { requireCtx } from "./ctx.js";
import { projectFile, projectFiles } from "./project-path.js";

export function createProjectFolder(ctx) {
  requireCtx("createProjectFolder", ctx,
    ["setStatus", "setDirty", "load", "showPanel", "updatePanels",
     "teiVocabularyLine", "getProjectPanelHost"],
    ["app"]);
  const {
    app, setStatus, setDirty, load,
    showPanel, updatePanels, teiVocabularyLine, getProjectPanelHost,
  } = ctx;
  // Optional hook: announce a plaintext draft so the shell can show the neutral
  // draft banner and record the Source provenance. Absent in headless callers.
  const onPlaintextDraft = ctx.onPlaintextDraft || (() => {});

  const summaryForState = (state) => annotationPageSummary(state, noteIndex(state.doc));

  function annotationStatus(file) {
    if (file.kind !== "tei") return null;
    if (file.name === app.docName && app.state) return { state: "done", summary: summaryForState(app.state) };
    return file.annotationStatus || { state: "pending" };
  }

  async function scanProjectAnnotations() {
    const pf = app.projectFolder;
    if (!pf || pf.scanningAnnotations) return;
    pf.scanningAnnotations = true;
    renderProjectPanel();
    let checked = 0;
    for (const file of pf.files.filter((item) => item.kind === "tei")) {
      if (app.projectFolder !== pf) return;
      file.annotationStatus = { state: "scanning" };
      renderProjectPanel();
      try {
        const source = await file.handle.getFile();
        const decoded = decodeXmlBytes(await source.arrayBuffer());
        file.annotationStatus = { state: "done", summary: summaryForState(parseEdition(decoded.text)) };
      } catch (err) {
        file.annotationStatus = { state: "error", message: err.message };
      }
      checked += 1;
      renderProjectPanel();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (app.projectFolder !== pf) return;
    pf.scanningAnnotations = false;
    renderProjectPanel();
    setStatus(`Annotation status scanned for ${checked} TEI file${checked === 1 ? "" : "s"}.`);
  }

  function renderProjectPanel() {
    const host = getProjectPanelHost();
    clear(host);
    const pf = app.projectFolder;
    if (!pf) return;
    const head = el("div", { class: "ed-proj-headrow" });
    head.appendChild(el("div", { class: "ed-proj-head", text: pf.name }));
    const teiFiles = pf.files.filter((item) => item.kind === "tei");
    if (teiFiles.length) {
      const scan = el("button", {
        class: "ed-btn ed-proj-scan", type: "button",
        text: pf.scanningAnnotations ? "Scanning..." : "Scan annotations",
        title: "Read every TEI file in this folder and mark which files and pages contain annotations",
      });
      scan.disabled = !!pf.scanningAnnotations;
      scan.addEventListener("click", scanProjectAnnotations);
      head.appendChild(scan);
    }
    host.appendChild(head);
    const vocab = teiVocabularyLine();
    if (vocab) host.appendChild(el("div", { class: "ed-proj-vocab", text: vocab }));
    if (!pf.files.length) {
      // Onboarding for an adopted but empty project: state the two ways to get a
      // document into the editor, in plain terms. Reuses the project-panel tones.
      host.appendChild(el("p", { class: "ed-proj-empty",
        text: "This project folder has no .xml, .txt or .md files yet." }));
      host.appendChild(el("p", { class: "ed-proj-empty",
        text: "Add a TEI .xml or a plaintext .txt/.md file to the folder on disk, then reopen "
          + "the folder (Load... > Open project folder). A plaintext file opens as a line-level "
          + "draft and the first save writes the .xml next to it. You can also start from text "
          + "now with Load... > Open TEI or text, then save into this folder." }));
      return;
    }
    const list = el("div", { class: "ed-proj-list" });
    const directories = new Map([["", list]]);
    pf.collapsedDirectories ||= new Set();
    const directoryList = (path) => {
      if (directories.has(path)) return directories.get(path);
      const parts = path.split("/");
      const name = parts.pop();
      const parent = directoryList(parts.join("/"));
      const group = el("details", { class: "ed-proj-directory" });
      group.open = !pf.collapsedDirectories.has(path);
      group.appendChild(el("summary", { text: name }));
      const children = el("div", { class: "ed-proj-children" });
      group.appendChild(children);
      group.addEventListener("toggle", () => {
        if (group.open) pf.collapsedDirectories.delete(path);
        else pf.collapsedDirectories.add(path);
      });
      parent.appendChild(group);
      directories.set(path, children);
      return children;
    };
    for (const f of pf.files) {
      const docType = typeForFile(pf.project, f.name);
      const row = el("button", {
        class: "ed-proj-file" + (f.name === app.docName ? " active" : ""), type: "button",
        title: f.kind === "text"
          ? "Plaintext: opens as a deterministic line-level TEI draft; Save writes the .xml into the project folder"
          : "Open this TEI file",
      });
      row.setAttribute("aria-label", f.name);
      row.appendChild(el("span", { class: "ed-proj-file-name", text: f.name.split("/").at(-1) }));
      if (docType) row.appendChild(el("span", { class: "ed-proj-file-type", text: docType.label }));
      if (f.kind === "text") row.appendChild(el("span", { class: "ed-proj-file-kind", text: "plaintext" }));
      const status = annotationStatus(f);
      if (status) {
        let label = "not scanned";
        let stateClass = "pending";
        if (status.state === "scanning") { label = "scanning"; stateClass = "pending"; }
        else if (status.state === "error") { label = "scan failed"; stateClass = "error"; }
        else if (status.state === "done") {
          const summary = status.summary;
          label = summary.annotatedPages
            ? `annotated ${summary.annotatedPages}/${summary.totalPages}`
            : "no annotations";
          stateClass = summary.annotatedPages ? "annotated" : "empty";
        }
        row.appendChild(el("span", {
          class: `ed-proj-ann ${stateClass}`, text: label,
          title: status.state === "error" ? status.message : "Detected annotation-bearing pages in this TEI file",
        }));
      }
      row.addEventListener("click", () => openProjectFile(f));
      directoryList(f.name.split("/").slice(0, -1).join("/")).appendChild(row);
    }
    host.appendChild(list);
  }

  async function openProjectFile(f, folder = app.projectFolder) {
    if (!folder) return false;
    try {
      const file = await f.handle.getFile();
      const project = folder.project;
      if (f.kind === "text") {
        // Deterministic transport, no model: the draft exists only in the editor
        // until Save creates the .xml next to the source in the project folder.
        const baseName = f.name.replace(/\.(txt|md)$/i, "");
        const xmlName = baseName + ".xml";
        const opened = await load(teiFromPlaintext(await file.text(), baseName), xmlName, null, project,
          { projectFolder: folder, directory: f.directory || folder.dir });
        if (!opened) return false;
        app.saveTarget = { dir: f.directory || folder.dir, name: xmlName.split("/").at(-1), prefix: f.prefix || "" };
        setDirty(true);
        onPlaintextDraft(f.name);
        setStatus(`Drafted ${xmlName} deterministically from ${f.name} (text carried verbatim). Save writes it into the project folder.`);
      } else {
        const decoded = decodeXmlBytes(await file.arrayBuffer());
        const opened = await load(decoded.text, f.name, f.handle, project, {
          projectFolder: folder,
          directory: f.directory || folder.dir,
          fileEncoding: { encoding: decoded.encoding, bom: decoded.bom },
          fileSnapshot: fileVersion(file),
        });
        if (!opened) return false;
      }
      // Stay in the project context: switching to the next file is one click.
      showPanel("project");
      return true;
    } catch (err) {
      setStatus(`Could not open ${f.name}: ${err.message}`);
      return false;
    }
  }

  async function adoptProjectFolder(dir) {
    try { return await readProjectFolder(dir); }
    catch (err) {
      setStatus(`Could not read the project folder: ${err.message}`);
      return false;
    }
  }

  async function readProjectFolder(dir) {
    const files = [];
    const handles = new Map(); // name -> handle, to read manifest-referenced files
    let manifestText = null;
    for (const item of await projectFiles(dir)) {
      handles.set(item.name, item.handle);
      if (item.name === MANIFEST_FILENAME) manifestText = await (await item.handle.getFile()).text();
      else if (/\.xml$/i.test(item.name)) files.push({ ...item, kind: "tei" });
      else if (/\.(txt|md)$/i.test(item.name)) files.push({ ...item, kind: "text" });
    }
    files.sort((a, b) => a.name.localeCompare(b.name));
    let project = null, note = "";
    if (manifestText !== null) {
      try { project = parseManifest(manifestText); }
      catch (err) { note = ` ${err.message}; the folder opened without project settings.`; }
    }
    // Ingest any Markdown mapping files the manifest references: they are project
    // configuration (the model's phenomenon-to-TEI guidance), not openable drafts,
    // so read them into project.llmMappings and drop them from the file list. A
    // missing one degrades to the built-in fallback, never blocks.
    if (project) {
      const names = mappingFiles(project);
      if (names.length) {
        project.llmMappings = {};
        for (const name of names) {
          const h = handles.get(name);
          if (!h) continue;
          try { project.llmMappings[name] = await (await h.getFile()).text(); } catch { /* fall back */ }
        }
        for (let i = files.length - 1; i >= 0; i--) {
          if (names.includes(files[i].name)) files.splice(i, 1);
        }
      }
      if (project.schema) {
        project.localSchemas = await loadProjectSchemaFiles(project.schema, async (name) => {
          const handle = await projectFile(dir, name, true);
          const decoded = decodeXmlBytes(await (await handle.getFile()).arrayBuffer());
          return decoded.text;
        });
      }
    }
    const folder = { dir, name: project ? project.name : dir.name, files, project };
    const teiCount = files.filter((x) => x.kind === "tei").length;
    if (files.length) {
      const opened = await openProjectFile(files[0], folder);
      if (!opened) return false;
      setStatus(`Project folder "${folder.name}": ${files.length} file(s) (${teiCount} TEI, ${files.length - teiCount} plaintext).${note}`);
    }
    else {
      app.projectFolder = folder;
      setStatus(`Project folder "${folder.name}": 0 files.${note}`);
      // No openable document: surface the project panel so its onboarding note
      // (how to add a document or start from text) is what the operator sees,
      // not the bare empty reading pane.
      updatePanels();
      showPanel("project");
    }
    return true;
  }

  async function openProjectFolder() {
    if (!window.showDirectoryPicker) {
      setStatus("Open project folder needs the File System Access API (Chromium-based browsers).");
      return;
    }
    let dir;
    try {
      dir = await window.showDirectoryPicker({ mode: "readwrite" });
    } catch (err) {
      if (err && err.name === "AbortError") return;
      setStatus(`Could not open the folder: ${err.message}`);
      return;
    }
    await adoptProjectFolder(dir);
  }

  async function newProject() {
    if (!window.showDirectoryPicker) {
      setStatus("New project needs the File System Access API (Chromium-based browsers).");
      return;
    }
    let dir;
    try {
      dir = await window.showDirectoryPicker({ mode: "readwrite" });
    } catch (err) {
      if (err && err.name === "AbortError") return;
      setStatus(`Could not open the folder: ${err.message}`);
      return;
    }
    let exists;
    try { exists = await existingFile(dir, MANIFEST_FILENAME); }
    catch (err) {
      setStatus(`Could not inspect the project manifest: ${err.message}`);
      return;
    }
    if (exists) {
      setStatus("This folder already carries a teicrafter.project.json; opening it as a project.");
      await adoptProjectFolder(dir);
      return;
    }
    const name = window.prompt("Project name:", dir.name);
    if (name === null) return;
    let writable;
    try {
      if (await existingFile(dir, MANIFEST_FILENAME)) {
        setStatus("A project manifest was created in this folder; opening that project.");
        await adoptProjectFolder(dir);
        return;
      }
      const handle = await dir.getFileHandle(MANIFEST_FILENAME, { create: true });
      if ((await handle.getFile()).size !== 0) throw new Error("The manifest changed before it could be written. Reopen the project folder.");
      writable = await handle.createWritable();
      await writable.write(JSON.stringify({ teicrafter: 1, name: name.trim() || dir.name }, null, 2) + "\n");
      await writable.close();
    } catch (err) {
      if (writable?.abort) await writable.abort().catch(() => {});
      setStatus(`Could not write the project manifest: ${err.message}`);
      return;
    }
    await adoptProjectFolder(dir);
  }

  /**
   * First-save plumbing for plaintext drafts: when no file handle exists but a
   * saveTarget does, create the .xml in the project folder, adopt the handle
   * and register the new file in the panel list. Does nothing when there is
   * nothing to finalize; on failure it reports and leaves fileHandle null, so
   * the caller's download fallback takes over.
   */
  async function finalizeSaveTarget() {
    if (app.fileHandle || !(app.saveTarget && app.saveTarget.dir)) return;
    const target = app.saveTarget;
    try {
      const created = await createUnusedFile(target.dir, target.name);
      if (app.saveTarget !== target) return;
      app.fileHandle = created.handle;
      app.fileSnapshot = fileVersion(created.file);
      app.docName = (target.prefix || "") + created.name;
      app.documentDirectory = target.dir;
      app.saveTarget = null;
      if (app.projectFolder) {
        const known = app.projectFolder.files.some((f) => f.name === app.docName);
        if (!known) {
          app.projectFolder.files.push({ name: app.docName, kind: "tei", handle: app.fileHandle, directory: target.dir, prefix: target.prefix || "" });
          app.projectFolder.files.sort((a, b) => a.name.localeCompare(b.name));
        }
      }
    } catch (err) {
      setStatus(`Could not create ${target.name} in the project folder (${err.message}); downloading instead`);
    }
  }

  return { renderProjectPanel, openProjectFolder, newProject, finalizeSaveTarget };
}
