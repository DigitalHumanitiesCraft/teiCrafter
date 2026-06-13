/**
 * teiCrafter Editor -- authority lookup (DOM-free service).
 *
 * Client-side search against the authority registers, so a human can pick an id
 * instead of typing it. The URL builders and response parsers are pure (provable
 * headless); lookup() adds the browser fetch. The chosen id is stored as the bare
 * value in <idno type="...">, matching manual entry.
 *
 * CORS notes:
 *   - Wikidata (wbsearchentities, origin=*) and GND (lobid.org) are keyless and
 *     send permissive CORS headers, so they work directly from the static site.
 *   - GeoNames needs a free username and does not reliably send CORS headers; it
 *     may be blocked from the browser. Prefer Wikidata for places when unsure.
 */

// Registers offered for live lookup, in display order.
export const LOOKUP_AUTHORITIES = Object.freeze(["GND", "Wikidata", "GeoNames"]);

/** Build the search URL for an authority, or null for an unknown one. */
export function searchUrl(authority, query, opts = {}) {
  const q = encodeURIComponent(String(query == null ? "" : query).trim());
  const limit = opts.limit || 7;
  if (!q) return null;
  switch (authority) {
    case "Wikidata":
      return "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=" + q +
        "&language=en&uselang=en&format=json&origin=*&limit=" + limit;
    case "GND":
      return "https://lobid.org/gnd/search?q=" + q + "&format=json&size=" + limit;
    case "GeoNames":
      return "https://secure.geonames.org/searchJSON?q=" + q + "&maxRows=" + limit +
        "&username=" + encodeURIComponent(opts.username || "");
    default:
      return null;
  }
}

/**
 * Resolve an authority id (the bare value stored in <idno type="...">) to the
 * register's public record page, so an attached id can be verified in one click.
 * Pure: no fetch. Returns null for an unknown register or an empty value; a value
 * that is already an http(s) URI is returned unchanged (some editions store the
 * full URI rather than the bare id).
 */
export function recordUrl(authority, value) {
  const v = String(value == null ? "" : value).trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  switch (authority) {
    case "GND":
      return "https://d-nb.info/gnd/" + encodeURIComponent(v);
    case "Wikidata":
      return "https://www.wikidata.org/wiki/" + encodeURIComponent(v);
    case "GeoNames":
      return "https://www.geonames.org/" + encodeURIComponent(v);
    default:
      return null;
  }
}

function gndDescription(hit) {
  const bio = hit.biographicalOrHistoricalInformation;
  if (Array.isArray(bio) && bio.length) return String(bio[0]);
  const type = hit.type;
  if (Array.isArray(type) && type.length) return type[type.length - 1];
  return "";
}

/** Normalise an authority's JSON response into [{ id, label, description }]. */
export function parseResults(authority, json) {
  if (!json || typeof json !== "object") return [];
  try {
    if (authority === "Wikidata") {
      const arr = Array.isArray(json.search) ? json.search : [];
      return arr
        .map((h) => ({ id: h.id, label: h.label || (h.match && h.match.text) || h.id, description: h.description || "" }))
        .filter((h) => h.id);
    }
    if (authority === "GND") {
      const arr = Array.isArray(json.member) ? json.member : [];
      return arr
        .map((h) => ({ id: h.gndIdentifier, label: h.preferredName || h.gndIdentifier, description: gndDescription(h) }))
        .filter((h) => h.id);
    }
    if (authority === "GeoNames") {
      const arr = Array.isArray(json.geonames) ? json.geonames : [];
      return arr
        .map((h) => ({
          id: h.geonameId != null ? String(h.geonameId) : "",
          label: h.name || (h.geonameId != null ? String(h.geonameId) : ""),
          description: [h.adminName1, h.countryName].filter(Boolean).join(", "),
        }))
        .filter((h) => h.id);
    }
    return [];
  } catch (_e) {
    return [];
  }
}

/** Fetch and parse live results for an authority. Throws on network/config error. */
export async function lookup(authority, query, opts = {}) {
  if (authority === "GeoNames" && !opts.username) {
    throw new Error("GeoNames needs a username. Use Wikidata for places, or set a username.");
  }
  const url = searchUrl(authority, query, opts);
  if (!url) return [];
  const res = await fetch(url, { signal: opts.signal, credentials: "omit" });
  if (!res.ok) throw new Error(authority + " lookup failed (HTTP " + res.status + ")");
  return parseResults(authority, await res.json());
}
