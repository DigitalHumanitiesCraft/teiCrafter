/**
 * teiCrafter Editor -- central JSDoc type vocabulary.
 *
 * Shared @typedef declarations the editor modules reference from their own JSDoc
 * via `import('./typedefs.js').Name`, so the shapes the app state, the edition
 * model, the cells, the project manifest, and the ctx contract pass around are
 * described in one place. The offset-true node/document/surface/zone shapes stay
 * owned by tei-document.js and are aliased here rather than duplicated. This file
 * carries types only; the final `export {}` makes it a real loadable ES module.
 */

// ---- aliases to the offset-true core (owned by tei-document.js) -------------

/** @typedef {import('./tei-document.js').Token} Token */
/** @typedef {import('./tei-document.js').TeiNode} TeiNode */
/** @typedef {import('./tei-document.js').TeiDocument} TeiDocument */
/** @typedef {import('./tei-document.js').TeiSurface} Surface */
/** @typedef {import('./tei-document.js').Zone} Zone */

// ---- edition model (built by edition.js parseEdition) -----------------------

/**
 * The wrapping dual-reading <w> a cell sits inside, exposing its readings.
 * @typedef {Object} CellReading
 * @property {TeiNode} el The wrapping <w> element.
 * @property {string|null} orig The @orig reading, or null.
 * @property {string|null} norm The @norm reading, or null.
 */

/**
 * One inline annotation layer wrapping a cell's text node (innermost first).
 * @typedef {Object} Layer
 * @property {"mention"|"critical"|"markup"} kind Layer category.
 * @property {string} localName The wrapper element's local-name.
 * @property {string|null} ref Referenced entity id (mention only), else null.
 * @property {TeiNode} el The layer's element.
 * @property {string|null} resp The @resp provenance value, or null.
 */

/**
 * An editable reading-text unit (a word or a line) or a read-only gap marker.
 * @typedef {Object} Cell
 * @property {string} id Cell id (nearest ancestor xml:id, else a synthetic one).
 * @property {string} text Decoded reading text ("" for a gap cell).
 * @property {TeiNode} node The text node, or the <gap/> element for a gap cell.
 * @property {number|null} start Raw start offset (the <gap/> outerStart for a gap).
 * @property {number|null} end Raw end offset.
 * @property {string} rawText The raw slice doc.raw.slice(start, end).
 * @property {string|null} facs Facsimile zone or surface id the cell links to, or null.
 * @property {boolean} gap True for a read-only <gap/> marker cell.
 * @property {string|null} crit Local-name of the immediate critical wrapper, or null.
 * @property {boolean} critSole True when the cell is that wrapper's sole content.
 * @property {string|null} mention Referenced entity id from a <name ref>, or null.
 * @property {CellReading|null} w The wrapping dual-reading <w>, or null.
 * @property {Layer[]} layers Inline annotation layers over the cell, innermost first.
 */

/**
 * One render line: cells sharing an <lb>/<l> (or block) segment.
 * @typedef {Object} Line
 * @property {string|null} n The line's @n, or null.
 * @property {string|null} facs Facsimile zone id for the line, or null.
 * @property {TeiNode|null} el The element that opened the line (<l> or <lb/>), or null.
 * @property {string|null} kind Local-name of that element ("l" or "lb"), or null.
 * @property {Cell[]} cells The line's cells.
 */

/**
 * One folio: the run of lines under a page break.
 * @typedef {Object} Folio
 * @property {number} index Zero-based folio index.
 * @property {string|null} n The page break's @n, or null.
 * @property {string|null} surfaceId The linked surface id (@facs without '#'), or null.
 * @property {Surface|null} surface The resolved surface, or null.
 * @property {Line[]} lines The folio's lines.
 */

/**
 * The editor model parseEdition builds from a parsed document.
 * @typedef {Object} EditionState
 * @property {string} raw The canonical raw XML string.
 * @property {TeiDocument} doc The offset-true parsed document.
 * @property {"word"|"line"} profile Editing granularity (word if any <w>, else line).
 * @property {Cell[]} cells All reading-text cells in document order.
 * @property {Map<string, Cell>} cellById Cell index by id.
 * @property {Cell[]} words Alias of cells (back-compat).
 * @property {Map<string, Cell>} wordById Alias of cellById (back-compat).
 * @property {Line[]} lines All non-empty render lines.
 * @property {Surface[]} surfaces Facsimile surfaces.
 * @property {Map<string, Surface>} surfaceById Surface index by id.
 * @property {Map<string, {surface: Surface, zone: Zone|null}>} zoneIndex Zone/surface index by id.
 * @property {Folio[]} folios Folios split by <pb>.
 * @property {boolean} hasDualReadings True when any cell carries a @norm reading.
 */

