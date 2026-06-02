#!/usr/bin/env python3
"""
Deterministic folio extractor for the Wenzelsbibel codex.

Slices small, self-contained folio fixtures out of the full codex-2759.xml
(~78 MB, ONB, NOT in this repo) so the eval harness has realistic test material.
Each fixture is its own reference: a lossless round-trip must reproduce it.

The real codex is third-party material; its derived fixtures must stay LOCAL and
go to the gitignored test/fixtures/ tree. This tool is the ONLY thing that reads
the big file; run it once when the codex is available.

Assumptions about the codex structure (documented so they can be adjusted):
  - <facsimile> holds one <surface xml:id="..."> per folio, in document order.
  - <text>/<body> is a stream whose folios are delimited by <pb facs="#surfaceId"/>;
    the elements between one <pb> and the next belong to that folio.
  - <standOff> holds apparatus entries that point into the text via @target/@corresp.

Usage
  python extract_folio.py --codex /path/to/codex-2759.xml --surfaces 1 \
         --name codex-folio-S001 --out test/fixtures/wb
  python extract_folio.py --codex ... --first 5  --name codex-folio-S001-S005 --out ...
  python extract_folio.py --codex ... --first 40 --name codex-folio-large      --out ...

Add --sch /path/to/Bilderfassung.sch to copy the project Schematron next to the fixtures.
"""
import argparse
import copy
import json
import os
import re
import sys

try:
    from lxml import etree
except ImportError:
    sys.stderr.write("ERROR: lxml is required (pip install lxml).\n")
    sys.exit(4)

TEI_NS = "http://www.tei-c.org/ns/1.0"
XML_ID = "{http://www.w3.org/XML/1998/namespace}id"
NS = {"t": TEI_NS}
POINTER_ATTRS = ("target", "corresp", "facs")
TRACKED = ["surface", "zone", "standOff", "note", "w", "lb", "l", "pb"]
REF_RE = re.compile(r"#([\w.\-:]+)")


def ln(el):
    return etree.QName(el).localname if isinstance(el.tag, str) else None


def refs_of(value):
    return REF_RE.findall(value or "")


def collect_ids(elem):
    ids = set()
    for e in elem.iter():
        if isinstance(e.tag, str) and e.get(XML_ID):
            ids.add(e.get(XML_ID))
    return ids


