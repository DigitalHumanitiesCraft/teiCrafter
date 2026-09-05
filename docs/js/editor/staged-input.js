/** One revision-owned contract for unfinished reading, XML and metadata input. */

/** @typedef {{ sessionId: number, raw: string }} InputOwner */
/** @typedef {{ mode: string, folio: number, cellId?: string }} InputContext */
/** @typedef {{ hasChanges: () => boolean, value: () => any, apply: () => boolean, restore: (value: any) => void, dispose?: () => void }} InputSurface */

/** @param {{ current: () => InputOwner, blocked: (message: string) => void }} ctx */
export function createStagedInput(ctx) {
  /** @type {{ owner: InputOwner, context: InputContext, surface: InputSurface } | null} */
  let active = null;
  let applying = false;
  const hasChanges = () => !applying && !!active?.surface.hasChanges();
  const isCurrent = () => !active || (active.owner.sessionId === ctx.current().sessionId
    && active.owner.raw === ctx.current().raw);

  function clear() { active?.surface.dispose?.(); active = null; }

  /** Register a mounted surface; a re-render cannot silently displace input. */
  function mount(surface, context) {
    if (hasChanges()) throw new Error("Apply or cancel the visible edits before opening another editor.");
    active = { surface, context: { ...context }, owner: { ...ctx.current() } };
    return surface;
  }

  function snapshot() {
    if (!hasChanges()) return null;
    return { ...active.context, value: structuredClone(active.surface.value()) };
  }

  /** Also wraps Apply buttons and inline blur commits, not just file actions. */
  function commit(action) {
    if (!isCurrent()) {
      ctx.blocked("The document changed since this input was opened. Preserve it using Working copy before reopening the editor.");
      return false;
    }
    const previous = active;
    applying = true;
    try {
      const applied = action() !== false;
      if (applied && active === previous) clear();
      return applied;
    } finally { applying = false; }
  }

  function allowChange(action) {
    if (!hasChanges()) return true;
    const discard = active.context.mode === "metadata-form" ? "reset" : "cancel";
    ctx.blocked(`Apply or ${discard} the visible edits before ${action}. Working copy can preserve unfinished input.`);
    return false;
  }

  return {
    mount, clear, snapshot, hasChanges, commit, allowChange,
    apply: () => !hasChanges() || (isCurrent() ? active.surface.apply() : commit(() => false)),
    restore: (value) => active?.surface.restore(value),
  };
}
