import { galleryCards, renderGallery } from "./derivation-gallery.js";
import { FEATURES, llmEnabled } from "./utils/constants.js";

if (FEATURES.examples) {
  document.getElementById("examples").hidden = false;
}

if (llmEnabled()) {
  document.getElementById("lp-llm-onramp").hidden = false;
}

// Without the data the gallery stays hidden; the rest of the page does not depend on it.
const gallery = document.getElementById("editions");
try {
  const response = await fetch("data/derivations.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  renderGallery(document.getElementById("editions-list"), galleryCards(await response.json()));
  gallery.hidden = false;
} catch (error) {
  console.warn(`The editions gallery is not shown: ${error.message}`);
}
