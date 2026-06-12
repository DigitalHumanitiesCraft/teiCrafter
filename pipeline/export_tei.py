#!/usr/bin/env python3
"""SZD Page-JSON v0.2 -> teiCrafter-target TEI (deterministic).

Faithful Python port of test/tools/szd-pagejson-to-tei.mjs (the reference
prototype, spec-by-example). Same input, byte-identical output. The contract is
knowledge/converter-reference.md.

The conversion is a rule, never an LLM: the transcription is already in
pages[].text. Output is byte-identical round-trippable by the teiCrafter engine
(proven by the prototype, which round-trips its output through edition.js; this
port is verified byte-equal to the prototype, see test/tools/port_parity.mjs).

Usage:
  python pipeline/export_tei.py <in_page.json> <out.xml>
  python pipeline/export_tei.py --id <object_id> --out <dir> [--root <results_dir>]
  python pipeline/export_tei.py --all [--out <dir>] [--root <results_dir>]

The --all form converts every o_szd.*_page.json under <results_dir> (default
SZD_DIR or ../../szd-htr/results) to <out>/<folder>__<id>.xml; the folder prefix
keeps the duplicate id o_szd.161 (two folders) from colliding. This is M1.5;
verify the result with test/tools/szd_loadability_sweep.mjs.

The --id form resolves <object_id> to a single Page-JSON under <results_dir>;
ambiguous ids (the same id in two folders, e.g. o_szd.161) are a hard error,
listing the candidates, because the converter must not silently pick one.
"""
import json
import math
import os
import sys
import unicodedata

# --- escaping (mirror escText/escAttr in the prototype, & first) -------------
def esc_text(s):
    s = "" if s is None else str(s)
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def esc_attr(s):
    return esc_text(s).replace('"', "&quot;")

def js_round(v):
    # JS Math.round: round half toward +Infinity. All bbox products are >= 0,
    # so floor(v + 0.5) reproduces it exactly (Python round() is banker's).
    return math.floor(v + 0.5)

def slug(s):
    s = "" if s is None else str(s)
    s = unicodedata.normalize("NFKD", s)
    out = []
    for ch in s:
        # JS strips exactly U+0300..U+036F (combining diacritical marks block)
        if "̀" <= ch <= "ͯ":
            continue
        out.append(ch)
    s = "".join(out).lower()
    # non-[a-z0-9] runs -> single underscore, trim leading/trailing underscores
    res = []
    prev_us = False
    for ch in s:
        if ("a" <= ch <= "z") or ("0" <= ch <= "9"):
            res.append(ch)
            prev_us = False
        else:
            if not prev_us:
                res.append("_")
            prev_us = True
    slugged = "".join(res).strip("_")
    return slugged or "x"


