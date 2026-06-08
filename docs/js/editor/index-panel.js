/**
 * teiCrafter Editor -- Index-management panel
 * (Persons / Places / Organisations / Works / Events).
 *
 * Pure DOM module. It imports nothing from the project: it receives entity data
 * via render() and reports every user intent through the hooks passed at
 * construction. The data model (slugifying ids, mutating the TEI standOff, the
 * lossless splice) lives entirely on the integrator's side; this module only
 * draws the index sections and routes clicks.
 *
 * Contract:
 *   createIndexPanel(hostEl, hooks = {}) -> { render(entities), setActive(id), clear() }
 *   hooks: {
 *     onAdd(type, { name }),                 // type in person|place|org|work|event; id is the model's job
 *     onUpdate(id, { name }),                // inline rename committed
 *     onDelete(id),                          // delete button
 *     onSelect(entity),                      // row body clicked (also marks it active)
 *     onStartLink(entity),                   // small "link" button clicked
 *     onSetAuthority(id, { authority, value }), // add/replace (value set) or remove (value "") an idno
 *   }
 *   render(entities) with entities = { persons:[E], places:[E], orgs:[E], works:[E], events:[E] }
 *   E = { id, type, name, authorities:[{ type, value }] }
 *
 * Styling: token-only classes prefixed ed-idx- (defined in editor.css by the
 * integrator). No inline colors.
 */

// Authority registers offered in the add-id selector, in display order. Kept in
// sync with standoff.js AUTHORITIES (this module imports nothing, so it is a copy).
const AUTHORITIES = ["GND", "GeoNames", "Wikidata"];

