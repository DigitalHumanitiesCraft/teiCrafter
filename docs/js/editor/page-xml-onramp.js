import { el } from "./dom.js";
import { decodeXmlBytes } from "./file-encoding.js";
import { importPageXml } from "./page-xml-import.js";

/** Mount the deterministic PAGE import form; the caller owns draft/recovery transitions. */
export function mountPageXmlImport(host, { onImport, status = () => {}, readOnly = () => false }) {
  let disposed = false;
  let busy = false;
  const form = el("form", { class: "ed-wb-form", "aria-label": "Import PAGE XML" });
  const title = el("input", { name: "title", value: "Imported PAGE transcription", required: true });
  const files = el("input", { type: "file", name: "page-files", accept: ".xml,application/xml,text/xml", multiple: true, required: true });
  const mets = el("input", { type: "file", name: "mets-file", accept: ".xml,application/xml,text/xml" });
  const ordering = el("select", { name: "order" }, [
    el("option", { value: "filename", text: "Natural filename order" }),
    el("option", { value: "selection", text: "Selected file order" }),
  ]);
  const feedback = el("p", { class: "ed-wb-feedback", role: "status" });
  const submit = el("button", { class: "ed-btn", type: "submit", text: "Create TEI draft", disabled: readOnly() });
  const label = (text, control) => el("label", { class: "ed-wb-field" }, [el("span", { text }), control]);
  form.append(el("h3", { text: "Import PAGE XML" }),
    el("p", { text: "Create a separate TEI draft from selected PAGE files. Text, page geometry and source annotations are retained. The new draft requires editorial review." }),
    label("Draft title", title), label("PAGE XML files", files), label("Page order", ordering),
    label("METS order file (optional)", mets),
    el("p", { text: "A supplied METS file determines page order. Otherwise the selected ordering is used. Keep the original PAGE files for their complete source metadata. Images remain external files." }),
    submit, feedback);
  const show = (message) => { if (!disposed) { feedback.textContent = message; status(message); } };
  files.addEventListener("change", () => {
    const names = Array.from(files.files || []).map((file) => file.name);
    show(names.length ? `${names.length} PAGE files selected: ${names.join(", ")}` : "Choose PAGE XML files.");
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (disposed || busy || readOnly() || !form.reportValidity()) return;
    busy = true; submit.disabled = true;
    try {
      const selected = Array.from(files.files || []);
      const metsFile = mets.files?.[0];
      const options = { title: title.value, order: ordering.value, teiType: "wenzelsbibel-transcription" };
      const pageFiles = await Promise.all(selected.map(async (file) => ({ name: file.name, raw: decodeXmlBytes(await file.arrayBuffer()).text })));
      const result = importPageXml(pageFiles, {
        ...options,
        mets: metsFile ? decodeXmlBytes(await metsFile.arrayBuffer()).text : null,
      });
      if (disposed || readOnly()) return;
      const accepted = await onImport(result);
      if (accepted !== false) show(`Created a separate TEI draft from ${result.pages.length} pages in ${result.order}.${result.warnings.length ? ` ${result.warnings.join(" ")}` : ""}`);
    } catch (error) { show(error.message); }
    finally { busy = false; if (!disposed) submit.disabled = readOnly(); }
  });
  host.append(form);
  return { dispose: () => { disposed = true; form.remove(); } };
}
