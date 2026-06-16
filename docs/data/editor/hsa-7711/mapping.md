# Mapping: scholarly letter to TEI

How the text phenomena of a letter map to TEI markup for this project. The model
proposes only these constructs, and only where they actually occur in the text.

- A person's name (sender, addressee, a person mentioned) -> `<persName>`
- A place name -> `<placeName>`
- A date -> `<date when="YYYY-MM-DD">`; normalize to the W3C form when the date is
  unambiguous, otherwise wrap the date without `@when`.
- A reference or link to an external resource (a work, a URL, an archive record) ->
  `<ref target="...">`
- The opening salutation line -> `<salute>`
- The closing signature -> `<signed>`
- A reading that is uncertain or hard to decipher -> `<unclear>`
- Text that is omitted or illegible in the source -> `<gap>`

Do not invent markup beyond this list. Do not change, reorder, or drop any of the
source text; markup wraps the existing words, it never rewrites them.
