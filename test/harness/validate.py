#!/usr/bin/env python3
"""
teiCrafter validation harness ("the other side").

Grades a candidate TEI document against a reference fixture and emits a
machine-readable report (JSON) that is the feedback signal for the round-trip
eval loop.

Levels
  L1  text/word fidelity   every <w> text preserved in document order
  L3  structural invariants counts, namespace, pointer integrity
  L2  real schema validity  TEI All RelaxNG + project Schematron (lxml)

MVP gate (current milestone): well-formed AND L1 pass AND L3 counts preserved.
L2 is always reported (full L1/L2/L3 breakdown) but does not gate yet; for a
round-trip it is scored as a DIFF (errors the candidate introduces vs the input),
because the raw codex may not be tei_all-valid as-is.

Usage
  python validate.py --input REF.xml --candidate CAND.xml
                     [--manifest M.json] [--sch S.sch] [--rng tei_all.rng]
                     [--json-out OUT.json] [--quiet]

Exit codes: 0 gate pass, 2 gate fail, 3 candidate not well-formed, 4 usage/IO error.
"""
import argparse
import difflib
import json
import sys

try:
    from lxml import etree
    from lxml.isoschematron import Schematron
except ImportError:
    sys.stderr.write("ERROR: lxml is required (pip install lxml). isoschematron ships with lxml.\n")
    sys.exit(4)

TEI_NS = "http://www.tei-c.org/ns/1.0"
XML_ID = "{http://www.w3.org/XML/1998/namespace}id"
TRACKED_TAGS = ["surface", "zone", "standOff", "note", "w", "lb", "l", "pb"]
POINTER_ATTRS = ["target", "corresp", "facs"]


def localname(el):
    tag = el.tag
    if not isinstance(tag, str):  # comments / PIs inside the tree
        return None
    return etree.QName(el).localname


def parse(path):
    """Return (tree, None) or (None, error_message)."""
    try:
        return etree.parse(path), None
    except (etree.XMLSyntaxError, OSError) as exc:
        return None, str(exc)


def word_texts(root):
    """Ordered list of normalized text content of every <w> element."""
    out = []
    for el in root.iter():
        if localname(el) == "w":
            out.append(" ".join("".join(el.itertext()).split()))
    return out


def count_tags(root):
    counts = {t: 0 for t in TRACKED_TAGS}
    for el in root.iter():
        ln = localname(el)
        if ln in counts:
            counts[ln] += 1
    return counts


def collect_ids(root):
    ids = set()
    for el in root.iter():
        if not isinstance(el.tag, str):
            continue
        v = el.get(XML_ID)
        if v:
            ids.add(v)
    return ids


def extract_refs(value):
    """Pull '#id' references out of a pointer value (handles range(#a,#b), space lists)."""
    refs = []
    for token in value.replace(",", " ").split():
        idx = 0
        while True:
            h = token.find("#", idx)
            if h == -1:
                break
            j = h + 1
            while j < len(token) and (token[j].isalnum() or token[j] in "._-:"):
                j += 1
            if j > h + 1:
                refs.append(token[h + 1:j])
            idx = j
    return refs


def check_pointers(root, ids):
    dangling = []
    for el in root.iter():
        if not isinstance(el.tag, str):
            continue
        for attr in POINTER_ATTRS:
            val = el.get(attr)
            if not val:
                continue
            for ref in extract_refs(val):
                if ref not in ids:
                    dangling.append({"element": localname(el), "attr": attr, "ref": ref})
    return dangling


def root_default_ns(tree):
    return tree.getroot().nsmap.get(None)


def l1_fidelity(in_root, cand_root):
    """Compare the ordered <w> text of input vs candidate via sequence alignment,
    so a deletion/insertion is localized to the actual edit site (not the tail)."""
    a, b = word_texts(in_root), word_texts(cand_root)
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    first_div, lost, added = None, [], []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            continue
        if first_div is None:
            first_div = {
                "index": i1,
                "input": a[i1] if i1 < i2 else None,
                "candidate": b[j1] if j1 < j2 else None,
                "op": op,
            }
        if op in ("delete", "replace"):
            lost.extend(a[i1:i2])
        if op in ("insert", "replace"):
            added.extend(b[j1:j2])
    return {
        "pass": a == b,
        "weight": 40,
        "wCountInput": len(a),
        "wCountCandidate": len(b),
        "firstDivergence": first_div,
        "lostWords": lost[:20],
        "addedWords": added[:20],
    }