// ---- tiny DOM helpers (self-contained; mirrors el() in editor-app.js) ------

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (k === "dataset") for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
    else if (v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// The three sections, in render order. label is the section heading; type is the
// value handed back to onAdd; key is the property read off the entities object.
const SECTIONS = [
  { type: "person", key: "persons", label: "Persons", addLabel: "add person" },
  { type: "place", key: "places", label: "Places", addLabel: "add place" },
  { type: "org", key: "orgs", label: "Organisations", addLabel: "add organisation" },
  { type: "work", key: "works", label: "Works", addLabel: "add work" },
  { type: "event", key: "events", label: "Events", addLabel: "add event" },
];

export function createIndexPanel(hostEl, hooks = {}) {
  const onAdd = typeof hooks.onAdd === "function" ? hooks.onAdd : () => {};
  const onUpdate = typeof hooks.onUpdate === "function" ? hooks.onUpdate : () => {};
  const onDelete = typeof hooks.onDelete === "function" ? hooks.onDelete : () => {};
  const onSelect = typeof hooks.onSelect === "function" ? hooks.onSelect : () => {};
  const onStartLink = typeof hooks.onStartLink === "function" ? hooks.onStartLink : () => {};
  const onSetAuthority = typeof hooks.onSetAuthority === "function" ? hooks.onSetAuthority : () => {};

  // Active id is owned here so re-rendering re-applies the highlight. Row nodes
  // are indexed by id for setActive() to toggle without a full re-render.
  let activeId = null;
  let rowById = new Map();

  function applyActive() {
    for (const [id, row] of rowById) row.classList.toggle("ed-idx-row-active", id === activeId);
  }

  // ---- one entity row ------------------------------------------------------

  function buildRow(entity) {
    const row = el("div", { class: "ed-idx-row", dataset: { id: entity.id } });

    // Body: name + faded id. Clicking it selects the entity.
    const body = el("button", {
      class: "ed-idx-rowbody",
      type: "button",
      title: "Select this entity",
      onclick: () => {
        setActive(entity.id);
        onSelect(entity);
      },
    }, [
      el("span", { class: "ed-idx-name", text: entity.name || "(unnamed)" }),
      el("span", { class: "ed-idx-id", text: entity.id }),
    ]);

    // Inline rename: swap the name span for an input bound to onUpdate.
    const beginRename = () => {
      if (row.querySelector(".ed-idx-rename")) return; // already renaming
      const input = el("input", {
        class: "ed-idx-rename",
        type: "text",
        value: entity.name || "",
      });
      const nameSpan = body.querySelector(".ed-idx-name");
      nameSpan.replaceWith(input);
      input.focus();
      input.select();

      let done = false;
      const finish = (commit) => {
        if (done) return;
        done = true;
        const next = input.value.trim();
        if (commit && next && next !== entity.name) onUpdate(entity.id, { name: next });
        // Restore the static view; the integrator re-renders on a real change.
        const restored = el("span", { class: "ed-idx-name", text: (commit && next) ? next : (entity.name || "(unnamed)") });
        input.replaceWith(restored);
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); finish(true); }
        else if (e.key === "Escape") { e.preventDefault(); finish(false); }
      });
      input.addEventListener("blur", () => finish(true));
    };

    const actions = el("div", { class: "ed-idx-actions" }, [
      el("button", {
        class: "ed-idx-btn ed-idx-edit", type: "button", title: "Rename",
        "aria-label": "Rename", text: "edit",
        onclick: beginRename,
      }),
      el("button", {
        class: "ed-idx-btn ed-idx-link", type: "button", title: "Link this entity to the selected text",
        "aria-label": "Link", text: "link",
        onclick: () => onStartLink(entity),
      }),
      el("button", {
        class: "ed-idx-btn ed-idx-delete", type: "button", title: "Delete",
        "aria-label": "Delete", text: "delete",
        onclick: () => onDelete(entity.id),
      }),
    ]);

    const main = el("div", { class: "ed-idx-rowmain" });
    main.appendChild(body);
    main.appendChild(actions);
    row.appendChild(main);
    row.appendChild(buildAuthorities(entity));
    return row;
  }

  // ---- authority ids (idno) for one entity ---------------------------------

  function buildAuthorities(entity) {
    const list = el("div", { class: "ed-idx-authlist" });
    const auths = Array.isArray(entity.authorities) ? entity.authorities : [];
    for (const a of auths) {
      list.appendChild(el("span", { class: "ed-idx-authid", title: `${a.type || "id"}: ${a.value}` }, [
        el("span", { class: "ed-idx-authtype", text: a.type || "id" }),
        el("span", { class: "ed-idx-authval", text: a.value }),
        el("button", {
          class: "ed-idx-btn ed-idx-authdel", type: "button",
          title: "Remove this id", "aria-label": "Remove id", text: "x",
          onclick: () => onSetAuthority(entity.id, { authority: a.type, value: "" }),
        }),
      ]));
    }

    const typeSel = el("select", { class: "ed-idx-authtypesel", title: "Authority register" },
      AUTHORITIES.map((name) => el("option", { value: name, text: name })));
    const valInput = el("input", {
      class: "ed-idx-authinput", type: "text", placeholder: "authority id or URI",
    });
    const submit = () => {
      const value = valInput.value.trim();
      if (!value) return;
      onSetAuthority(entity.id, { authority: typeSel.value, value });
      valInput.value = "";
    };
    valInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
    });
    const addForm = el("div", { class: "ed-idx-authadd" }, [
      typeSel,
      valInput,
      el("button", {
        class: "ed-idx-btn ed-idx-authaddbtn", type: "button",
        title: "Add authority id", "aria-label": "Add id", text: "+id",
        onclick: submit,
      }),
    ]);

    return el("div", { class: "ed-idx-auth" }, [list, addForm]);
  }

  // ---- the "+ add" row -----------------------------------------------------

  function buildAddRow(section) {
    const input = el("input", {
      class: "ed-idx-add-input", type: "text", placeholder: section.addLabel,
    });
    const submit = () => {
      const name = input.value.trim();
      if (!name) return;
      onAdd(section.type, { name });
      input.value = "";
      input.focus();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
    });
    return el("div", { class: "ed-idx-addrow" }, [
      el("button", {
        class: "ed-idx-btn ed-idx-add", type: "button", title: "Add",
        "aria-label": "Add", text: "+",
        onclick: submit,
      }),
      input,
    ]);
  }

  // ---- one section ---------------------------------------------------------

  function buildSection(section, items) {
    const list = el("div", { class: "ed-idx-list" });
    if (!items.length) {
      list.appendChild(el("div", { class: "ed-idx-empty", text: "No entries yet." }));
    } else {
      for (const entity of items) {
        const row = buildRow(entity);
        rowById.set(entity.id, row);
        list.appendChild(row);
      }
    }
    return el("section", { class: "ed-idx-section", dataset: { type: section.type } }, [
      el("h4", { class: "ed-idx-heading" }, [
        el("span", { text: section.label }),
        el("span", { class: "ed-idx-count", text: String(items.length) }),
      ]),
      list,
      buildAddRow(section),
    ]);
  }

  // ---- public API ----------------------------------------------------------

  function render(entities = {}) {
    clearNode(hostEl);
    rowById = new Map();
    const root = el("div", { class: "ed-idx" });
    for (const section of SECTIONS) {
      const items = Array.isArray(entities[section.key]) ? entities[section.key] : [];
      root.appendChild(buildSection(section, items));
    }
    hostEl.appendChild(root);
    applyActive();
  }

  function setActive(id) {
    activeId = id;
    applyActive();
  }

  function clear() {
    activeId = null;
    rowById = new Map();
    clearNode(hostEl);
  }

  return { render, setActive, clear };
}
