# Prototype B, focused source editing

An outline beside the editor lists the structure of the document. Choosing an entry shows only that part of the source in the editor, with a path above it back to the enclosing parts. The surrounding document is absent from the view, not folded. The editor holds the chosen range of the canonical raw string, and every change is spliced back into that string at the recorded range.

## Content and interaction hierarchy

1. A TEI-literate editor opens one UTF-8 TEI XML file, chooses one part of it, such as a page or a division, reads and corrects that part in the source without the rest of the document in view, and saves the whole document unchanged outside the deliberate edits.
2. The primary objects are the units of the document, meaning the document itself, its header and its sub-parts, standOff, facsimile, text with front, body and back, divisions labelled by their heading or by type and number, and pages running from one page break to the next, each with a source range, a label taken from the source and a parent unit. The open file adds its name, byte order mark and well-formedness.
3. Visible for the first decision are the outline with the focused unit marked, the path from the document to the focused unit, the source of the focused unit with absolute document line numbers, and the document line and column at the cursor, whether the whole document is well-formed, and whether it is saved.
4. Optional depth comes from expanding the header and other outline entries, moving to the parent or to a neighbouring unit, and choosing the whole document as the focus.
5. Navigation targets are the outline units, reached through the outline tree, the path, the keys Alt+Up for the parent and Alt+Left or Alt+Right for the previous or next unit, and a well-formedness error outside the focus, which refocuses on the unit that contains it. The open file and the loaded sample are the only addressable states.
6. On a wide screen the outline is a column of about 18rem beside the editor column, which holds the path row, the editor and the status line. On a narrow screen the outline is hidden behind an Outline toggle in the path row and opens above the editor, the header controls wrap, and long source lines scroll inside the editor.

## Run

`npx vite --config prototypes/vite.config.js`, then open `/prototypes/b-focus/index.html`. `node prototypes/b-focus/check.mjs` drives the page in Chromium against a running server on port 5174, or on the port given in the `PORT` environment variable.