def page_json_to_tei(pj):
    src = pj.get("source") or {}
    dm = src.get("descriptive_metadata") or {}
    prov = pj.get("provenance") or {}
    pages = pj.get("pages") or []

    # --- persons (standOff) from descriptive_metadata.creator ----------------
    persons = []
    for c in (dm.get("creator") or []):
        persons.append({
            "id": "pers_" + slug(c.get("name")),
            "name": c.get("name"),
            "gnd": c.get("gnd") or None,
        })

    def person_block(p):
        s = (
            '      <person xml:id="' + esc_attr(p["id"]) + '">\n'
            "        <persName>" + esc_text(p["name"]) + "</persName>\n"
        )
        if p["gnd"]:
            s += '        <idno type="GND">' + esc_text(p["gnd"]) + "</idno>\n"
        s += "      </person>"
        return s

    person_xml = "\n".join(person_block(p) for p in persons)

    # --- facsimile: one surface per page (graphic + zones from bboxes) -------
    def zones_for(page):
        w = page.get("image_width")
        h = page.get("image_height")
        if not w or not h or not isinstance(page.get("regions"), list):
            return []
        zs = []
        for r in page["regions"]:
            x, y, bw, bh = r["bbox"]
            ulx = js_round((x / 100) * w)
            uly = js_round((y / 100) * h)
            lrx = js_round(((x + bw) / 100) * w)
            lry = js_round(((y + bh) / 100) * h)
            t = (' type="' + esc_attr(r["type"]) + '"') if r.get("type") else ""
            zs.append(
                '      <zone xml:id="z_' + str(page["page"]) + "_" + esc_attr(r["id"])
                + '" ulx="' + str(ulx) + '" uly="' + str(uly)
                + '" lrx="' + str(lrx) + '" lry="' + str(lry) + '"' + t + "/>"
            )
        return zs

    images = src.get("images") or []
    surfaces = []
    for i, page in enumerate(pages):
        sid = "surf_" + str(page["page"])
        img = (images[i] if i < len(images) else None) or page.get("image") or ""
        zs = zones_for(page)
        if not zs and not img:
            continue
        w = page.get("image_width")
        h = page.get("image_height")
        dims = (' ulx="0" uly="0" lrx="' + str(w) + '" lry="' + str(h) + '"') if (w and h) else ""
        s = '    <surface xml:id="' + sid + '"' + dims + ">\n"
        if img:
            s += '      <graphic url="' + esc_attr(img) + '"/>\n'
        if zs:
            s += "\n".join(zs) + "\n"
        s += "    </surface>"
        surfaces.append(s)

    def has_surface(page):
        needle = 'xml:id="surf_' + str(page["page"]) + '"'
        return any(needle in s for s in surfaces)

    # --- body: pb per page; text -> <p> by blank line, <lb/> per line --------
    def body_for_page(page):
        sid = "surf_" + str(page["page"])
        pb = (
            '      <pb n="' + esc_attr(page["page"]) + '"'
            + (' facs="#' + sid + '"' if has_surface(page) else "")
            + "/>"
        )
        text = (page.get("text") or "").replace("\r\n", "\n")
        if not text.strip():
            return pb
        import re
        paras = re.split(r"\n{2,}", text)
        out = []
        for para in paras:
            inner = "\n        ".join("<lb/>" + esc_text(ln) for ln in para.split("\n"))
            out.append("      <p>\n        " + inner + "\n      </p>")
        return pb + "\n" + "\n".join(out)

    body = "\n".join(body_for_page(p) for p in pages)

    # --- header from descriptive metadata ------------------------------------
    title = src.get("title") or src.get("id") or "Untitled"
    resp_list = "\n".join(
        "        <respStmt><resp>contributor</resp><persName>"
        + esc_text(p["name"]) + "</persName></respStmt>"
        for p in persons
    )
    rights = dm.get("rights") or ""
    holding = dm.get("holding") or {}
    repo = (holding.get("repository") if holding else None) or src.get("repository") or ""
    shelf = src.get("shelfmark") or ""
    lang = src.get("language") or "und"
    review = pj.get("review") or {}
    review_status = review.get("status") if (review and review.get("status")) else "unreviewed"
    model = prov.get("model") or "unknown model"

    pub_p = (
        "Machine-generated TEI from szd-htr Page-JSON (" + esc_text(model)
        + "). Structure unreviewed; transcription " + esc_text(review_status) + "."
        + ((" Rights: " + esc_text(rights) + ".") if rights else "")
    )
    ms_inner = ""
    if repo:
        ms_inner += "\n            <repository>" + esc_text(repo) + "</repository>"
    if shelf:
        ms_inner += '\n            <idno type="shelfmark">' + esc_text(shelf) + "</idno>"

    header = (
        "  <teiHeader>\n"
        "    <fileDesc>\n"
        "      <titleStmt>\n"
        "        <title>" + esc_text(title) + "</title>\n"
        + ((resp_list + "\n") if resp_list else "")
        + "      </titleStmt>\n"
        "      <publicationStmt>\n"
        "        <p>" + pub_p + "</p>\n"
        "      </publicationStmt>\n"
        "      <sourceDesc>\n"
        "        <msDesc>\n"
        "          <msIdentifier>" + ms_inner + "\n"
        '            <idno type="objectId">' + esc_text(src.get("id") or "") + "</idno>\n"
        "          </msIdentifier>\n"
        "        </msDesc>\n"
        "      </sourceDesc>\n"
        "    </fileDesc>\n"
        "    <profileDesc>\n"
        '      <langUsage><language ident="' + esc_attr(lang) + '"/></langUsage>\n'
        "    </profileDesc>\n"
        "  </teiHeader>"
    )

    facsimile = ("  <facsimile>\n" + "\n".join(surfaces) + "\n  </facsimile>\n") if surfaces else ""
    stand_off = (
        "  <standOff>\n    <listPerson>\n" + person_xml + "\n    </listPerson>\n  </standOff>\n"
        if persons else ""
    )

    tei = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<TEI xmlns="http://www.tei-c.org/ns/1.0">\n'
        + header + "\n"
        + stand_off + facsimile + "  <text>\n"
        "    <body>\n"
        '      <div type="document" n="' + esc_attr(src.get("id") or "") + '">\n'
        + body + "\n"
        "      </div>\n"
        "    </body>\n"
        "  </text>\n"
        "</TEI>\n"
    )
    return tei


