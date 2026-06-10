/**
 * teiCrafter Editor -- OpenSeadragon facsimile viewer with zone overlays.
 *
 * Pure UI module. It depends only on the global OpenSeadragon (loaded via CDN by
 * the integrator) and imports NO project files. It replaces the synthetic SVG
 * placeholder in editor-app.js with a real pan/zoom image viewer whose <zone>
 * rectangles are overlaid on the page image and linked back to the reading text.
 *
 * Proven technique (mirrored from the sibling ZBZ viewer, not copied): init OSD
 * with a plain-image tileSource { type:'image', url }, then after the 'open'
 * event place one absolutely positioned overlay <div> per zone via
 * viewer.viewport.imageToViewportRectangle(x, y, w, h) + viewer.addOverlay(...).
 *
 * Coordinate model: zone coords are in image pixels and a surface's lrx/lry equal
 * the page image size, so a zone maps to imageToViewportRectangle(z.ulx, z.uly,
 * z.lrx - z.ulx, z.lry - z.uly) directly, with no percentage scaling.
 *
 * Contract:
 *   export function plainImageTileSource(url) -> { type:'image', url }
 *   export function createFacsimile(hostEl, opts) -> controller with
 *     showPage({ imageUrl, surface, onZoneEnter, onZoneLeave, onZoneClick })
 *     highlightZone(zoneIdOrIndex)
 *     clearHighlight()
 *     destroy()
 *
 * If window.OpenSeadragon is undefined, this degrades to a no-op empty state and
 * logs a console.warn; it never throws.
 */

// OSD ships its own UI sprite set; this CDN path matches the version the
// integrator loads. Kept here so the module stays self-contained.
const OSD_PREFIX = "https://cdn.jsdelivr.net/npm/openseadragon@5.0.1/build/openseadragon/images/";

// ---- tiny DOM helpers (same shape as editor-app.js) ------------------------

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
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

function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
}

/** Plain-image tileSource for a single full-resolution page image (no tiling). */
export function plainImageTileSource(url) {
  return { type: "image", url };
}

/**
 * Create a facsimile controller bound to hostEl.
 *
 * opts.tileSourceFor(imageUrl) is an optional hook so a IIIF info.json or
 * manifest-backed source can be injected later; it defaults to
 * plainImageTileSource so the editor works against plain page images today.
 */
