/** Small cache whose contents live for exactly one document revision. */

export function createRevisionCache() {
  let sessionId = null;
  let revision = null;
  const values = new Map();

  function align(snapshot) {
    if (!snapshot || snapshot.sessionId !== sessionId || snapshot.revision !== revision) {
      sessionId = snapshot ? snapshot.sessionId : null;
      revision = snapshot ? snapshot.revision : null;
      values.clear();
    }
  }

  function get(snapshot, key, compute) {
    align(snapshot);
    if (!values.has(key)) values.set(key, compute());
    return values.get(key);
  }

  function clear() {
    sessionId = null;
    revision = null;
    values.clear();
  }

  return { get, clear };
}
