/** Serialize committed recovery writes without retaining mutable session state. */

/**
 * Checkpoints captured while a write is running join one waiting batch, in which a later
 * capture of the same id replaces the earlier one. A large document is then written once
 * per completed write rather than once per keystroke, and the latest capture is always
 * written. A removal closes the waiting batch, so a later capture is written after it.
 * @template {{ id: string }} Record
 * @param {{ store: { put: (record: Record) => Promise<void>, remove: (id: string) => Promise<void>, list: () => Promise<Record[]> },
 * capture: () => Record | null, onError: (error: Error) => void, clone?: (record: Record) => Record }} ctx
 */
export function createRecoveryCoordinator(ctx) {
  const clone = ctx.clone || structuredClone;
  let queue = Promise.resolve();
  /** @type {{ records: Map<string, Record>, done: Promise<Map<string, boolean>> } | null} */
  let waiting = null;
  const failed = (error) => { ctx.onError(error); return false; };
  const enqueue = (action) => {
    waiting = null;
    const result = queue.then(action).then(() => true, failed);
    queue = result.then(() => {});
    return result;
  };
  function openBatch() {
    const records = new Map();
    const batch = { records, done: null };
    batch.done = queue.then(async () => {
      if (waiting === batch) waiting = null;
      const results = new Map();
      for (const [id, record] of records) {
        results.set(id, await Promise.resolve().then(() => ctx.store.put(record)).then(() => true, failed));
      }
      return results;
    });
    queue = batch.done.then(() => {});
    return batch;
  }
  function persist() {
    let record;
    try {
      const captured = ctx.capture();
      if (!captured) return Promise.resolve(true);
      // Clone before waiting, including nested schema settings and staged fields.
      record = clone(captured);
    } catch (error) { return Promise.resolve(failed(error)); }
    if (!waiting) waiting = openBatch();
    waiting.records.set(record.id, record);
    return waiting.done.then((results) => results.get(record.id));
  }
  return {
    persist,
    remove: (id) => id ? enqueue(() => ctx.store.remove(id)) : Promise.resolve(true),
    list: async () => { await queue; return ctx.store.list(); },
    flush: () => queue,
  };
}