export function createFacsimile(hostEl, opts = {}) {
  const tileSourceFor = typeof opts.tileSourceFor === "function" ? opts.tileSourceFor : plainImageTileSource;
  const hasOSD = typeof window !== "undefined" && window.OpenSeadragon;

  // Per-controller state. The OSD instance is reused across pages when possible
  // (viewer.open(newTileSource)); overlays are torn down and rebuilt each page.
  let viewer = null;       // OpenSeadragon instance, or null
  let osdHost = null;      // the element OSD draws into (kept stable across pages)
  let openHandler = null;  // current 'open' handler, removed before each page swap
  let overlays = [];       // [{ id, index, element }] for the current page
  let warned = false;
  let zonesShown = false;  // layout zones are hidden by default; hover or the toggle reveals them
  let toggleBtn = null;    // the panel's "Zones" show/hide control

  if (!hasOSD) {
    console.warn("facsimile.js: window.OpenSeadragon is undefined; facsimile viewer degraded to empty state.");
    warned = true;
  }

  // ---- empty / loading / error states (no OSD or no data) ------------------

  function showEmpty(message) {
    teardownOverlays();
    detachOpenHandler();
    if (viewer) {
      // Keep the instance alive but blank it, so a later showPage can reopen.
      try { viewer.close(); } catch (e) { /* ignore */ }
    }
    clear(hostEl);
    hostEl.appendChild(el("div", { class: "ed-empty", text: message }));
  }

  // ---- overlay lifecycle ---------------------------------------------------

  function teardownOverlays() {
    if (viewer) {
      for (const o of overlays) {
        try { viewer.removeOverlay(o.element); } catch (e) { /* ignore */ }
      }
    }
    overlays = [];
  }

  function detachOpenHandler() {
    if (viewer && openHandler) {
      try { viewer.removeHandler("open", openHandler); } catch (e) { /* ignore */ }
    }
    openHandler = null;
  }

  function addZoneOverlays(surface, handlers) {
    if (!viewer || !surface || !Array.isArray(surface.zones)) return;
    const vp = viewer.viewport;
    surface.zones.forEach((z, index) => {
      const x = z.ulx ?? 0;
      const y = z.uly ?? 0;
      const w = (z.lrx ?? x) - x;
      const h = (z.lry ?? y) - y;
      if (!(w > 0) || !(h > 0)) return; // skip degenerate zones, do not crash
      const element = el("div", {
        class: "ed-osd-zone",
        dataset: { zoneid: z.id || "", zone: String(index) },
      });
      const zid = z.id;
      element.addEventListener("mouseenter", () => handlers.onZoneEnter && handlers.onZoneEnter(zid, index));
      element.addEventListener("mouseleave", () => handlers.onZoneLeave && handlers.onZoneLeave(zid, index));
      element.addEventListener("click", () => handlers.onZoneClick && handlers.onZoneClick(zid, index));
      const location = vp.imageToViewportRectangle(x, y, w, h);
      viewer.addOverlay({ element, location });
      overlays.push({ id: z.id || null, index, element });
    });
  }

  // ---- OSD instance --------------------------------------------------------

  function ensureViewer() {
    if (viewer) return viewer;
    clear(hostEl);
    // Neutral inner class (not ed-osd): the host #ed-osd already carries the
    // ed-osd frame; the inner element only needs to fill it.
    osdHost = el("div", { class: "ed-osd-canvas" });
    // OSD needs a sized element; the host pane controls layout, the inner
    // element just fills it. Inline size keeps the module CSS-free.
    osdHost.style.width = "100%";
    osdHost.style.height = "100%";
    hostEl.appendChild(osdHost);
    viewer = window.OpenSeadragon({
      element: osdHost,
      prefixUrl: OSD_PREFIX,
      showNavigator: false,
      showRotationControl: true,
      showFullPageControl: false,
      showHomeControl: true,
      showZoomControl: true,
      gestureSettingsMouse: { clickToZoom: false, scrollToZoom: true },
      minZoomLevel: 0.5,
      maxZoomPixelRatio: 6,
      visibilityRatio: 0.8,
      constrainDuringPan: true,
      animationTime: 0.5,
    });
    return viewer;
  }

  // ---- public: show a page -------------------------------------------------

  function showPage({ imageUrl, surface, onZoneEnter, onZoneLeave, onZoneClick } = {}) {
    if (!hasOSD) {
      if (!warned) {
        console.warn("facsimile.js: window.OpenSeadragon is undefined; cannot show page.");
        warned = true;
      }
      showEmpty("Facsimile viewer unavailable (OpenSeadragon not loaded).");
      return;
    }
    if (!imageUrl || !surface) {
      showEmpty("No facsimile image for this folio.");
      return;
    }

    ensureViewer();
    ensureZonesToggle();
    teardownOverlays();
    detachOpenHandler();

    const handlers = { onZoneEnter, onZoneLeave, onZoneClick };
    openHandler = () => addZoneOverlays(surface, handlers);
    viewer.addHandler("open", openHandler);

    // open() swaps the tile source on the existing instance; the 'open' handler
    // then places the overlays once the image dimensions are known.
    try {
      viewer.open(tileSourceFor(imageUrl));
    } catch (e) {
      showEmpty("Facsimile could not be opened.");
    }
  }

  // ---- public: highlight a zone by id or numeric index ---------------------

  function findOverlay(zoneIdOrIndex) {
    if (zoneIdOrIndex == null) return null;
    // Match by id first (string), then by numeric index.
    let hit = overlays.find((o) => o.id != null && o.id === zoneIdOrIndex);
    if (hit) return hit;
    const idx = Number(zoneIdOrIndex);
    if (Number.isInteger(idx)) hit = overlays.find((o) => o.index === idx);
    return hit || null;
  }

  function highlightZone(zoneIdOrIndex, panTo = false) {
    clearHighlight();
    const hit = findOverlay(zoneIdOrIndex);
    if (!hit) return;
    hit.element.classList.add("linked");
    if (panTo && viewer) {
      try {
        // Resolve the live OSD overlay to get its current viewport bounds,
        // then center the viewport on it.
        const overlay = viewer.getOverlayById && viewer.getOverlayById(hit.element);
        const loc = overlay && overlay.getBounds ? overlay.getBounds(viewer.viewport) : null;
        if (loc) viewer.viewport.panTo(loc.getCenter(), false);
      } catch (e) { /* ignore pan failures */ }
    }
  }

  function clearHighlight() {
    for (const o of overlays) o.element.classList.remove("linked");
  }

  // ---- zone visibility (layout on/off) -------------------------------------
  // Zones are hidden by default and revealed on hover (the reading text drives
  // highlightZone). The toggle shows or hides them all at once. The control is a
  // panel-corner button, not an OSD overlay, so it stays put while the image pans.

  function applyZonesShown() {
    if (osdHost) osdHost.classList.toggle("ed-zones-shown", zonesShown);
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-pressed", String(zonesShown));
      toggleBtn.classList.toggle("active", zonesShown);
    }
  }

  function setZonesShown(on) {
    zonesShown = !!on;
    applyZonesShown();
  }

  function ensureZonesToggle() {
    if (toggleBtn && toggleBtn.isConnected) { applyZonesShown(); return; }
    toggleBtn = el("button", {
      class: "ed-zones-toggle", type: "button",
      title: "Show the layout zones on the image (otherwise a zone is revealed when you hover its line)",
      "aria-pressed": String(zonesShown),
      text: "Zones",
      onclick: () => setZonesShown(!zonesShown),
    });
    hostEl.appendChild(toggleBtn);
    applyZonesShown();
  }

  // ---- public: destroy -----------------------------------------------------

  function destroy() {
    teardownOverlays();
    detachOpenHandler();
    if (viewer) {
      try { viewer.destroy(); } catch (e) { /* ignore */ }
      viewer = null;
    }
    osdHost = null;
    toggleBtn = null;
    clear(hostEl);
  }

  return { showPage, highlightZone, clearHighlight, setZonesShown, destroy };
}
