import { isTeiElement, nearestAncestor, walk } from "./tei-document.js";
import { contentDigest } from "./content-digest.js";

export const REVIEW_FINGERPRINT_PREFIX = "urn:teicrafter:review-scope:v1:sha256:";
const cache = new WeakMap();

function evidenceIndex(doc) {
  if (cache.has(doc)) return cache.get(doc);
  const pages = new Map(), revisions = [], ends = new Map(), digests = new Map();
  walk(doc.root, (node) => {
    if (isTeiElement(node, "revisionDesc")) revisions.push(node);
    if (!isTeiElement(node, "pb")) return;
    const owner = nearestAncestor(node, (element) => isTeiElement(element, "text"))
      || nearestAncestor(node, (element) => isTeiElement(element, "TEI"));
    if (!owner) return;
    if (!pages.has(owner)) pages.set(owner, []);
    pages.get(owner).push(node);
  });
  for (const [owner, nodes] of pages) nodes.forEach((node, index) => {
    ends.set(node, nodes[index + 1]?.outerStart ?? owner.contentEnd ?? owner.outerEnd);
  });
  const index = { revisions, ends, digests };
  cache.set(doc, index);
  return index;
}

/** A page extends to the next pb; containers cover their XML, excluding revision history. */
export function reviewFingerprint(doc, anchor) {
  const index = evidenceIndex(doc);
  if (index.digests.has(anchor)) return index.digests.get(anchor);
  const start = anchor.outerStart;
  const end = isTeiElement(anchor, "pb") ? index.ends.get(anchor) : anchor.outerEnd;
  if (start == null || end == null) return null;
  let raw = doc.raw.slice(start, end);
  for (const revision of [...index.revisions].reverse()) {
    if (revision.outerStart >= start && revision.outerEnd <= end) {
      raw = raw.slice(0, revision.outerStart - start) + raw.slice(revision.outerEnd - start);
    }
  }
  const fingerprint = REVIEW_FINGERPRINT_PREFIX + contentDigest(raw);
  index.digests.set(anchor, fingerprint);
  return fingerprint;
}
