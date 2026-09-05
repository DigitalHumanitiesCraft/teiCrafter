import { el } from "./dom.js";
import { DEFAULT_REVIEWER, DEFAULT_REVIEW_RATIONALE } from "./review-record.js";
import { getSetting, setSetting } from "../services/storage.js";

export function chooseReviewDetails(unit, previous = null) {
  return new Promise((resolve) => {
    const dialog = el("dialog", { class: "ed-review-dialog", "aria-labelledby": "ed-review-title" });
    const form = el("form");
    form.appendChild(el("h2", { id: "ed-review-title", text: `Review ${unit}` }));
    form.appendChild(el("p", { text: "This review covers the source unit and its inline markup. Referenced register entries and other units need their own review." }));
    if (previous) form.appendChild(el("p", { text: `Previous record: ${previous.who || "unspecified reviewer"}, ${previous.when || "undated"}. ${previous.rationale || ""}` }));
    const identity = el("input", { type: "text", required: "", value: getSetting("reviewerIdentity", DEFAULT_REVIEWER) });
    const rationale = el("textarea", { rows: "3", required: "" });
    rationale.value = DEFAULT_REVIEW_RATIONALE;
    form.appendChild(el("label", {}, [el("span", { text: "Reviewer identifier (URI or TEI pointer)" }), identity]));
    form.appendChild(el("p", { class: "ed-review-hint", text: "The default identifier means an unnamed local editor. Enter your own identifier to record a named responsibility." }));
    form.appendChild(el("label", {}, [el("span", { text: "Review rationale" }), rationale]));
    const actions = el("div", { class: "ed-review-actions" });
    const cancel = el("button", { type: "button", class: "ed-btn", text: "Cancel" });
    const submit = el("button", { type: "submit", class: "ed-btn ed-btn-primary", text: "Mark reviewed" });
    actions.append(cancel, submit);
    form.appendChild(actions);
    dialog.appendChild(form);
    let result = null;
    cancel.addEventListener("click", () => dialog.close());
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      result = { who: identity.value.trim(), rationale: rationale.value.trim() };
      setSetting("reviewerIdentity", result.who);
      dialog.close();
    });
    dialog.addEventListener("close", () => { dialog.remove(); resolve(result); });
    document.body.appendChild(dialog);
    dialog.showModal();
    identity.focus();
  });
}
