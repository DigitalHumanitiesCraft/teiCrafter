#!/usr/bin/env python3
"""
Deterministic generator for a SYNTHETIC Wenzelsbibel-like codex.

Emits a structural twin of codex-2759.xml (no ONB data) at a chosen scale, so the
eval harness can be exercised across data tiers (1 folio, a handful, many) without
the real, licence-restricted codex. Output is reproducible (no randomness): the same
arguments always yield byte-identical XML.

Structure mirrored:
  teiHeader, standOff (apparatus notes -> @target into words),
  facsimile/surface/zone, text/body with <pb facs="#surface_n"/>, <l>, <lb/>, <w xml:id>.

Usage
  python gen_synthetic_codex.py --surfaces 20 --lines-per-surface 4 --words-per-line 6 \
         --out test/fixtures-synthetic/synthetic-codex.xml
"""
import argparse

# Small pseudo-Middle-High-German pool; index-addressed for determinism.
POOL = ["in", "dem", "anegenge", "schuof", "got", "himel", "und", "erde", "daz",
        "lieht", "wart", "wazzer", "name", "tac", "naht", "guot", "vil", "michel",
        "wirt", "herre", "kint", "vrouwe", "muoter", "vater", "wort", "leben"]


def word(i):
    return POOL[i % len(POOL)]


def main():
    ap = argparse.ArgumentParser(description="Generate a synthetic Wenzelsbibel-like codex")
    ap.add_argument("--surfaces", type=int, default=20)
    ap.add_argument("--lines-per-surface", type=int, default=4)
    ap.add_argument("--words-per-line", type=int, default=6)
    ap.add_argument("--zones-per-surface", type=int, default=3)
    ap.add_argument("--standoff-per-surface", type=int, default=1, help="apparatus notes per surface")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    out = []
    out.append('<?xml version="1.0" encoding="UTF-8"?>')
    out.append('<?xml-model href="Bilderfassung-synthetic.sch" type="application/xml" '
               'schematypens="http://purl.oclc.org/dsdl/schematron"?>')
    out.append('<TEI xmlns="http://www.tei-c.org/ns/1.0">')

    # header
    out.append('  <teiHeader>')
    out.append('    <fileDesc>')
    out.append('      <titleStmt>')
    out.append(f'        <title>Synthetic Wenzelsbibel structural twin ({args.surfaces} surfaces)</title>')
    out.append('      </titleStmt>')
    out.append('      <publicationStmt><p>Synthetic fixture, no ONB data, CC0.</p></publicationStmt>')
    out.append('      <sourceDesc><p>Generated structural twin of codex-2759.xml.</p></sourceDesc>')
    out.append('    </fileDesc>')
    out.append('  </teiHeader>')

    # plan words first so standOff can target real ids
    # word id scheme: w_{surface}_{n}, n running within a surface starting at 1
    standoff_targets = []  # (app_id, target_id, kind)
    app_counter = 0
    for s in range(1, args.surfaces + 1):
        for k in range(args.standoff_per_surface):
            # target the (k+1)-th word on the surface
            target_n = k + 1
            app_counter += 1
            kind = "apparatus" if app_counter % 2 else "commentary"
            standoff_targets.append((f"app_{app_counter}", f"w_{s}_{target_n}", kind))

    # standOff
    if standoff_targets:
        out.append('  <standOff>')
        for app_id, target, kind in standoff_targets:
            out.append(f'    <note xml:id="{app_id}" target="#{target}" type="{kind}">note for {target}</note>')
        out.append('  </standOff>')

    # facsimile
    out.append('  <facsimile>')
    for s in range(1, args.surfaces + 1):
        out.append(f'    <surface xml:id="surface_{s}" n="{s}r">')
        for z in range(1, args.zones_per_surface + 1):
            uly = z * 40
            out.append(f'      <zone xml:id="zone_{s}_{z}" ulx="10" uly="{uly}" lrx="100" lry="{uly + 30}"/>')
        out.append('    </surface>')
    out.append('  </facsimile>')

    # text/body
    out.append('  <text>')
    out.append('    <body>')
    for s in range(1, args.surfaces + 1):
        out.append(f'      <pb n="{s}r" facs="#surface_{s}"/>')
        n = 0  # running word index within surface
        gi = (s - 1) * args.lines_per_surface * args.words_per_line  # global offset for variety
        for line in range(1, args.lines_per_surface + 1):
            parts = [f'      <l n="{line}"><lb/>']
            ws = []
            for _ in range(args.words_per_line):
                n += 1
                ws.append(f'<w xml:id="w_{s}_{n}">{word(gi + n)}</w>')
            parts.append(" ".join(ws))
            parts.append('</l>')
            out.append("".join(parts))
    out.append('    </body>')
    out.append('  </text>')
    out.append('</TEI>')
    out.append('')

    text = "\n".join(out)
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(text)

    # quick stats
    print(f"wrote {args.out}")
    print(f"  surfaces={args.surfaces} "
          f"w={args.surfaces * args.lines_per_surface * args.words_per_line} "
          f"l={args.surfaces * args.lines_per_surface} "
          f"lb={args.surfaces * args.lines_per_surface} "
          f"zone={args.surfaces * args.zones_per_surface} "
          f"note={len(standoff_targets)} pb={args.surfaces}")


if __name__ == "__main__":
    main()
