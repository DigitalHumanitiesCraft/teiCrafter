/** Proof: in-place save detects a file changed since load. */

import { fileVersion, fileVersionChanged } from "../../docs/js/editor/file-version.js";
import { check, finish, section } from "./_assert.mjs";

section("File version conflict guard");

const opened = fileVersion({ size: 1200, lastModified: 100 });
check("unchanged metadata permits an in-place save",
  !fileVersionChanged(opened, fileVersion({ size: 1200, lastModified: 100 })));
check("a changed size blocks an in-place save",
  fileVersionChanged(opened, fileVersion({ size: 1201, lastModified: 100 })));
check("a changed modification time blocks an in-place save",
  fileVersionChanged(opened, fileVersion({ size: 1200, lastModified: 101 })));
check("the load snapshot is a value copy",
  opened.size === 1200 && opened.lastModified === 100);

finish("External file changes are detected before an in-place write.");
