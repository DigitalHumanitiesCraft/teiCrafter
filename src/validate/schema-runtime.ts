/**
 * RelaxNG and XSD validation through libxml2-wasm, independent of where it
 * runs. The worker wraps this module; Node tests call it directly. It has no
 * runtime imports so that Node can load it after type stripping alone.
 */
import type * as Libxml from "../../public/vendor/libxml2-wasm/lib/index.mjs";

export type LibxmlModule = typeof Libxml;

export interface Diagnostic {
  /** 1-based; 0 means the finding is not tied to a document position. */
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
  schema: string;
}

export interface SchemaSource {
  kind: "rng" | "xsd" | "sch";
  /** Relative URLs resolve against the app's public root. */
  url?: string;
  text?: string;
  label: string;
}

export const TEI_ALL: SchemaSource = Object.freeze({
  kind: "rng",
  url: "schemas/tei-p5-4.11.0/tei_all.rng",
  label: "TEI P5 4.11.0 (TEI All)",
});

export const WELL_FORMEDNESS_LABEL = "XML well-formedness";

export interface RuntimeHost {
  loadLibxml(): Promise<LibxmlModule>;
  fetchText(url: string): Promise<string>;
}

interface Compiled {
  validator: Libxml.RelaxNGValidator | Libxml.XsdValidator;
  schemaDocument: Libxml.XmlDocument;
}

// TEI All compiles to a large wasm-side structure; a small bound keeps
// repeatedly re-picked user schemas from growing the heap without limit.
const CACHE_LIMIT = 4;

// A JS string reaches libxml2 as UTF-8 bytes, so a declared encoding such as
// ISO-8859-1 must not make the parser decode those bytes a second time.
const UTF8 = { encoding: "utf-8" } as const;

function details(error: unknown): { message: string; line: number; col: number }[] {
  const list = (error as { details?: unknown })?.details;
  if (Array.isArray(list) && list.length) return list;
  return [{ message: error instanceof Error ? error.message : String(error), line: 0, col: 0 }];
}

function schemaFailure(schema: SchemaSource, error: unknown): Diagnostic {
  // Compile errors carry positions inside the schema file, never the document.
  const reason = details(error).map((item) => String(item.message).trim()).filter(Boolean).slice(0, 3).join(" ");
  return {
    line: 0,
    column: 0,
    severity: "error",
    message: `Schema "${schema.label}" could not be used: ${reason || "unknown error"}`,
    schema: schema.label,
  };
}

function positioned(error: unknown, schema: string): Diagnostic[] {
  return details(error).map((item) => ({
    line: Number(item.line) || 0,
    column: Number(item.col) || 0,
    message: String(item.message || "Validation failed.").trim(),
    severity: "error",
    schema,
  }));
}

/** URL sources are keyed by URL and assumed immutable (pinned, versioned files). */
function cacheKey(schema: SchemaSource): string {
  if (typeof schema.text === "string") return `${schema.kind}\u0000text\u0000${schema.text}`;
  if (schema.url) return `${schema.kind}\u0000url\u0000${schema.url}`;
  throw new Error("The schema has neither a URL nor text.");
}

export function createSchemaRuntime(host: RuntimeHost) {
  let libxml: Promise<LibxmlModule> | null = null;
  const cache = new Map<string, Promise<Compiled>>();

  function evict(key: string): void {
    const entry = cache.get(key);
    cache.delete(key);
    entry?.then((compiled) => {
      compiled.validator.dispose();
      compiled.schemaDocument.dispose();
    }, () => {});
  }

  async function compile(schema: SchemaSource): Promise<Compiled> {
    const runtime = await (libxml ??= host.loadLibxml());
    const text = typeof schema.text === "string" ? schema.text : await host.fetchText(schema.url as string);
    const schemaDocument = runtime.XmlDocument.fromString(text, UTF8);
    try {
      const validator = schema.kind === "xsd"
        ? runtime.XsdValidator.fromDoc(schemaDocument)
        : runtime.RelaxNGValidator.fromDoc(schemaDocument);
      return { validator, schemaDocument };
    } catch (error) {
      schemaDocument.dispose();
      throw error;
    }
  }

  function compiled(schema: SchemaSource): Promise<Compiled> {
    const key = cacheKey(schema);
    let entry = cache.get(key);
    if (entry) {
      cache.delete(key);
      cache.set(key, entry);
      return entry;
    }
    entry = compile(schema);
    cache.set(key, entry);
    entry.catch(() => { if (cache.get(key) === entry) cache.delete(key); });
    return entry;
  }

  /**
   * Diagnostics grouped by schema in the given order. A schema that cannot be
   * used yields one line-0 error; a document that is not well-formed yields its
   * parser errors once, ahead of any schema result.
   */
  async function validate(raw: string, schemas: readonly SchemaSource[]): Promise<Diagnostic[]> {
    if (typeof raw !== "string") throw new TypeError("Validation requires the XML as a string.");
    const slots: Diagnostic[][] = schemas.map(() => []);
    const ready: { index: number; label: string; entry: Compiled }[] = [];
    for (const [index, schema] of schemas.entries()) {
      try {
        if (schema.kind === "sch") throw new Error("Schematron is not supported by this validator.");
        if (schema.kind !== "rng" && schema.kind !== "xsd") throw new Error(`Unknown schema kind "${String(schema.kind)}".`);
        ready.push({ index, label: schema.label, entry: await compiled(schema) });
      } catch (error) {
        slots[index].push(schemaFailure(schema, error));
      }
    }
    if (!ready.length) return slots.flat();
    try {
      const runtime = await (libxml ??= host.loadLibxml());
      let document: Libxml.XmlDocument;
      try {
        document = runtime.XmlDocument.fromString(raw, UTF8);
      } catch (error) {
        return [...positioned(error, WELL_FORMEDNESS_LABEL), ...slots.flat()];
      }
      try {
        for (const { index, label, entry } of ready) {
          try {
            entry.validator.validate(document);
          } catch (error) {
            slots[index].push(...positioned(error, label));
          }
        }
      } finally {
        document.dispose();
      }
      return slots.flat();
    } finally {
      // Trimmed only after use, so a call with many schemas never validates
      // against a validator it has just evicted.
      while (cache.size > CACHE_LIMIT) evict(cache.keys().next().value as string);
    }
  }

  function dispose(): void {
    for (const key of [...cache.keys()]) evict(key);
  }

  return { validate, dispose };
}
