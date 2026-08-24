#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "lxml>=5,<6",
# ]
# ///
"""Validate a candidate TEI against a reference document.

L1 compares general reading text and the ordered content of every ``w``.
L2 reports Relax NG and Schematron differences; requested but unavailable
schema engines fail the gate. L3 checks structural counts, expanded element
names, TEI namespaces, and local pointer integrity.

Exit codes: 0 gate pass, 2 gate fail, 3 malformed candidate, 4 usage or I/O.
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import sys
import tempfile
from collections import Counter
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Any

try:
    from lxml import etree
    from lxml.isoschematron import Schematron
except ImportError:
    sys.stderr.write(
        "ERROR: lxml is required (use `uv run test/harness/validate.py ...`).\n"
    )
    raise SystemExit(4) from None


TEI_NS = "http://www.tei-c.org/ns/1.0"
XML_ID = "{http://www.w3.org/XML/1998/namespace}id"
SVRL_NS = "http://purl.oclc.org/dsdl/svrl"
TRACKED_TAGS = ["surface", "zone", "standOff", "note", "w", "lb", "l", "pb"]
POINTER_ATTRS = {
    "active",
    "ana",
    "copyOf",
    "corresp",
    "facs",
    "mutual",
    "next",
    "passive",
    "prev",
    "ref",
    "resp",
    "sameAs",
    "target",
    "who",
}
LOCAL_POINTER = re.compile(r"(?<![\w:/?=&])#([A-Za-z_][A-Za-z0-9._:-]*)")


def localname(element: etree._Element) -> str | None:
    """Return the local element name, excluding comments and PIs."""
    if not isinstance(element.tag, str):
        return None
    return etree.QName(element).localname


def parse(path: Path | str) -> tuple[etree._ElementTree | None, str | None]:
    """Parse XML without network access or external entity resolution."""
    parser = etree.XMLParser(resolve_entities=False, no_network=True, huge_tree=False)
    try:
        return etree.parse(str(path), parser), None
    except (etree.XMLSyntaxError, OSError) as error:
        return None, str(error)


def reading_root(root: etree._Element) -> etree._Element:
    """Select the TEI body, then text, with a root fallback for fragments."""
    for wanted in ("body", "text"):
        for element in root.iter():
            if localname(element) == wanted:
                return element
    return root


def reading_text(root: etree._Element) -> str:
    """Return all reading-layer characters in document order."""
    return "".join(reading_root(root).itertext())


def word_texts(root: etree._Element) -> list[str]:
    """Return exact text content of every ``w`` in document order."""
    return ["".join(element.itertext()) for element in root.iter() if localname(element) == "w"]


def count_tags(root: etree._Element) -> dict[str, int]:
    """Count tracked local element names."""
    counts = dict.fromkeys(TRACKED_TAGS, 0)
    for element in root.iter():
        name = localname(element)
        if name in counts:
            counts[name] += 1
    return counts


def expanded_name_counts(root: etree._Element) -> Counter[str]:
    """Count every element by expanded QName."""
    return Counter(element.tag for element in root.iter() if isinstance(element.tag, str))


def collect_ids(root: etree._Element) -> tuple[set[str], list[str]]:
    """Collect XML IDs and repeated occurrences."""
    identifiers: set[str] = set()
    duplicates: list[str] = []
    for element in root.iter():
        if not isinstance(element.tag, str):
            continue
        value = element.get(XML_ID)
        if not value:
            continue
        if value in identifiers:
            duplicates.append(value)
        identifiers.add(value)
    return identifiers, duplicates


def extract_refs(value: str) -> list[str]:
    """Extract document-local fragment references without treating URI fragments as local."""
    return LOCAL_POINTER.findall(value)


def check_pointers(root: etree._Element, identifiers: set[str]) -> list[dict[str, str]]:
    """Report unresolved local references in TEI pointer attributes."""
    dangling: list[dict[str, str]] = []
    for element in root.iter():
        if not isinstance(element.tag, str):
            continue
        for attribute_name, value in element.attrib.items():
            attribute_localname = etree.QName(attribute_name).localname
            if attribute_localname not in POINTER_ATTRS:
                continue
            for reference in extract_refs(value):
                if reference not in identifiers:
                    dangling.append(
                        {
                            "element": localname(element) or "",
                            "attr": attribute_localname,
                            "ref": reference,
                        }
                    )
    return dangling


def root_namespace(root: etree._Element) -> str | None:
    """Return the root expanded-name namespace, independent of prefix choice."""
    if not isinstance(root.tag, str):
        return None
    return etree.QName(root).namespace


def _first_character_divergence(left: str, right: str) -> dict[str, Any] | None:
    if left == right:
        return None
    index = 0
    limit = min(len(left), len(right))
    while index < limit and left[index] == right[index]:
        index += 1
    return {
        "index": index,
        "input": left[index] if index < len(left) else None,
        "candidate": right[index] if index < len(right) else None,
        "inputContext": left[max(0, index - 20) : index + 20],
        "candidateContext": right[max(0, index - 20) : index + 20],
    }


def l1_fidelity(input_root: etree._Element, candidate_root: etree._Element) -> dict[str, Any]:
    """Compare both general reading text and word-level content exactly."""
    input_words = word_texts(input_root)
    candidate_words = word_texts(candidate_root)
    matcher = difflib.SequenceMatcher(a=input_words, b=candidate_words, autojunk=False)
    first_word_divergence: dict[str, Any] | None = None
    lost: list[str] = []
    added: list[str] = []
    for operation, input_start, input_end, candidate_start, candidate_end in matcher.get_opcodes():
        if operation == "equal":
            continue
        if first_word_divergence is None:
            first_word_divergence = {
                "index": input_start,
                "input": input_words[input_start] if input_start < input_end else None,
                "candidate": (
                    candidate_words[candidate_start]
                    if candidate_start < candidate_end
                    else None
                ),
                "op": operation,
            }
        if operation in ("delete", "replace"):
            lost.extend(input_words[input_start:input_end])
        if operation in ("insert", "replace"):
            added.extend(candidate_words[candidate_start:candidate_end])

    input_text = reading_text(input_root)
    candidate_text = reading_text(candidate_root)
    text_matcher = difflib.SequenceMatcher(a=input_text, b=candidate_text, autojunk=False)
    word_ratio = matcher.ratio()
    return {
        "pass": input_text == candidate_text and input_words == candidate_words,
        "weight": 40,
        "mode": "general-reading-text-and-w",
        "readingTextLengthInput": len(input_text),
        "readingTextLengthCandidate": len(candidate_text),
        "fidelityRatio": text_matcher.ratio(),
        "wordFidelityRatio": word_ratio,
        "firstTextDivergence": _first_character_divergence(input_text, candidate_text),
        "wCountInput": len(input_words),
        "wCountCandidate": len(candidate_words),
        "firstDivergence": first_word_divergence,
        "lostWords": lost[:20],
        "addedWords": added[:20],
    }


def l3_invariants(
    input_root: etree._Element,
    candidate_root: etree._Element,
    manifest: Mapping[str, Any] | None,
) -> dict[str, Any]:
    """Evaluate structural, namespace, expanded-name, and pointer gates."""
    input_counts = count_tags(input_root)
    candidate_counts = count_tags(candidate_root)
    expected = (manifest or {}).get("counts")
    counts: dict[str, dict[str, int]] = {}
    preserved = True
    for tag in TRACKED_TAGS:
        entry = {
            "input": input_counts[tag],
            "candidate": candidate_counts[tag],
            "delta": candidate_counts[tag] - input_counts[tag],
        }
        if isinstance(expected, Mapping) and tag in expected:
            entry["expected"] = expected[tag]
        if entry["delta"] != 0:
            preserved = False
        counts[tag] = entry

    namespace_ok = root_namespace(input_root) == TEI_NS == root_namespace(candidate_root)
    input_names = expanded_name_counts(input_root)
    candidate_names = expanded_name_counts(candidate_root)
    names_preserved = input_names == candidate_names
    name_delta = {
        name: candidate_names[name] - input_names[name]
        for name in sorted(input_names.keys() | candidate_names.keys())
        if candidate_names[name] != input_names[name]
    }
    identifiers, duplicate_ids = collect_ids(candidate_root)
    dangling = check_pointers(candidate_root, identifiers)
    passed = preserved and namespace_ok and names_preserved and not duplicate_ids and not dangling
    return {
        "pass": passed,
        "weight": 25,
        "countsPreserved": preserved,
        "counts": counts,
        "namespaceOk": namespace_ok,
        "expandedNamesPreserved": names_preserved,
        "expandedNameDelta": name_delta,
        "duplicateXmlIds": duplicate_ids,
        "danglingPointers": dangling,
    }


def _schematron_failures(validator: Schematron) -> list[dict[str, str | None]]:
    report = validator.validation_report
    if report is None:
        return []
    failures: list[dict[str, str | None]] = []
    for failed in report.findall(f".//{{{SVRL_NS}}}failed-assert"):
        text = " ".join("".join(failed.itertext()).split())
        failures.append(
            {
                "location": failed.get("location"),
                "test": failed.get("test"),
                "role": failed.get("role"),
                "message": text,
            }
        )
    return failures


def schema_messages(
    tree: etree._ElementTree,
    rng_path: str | None,
    sch_path: str | None,
) -> dict[str, dict[str, Any] | None]:
    """Run requested schema engines and expose engine failures explicitly."""
    output: dict[str, dict[str, Any] | None] = {"rng": None, "sch": None}
    if rng_path:
        try:
            schema_parser = etree.XMLParser(resolve_entities=False, no_network=True, huge_tree=False)
            relax_ng = etree.RelaxNG(etree.parse(rng_path, schema_parser))
            valid = relax_ng.validate(tree)
            output["rng"] = {
                "valid": bool(valid),
                "errors": [
                    {"line": error.line, "path": error.path, "message": error.message}
                    for error in relax_ng.error_log
                ],
            }
        except (etree.XMLSyntaxError, etree.RelaxNGError, OSError) as error:
            output["rng"] = {"valid": None, "engineError": str(error)}
    if sch_path:
        try:
            schema_parser = etree.XMLParser(resolve_entities=False, no_network=True, huge_tree=False)
            schematron = Schematron(
                etree.parse(sch_path, schema_parser),
                store_report=True,
            )
            valid = schematron.validate(tree)
            output["sch"] = {
                "valid": bool(valid),
                "engine": "lxml-isoschematron-xslt1",
                "failures": _schematron_failures(schematron),
            }
        except (etree.LxmlError, OSError) as error:
            output["sch"] = {
                "valid": None,
                "engine": "unsupported",
                "engineError": str(error),
                "hint": "Use a supported ISO Schematron or an explicitly configured XSLT2 engine.",
            }
    return output


def _multiset_difference(
    candidate: Iterable[Mapping[str, Any]],
    baseline: Iterable[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    """Subtract diagnostic occurrences without collapsing duplicate errors."""
    baseline_counts = Counter(
        json.dumps(dict(item), sort_keys=True, ensure_ascii=False) for item in baseline
    )
    difference: list[dict[str, Any]] = []
    for item in candidate:
        key = json.dumps(dict(item), sort_keys=True, ensure_ascii=False)
        if baseline_counts[key]:
            baseline_counts[key] -= 1
        else:
            difference.append(dict(item))
    return difference


def l2_schema(
    input_tree: etree._ElementTree,
    candidate_tree: etree._ElementTree,
    rng_path: str | None,
    sch_path: str | None,
) -> dict[str, Any]:
    """Report schema results and errors newly introduced by the candidate."""
    result: dict[str, Any] = {"weight": 35, "wellFormed": True}
    requested = [name for name, path in (("rng", rng_path), ("sch", sch_path)) if path]
    result["requested"] = requested
    if not requested:
        result.update({"skipped": True, "available": True, "rng": "skipped", "sch": "skipped"})
        return result

    candidate = schema_messages(candidate_tree, rng_path, sch_path)
    baseline = schema_messages(input_tree, rng_path, sch_path)
    available = all(
        isinstance(candidate.get(name), Mapping)
        and candidate[name].get("valid") is not None
        and isinstance(baseline.get(name), Mapping)
        and baseline[name].get("valid") is not None
        for name in requested
    )
    new_rng = _multiset_difference(
        (candidate.get("rng") or {}).get("errors", []),
        (baseline.get("rng") or {}).get("errors", []),
    )
    new_sch = _multiset_difference(
        (candidate.get("sch") or {}).get("failures", []),
        (baseline.get("sch") or {}).get("failures", []),
    )
    result.update(
        {
            "available": available,
            "rng": candidate.get("rng"),
            "sch": candidate.get("sch"),
            "newErrorsVsInput": {"rng": new_rng, "sch": new_sch},
        }
    )
    return result


def score(levels: Mapping[str, Mapping[str, Any]]) -> int:
    """Calculate a score that cannot reward unavailable requested checks."""
    earned = 0.0
    total = 0.0
    for key in ("L1", "L2", "L3"):
        level = levels.get(key) or {}
        weight = float(level.get("weight", 0))
        if level.get("skipped"):
            continue
        total += weight
        if key == "L1":
            earned += weight * min(
                float(level.get("fidelityRatio", 0.0)),
                float(level.get("wordFidelityRatio", 0.0)),
            )
        elif key == "L3":
            subgates = [
                level.get("countsPreserved"),
                level.get("namespaceOk"),
                level.get("expandedNamesPreserved"),
                not level.get("duplicateXmlIds"),
                not level.get("danglingPointers"),
            ]
            earned += weight * (sum(bool(value) for value in subgates) / len(subgates))
        elif key == "L2" and level.get("available"):
            new_errors = level.get("newErrorsVsInput", {})
            if not new_errors.get("rng") and not new_errors.get("sch"):
                earned += weight
    return round(100 * earned / total) if total else 0


def _load_manifest(path: str | None) -> Mapping[str, Any] | None:
    if not path:
        return None
    with Path(path).open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, Mapping):
        raise ValueError("manifest root must be an object")
    return value


def _emit(report: Mapping[str, Any], args: argparse.Namespace) -> None:
    """Emit JSON and atomically replace a requested report file."""
    text = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if args.json_out:
        target = Path(args.json_out)
        target.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{target.name}.", suffix=".tmp", dir=target.parent
        )
        temporary = Path(temporary_name)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as handle:
                handle.write(text)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, target)
        except BaseException:
            temporary.unlink(missing_ok=True)
            raise
    if not args.quiet:
        print(text, end="")


def main() -> int:
    """Run the validation CLI."""
    parser = argparse.ArgumentParser(description="teiCrafter L1/L2/L3 validation harness")
    parser.add_argument("--input", required=True, help="reference fixture")
    parser.add_argument("--candidate", required=True, help="round-trip candidate")
    parser.add_argument("--manifest", help="manifest with expected structural counts")
    parser.add_argument("--rng", help="Relax NG schema")
    parser.add_argument("--sch", help="project Schematron")
    parser.add_argument("--json-out", help="atomically written JSON report")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    for label, value in (("input", args.input), ("candidate", args.candidate)):
        if not Path(value).is_file():
            sys.stderr.write(f"ERROR: {label} is not a file: {value}\n")
            return 4
    try:
        manifest = _load_manifest(args.manifest)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        sys.stderr.write(f"ERROR reading manifest: {error}\n")
        return 4

    input_tree, input_error = parse(args.input)
    if input_error or input_tree is None:
        sys.stderr.write(f"ERROR: input not well-formed: {input_error}\n")
        return 4
    candidate_tree, candidate_error = parse(args.candidate)
    report: dict[str, Any] = {
        "schemaVersion": "tcr-eval/2",
        "fixtureId": (manifest or {}).get("fixtureId"),
        "input": args.input,
        "candidate": args.candidate,
    }
    if candidate_error or candidate_tree is None:
        report.update(
            {
                "levels": {"L2": {"wellFormed": False, "error": candidate_error}},
                "gates": {"wellFormed": "fail"},
                "verdict": "fail",
                "score": 0,
                "topIssues": [
                    {"level": "L2", "message": f"candidate not well-formed: {candidate_error}"}
                ],
            }
        )
        try:
            _emit(report, args)
        except OSError as error:
            sys.stderr.write(f"ERROR writing json-out: {error}\n")
            return 4
        return 3

    input_root = input_tree.getroot()
    candidate_root = candidate_tree.getroot()
    level_1 = l1_fidelity(input_root, candidate_root)
    level_3 = l3_invariants(input_root, candidate_root, manifest)
    level_2 = l2_schema(input_tree, candidate_tree, args.rng, args.sch)
    levels = {"L1": level_1, "L2": level_2, "L3": level_3}
    schema_gate = not level_2["requested"] or level_2["available"]
    gate = bool(level_1["pass"] and level_3["pass"] and schema_gate)

    top_issues: list[dict[str, Any]] = []
    if not level_1["pass"]:
        top_issues.append(
            {
                "level": "L1",
                "message": "reading-text fidelity broken",
                "detail": level_1["firstTextDivergence"] or level_1["firstDivergence"],
            }
        )
    if not level_3["countsPreserved"]:
        changed = {
            tag: count["delta"]
            for tag, count in level_3["counts"].items()
            if count["delta"]
        }
        top_issues.append(
            {"level": "L3", "message": "structural counts changed", "detail": changed}
        )
    if not level_3["namespaceOk"] or not level_3["expandedNamesPreserved"]:
        top_issues.append(
            {
                "level": "L3",
                "message": "element namespace or expanded names changed",
                "detail": level_3["expandedNameDelta"],
            }
        )
    if level_3["duplicateXmlIds"]:
        top_issues.append(
            {
                "level": "L3",
                "message": "duplicate xml:id values",
                "detail": level_3["duplicateXmlIds"][:10],
            }
        )
    if level_3["danglingPointers"]:
        top_issues.append(
            {
                "level": "L3",
                "message": "dangling pointers",
                "detail": level_3["danglingPointers"][:5],
            }
        )
    if not schema_gate:
        top_issues.append(
            {
                "level": "L2",
                "message": "requested schema validation unavailable",
                "detail": {
                    name: level_2.get(name)
                    for name in level_2["requested"]
                    if not isinstance(level_2.get(name), Mapping)
                    or level_2[name].get("valid") is None
                },
            }
        )
    for failure in level_2.get("newErrorsVsInput", {}).get("sch", [])[:3]:
        top_issues.append(
            {
                "level": "L2",
                "engine": "schematron",
                "message": failure.get("message"),
                "detail": failure,
            }
        )
    for error in level_2.get("newErrorsVsInput", {}).get("rng", [])[:3]:
        top_issues.append(
            {
                "level": "L2",
                "engine": "relaxng",
                "message": error.get("message"),
                "detail": error,
            }
        )

    report.update(
        {
            "levels": levels,
            "gates": {
                "wellFormed": "pass",
                "textFidelity": "pass" if level_1["pass"] else "fail",
                "structure": "pass" if level_3["pass"] else "fail",
                "schemaAvailable": "pass" if schema_gate else "fail",
            },
            "score": score(levels),
            "threshold": 95,
            "verdict": "pass" if gate else "fail",
            "topIssues": top_issues,
        }
    )
    try:
        _emit(report, args)
    except OSError as error:
        sys.stderr.write(f"ERROR writing json-out: {error}\n")
        return 4
    return 0 if gate else 2


if __name__ == "__main__":
    raise SystemExit(main())
