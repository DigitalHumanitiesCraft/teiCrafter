/** Revision-bound output orchestration. UI, validation and storage are adapters. */
import { encodeXmlBytes } from "./file-encoding.js";
import { fileVersion, fileVersionChanged } from "./file-version.js";

/** @typedef {{ raw: string, name: string, bom: boolean, inlineGND: boolean, sessionId: number, recoveryId: string }} OutputSnapshot */
/** @typedef {{ write: (bytes: Uint8Array) => Promise<void>, close: () => Promise<void>, abort?: () => Promise<void> }} OutputWriter */
/** @typedef {{ getFile: () => Promise<File>, createWritable?: () => Promise<OutputWriter> }} OutputHandle */
/** @typedef {{ handle: OutputHandle | null, baseline: ReturnType<typeof fileVersion>, directory: any, name: string }} OutputTarget */
/**
 * @param {{ capture: (kind: string) => OutputSnapshot | null, sessionId: () => number,
 * resolveStaged: (action: string) => boolean, hasStaged: () => boolean,
 * authorize: (raw: string, action: string) => Promise<unknown>, authorizationCurrent: (authorization: unknown) => boolean,
 * prepareSaveTarget: () => Promise<void>, target: () => OutputTarget,
 * setFileSnapshot: (handle: OutputHandle, snapshot: ReturnType<typeof fileVersion>) => void,
 * persistImages: (directory: any) => Promise<{ written: number, failed: number }>, countImages: () => number,
 * markSaved: () => void, markDirty: () => void, persistRecovery: () => Promise<boolean>, clearRecovery: (id: string) => Promise<boolean>,
 * download: (data: Uint8Array, name: string, type: string) => void, status: (message: string) => void }} ctx
 */
export function createOutputController(ctx) {
  let saving = false;
  const owns = (snapshot) => ctx.sessionId() === snapshot.sessionId;
  const current = (snapshot, authorization) => owns(snapshot)
    && ctx.authorizationCurrent(authorization) && !ctx.hasStaged();
  const report = (snapshot, message) => { if (owns(snapshot)) ctx.status(message); };
  function check(snapshot, authorization, action) {
    if (current(snapshot, authorization)) return true;
    report(snapshot, `${action} blocked: the document, visible input or configured schema set changed after validation. Run ${action} again for the current revision.`);
    return false;
  }

  async function prepare(action, kind = "project") {
    if (!ctx.resolveStaged(action)) return null;
    let snapshot;
    try { snapshot = ctx.capture(kind); }
    catch (error) { ctx.status(`${action} failed while preparing the output format: ${error.message}`); return null; }
    if (!snapshot) return null;
    const authorization = await ctx.authorize(snapshot.raw, action);
    if (!authorization || !check(snapshot, authorization, action)) return null;
    return { snapshot, authorization };
  }

  async function requestDownload(snapshot, authorization, action = "Download") {
    if (!check(snapshot, authorization, action)) return false;
    try {
      const bytes = encodeXmlBytes(snapshot.raw, { bom: snapshot.bom });
      ctx.download(bytes, snapshot.name, "application/xml;charset=UTF-8");
      const pending = ctx.countImages();
      const recovered = await ctx.persistRecovery();
      if (!owns(snapshot) || !recovered) return true;
      report(snapshot, `Download requested: ${snapshot.name}${snapshot.inlineGND ? " in inline-GND format" : ""}. Local recovery is retained.`
        + (pending ? ` ${pending} attached page image(s) are not included. Use Working copy or save into a project folder to retain them.` : ""));
      return true;
    } catch (error) { report(snapshot, `${action} failed: ${error.message}`); return false; }
  }

  async function download(kind = "project") {
    const action = kind === "inline-gnd" ? "Inline-GND export" : "Download";
    const prepared = await prepare(action, kind);
    return prepared ? requestDownload(prepared.snapshot, prepared.authorization, action) : false;
  }

  async function saveCurrent() {
    const prepared = await prepare("Save");
    if (!prepared) return false;
    const { snapshot, authorization } = prepared;
    try { await ctx.prepareSaveTarget(); }
    catch (error) { report(snapshot, `Save target could not be prepared: ${error.message}`); return false; }
    if (!check(snapshot, authorization, "Save")) return false;
    const target = ctx.target();
    const handle = target.handle;
    if (!handle?.createWritable) return requestDownload(snapshot, authorization);
    try {
      if (!target.baseline || fileVersionChanged(target.baseline, fileVersion(await handle.getFile()))) {
        report(snapshot, `Save blocked: ${target.name} changed outside teiCrafter. Download a copy or reload the file before saving in place.`);
        return false;
      }
    } catch (error) {
      report(snapshot, `Save blocked because the current file could not be checked for external changes (${error.message}). Download a copy or reload it.`);
      return false;
    }
    if (!check(snapshot, authorization, "Save")) return false;
    /** @type {OutputWriter | null} */
    let writer = null;
    try {
      const bytes = encodeXmlBytes(snapshot.raw, { bom: snapshot.bom });
      writer = await handle.createWritable();
      if (!check(snapshot, authorization, "Save")) { await writer.abort?.(); return false; }
      await writer.write(bytes);
      // A user may keep editing while a slow write is in flight. Abort before
      // close when possible; after close an older revision must remain dirty.
      if (!check(snapshot, authorization, "Save")) { await writer.abort?.(); return false; }
      await writer.close();
      writer = null;
    } catch (error) {
      if (writer?.abort) await writer.abort().catch(() => {});
      report(snapshot, `Save in place failed (${error.message}); requesting a download instead.`);
      return requestDownload(snapshot, authorization);
    }
    try {
      const savedFile = await handle.getFile();
      if (owns(snapshot)) ctx.setFileSnapshot(handle, fileVersion(savedFile));
    } catch { if (owns(snapshot)) ctx.setFileSnapshot(handle, null); }
    if (!owns(snapshot)) return false;
    let images;
    try { images = await ctx.persistImages(target.directory); }
    catch (error) {
      if (owns(snapshot)) {
        ctx.markDirty();
        report(snapshot, `Saved XML: ${target.name}. Page images could not be saved (${error.message}); local recovery is retained.`);
      }
      return false;
    }
    if (!owns(snapshot)) return false;
    const complete = current(snapshot, authorization) && !images.failed && !ctx.countImages();
    if (complete) {
      ctx.markSaved();
      // The captured ID and queue order protect a different document and edits
      // made while the checkpoint deletion is waiting for earlier writes.
      if (!await ctx.clearRecovery(snapshot.recoveryId)) return true;
      if (!current(snapshot, authorization)) return true;
    } else ctx.markDirty();
    report(snapshot, complete
      ? `Saved in place${snapshot.inlineGND ? " as inline-GND" : ""}: ${target.name}${images.written ? `, ${images.written} page image(s)` : ""}`
      : `Saved XML: ${target.name}. Unfinished changes or images remain; local recovery is retained.`);
    return complete;
  }

  return {
    download,
    async save() {
      if (saving) return false;
      saving = true;
      try { return await saveCurrent(); }
      finally { saving = false; }
    },
  };
}
