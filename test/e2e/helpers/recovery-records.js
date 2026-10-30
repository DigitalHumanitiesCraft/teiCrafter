/**
 * Recovery checkpoints as the application reads them back, decoded independently of its code:
 * a stored XML Blob becomes its exact UTF-8 text with any BOM kept, the active project entry,
 * stored without text, receives the checkpoint's text, and image Blobs become base64.
 * `storedAs` names the stored form of the top-level text and `activeStored` that of the
 * active project entry. `source` reads the IndexedDB store, or "probe" the records an
 * instrumented put collected in `window.recoveryFirstCheckpointProbe`.
 * @param {import("@playwright/test").Page} page
 * @param {"store" | "probe"} [source]
 */
export function recoveryRecords(page, source = "store") {
  return page.evaluate(async (from) => {
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    const text = async (value) => value instanceof Blob ? decoder.decode(await value.arrayBuffer()) : value;
    const form = (value) => value instanceof Blob ? `blob:${value.type}` : value === null ? "none" : typeof value;
    const images = (list) => Promise.all((list || []).map(async (image) => ({
      name: image.name, type: image.type,
      base64: btoa(String.fromCharCode(...new Uint8Array(await image.blob.arrayBuffer()))),
    })));
    let records;
    if (from === "probe") records = window.recoveryFirstCheckpointProbe.records;
    else {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("teicrafter.recovery");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      records = await new Promise((resolve, reject) => {
        const request = db.transaction("sessions").objectStore("sessions").getAll();
        request.onsuccess = () => { db.close(); resolve(request.result); };
        request.onerror = () => { db.close(); reject(request.error); };
      });
    }
    return Promise.all(records.map(async (record) => {
      const raw = await text(record.raw);
      const project = record.projectDocuments;
      const active = project?.documents.find((entry) => entry.id === project.activeId);
      return {
        ...record, raw, storedAs: form(record.raw), activeStored: active ? form(active.raw) : null,
        images: await images(record.images),
        projectDocuments: project && { ...project, documents: await Promise.all(project.documents.map(async (entry) => ({
          ...entry, raw: entry.raw == null && entry === active ? raw : await text(entry.raw), images: await images(entry.images),
        }))) },
      };
    }));
  }, source);
}