def resolve_id(object_id, root):
    target = object_id + "_page.json"
    hits = []
    for dirpath, _dirs, files in os.walk(root):
        if target in files:
            hits.append(os.path.join(dirpath, target))
    if not hits:
        sys.exit("no Page-JSON found for id %r under %s" % (object_id, root))
    if len(hits) > 1:
        sys.exit(
            "ambiguous id %r resolves to %d files; pass an explicit path instead:\n  %s"
            % (object_id, len(hits), "\n  ".join(hits))
        )
    return hits[0]


def convert_file(in_path, out_path):
    with open(in_path, "r", encoding="utf-8") as f:
        pj = json.load(f)
    tei = page_json_to_tei(pj)
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        f.write(tei)
    return tei


def convert_all(root, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    inputs = []
    for dirpath, _dirs, files in os.walk(root):
        for f in files:
            if f.startswith("o_szd.") and f.endswith("_page.json"):
                inputs.append(os.path.join(dirpath, f))
    inputs.sort()
    for p in inputs:
        folder = os.path.basename(os.path.dirname(p))
        oid = os.path.basename(p)[:-len("_page.json")]
        convert_file(p, os.path.join(out_dir, folder + "__" + oid + ".xml"))
    return len(inputs)


def main(argv):
    args = argv[1:]
    if not args:
        sys.exit(__doc__)
    if args[0] == "--all":
        out_dir = "output/szd-tei"
        root = os.environ.get("SZD_DIR", "../../szd-htr/results")
        i = 0
        while i < len(args):
            a = args[i]
            if a == "--all":
                i += 1
            elif a == "--out":
                out_dir = args[i + 1]; i += 2
            elif a == "--root":
                root = args[i + 1]; i += 2
            else:
                sys.exit("unknown argument: " + a)
        n = convert_all(root, out_dir)
        print("converted %d objects -> %s" % (n, out_dir))
        return
    if args[0] == "--id":
        object_id = None
        out_dir = "output"
        root = os.environ.get("SZD_DIR", "../../szd-htr/results")
        i = 0
        while i < len(args):
            a = args[i]
            if a == "--id":
                object_id = args[i + 1]; i += 2
            elif a == "--out":
                out_dir = args[i + 1]; i += 2
            elif a == "--root":
                root = args[i + 1]; i += 2
            else:
                sys.exit("unknown argument: " + a)
        if not object_id:
            sys.exit("--id requires an object id")
        in_path = resolve_id(object_id, root)
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, object_id + ".xml")
        convert_file(in_path, out_path)
        print(out_path)
    else:
        if len(args) < 2:
            sys.exit("usage: python export_tei.py <in_page.json> <out.xml>")
        convert_file(args[0], args[1])
        print(args[1])


if __name__ == "__main__":
    main(sys.argv)
