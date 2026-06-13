/**
 * teiCrafter Editor -- shared authority-id form
 * (existing idno chips + add form + live register lookup).
 *
 * One source for the authority UI in BOTH places it appears: the index
 * overlay rows (index-panel.js) and the annotation editor at the mention
 * (editor-app.js, M2.11). Pure DOM; every mutation and lookup is reported
 * through hooks, the lossless standOff splice stays on the integrator's side.
 *
 * Contract:
 *   buildAuthorityForm(entity, hooks = {}) -> Element (.ed-idx-auth)
 *   entity: { id, name?, authorities?: [{ type, value }] }
 *   hooks: {
 *     onSet(authority, value),                  // add/replace (value set) or remove (value "")
 *     onLookup(authority, query, anchor, onPick), // live register search; onPick(id) commits
 *   }
 *
 * The register list comes from standoff.js AUTHORITIES (single source).
 * Styling: token-only ed-idx-auth* classes in editor.css.
 */

import { el } from "./dom.js";
import { AUTHORITIES } from "./standoff.js";
import { recordUrl } from "../services/authority-lookup.js";

export function buildAuthorityForm(entity, hooks = {}) {
  const onSet = typeof hooks.onSet === "function" ? hooks.onSet : () => {};
  const onLookup = typeof hooks.onLookup === "function" ? hooks.onLookup : () => {};

  const list = el("div", { class: "ed-idx-authlist" });
  const auths = Array.isArray(entity.authorities) ? entity.authorities : [];
  for (const a of auths) {
    // The id value links to the register's record, so an attached id can be
    // verified in one click; falls back to plain text for an unknown register.
    const url = recordUrl(a.type, a.value);
    const valNode = url
      ? el("a", {
          class: "ed-idx-authval ed-idx-authlink", text: a.value,
          href: url, target: "_blank", rel: "noopener noreferrer",
          title: `Open this ${a.type || "id"} record in a new tab`,
          onclick: (e) => e.stopPropagation(),
        })
      : el("span", { class: "ed-idx-authval", text: a.value });
    list.appendChild(el("span", { class: "ed-idx-authid", title: `${a.type || "id"}: ${a.value}` }, [
      el("span", { class: "ed-idx-authtype", text: a.type || "id" }),
      valNode,
      el("button", {
        class: "ed-idx-btn ed-idx-authdel", type: "button",
        title: "Remove this id", "aria-label": "Remove id", text: "x",
        onclick: (e) => { e.stopPropagation(); onSet(a.type, ""); },
      }),
    ]));
  }

  const typeSel = el("select", { class: "ed-idx-authtypesel", title: "Authority register" },
    AUTHORITIES.map((name) => el("option", { value: name, text: name })));
  const valInput = el("input", {
    class: "ed-idx-authinput", type: "text", placeholder: "authority id or URI",
    title: "Paste an id or URI, or use find to search the register by name",
  });
  // Inside the annotation popover a mouseup would bubble to the global
  // selection handler; harmless in the overlay.
  valInput.addEventListener("mouseup", (e) => e.stopPropagation());
  const submit = () => {
    const value = valInput.value.trim();
    if (!value) return;
    onSet(typeSel.value, value);
    valInput.value = "";
  };
  valInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
  });
  const addForm = el("div", { class: "ed-idx-authadd" }, [
    typeSel,
    valInput,
    el("button", {
      class: "ed-idx-btn", type: "button",
      title: "Add this authority id", "aria-label": "Add id", text: "+id",
      onclick: (e) => { e.stopPropagation(); submit(); },
    }),
    el("button", {
      class: "ed-idx-btn", type: "button",
      title: "Search this register (uses the typed text, else the entity name); pick a hit to attach its id",
      "aria-label": "Look up id", text: "find",
      onclick: (e) => {
        e.stopPropagation();
        onLookup(typeSel.value, valInput.value.trim() || entity.name, addForm, (id) => {
          valInput.value = id;
          submit();
        });
      },
    }),
  ]);

  return el("div", { class: "ed-idx-auth" }, [list, addForm]);
}
