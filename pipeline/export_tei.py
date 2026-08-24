#!/usr/bin/env python3
"""Convert SZD Page-JSON v0.2 to deterministic teiCrafter TEI.

All JSON and XML files use UTF-8 without a byte-order mark. Inputs are
validated before rendering, and every XML file is replaced atomically only
after its complete byte sequence has been written to a sibling temporary file.

Usage:
  python pipeline/export_tei.py <in_page.json> <out.xml>
  python pipeline/export_tei.py --id <object_id> --out <dir> [--root <results_dir>]
  python pipeline/export_tei.py --all [--out <dir>] [--root <results_dir>]
"""

from __future__ import annotations

import json
import math
import os
import re
import sys
import tempfile
import unicodedata
from collections.abc import Iterator, Mapping
from pathlib import Path
from typing import Any


PAGE_JSON_SUFFIX = "_page.json"
XML_ID_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9._-]*$")
REGION_ID_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9._-]*$")


def esc_text(value: object) -> str:
    """Escape character data for XML 1.0."""
    text = "" if value is None else str(value)
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def esc_attr(value: object) -> str:
    """Escape an XML attribute value delimited by double quotes."""
    return esc_text(value).replace('"', "&quot;")


def js_round(value: float) -> int:
    """Match JavaScript Math.round for the converter's non-negative values."""
    return math.floor(value + 0.5)


def slug(value: object) -> str:
    """Create the converter's stable ASCII identifier fragment."""
    text = "" if value is None else str(value)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(character for character in text if not "\u0300" <= character <= "\u036f")
    result: list[str] = []
    previous_underscore = False
    for character in text.lower():
        if character.isascii() and character.isalnum():
            result.append(character)
            previous_underscore = False
        elif not previous_underscore:
            result.append("_")
            previous_underscore = True
    return "".join(result).strip("_") or "x"


def is_xml_10_character(codepoint: int) -> bool:
    """Return whether a Unicode scalar value is legal in XML 1.0 Fifth Edition."""
    return (
        codepoint in (0x09, 0x0A, 0x0D)
        or 0x20 <= codepoint <= 0xD7FF
        or 0xE000 <= codepoint <= 0xFFFD
        or 0x10000 <= codepoint <= 0x10FFFF
    )


def iter_json_strings(value: Any, path: str = "$") -> Iterator[tuple[str, str]]:
    """Yield string values with deterministic JSON paths."""
    if isinstance(value, str):
        yield path, value
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from iter_json_strings(item, f"{path}[{index}]")
    elif isinstance(value, Mapping):
        for key, item in value.items():
            yield from iter_json_strings(item, f"{path}.{key}")


def validate_xml_characters(page_json: Mapping[str, Any]) -> None:
    """Reject JSON strings that cannot be represented in XML 1.0."""
    for path, text in iter_json_strings(page_json):
        for index, character in enumerate(text):
            if not is_xml_10_character(ord(character)):
                raise ValueError(
                    f"{path} contains XML 1.0-forbidden U+{ord(character):04X} "
                    f"at character {index}"
                )


