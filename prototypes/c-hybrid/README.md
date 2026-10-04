# Prototype C, hybrid text view with markup as inline marks

The document renders from the offset-true tree as flowing serif text. Every element stays visible as a compact mark with its name, block elements give the text its layout, and activating a mark opens the exact source of that element in an inline editor. The view is neither a code editor nor a WYSIWYG surface, and the raw string stays canonical.

## Content and interaction hierarchy

1. A TEI-literate editor reads one UTF-8 TEI XML file as text with its markup in view, corrects one element at a time in its exact source, and saves the file unchanged outside the deliberate edits.
2. The primary objects are the elements of one document, each with its name, its attributes as written, its text and its source range, together with the file name, well-formedness and saved state.
3. Visible for the first decision are the text in reading order with every element named by a mark, the header and other apparatus collapsed to a one-line summary, entity names on their entity background, and whether the document is well-formed and saved.
4. Optional depth comes from the attributes of a mark on hover or focus, an expanded apparatus block, the inline source editor of one element, and the Reading level, which hides the marks and keeps the block structure and the entity backgrounds.
5. Navigation targets are the marks of the document, reached by pointer, by Tab into the document and by arrow keys between marks, while the open file, the loaded sample and the view level are the only addressable states.
6. On a wide screen the header holds all commands in one row above the document column of under 80 characters and a status footer, and on a narrow screen the header controls wrap, the column fills the width with smaller nesting indents, and long attribute values and the inline editor wrap or scroll inside their own box.

## Run

`npx vite --config prototypes/vite.config.js`, then open `/prototypes/c-hybrid/index.html`. `node prototypes/c-hybrid/check.mjs` drives the page in Chromium against a running server on port 5174, or on the port given in the `PORT` environment variable.
