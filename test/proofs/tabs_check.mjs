import { nextTabIndex } from "../../docs/js/editor/tabs.js";
import { check, finish, section } from "./_assert.mjs";

section("Tab keyboard navigation");
check("ArrowRight advances", nextTabIndex(1, 3, "ArrowRight") === 2);
check("ArrowRight wraps", nextTabIndex(2, 3, "ArrowRight") === 0);
check("ArrowLeft wraps", nextTabIndex(0, 3, "ArrowLeft") === 2);
check("Home selects first", nextTabIndex(2, 3, "Home") === 0);
check("End selects last", nextTabIndex(0, 3, "End") === 2);
check("unrelated keys retain the current tab", nextTabIndex(1, 3, "PageDown") === 1);
finish("tabs_check passed");
