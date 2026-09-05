"""Reproduce the local Markdown inventory/link audit without fetching external URLs."""
from pathlib import Path
import json
import re
import subprocess
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = ["node_modules", ".git", "dist", "output", "test-results", "playwright-report", "test/reports"]
command = ["rg", "--files", "--hidden", "-g", "*.md"]
for directory in EXCLUDED:
    command += ["-g", f"!{directory}"]
paths = sorted(Path(name) for name in subprocess.check_output(command, cwd=ROOT, text=True).splitlines())
errors = []
upstream_references = []
UPSTREAM_ONLY = {
    ("docs/vendor/libxml2-wasm/UPSTREAM-README.md", "CONTRIBUTING.md"),
    ("docs/vendor/libxml2-wasm/UPSTREAM-README.md", "docs/performance.md"),
}
texts = {}
for path in paths:
    try:
        texts[path] = (ROOT / path).read_text(encoding="utf-8")
    except UnicodeDecodeError:
        errors.append({"file": path.as_posix(), "error": "not UTF-8"})


def prose(text):
    text = re.sub(r"\A---\r?\n.*?\r?\n---\r?\n", "", text, flags=re.S)
    return re.sub(r"(?ms)^(`{3,}|~{3,})[^\n]*\n.*?^\1\s*$", "", text)


def anchors(text):
    result = set(re.findall(r'<a\s+(?:name|id)=["\']([^"\']+)', text))
    duplicates = {}
    for heading in re.findall(r"(?m)^#{1,6}\s+(.+?)\s*#*\s*$", prose(text)):
        heading = re.sub(r"\[([^]]+)\]\([^)]*\)", r"\1", heading)
        slug = re.sub(r"[^\w\- ]", "", heading.lower()).replace(" ", "-")
        count = duplicates.get(slug, 0)
        duplicates[slug] = count + 1
        result.add(f"{slug}-{count}" if count else slug)
    return result


local_links = 0
anchor_links = 0
for path, raw in texts.items():
    if "\ufffd" in raw or "\u00c3\u0192" in raw:
        errors.append({"file": path.as_posix(), "error": "replacement character or repeated encoding corruption"})
    for match in re.finditer(r'\[[^\]\n]*\]\((<[^>]+>|[^\s)]+)(?:\s+["\'][^\n]*?["\'])?\)', prose(raw)):
        target = match.group(1).strip("<>")
        url = urlsplit(target)
        if url.scheme or url.netloc:
            continue
        local_links += 1
        destination = (ROOT / unquote(url.path).lstrip("/")) if url.path.startswith("/") else (ROOT / path.parent / unquote(url.path))
        if not url.path:
            destination = ROOT / path
        destination = destination.resolve()
        if not destination.exists():
            finding = {"file": path.as_posix(), "target": target, "error": "missing local target"}
            if (path.as_posix(), target) in UPSTREAM_ONLY:
                upstream_references.append(finding)
            else:
                errors.append(finding)
        elif url.fragment and destination.suffix.lower() == ".md":
            anchor_links += 1
            if unquote(url.fragment) not in anchors(destination.read_text(encoding="utf-8")):
                errors.append({"file": path.as_posix(), "target": target, "error": "missing heading anchor"})

knowledge = [p for p in paths if p.parts[0] == "knowledge"]
for path in knowledge:
    raw = texts.get(path, "")
    match = re.match(r"\A---\n(.*?)\n---\n", raw, re.S)
    if not match:
        errors.append({"file": path.as_posix(), "error": "missing knowledge frontmatter"})
        continue
    front = match.group(1)
    for field in ["title", "project", "method", "template", "status", "created", "updated", "language", "topics", "related"]:
        if not re.search(rf"(?m)^{field}:", front):
            errors.append({"file": path.as_posix(), "error": f"missing frontmatter field {field}"})
    versions = re.findall(r"(?m)^version:\s*(.*)$", front)
    expected = {"INDEX.md": '"0.22"', "converter-reference.md": "0.6.1"}.get(path.name)
    if versions != ([expected] if expected else []):
        errors.append({"file": path.as_posix(), "error": "unexpected top-level documentation version"})
    related = re.search(r"(?m)^related:\s*\[(.*)\]", front)
    if related:
        for name in related.group(1).split(","):
            target = ROOT / "knowledge" / (name.strip().strip('"\'') + ".md")
            if not target.exists():
                errors.append({"file": path.as_posix(), "error": f"missing related document {name.strip()}"})

report = {
    "date": "2026-09-05",
    "scope": "Repository Markdown discovered by rg; generated outputs and dependencies excluded.",
    "limitations": "Checks local inline Markdown targets, Markdown heading anchors, UTF-8 and knowledge metadata conventions. It does not fetch external links, parse all CommonMark constructs, validate YAML semantics or establish factual correctness.",
    "markdownFiles": len(paths),
    "localLinks": local_links,
    "markdownAnchorLinks": anchor_links,
    "knowledgeDocuments": len(knowledge),
    "files": [p.as_posix() for p in paths],
    "unbundledUpstreamReferences": upstream_references,
    "errors": errors,
}
(ROOT / "reports/documentation-audit-2026-09-05.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps({k: v for k, v in report.items() if k not in ["files", "scope", "limitations"]}, indent=2))
raise SystemExit(bool(errors))
