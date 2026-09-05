function rawOf(state) {
  if (!state || !state.doc || typeof state.doc.raw !== "string") {
    throw new TypeError("EditorSession requires a parsed state with doc.raw.");
  }
  return state.doc.raw;
}

export function minimalPatch(before, after) {
  if (before === after) return null;
  const limit = Math.min(before.length, after.length);
  let start = 0;
  while (start < limit && before.charCodeAt(start) === after.charCodeAt(start)) start++;

  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (
    beforeEnd > start &&
    afterEnd > start &&
    before.charCodeAt(beforeEnd - 1) === after.charCodeAt(afterEnd - 1)
  ) {
    beforeEnd--;
    afterEnd--;
  }
  return {
    start,
    before: before.slice(start, beforeEnd),
    after: after.slice(start, afterEnd),
  };
}

export function applyPatch(raw, patch, direction = "forward") {
  const expected = direction === "forward" ? patch.before : patch.after;
  const replacement = direction === "forward" ? patch.after : patch.before;
  if (raw.slice(patch.start, patch.start + expected.length) !== expected) {
    throw new Error("History patch no longer matches the current document revision.");
  }
  return raw.slice(0, patch.start) + replacement + raw.slice(patch.start + expected.length);
}

export class EditorSession {
  constructor(parse, options = {}) {
    if (typeof parse !== "function") throw new TypeError("EditorSession requires a parse function.");
    this.parse = parse;
    this.maxEntries = Number.isInteger(options.maxEntries) ? options.maxEntries : 100;
    this.maxPatchChars = Number.isInteger(options.maxPatchChars) ? options.maxPatchChars : 16_000_000;
    this.sessionId = 0;
    this.revision = 0;
    this.state = null;
    this.history = [];
    this.cursor = 0;
    this.historyChars = 0;
    this.nextToken = 1;
    this.currentToken = 0;
    this.savedToken = 0;
    this.readOnly = false;
  }

  load(state) {
    rawOf(state);
    this.sessionId++;
    this.revision = 0;
    this.state = state;
    this.history = [];
    this.cursor = 0;
    this.historyChars = 0;
    this.currentToken = 0;
    this.savedToken = 0;
    return state;
  }

  replace(nextState, label = "Edit") {
    const before = rawOf(this.state);
    const after = rawOf(nextState);
    const patch = minimalPatch(before, after);
    if (!patch) return false;
    if (this.readOnly) throw new Error("The document is read only. Choose Edit document to change it.");

    if (this.cursor < this.history.length) {
      const removed = this.history.splice(this.cursor);
      this.historyChars -= removed.reduce((sum, entry) => sum + entry.size, 0);
    }

    const beforeToken = this.currentToken;
    const afterToken = this.nextToken++;
    const size = patch.before.length + patch.after.length;
    if (size <= this.maxPatchChars) {
      this.history.push({ label, patch, size, beforeToken, afterToken });
      this.cursor = this.history.length;
      this.historyChars += size;
      this.trimHistory();
    } else {
      this.history = [];
      this.cursor = 0;
      this.historyChars = 0;
    }

    this.state = nextState;
    this.currentToken = afterToken;
    this.revision++;
    return true;
  }

  /** Replace derived projections without creating a document revision. */
  reproject(nextState) {
    if (rawOf(nextState) !== rawOf(this.state)) {
      throw new Error("A projection refresh cannot change document bytes.");
    }
    this.state = nextState;
    return nextState;
  }

  trimHistory() {
    while (
      this.history.length > this.maxEntries ||
      (this.historyChars > this.maxPatchChars && this.history.length > 1)
    ) {
      const removed = this.history.shift();
      this.historyChars -= removed.size;
      this.cursor--;
    }
  }

  undo() {
    if (!this.canUndo()) return null;
    const entry = this.history[this.cursor - 1];
    const raw = applyPatch(rawOf(this.state), entry.patch, "backward");
    this.state = this.parse(raw);
    this.cursor--;
    this.currentToken = entry.beforeToken;
    this.revision++;
    return { state: this.state, label: entry.label };
  }

  redo() {
    if (!this.canRedo()) return null;
    const entry = this.history[this.cursor];
    const raw = applyPatch(rawOf(this.state), entry.patch, "forward");
    this.state = this.parse(raw);
    this.cursor++;
    this.currentToken = entry.afterToken;
    this.revision++;
    return { state: this.state, label: entry.label };
  }

  canUndo() {
    return !this.readOnly && this.cursor > 0;
  }

  canRedo() {
    return !this.readOnly && this.cursor < this.history.length;
  }

  undoLabel() {
    return this.canUndo() ? this.history[this.cursor - 1].label : null;
  }

  redoLabel() {
    return this.canRedo() ? this.history[this.cursor].label : null;
  }

  markSaved() {
    this.savedToken = this.currentToken;
  }

  get dirty() {
    return this.currentToken !== this.savedToken;
  }

  snapshot(extra = {}) {
    return Object.freeze({
      sessionId: this.sessionId,
      revision: this.revision,
      raw: rawOf(this.state),
      ...extra,
    });
  }

  isCurrent(snapshot) {
    return Boolean(
      snapshot &&
      snapshot.sessionId === this.sessionId &&
      snapshot.revision === this.revision &&
      snapshot.raw === rawOf(this.state)
    );
  }
}
