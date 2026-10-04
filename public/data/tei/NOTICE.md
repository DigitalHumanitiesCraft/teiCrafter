# NOTICE: vendored TEI P5 Guidelines compilation

This directory ships one third-party data file:

| Field | Value |
|-------|-------|
| File | `p5subset_en.json` |
| Source | https://www.tei-c.org/Vault/P5/4.11.0/xml/tei/odd/p5subset_en.json |
| Pinned version | 4.11.0 (the newest stable P5 release in the TEI Vault as of retrieval) |
| Retrieval date | 2026-06-10 |
| Byte size | 1901343 |
| SHA-256 | `041669f1315a3f10b73d0de29eb2068ba9b768e1cba24327b439eeab5a7f72e4` |

The file is the TEI Consortium's machine-readable compilation of the P5
Guidelines (an odd2json output: 588 elementSpecs, 22 modules). It is stored
byte-verbatim, exactly as downloaded, with no re-serialization. The compilation
itself carries no version string (its `edition` field is empty and "4.11.0"
appears nowhere in the file), so the version above is the pinned Vault release,
not a value read from the JSON.

## License

The TEI Guidelines and this compilation are published by the TEI Consortium
under a dual license: Creative Commons Attribution 3.0 Unported (CC-BY 3.0) and
the BSD 2-Clause License. Attribution: TEI Consortium, eds. *TEI P5: Guidelines
for Electronic Text Encoding and Interchange.* Version 4.11.0. TEI Consortium.
https://www.tei-c.org/

- CC-BY 3.0: https://creativecommons.org/licenses/by/3.0/
- BSD 2-Clause: https://opensource.org/license/bsd-2-clause

You may use either license. Both require attribution to the TEI Consortium.

## Updating this file

To move to a newer P5 release, do all of the following in ONE commit:

1. Download the new compilation byte-verbatim, replacing `p5subset_en.json`:
   `curl -o p5subset_en.json https://www.tei-c.org/Vault/P5/<version>/xml/tei/odd/p5subset_en.json`
2. Update this NOTICE: pinned version, retrieval date, byte size and SHA-256
   (`sha256sum p5subset_en.json`).
3. Update the pinned counts in `test/proofs/guidelines_check.mjs`
   (`PINNED_VERSION`, `PINNED_MODULE_COUNT`, `PINNED_PERSNAME_ATTS`) to the
   values measured against the new file, and update
   `VENDORED_GUIDELINES_VERSION` in `docs/js/editor/tei-guidelines.js`.
4. Run `node test/proofs/guidelines_check.mjs` and confirm it passes.
