import { parseEdition } from "../../docs/js/editor/edition.js";
import {
  EditorSession,
  applyPatch,
  minimalPatch,
} from "../../docs/js/editor/editor-session.js";
import { check, finish, section } from "./_assert.mjs";

section("Editor session transactions");

const base = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><p>alpha<lb/>beta</p></body></text></TEI>`;
const changed = base.replace("alpha", "Alpha");
const patch = minimalPatch(base, changed);
check("minimal patch isolates the changed character", patch.start === base.indexOf("a") && patch.before === "a" && patch.after === "A");
check("patch applies forward", applyPatch(base, patch) === changed);
check("patch applies backward", applyPatch(changed, patch, "backward") === base);

const session = new EditorSession(parseEdition, { maxEntries: 10, maxPatchChars: 1000 });
session.load(parseEdition(base));
check("newly loaded session is clean", !session.dirty && !session.canUndo());
const snapshot = session.snapshot({ folio: 0 });
const projected = { ...session.state, projectionMarker: "schema evidence" };
session.reproject(projected);
check("projection refresh adopts derived state without changing revision or history",
  session.state.projectionMarker === "schema evidence" && session.revision === 0
    && !session.dirty && session.isCurrent(snapshot));
let rejectedProjection = false;
try {
  session.reproject(parseEdition(changed));
} catch (error) {
  rejectedProjection = error.message.includes("cannot change document bytes");
}
check("projection refresh rejects changed source bytes", rejectedProjection);
check("same parsed state is a no-op", session.replace(parseEdition(base), "No-op") === false);
check("real replacement is recorded", session.replace(parseEdition(changed), "Capitalise") === true);
check("the next Undo action exposes its label", session.undoLabel() === "Capitalise");
check("replacement marks dirty and invalidates snapshots", session.dirty && !session.isCurrent(snapshot));
const undone = session.undo();
check("undo restores exact source bytes", undone.state.doc.raw === base && session.canRedo());
check("the next Redo action exposes its label", session.redoLabel() === "Capitalise");
check("undo to load point restores clean state", !session.dirty);
const redone = session.redo();
check("redo restores exact edited source", redone.state.doc.raw === changed && session.dirty);
session.markSaved();
check("markSaved records the current history token", !session.dirty);
session.undo();
check("undoing a saved edit marks the prior state dirty", session.dirty);
session.replace(parseEdition(base.replace("alpha", "ALPHA")), "Branch edit");
check("a branch edit discards redo history", !session.canRedo());

finish("editor_session_check passed");