// ---- project manifest (parseManifest / detectProject) -----------------------

/**
 * The normalized project profile (parseManifest) or a PID-detected fallback.
 * @typedef {Object} Project
 * @property {string} source "manifest" for a teicrafter.project.json, else "detected".
 * @property {string} name Project name.
 * @property {string|null} [schema] Schema path, or null.
 * @property {string|null} [iiifImageTemplate] IIIF image URL template, or null.
 * @property {string|null} [iiifPresentationManifest] IIIF presentation manifest URL, or null.
 * @property {Object[]|null} [markup] Default markup wrap list, or null.
 * @property {Object} [teiScope] Default TEI scope descriptor.
 * @property {Object[]} [documentTypes] Declared document types.
 * @property {Object<string, string>} [files] File-name to type-key map.
 * @property {Object[]} [indices] Index descriptors.
 * @property {Object[]} [views] View descriptors.
 * @property {Object} [reconciliation] Reconciliation descriptor.
 * @property {Object} [llm] LLM descriptor.
 * @property {string|null} [interchange] Interchange profile ("inline-gnd"), or null.
 */

// ---- app state and the ctx contract -----------------------------------------

/**
 * The shared editor state editor-app.js owns and hands the feature factories via
 * ctx.app. One live instance; the factories read and mutate it by reference.
 * @typedef {Object} AppState
 * @property {EditionState|null} state Current edition model, or null when nothing is loaded.
 * @property {number} folio Current folio index.
 * @property {FileSystemFileHandle|null} fileHandle Handle for save-in-place, or null.
 * @property {string|null} docName Displayed document name.
 * @property {boolean} dirty Unsaved changes since the last load or save.
 * @property {{wordCount: number, xmlIds: Set<string>, counts: Object<string, number>}|null} baseline Load-time snapshot for the integrity check.
 * @property {Map<string, string>} noteByWord Word id to note text.
 * @property {Line[]} currentLines Lines of the folio currently rendered.
 * @property {boolean} generated True when the edition came from the LLM (unreviewed).
 * @property {{kind: string, txtName?: string, label?: string}|null} source Load provenance, or null.
 * @property {string|null} imageBase Base dir for per-folio page images, or null.
 * @property {number} coordScale Zone-to-image scale for the facsimile (1 = none).
 * @property {Map<string, {url: string, blob: Blob, type: string}>} pageImages In-memory page images by filename.
 * @property {string} panel Id of the active right-pane context panel.
 * @property {boolean} sourceMode True while the left pane shows the XML source.
 * @property {"dipl"|"norm"} readingVariant Which reading the reading pane shows.
 * @property {"paged"|"continuous"} viewMode Reading view mode.
 * @property {Project|null} project Active project, or null.
 * @property {{dir: FileSystemDirectoryHandle, name: string, files: Object[], project: Project|null}|null} projectFolder Open project folder, or null.
 * @property {Object[]|null} markup Markup wrap list for the current document, or null.
 * @property {{dir: FileSystemDirectoryHandle, name: string}|null} saveTarget Deferred first-save target for a plaintext draft, or null.
 * @property {boolean} rightCollapsed True while the context pane is folded away.
 */

/**
 * The base dependency bag the createX(ctx) feature factories receive. Every
 * factory reads ctx.app and calls back into the integrator through the callbacks
 * below; each factory declares the subset it needs via requireCtx (ctx.js), so a
 * given call site supplies only the keys that factory requires. All callbacks are
 * therefore optional on the base type; app is the one member every factory shares.
 * @typedef {Object} EditorCtx
 * @property {AppState} app The shared editor state.
 * @property {(msg?: string) => void} [setStatus] Footer status feedback.
 * @property {(dirty: boolean) => void} [setDirty] Mark the document dirty or clean.
 * @property {(...args: any[]) => any} [load] Load a document into the editor.
 * @property {() => void} [render] Re-render the reading text.
 * @property {() => void} [renderActivePanel] Re-render the active context panel.
 * @property {(id: string) => void} [showPanel] Switch the active context panel.
 * @property {() => void} [updatePanels] Recompute the available context panels.
 * @property {(...args: any[]) => any} [commitStandoff] Commit a standOff/inline edit.
 */

export {};
