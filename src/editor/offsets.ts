/**
 * Raw offsets and editor positions. The core addresses the raw string; the
 * editor splits lines on the file's own separator, so sliceDoc() reproduces the
 * raw text exactly, but an editor position counts each CRLF as one character.
 *
 * Known limitation: a file containing any CRLF is split on CRLF only. A lone LF
 * in such a file stays an ordinary character of its line (shown as a control
 * character), Enter inserts CRLF, and the formatter writes CRLF.
 */
import { EditorState, type Extension } from "@codemirror/state";
import { lineSeparatorOf, rawToPos } from "../core/line-offsets.js";

export { lineSeparatorOf };

/** An editor state whose line separator is the one the raw text uses. */
export function createXmlState(raw: string, extensions: Extension[] = []): EditorState {
  return EditorState.create({ doc: raw, extensions: [EditorState.lineSeparator.of(lineSeparatorOf(raw)), ...extensions] });
}

/** The raw text with its original line endings; exact only for states built by createXmlState. */
export const rawOf = (state: EditorState): string => state.sliceDoc();

/** Editor position for a raw offset; raw must be rawOf(state) or the text the offset refers to. */
export const toPos = (state: EditorState, raw: string, offset: number): number => rawToPos(raw, state.lineBreak, offset);

/** Raw offset for an editor position: every line break before it is lineBreak.length raw characters long. */
export const toRaw = (state: EditorState, pos: number): number =>
  pos + (state.doc.lineAt(pos).number - 1) * (state.lineBreak.length - 1);
