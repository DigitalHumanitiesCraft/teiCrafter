/**
 * teiCrafter Editor -- ctx contract guard.
 *
 * The feature modules (entity-index, annotation-ui, project-folder,
 * validation-view) receive their integrator dependencies via a ctx object.
 * requireCtx makes a missing or mistyped key fail at construction time with
 * the factory and the key named, instead of as an undefined call when the
 * feature is first used in the browser.
 */
export function requireCtx(who, ctx, fnKeys = [], objKeys = []) {
  if (!ctx || typeof ctx !== "object") throw new Error(`${who}: ctx must be an object`);
  for (const k of fnKeys) {
    if (typeof ctx[k] !== "function") throw new Error(`${who}: ctx.${k} must be a function`);
  }
  for (const k of objKeys) {
    if (!ctx[k] || typeof ctx[k] !== "object") throw new Error(`${who}: ctx.${k} must be an object`);
  }
}
