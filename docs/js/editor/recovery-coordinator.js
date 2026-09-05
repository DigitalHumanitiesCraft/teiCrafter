/** Serialize committed recovery writes without retaining mutable session state. */

/**
 * @template {{ id: string }} Record
 * @param {{ store: { put: (record: Record) => Promise<void>, remove: (id: string) => Promise<void>, list: () => Promise<Record[]> },
 * capture: () => Record | null, onError: (error: Error) => void }} ctx
 */
export function createRecoveryCoordinator(ctx) {
  let queue = Promise.resolve();
  const failed = (error) => { ctx.onError(error); return false; };
  const enqueue = (action) => {
    const result = queue.then(action).then(() => true, failed);
    queue = result.then(() => {});
    return result;
  };
  function persist() {
    try {
      const captured = ctx.capture();
      // Clone before waiting, including nested schema settings and staged fields.
      const record = captured && structuredClone(captured);
      return record ? enqueue(() => ctx.store.put(record)) : Promise.resolve(true);
    } catch (error) { return Promise.resolve(failed(error)); }
  }
  return {
    persist,
    remove: (id) => id ? enqueue(() => ctx.store.remove(id)) : Promise.resolve(true),
    list: async () => { await queue; return ctx.store.list(); },
    flush: () => queue,
  };
}