def main():
    ap = argparse.ArgumentParser(description="Slice folio fixtures from codex-2759.xml")
    ap.add_argument("--codex", required=True, help="path to the full codex-2759.xml (local only)")
    ap.add_argument("--out", required=True, help="output directory (use test/fixtures/wb, gitignored)")
    ap.add_argument("--name", required=True, help="fixture base name, e.g. codex-folio-S001")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--surfaces", type=int, nargs="+", help="1-based surface indices to include")
    g.add_argument("--first", type=int, help="include the first N surfaces")
    ap.add_argument("--sch", help="path to Bilderfassung.sch to copy next to the fixture")
    args = ap.parse_args()

    if not os.path.isfile(args.codex):
        sys.stderr.write(f"ERROR: codex not found: {args.codex}\n")
        sys.exit(4)
    os.makedirs(args.out, exist_ok=True)

    sys.stderr.write(f"Parsing {args.codex} ...\n")
    tree = etree.parse(args.codex)  # full parse; libxml2 handles ~78 MB. Use iterparse if RAM-bound.
    root = tree.getroot()

    surfaces = root.findall(".//t:facsimile/t:surface", NS)
    if not surfaces:
        sys.stderr.write("ERROR: no <surface> elements found under <facsimile>.\n")
        sys.exit(4)
    idxs = list(range(1, args.first + 1)) if args.first else sorted(set(args.surfaces))
    idxs = [i for i in idxs if 1 <= i <= len(surfaces)]
    if not idxs:
        sys.stderr.write("ERROR: requested surface indices out of range.\n")
        sys.exit(4)
    chosen = [surfaces[i - 1] for i in idxs]
    chosen_ids = {s.get(XML_ID) for s in chosen if s.get(XML_ID)}
    sys.stderr.write(f"Selecting {len(chosen)} surface(s): {sorted(chosen_ids)}\n")

    body = root.find(".//t:text/t:body", NS)
    if body is None:
        sys.stderr.write("ERROR: no <text>/<body> found.\n")
        sys.exit(4)

    # Walk body's direct children; <pb> switches current folio. Keep children whose
    # current folio is a chosen surface.
    kept_children, current = [], None
    for child in body:
        if ln(child) == "pb":
            facs = (child.get("facs") or "").lstrip("#")
            current = facs
        if current in chosen_ids:
            kept_children.append(child)
    if not kept_children:
        sys.stderr.write("WARNING: no body children matched the chosen surfaces "
                         "(structure assumption may differ; inspect the codex).\n")

    kept_ids = set()
    for c in kept_children:
        kept_ids |= collect_ids(c)

    # Keep standOff entries that point into the kept text.
    standoff = root.find(".//t:standOff", NS)
    kept_notes = []
    if standoff is not None:
        for note in standoff:
            if not isinstance(note.tag, str):
                continue
            pointed = []
            for a in POINTER_ATTRS:
                pointed += refs_of(note.get(a))
            if any(r in kept_ids for r in pointed):
                kept_notes.append(note)

    # Build the standalone TEI fixture.
    out_root = etree.Element("{%s}TEI" % TEI_NS, nsmap={None: TEI_NS})
    header = root.find("t:teiHeader", NS)
    if header is not None:
        out_root.append(copy.deepcopy(header))
    if kept_notes:
        so = etree.SubElement(out_root, "{%s}standOff" % TEI_NS)
        for n in kept_notes:
            so.append(copy.deepcopy(n))
    facs_el = etree.SubElement(out_root, "{%s}facsimile" % TEI_NS)
    for s in chosen:
        facs_el.append(copy.deepcopy(s))
    text_el = etree.SubElement(out_root, "{%s}text" % TEI_NS)
    body_el = etree.SubElement(text_el, "{%s}body" % TEI_NS)
    for c in kept_children:
        body_el.append(copy.deepcopy(c))

    out_tree = etree.ElementTree(out_root)
    xml_bytes = etree.tostring(out_tree, xml_declaration=True, encoding="UTF-8", pretty_print=False)
    # Preserve the project Schematron binding so L2 can find it.
    pi = b'<?xml-model href="Bilderfassung.sch" type="application/xml" schematypens="http://purl.oclc.org/dsdl/schematron"?>\n'
    decl_end = xml_bytes.index(b"?>") + 2
    xml_bytes = xml_bytes[:decl_end] + b"\n" + pi + xml_bytes[decl_end:].lstrip(b"\n")

    out_xml = os.path.join(args.out, args.name + ".xml")
    with open(out_xml, "wb") as fh:
        fh.write(xml_bytes)

    counts = {t: 0 for t in TRACKED}
    for e in out_root.iter():
        l = ln(e)
        if l in counts:
            counts[l] += 1
    manifest = {
        "fixtureId": args.name,
        "file": args.name + ".xml",
        "synthetic": False,
        "derivedFrom": "codex-2759.xml (ONB, LOCAL ONLY, do not commit)",
        "surfaces": sorted(chosen_ids),
        "schema": {"sch": "Bilderfassung.sch", "rng": "test/schemas/tei_all.rng"},
        "counts": counts,
        "namespaces": {"default": TEI_NS, "xml": "http://www.w3.org/XML/1998/namespace"},
    }
    with open(os.path.join(args.out, args.name + ".manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)

    if args.sch and os.path.isfile(args.sch):
        import shutil
        shutil.copyfile(args.sch, os.path.join(args.out, "Bilderfassung.sch"))

    sys.stderr.write(f"Wrote {out_xml}\n  counts: {counts}\n  notes kept: {len(kept_notes)}\n")
    print(out_xml)


if __name__ == "__main__":
    main()