def _require_mapping(value: Any, path: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{path} must be an object")
    return value


def _require_positive_int(value: Any, path: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError(f"{path} must be a positive integer")
    return value


def _require_finite_number(value: Any, path: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{path} must be a finite number")
    number = float(value)
    if not math.isfinite(number):
        raise ValueError(f"{path} must be a finite number")
    return number


def validate_page_json(page_json: Any) -> dict[str, Any]:
    """Validate the Page-JSON structure needed to create safe, stable TEI."""
    if not isinstance(page_json, dict):
        raise ValueError("Page-JSON root must be an object")
    source = _require_mapping(page_json.get("source"), "source")
    pages = page_json.get("pages")
    if not isinstance(pages, list):
        raise ValueError("pages must be an array")
    validate_xml_characters(page_json)

    for index, raw_page in enumerate(pages):
        page = _require_mapping(raw_page, f"pages[{index}]")
        _require_positive_int(page.get("page"), f"pages[{index}].page")
        if not isinstance(page.get("text"), str):
            raise ValueError(f"pages[{index}].text must be a string")
        regions = page.get("regions")
        if regions is not None and not isinstance(regions, list):
            raise ValueError(f"pages[{index}].regions must be an array")
        seen_regions: set[str] = set()
        for region_index, raw_region in enumerate(regions or []):
            region_path = f"pages[{index}].regions[{region_index}]"
            region = _require_mapping(raw_region, region_path)
            region_id = region.get("id")
            if not isinstance(region_id, str) or not REGION_ID_PATTERN.fullmatch(region_id):
                raise ValueError(f"{region_path}.id must be a stable XML identifier")
            if region_id in seen_regions:
                raise ValueError(f"{region_path}.id duplicates {region_id!r} on the same page")
            seen_regions.add(region_id)
            bbox = region.get("bbox")
            if not isinstance(bbox, list) or len(bbox) != 4:
                raise ValueError(f"{region_path}.bbox must contain four numbers")
            x, y, width, height = (
                _require_finite_number(item, f"{region_path}.bbox[{bbox_index}]")
                for bbox_index, item in enumerate(bbox)
            )
            if min(x, y, width, height) < 0 or x + width > 100 or y + height > 100:
                raise ValueError(f"{region_path}.bbox must lie within the 0..100 page area")
        if regions:
            _require_positive_int(page.get("image_width"), f"pages[{index}].image_width")
            _require_positive_int(page.get("image_height"), f"pages[{index}].image_height")

    descriptive = _require_mapping(
        source.get("descriptive_metadata") or {},
        "source.descriptive_metadata",
    )
    _require_mapping(descriptive.get("holding") or {}, "source.descriptive_metadata.holding")
    _require_mapping(page_json.get("provenance") or {}, "provenance")
    _require_mapping(page_json.get("review") or {}, "review")
    images = source.get("images") or []
    if not isinstance(images, list) or any(not isinstance(image, str) for image in images):
        raise ValueError("source.images must be an array of strings")
    creators = descriptive.get("creator") or []
    if not isinstance(creators, list):
        raise ValueError("source.descriptive_metadata.creator must be an array")
    for index, raw_creator in enumerate(creators):
        creator = _require_mapping(raw_creator, f"source.descriptive_metadata.creator[{index}]")
        if not isinstance(creator.get("name"), str) or not creator["name"].strip():
            raise ValueError(
                f"source.descriptive_metadata.creator[{index}].name must be a non-empty string"
            )
        if creator.get("gnd") is not None and not isinstance(creator["gnd"], str):
            raise ValueError(f"source.descriptive_metadata.creator[{index}].gnd must be a string")
    return page_json


def unique_occurrence_ids(values: list[int], prefix: str) -> list[str]:
    """Create stable, unique IDs while preserving duplicate page occurrences."""
    counts: dict[int, int] = {}
    identifiers: list[str] = []
    for value in values:
        counts[value] = counts.get(value, 0) + 1
        suffix = "" if counts[value] == 1 else f"_{counts[value]}"
        identifier = f"{prefix}{value}{suffix}"
        if not XML_ID_PATTERN.fullmatch(identifier):
            raise ValueError(f"generated invalid XML identifier: {identifier!r}")
        identifiers.append(identifier)
    return identifiers


def page_json_to_tei(raw_page_json: Any) -> str:
    """Convert validated Page-JSON to deterministic UTF-8 TEI text."""
    page_json = validate_page_json(raw_page_json)
    source = page_json["source"]
    descriptive = source.get("descriptive_metadata") or {}
    provenance = page_json.get("provenance") or {}
    pages = page_json["pages"]
    page_ids = unique_occurrence_ids([page["page"] for page in pages], "surf_")

    persons: list[dict[str, str | None]] = []
    creator_keys: set[tuple[str, str | None]] = set()
    person_id_counts: dict[str, int] = {}
    for creator in descriptive.get("creator") or []:
        name = creator["name"]
        gnd = creator.get("gnd") or None
        key = (name, gnd)
        if key in creator_keys:
            continue
        creator_keys.add(key)
        base_id = "pers_" + slug(name)
        person_id_counts[base_id] = person_id_counts.get(base_id, 0) + 1
        occurrence = person_id_counts[base_id]
        person_id = base_id if occurrence == 1 else f"{base_id}_{occurrence}"
        persons.append({"id": person_id, "name": name, "gnd": gnd})

    def person_block(person: Mapping[str, str | None]) -> str:
        result = (
            f'      <person xml:id="{esc_attr(person["id"])}">\n'
            f'        <persName>{esc_text(person["name"])}</persName>\n'
        )
        if person["gnd"]:
            result += f'        <idno type="GND">{esc_text(person["gnd"])}</idno>\n'
        return result + "      </person>"

    person_xml = "\n".join(person_block(person) for person in persons)

    def zones_for(page: Mapping[str, Any], page_id: str) -> list[str]:
        width = page.get("image_width")
        height = page.get("image_height")
        if not width or not height or not isinstance(page.get("regions"), list):
            return []
        zones: list[str] = []
        for region in page["regions"]:
            x, y, box_width, box_height = region["bbox"]
            ulx = js_round((x / 100) * width)
            uly = js_round((y / 100) * height)
            lrx = js_round(((x + box_width) / 100) * width)
            lry = js_round(((y + box_height) / 100) * height)
            region_type = f' type="{esc_attr(region["type"])}"' if region.get("type") else ""
            zones.append(
                f'      <zone xml:id="z_{page_id[5:]}_{esc_attr(region["id"])}" '
                f'ulx="{ulx}" uly="{uly}" lrx="{lrx}" lry="{lry}"{region_type}/>'
            )
        return zones

    images = source.get("images") or []
    surfaces: list[str] = []
    available_surfaces: set[str] = set()
    for index, (page, page_id) in enumerate(zip(pages, page_ids, strict=True)):
        image = (images[index] if index < len(images) else None) or page.get("image") or ""
        zones = zones_for(page, page_id)
        if not zones and not image:
            continue
        width = page.get("image_width")
        height = page.get("image_height")
        dimensions = f' ulx="0" uly="0" lrx="{width}" lry="{height}"' if width and height else ""
        surface = f'    <surface xml:id="{page_id}"{dimensions}>\n'
        if image:
            surface += f'      <graphic url="{esc_attr(image)}"/>\n'
        if zones:
            surface += "\n".join(zones) + "\n"
        surface += "    </surface>"
        surfaces.append(surface)
        available_surfaces.add(page_id)

    def body_for_page(page: Mapping[str, Any], page_id: str) -> str:
        page_break = (
            f'      <pb n="{esc_attr(page["page"])}"'
            + (f' facs="#{page_id}"' if page_id in available_surfaces else "")
            + "/>"
        )
        text = page["text"].replace("\r\n", "\n")
        if not text.strip():
            return page_break
        paragraphs = re.split(r"\n{2,}", text)
        rendered: list[str] = []
        for paragraph in paragraphs:
            inner = "\n        ".join(f"<lb/>{esc_text(line)}" for line in paragraph.split("\n"))
            rendered.append(f"      <p>\n        {inner}\n      </p>")
        return page_break + "\n" + "\n".join(rendered)

    body = "\n".join(
        body_for_page(page, page_id) for page, page_id in zip(pages, page_ids, strict=True)
    )
    title = source.get("title") or source.get("id") or "Untitled"
    response_statements = "\n".join(
        "        <respStmt><resp>contributor</resp><persName>"
        f'{esc_text(person["name"])}</persName></respStmt>'
        for person in persons
    )
    rights = descriptive.get("rights") or ""
    holding = descriptive.get("holding") or {}
    repository = holding.get("repository") or source.get("repository") or ""
    shelfmark = source.get("shelfmark") or ""
    language = source.get("language") or "und"
    review = page_json.get("review") or {}
    review_status = review.get("status") or "unreviewed"
    model = provenance.get("model") or "unknown model"
    publication = (
        f"Machine-generated TEI from szd-htr Page-JSON ({esc_text(model)}). "
        f"Structure unreviewed; transcription {esc_text(review_status)}."
        + (f" Rights: {esc_text(rights)}." if rights else "")
    )
    manuscript_identifier = ""
    if repository:
        manuscript_identifier += f"\n            <repository>{esc_text(repository)}</repository>"
    if shelfmark:
        manuscript_identifier += (
            f'\n            <idno type="shelfmark">{esc_text(shelfmark)}</idno>'
        )
    header = (
        "  <teiHeader>\n"
        "    <fileDesc>\n"
        "      <titleStmt>\n"
        f"        <title>{esc_text(title)}</title>\n"
        + (response_statements + "\n" if response_statements else "")
        + "      </titleStmt>\n"
        "      <publicationStmt>\n"
        f"        <p>{publication}</p>\n"
        "      </publicationStmt>\n"
        "      <sourceDesc>\n"
        "        <msDesc>\n"
        f"          <msIdentifier>{manuscript_identifier}\n"
        f'            <idno type="objectId">{esc_text(source.get("id") or "")}</idno>\n'
        "          </msIdentifier>\n"
        "        </msDesc>\n"
        "      </sourceDesc>\n"
        "    </fileDesc>\n"
        "    <profileDesc>\n"
        f'      <langUsage><language ident="{esc_attr(language)}"/></langUsage>\n'
        "    </profileDesc>\n"
        "  </teiHeader>"
    )
    joined_surfaces = "\n".join(surfaces)
    facsimile = f"  <facsimile>\n{joined_surfaces}\n  </facsimile>\n" if surfaces else ""
    stand_off = (
        f"  <standOff>\n    <listPerson>\n{person_xml}\n    </listPerson>\n  </standOff>\n"
        if persons
        else ""
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<TEI xmlns="http://www.tei-c.org/ns/1.0">\n'
        f"{header}\n{stand_off}{facsimile}  <text>\n"
        "    <body>\n"
        f'      <div type="document" n="{esc_attr(source.get("id") or "")}">\n'
        f"{body}\n"
        "      </div>\n"
        "    </body>\n"
        "  </text>\n"
        "</TEI>\n"
    )


def resolve_id(object_id: str, root: Path) -> Path:
    """Resolve one object ID, rejecting absent and ambiguous matches."""
    if not root.is_dir():
        raise FileNotFoundError(f"Page-JSON root does not exist or is not a directory: {root}")
    target = object_id + PAGE_JSON_SUFFIX
    hits = sorted(path for path in root.rglob(target) if path.is_file())
    if not hits:
        raise FileNotFoundError(f"no Page-JSON found for id {object_id!r} under {root}")
    if len(hits) > 1:
        candidates = "\n  ".join(str(path) for path in hits)
        raise ValueError(
            f"ambiguous id {object_id!r} resolves to {len(hits)} files; "
            f"pass an explicit path instead:\n  {candidates}"
        )
    return hits[0]


def atomic_write_utf8(path: Path, text: str) -> None:
    """Write UTF-8 text without BOM and atomically replace the target."""
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
    except BaseException:
        temporary_path.unlink(missing_ok=True)
        raise


def convert_file(input_path: Path | str, output_path: Path | str) -> str:
    """Convert one UTF-8 Page-JSON file to one atomically written TEI file."""
    source_path = Path(input_path)
    target_path = Path(output_path)
    try:
        with source_path.open("r", encoding="utf-8-sig") as handle:
            page_json = json.load(handle)
        tei = page_json_to_tei(page_json)
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        raise ValueError(f"{source_path}: {error}") from error
    atomic_write_utf8(target_path, tei)
    return tei


def convert_all(root: Path | str, output_directory: Path | str) -> int:
    """Convert every SZD Page-JSON, failing if the input set is absent or empty."""
    root_path = Path(root)
    if not root_path.is_dir():
        raise FileNotFoundError(f"Page-JSON root does not exist or is not a directory: {root_path}")
    inputs = sorted(path for path in root_path.rglob("o_szd.*_page.json") if path.is_file())
    if not inputs:
        raise FileNotFoundError(f"no o_szd.*_page.json inputs found under {root_path}")
    output_path = Path(output_directory)
    failures: list[str] = []
    for source_path in inputs:
        folder = source_path.parent.name
        object_id = source_path.name.removesuffix(PAGE_JSON_SUFFIX)
        try:
            convert_file(source_path, output_path / f"{folder}__{object_id}.xml")
        except ValueError as error:
            failures.append(str(error))
    if failures:
        details = "\n  ".join(failures)
        raise ValueError(
            f"{len(failures)} of {len(inputs)} Page-JSON inputs failed "
            f"preflight or conversion:\n  {details}"
        )
    return len(inputs)


def _option(args: list[str], name: str, default: str) -> str:
    if name not in args:
        return default
    index = args.index(name)
    if index + 1 >= len(args):
        raise ValueError(f"{name} requires a value")
    return args[index + 1]


def main(argv: list[str]) -> int:
    """Run the command-line converter."""
    args = argv[1:]
    if not args:
        raise ValueError(__doc__ or "missing arguments")
    default_root = os.environ.get("SZD_DIR", "../../szd-htr/results")
    if args[0] == "--all":
        unknown = [
            arg
            for arg in args
            if arg.startswith("--") and arg not in {"--all", "--out", "--root"}
        ]
        if unknown:
            raise ValueError(f"unknown argument: {unknown[0]}")
        output_directory = _option(args, "--out", "output/szd-tei")
        root = _option(args, "--root", default_root)
        converted = convert_all(root, output_directory)
        print(f"converted {converted} objects -> {output_directory}")
        return 0
    if args[0] == "--id":
        unknown = [
            arg
            for arg in args
            if arg.startswith("--") and arg not in {"--id", "--out", "--root"}
        ]
        if unknown:
            raise ValueError(f"unknown argument: {unknown[0]}")
        object_id = _option(args, "--id", "")
        if not object_id:
            raise ValueError("--id requires an object id")
        output_directory = Path(_option(args, "--out", "output"))
        root = Path(_option(args, "--root", default_root))
        input_path = resolve_id(object_id, root)
        output_path = output_directory / f"{object_id}.xml"
        convert_file(input_path, output_path)
        print(output_path)
        return 0
    if len(args) != 2:
        raise ValueError("usage: python export_tei.py <in_page.json> <out.xml>")
    convert_file(args[0], args[1])
    print(args[1])
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv))
    except (FileNotFoundError, OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        sys.stderr.write(f"ERROR: {error}\n")
        raise SystemExit(4) from None
