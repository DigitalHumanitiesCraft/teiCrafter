# Prototype A, source editor with structural folding

The whole TEI document is edited as XML source. Element-level folding, low-contrast markup, an element path and a formatter that leaves mixed content untouched keep the source workable without hiding it.

## Content and interaction hierarchy

1. A TEI-literate editor opens one UTF-8 TEI XML file, reads and corrects it directly in the source with the whole document present, and saves it unchanged outside the deliberate edits.
2. The primary object is the XML source of one document, whose elements are addressed by name, start tag, end tag and range, together with its file name, encoding, byte order mark and well-formedness.
3. Visible for the first decision are the body text with the header and other configured apparatus folded to a one-line summary, the element path at the cursor, and whether the document is well-formed and saved.
4. Optional depth comes from unfolding an element, dimming markup, find and replace, formatting one element through a before and after comparison, and a demonstration proposal awaiting accept or reject.
5. Navigation targets are the elements of the document, reached through the element path, folding and search, while the open file and the loaded sample are the only addressable states.
6. On a wide screen the header holds all commands in one row above a full-height editor, and on a narrow screen the header controls wrap into several rows while the editor keeps the remaining height and long lines scroll inside the editor.

## Run

`npx vite --config prototypes/vite.config.js`, then open `/prototypes/a-code/index.html`. `node prototypes/a-code/check.mjs` drives the page in Chromium against a running server on port 5174.