def l3_invariants(in_root, cand_root, manifest):
    in_counts = count_tags(in_root)
    cand_counts = count_tags(cand_root)
    expected = (manifest or {}).get("counts")
    counts = {}
    preserved = True
    for t in TRACKED_TAGS:
        entry = {"input": in_counts[t], "candidate": cand_counts[t]}
        if expected is not None and t in expected:
            entry["expected"] = expected[t]
        entry["delta"] = cand_counts[t] - in_counts[t]
        if entry["delta"] != 0:
            preserved = False
        counts[t] = entry
    ns_ok = root_default_ns(in_root.getroottree()) == TEI_NS == root_default_ns(cand_root.getroottree())
    ids = collect_ids(cand_root)
    dangling = check_pointers(cand_root, ids)
    return {
        "pass": preserved and ns_ok and len(dangling) == 0,
        "weight": 25,
        "countsPreserved": preserved,
        "counts": counts,
        "namespaceOk": ns_ok,
        "danglingPointers": dangling,
    }


def schema_messages(tree, rng_path, sch_path):
    out = {"rng": None, "sch": None}
    if rng_path:
        try:
            rng = etree.RelaxNG(etree.parse(rng_path))
            valid = rng.validate(tree)
            out["rng"] = {"valid": bool(valid),
                          "errors": [{"line": e.line, "message": e.message} for e in rng.error_log]}
        except (etree.XMLSyntaxError, etree.RelaxNGError, OSError) as exc:
            out["rng"] = {"valid": None, "engineError": str(exc)}
    if sch_path:
        try:
            sct = Schematron(etree.parse(sch_path), store_report=True)
            valid = sct.validate(tree)
            out["sch"] = {"valid": bool(valid),
                          "engine": "lxml-isoschematron-xslt1",
                          "failures": [e.message for e in sct.error_log]}
        except (etree.XMLSyntaxError, OSError, Exception) as exc:  # XSLT2 sch -> engine gap
            out["sch"] = {"valid": None, "engine": "unsupported",
                          "engineError": str(exc),
                          "hint": "If the .sch uses XSLT2, run via Saxon (pip install saxonche)."}
    return out


def l2_schema(in_tree, cand_tree, cand_wellformed, rng_path, sch_path):
    res = {"weight": 35, "wellFormed": cand_wellformed}
    if not (rng_path or sch_path):
        res.update({"skipped": True, "rng": "skipped", "sch": "skipped"})
        return res
    cand = schema_messages(cand_tree, rng_path, sch_path)
    base = schema_messages(in_tree, rng_path, sch_path) if in_tree is not None else {"rng": None, "sch": None}
    # round-trip diff: errors the candidate introduces that the input did not have
    new_rng, new_sch = [], []
    if cand.get("rng") and cand["rng"].get("errors") is not None:
        base_msgs = {e["message"] for e in (base.get("rng") or {}).get("errors", [])} if base.get("rng") else set()
        new_rng = [e for e in cand["rng"]["errors"] if e["message"] not in base_msgs]
    if cand.get("sch") and cand["sch"].get("failures") is not None:
        base_msgs = set((base.get("sch") or {}).get("failures", [])) if base.get("sch") else set()
        new_sch = [m for m in cand["sch"]["failures"] if m not in base_msgs]
    res.update({"rng": cand.get("rng"), "sch": cand.get("sch"),
                "newErrorsVsInput": {"rng": new_rng, "sch": new_sch}})
    return res


def score(levels):
    earned = total = 0
    for key in ("L1", "L2", "L3"):
        lv = levels.get(key) or {}
        w = lv.get("weight", 0)
        total += w
        if lv.get("skipped"):
            total -= w
            continue
        if key == "L1":
            ratio = 1.0 if lv.get("pass") else (
                min(lv.get("wCountCandidate", 0), lv.get("wCountInput", 0)) / lv["wCountInput"]
                if lv.get("wCountInput") else 0.0)
            earned += w * ratio
        elif key == "L3":
            sub = [lv.get("countsPreserved"), lv.get("namespaceOk"), len(lv.get("danglingPointers", [])) == 0]
            earned += w * (sum(1 for x in sub if x) / len(sub))
        elif key == "L2":
            ne = lv.get("newErrorsVsInput", {})
            earned += w if not ne.get("rng") and not ne.get("sch") else 0
    return round(100 * earned / total) if total else 0


