import { createRevisionCache } from "../../docs/js/editor/revision-cache.js";
import { check, finish, section } from "./_assert.mjs";

section("Document revision projection cache");

const cache = createRevisionCache();
let computations = 0;
const compute = () => ({ id: ++computations });
const opened = { sessionId: 4, revision: 0 };
const first = cache.get(opened, "annotation-pages", compute);
const second = cache.get(opened, "annotation-pages", compute);
check("one projection computes once within a revision",
  first === second && computations === 1);

const other = cache.get(opened, "entity-meta", compute);
check("different projections retain independent entries",
  other !== first && computations === 2);

const revised = cache.get({ sessionId: 4, revision: 1 }, "annotation-pages", compute);
check("a new revision invalidates every prior projection",
  revised !== first && computations === 3);

const replaced = cache.get({ sessionId: 5, revision: 0 }, "annotation-pages", compute);
check("a replacement session invalidates same-number revisions",
  replaced !== revised && computations === 4);

cache.clear();
check("an explicit clear invalidates the active revision",
  cache.get({ sessionId: 5, revision: 0 }, "annotation-pages", compute) !== replaced
    && computations === 5);

finish("revision_cache_check passed");
