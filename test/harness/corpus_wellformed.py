#!/usr/bin/env python3
"""Formally parse a TEI corpus and reject duplicate XML IDs."""

from __future__ import annotations

import json
import sys
import xml.etree.ElementTree as element_tree
from pathlib import Path


TEI_ROOT = "{http://www.tei-c.org/ns/1.0}TEI"
XML_ID = "{http://www.w3.org/XML/1998/namespace}id"


def check_file(path: Path) -> list[str]:
    """Return formal XML and identity errors for one file."""
    try:
        root = element_tree.parse(path).getroot()
    except (element_tree.ParseError, OSError) as error:
        return [f"formal XML parse failed: {error}"]
    errors: list[str] = []
    if root.tag != TEI_ROOT:
        errors.append(f"root is {root.tag!r}, expected {TEI_ROOT!r}")
    seen: set[str] = set()
    for element in root.iter():
        identifier = element.get(XML_ID)
        if not identifier:
            continue
        if identifier in seen:
            errors.append(f"duplicate xml:id {identifier!r}")
        seen.add(identifier)
    return errors


def main(argv: list[str]) -> int:
    """Check all XML files below one directory."""
    if len(argv) != 2:
        sys.stderr.write("usage: corpus_wellformed.py <tei-directory>\n")
        return 4
    directory = Path(argv[1])
    if not directory.is_dir():
        sys.stderr.write(f"ERROR: TEI directory does not exist: {directory}\n")
        return 4
    files = sorted(directory.rglob("*.xml"))
    if not files:
        sys.stderr.write(f"ERROR: no XML files found under {directory}\n")
        return 4
    failures = [
        {"file": str(path), "errors": errors}
        for path in files
        if (errors := check_file(path))
    ]
    print(
        json.dumps(
            {"files": len(files), "passed": len(files) - len(failures), "failures": failures},
            ensure_ascii=False,
        )
    )
    return 2 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