def main():
    ap = argparse.ArgumentParser(description="teiCrafter L1/L2/L3 validation harness")
    ap.add_argument("--input", required=True, help="reference fixture (the round-trip baseline)")
    ap.add_argument("--candidate", required=True, help="candidate produced by the round-trip")
    ap.add_argument("--manifest", help="manifest.json with expected counts")
    ap.add_argument("--rng", help="TEI All RelaxNG schema")
    ap.add_argument("--sch", help="project Schematron")
    ap.add_argument("--json-out", help="write the report JSON here")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    manifest = None
    if args.manifest:
        try:
            with open(args.manifest, encoding="utf-8") as fh:
                manifest = json.load(fh)
        except (OSError, json.JSONDecodeError) as exc:
            sys.stderr.write(f"ERROR reading manifest: {exc}\n")
            sys.exit(4)

    in_tree, in_err = parse(args.input)
    if in_err:
        sys.stderr.write(f"ERROR: input not well-formed: {in_err}\n")
        sys.exit(4)
    cand_tree, cand_err = parse(args.candidate)

    report = {
        "schemaVersion": "tcr-eval/1",
        "fixtureId": (manifest or {}).get("fixtureId"),
        "input": args.input,
        "candidate": args.candidate,
    }

    if cand_err:
        report.update({
            "levels": {"L2": {"wellFormed": False, "error": cand_err}},
            "gates": {"wellFormed": "fail"},
            "verdict": "fail", "score": 0,
            "topIssues": [{"level": "L2", "message": f"candidate not well-formed: {cand_err}"}],
        })
        _emit(report, args)
        sys.exit(3)

    in_root, cand_root = in_tree.getroot(), cand_tree.getroot()
    l1 = l1_fidelity(in_root, cand_root)
    l3 = l3_invariants(in_root, cand_root, manifest)
    l2 = l2_schema(in_tree, cand_tree, True, args.rng, args.sch)
    levels = {"L1": l1, "L2": l2, "L3": l3}

    gate = bool(l1["pass"] and l3["countsPreserved"])  # well-formed already true here
    top = []
    if not l1["pass"] and l1["firstDivergence"]:
        top.append({"level": "L1", "message": "word fidelity broken", "detail": l1["firstDivergence"]})
    if not l3["countsPreserved"]:
        changed = {t: c["delta"] for t, c in l3["counts"].items() if c["delta"]}
        top.append({"level": "L3", "message": "structural counts changed", "detail": changed})
    if l3["danglingPointers"]:
        top.append({"level": "L3", "message": "dangling pointers", "detail": l3["danglingPointers"][:5]})
    for m in l2.get("newErrorsVsInput", {}).get("sch", [])[:3]:
        top.append({"level": "L2", "engine": "schematron", "message": m})
    for e in l2.get("newErrorsVsInput", {}).get("rng", [])[:3]:
        top.append({"level": "L2", "engine": "relaxng", "message": e.get("message")})

    report.update({
        "levels": levels,
        "gates": {"wellFormed": "pass",
                  "textFidelity": "pass" if l1["pass"] else "fail",
                  "countsPreserved": "pass" if l3["countsPreserved"] else "fail"},
        "score": score(levels),
        "threshold": 95,
        "verdict": "pass" if gate else "fail",
        "topIssues": top,
    })
    _emit(report, args)
    sys.exit(0 if gate else 2)


def _emit(report, args):
    text = json.dumps(report, indent=2, ensure_ascii=False)
    if args.json_out:
        try:
            with open(args.json_out, "w", encoding="utf-8") as fh:
                fh.write(text + "\n")
        except OSError as exc:
            sys.stderr.write(f"ERROR writing json-out: {exc}\n")
    if not args.quiet:
        print(text)


if __name__ == "__main__":
    main()
