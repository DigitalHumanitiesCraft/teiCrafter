# Tool-Landschaft und strategische Positionierung

Marktanalyse browserbasierter TEI-Annotationswerkzeuge und LLM-gestützter Annotation in den Digital Humanities. Informiert die Entwicklungsstrategie von teiCrafter.

Stand: 2026-02-18 (Session 14)

**Quellen:** Recherche aus Trainingswissen (bis Mai 2025), ergänzt durch Web-Recherche. Empfehlung: Gegen aktuelle Tool-Websites und DH-Konferenzberichte (DH2025, TEI Conference 2025) verifizieren.

---

## 1. Bestehende Werkzeuge

### Tier 1: Vollständige TEI-Editierumgebungen

**Oxygen XML Web Author** (oxygenxml.com)
- Vollständigster browserbasierter XML-Editor. Schema-aware Editing mit Autovervollständigung, Author Mode (WYSIWYG via CSS), Tracked Changes, Kommentare. CMS-Backends (eXist-db, MarkLogic, GitHub).
- Schwächen: Kommerziell (hohe Lizenzkosten pro User), erfordert Server-Komponente, überfrachtet für nicht-technische Scholars. Generischer XML-Editor mit TEI-Framework-Schicht.

**ediarum** (BBAW)
- Zweckgebaut für kritische/wissenschaftliche Editionen. Umfangreiche TEI-Anpassung (Apparat, Register, Briefe, Tagebücher). Integrierte Publishing-Pipeline zu eXist-db. ediarum.WEB für eingeschränkte Browser-Funktionalität.
- Schwächen: Primär Desktop-Tool (Oxygen Author Framework), erfordert Oxygen-Lizenz, eng an BBAW-Infrastruktur gekoppelt, steile Lernkurve.

**TEI Publisher** (e-editiones)
- Community-getriebenes Open-Source auf eXist-db. Publishing-Pipeline (Ingest, ODD/Processing-Model-Transform, Publish). Web-Components-Architektur. Annotation-Editor ab v8+ (2023–2024).
- Schwächen: Erfordert eXist-db Server, Annotation-Editing sekundär zum Publishing-Fokus, hohe Lernkurve für ODD-Customization.

### Tier 2: Annotationsplattformen (nicht TEI-nativ)

**CATMA** (Uni Hamburg)
- Zweckgebaut für literarische/geisteswissenschaftliche Annotation. Flexible Tagsets, kollaborativ, integrierte Analyse und Visualisierung, Git-backed Versionskontrolle. Kostenlos, webbasiert.
- Schwächen: Kein TEI-Tool – nutzt eigenes Standoff-Annotationsmodell. TEI-Export ist sekundär, kein 1:1-Mapping zu Inline-TEI. Limitierte strukturelle Markup-Unterstützung. UI teilweise veraltet.

**LEAF-Writer** (CWRC, Kanada)
- Browserbasierter Editor mit Standoff-Annotation auf TEI-Dokumenten, Named-Entity-Tagging, WYSIWYG-Editing.
- Schwächen: Kleinere Community, an CWRC-Infrastruktur gebunden, eingeschränkte Verbreitung außerhalb kanadischer DH-Projekte.

### Tier 3: Transkriptions-fokussierte Werkzeuge (TEI-Export als Nebenprodukt)

**Transkribus** (READ-COOP)
- Marktführer HTR mit 600k+ verarbeiteten Dokumenten. Layout-Analyse, Baseline-Erkennung, Custom-Model-Training. Browser-Version (Transkribus Lite) seit 2022–2023. Export zu TEI, PAGE XML, ALTO.
- Schwächen: Transkriptions-, nicht Annotations-Tool. TEI-Export ist basale Strukturierung. Freemium-Modell mit Credit-Limits. TEI-Output erfordert signifikante Nachbearbeitung.

**eScriptorium** (PSL/EPHE Paris)
- Vollständig Open-Source HTR auf Kraken-Engine. Starke Multi-Script-Unterstützung (Arabisch, Hebräisch, Lateinisch). IIIF-Support.
- Schwächen: Erfordert Server-Infrastruktur (Django + Celery + Redis + GPU). TEI-Export nur auf Zeilen-/Zonen-Ebene. Keine semantische Annotation.

**FromThePage** (kommerziell)
- Kollaborative Crowdsourced-Transkription für Archive und Bibliotheken. IIIF, Subject Indexing, TEI-XML-Export.
- Schwächen: Basaler TEI-Support, Transkriptions- statt Annotationsfokus, kommerzielles SaaS.

### Weitere

- **EVT** (Edition Visualization Technology): TEI-Viewer (nicht Editor), gut für diplomatische/kritische Editionen.
- **TextGrid**: Deutsche Forschungsinfrastruktur mit TextGridLab, teilweise veraltet.
- **Versioning Machine**: Paralleltext-Anzeige für TEI-Editionen.
- **Codex** (ehem. Textual Communities): Browserbasierte kollaborative TEI-Transkription.

---

## 2. Vergleichsmatrix

| Fähigkeit | Oxygen Web | ediarum | TEI Publisher | CATMA | Transkribus | teiCrafter |
|---|---|---|---|---|---|---|
| Browserbasiert, kein Server | Nein | Teilweise | Nein (eXist-db) | Ja (gehostet) | Ja (gehostet) | **Ja (statisch)** |
| TEI-natives Inline-Editing | Ja | Ja | Ja | Nein (Standoff) | Nein | **Ja** |
| LLM-gestützte Annotation | Nein | Nein | Nein | Nein | Nein (nur HTR) | **Ja (Kern)** |
| Schema-geführter LLM-Output | Nein | — | — | — | — | **Ja** |
| Human Review von AI-Vorschlägen | Tracked Changes | — | — | — | HTR-Konfidenz | **Ja (Kern)** |
| Kein Account/Lizenz nötig | Nein (Lizenz) | Nein (Lizenz) | Nein | Nein (Account) | Nein (Account) | **Ja** |
| Offline-fähig nach Laden | Nein | Nein | Nein | Nein | Nein | **Möglich** |
| Multi-Provider LLM | — | — | — | — | — | **Ja (6 Provider)** |
| Open Source | Nein | Teilweise | Ja | Ja | Nein | **Ja** |

---

## 3. LLM-gestützte Annotation: State of the Art

### Zentraler Befund

**Kein bestehendes, produktionsreifes Tool kombiniert eine TEI-Annotationsoberfläche mit LLM-gestützter Markup-Generierung.** Diese Lücke ist real und signifikant. teiCrafter ist First Mover.

### Was existiert

- **NER-Pipelines:** GPT-3.5/4 für Named Entity Recognition auf historischen Texten, anschließendes Mapping zu TEI-Tags. Vielversprechend, aber erhebliche Nachkorrektur nötig, besonders für historisches Deutsch, Latein, Altfranzösisch.
- **Strukturelles Markup:** Experimente mit GPT-4/Claude für `<div>`, `<p>`, `<pb>`, `<head>`. LLMs zeigen gutes TEI-P5-Verständnis, aber systematische Fehler (halluzinierte Attribute, inkonsistente Verschachtelung, Namespace-Verwechslung, Über-Annotation).
- **Tool-Integration (früh):** Transkribus exploriert NER/Strukturanalyse. Einige Oxygen-Plugins für AI-Autocomplete. Kein Tool hat ein vollständiges „LLM annotiert TEI" Feature.

### DH-Community-Konsens

Der vielversprechendste und methodisch akzeptabelste Ansatz: **LLMs als First-Pass-Annotator mit obligatorischem menschlichem Review.** Das bewahrt wissenschaftliche Autorität bei gleichzeitiger Reduktion repetitiver Arbeit. Die epistemische Asymmetrie (VISION.md) ist kein teiCrafter-spezifisches Konzept, sondern wird in der DH-Community breit diskutiert.

---

## 4. LLM + TEI-XML: Bekannte Failure Modes

| Failure Mode | Beschreibung | Mitigation in teiCrafter |
|---|---|---|
| **Malformed XML** | Nicht geschlossene Tags, überlappende Hierarchien | Well-Formedness-Check via DOMParser ✅ |
| **Text-Alteration** | „Korrektur" historischer Schreibweisen, stille Zeichenlöschung | Plaintext-Vergleich (validator.js `checkPlaintext`) ✅ |
| **Halluzinierte Attribute** | Erfundene Attributnamen/-werte | Schema-Validierung ✅, Attribut-Bereinigung im Export ✅ |
| **Über-Annotation** | Alles Mögliche wird annotiert (Recall > Precision) | Prompt-Regel „Präzision vor Recall" ✅, Konfidenz-Scoring ✅ |
| **Unter-Annotation** | Entitäten in Abkürzungen/hist. Schreibweisen übersehen | 📋 Multi-Pass, „Suggest more"-Button |
| **Namespace-Verwechslung** | TEI P5 mit anderen XML-Vocabularies gemischt | ANNOTATION_TAGS Whitelist ✅ |
| **Struktur vs. Semantik** | LLM ändert `<div>`/`<p>` statt nur NER | selectedTypes-Filter in transform.js ✅ |
| **Inkonsistenz** | Gleiche Entität unterschiedlich annotiert | 📋 Konsistenz-Check (Phase 3) |

---

## 5. Best Practices für Review-Workflows

### Accept/Reject/Edit-Triade

Standard-Pattern in Prodigy, Label Studio, INCEpTION:

- **Accept** = niedrigster kognitiver Aufwand, optimiert für den Normalfall (ein Klick/Tastendruck)
- **Reject** = Annotation wird entfernt
- **Edit** = Annotation wird modifiziert, inline (nicht modal) für minimalen Flow-Bruch
- **Pre-Accept** bei hoher Konfidenz reduziert Review-Fatigue dramatisch

### Konfidenz-Anzeige (Forschungslage)

- **3 Levels Maximum** – mehr erzeugt kognitive Überladung (Kay et al. 2016)
- **Benannte Kategorien** statt numerischer Scores – User denken in „sicher/unsicher/falsch", nicht „0.73 Konfidenz"
- **Dual-Channel-Encoding** für Barrierefreiheit – zwei unabhängige visuelle Kanäle
- **Aggregat-Statistiken** immer sichtbar – „87% sicher, 10% prüfenswert, 3% problematisch"
- **Persistente Legende** – User müssen Farbcodes nicht memorieren

**Bewertung teiCrafter:** Das aktuelle System (sicher/prüfenswert/problematisch + manuell) mit Dual-Channel (Unterstreichungsfarbe + Hintergrund-Tint) ist nahe am Optimum laut Forschungslage.

### Batch vs. Inline Review

| Modus | Bester Einsatz | Kognitives Modell |
|---|---|---|
| **Inline** | Korrekturlesen, Kontextfehler, kleine Dokumente | „Lesen mit Unterbrechungen" |
| **Batch** | Hohe Annotationszahl, NER-Konsistenz, systematische Vollständigkeit | „Stapel sortieren" |

**Empfohlener Hybrid:** Inline-Review zur Orientierung, dann Batch-Review für Vollständigkeit, mit Filterung (nach Konfidenz, Tag-Typ, Review-Status).

---

## 6. Prompt Engineering für TEI-XML

Best Practices aus Forschung und Praxis:

1. **Few-Shot-Beispiele sind essenziell.** 2–3 annotierte Beispiele im Prompt sind effektiver als seitenlange Regeln.
2. **Lange Dokumente chunken.** Absatzweise senden reduziert Text-Alteration.
3. **Separate Passes für unterschiedliche Annotationstypen.** Strukturell → Semantisch → Referenzen.
4. **Niedrige Temperature** (0.1–0.3) für Markup-Generierung.
5. **Selbsteinschätzung anfordern.** `@confidence`-Attribute – LLMs sind bei NER-Certainty brauchbar kalibriert.
6. **Output-Format strikt einschränken.** „Nur annotiertes XML zurückgeben, keine Erklärungen."

---

## 7. State Management in Vanilla JS (Forschungslage)

### EventTarget ist die richtige Wahl

| Pattern | Komplexität | Geeignet für |
|---|---|---|
| **EventTarget** (nativ) | Niedrig | Single Document Model, moderate Event-Anzahl |
| **Proxy-basierte Reaktivität** | Mittel | Fine-grained Property-Observation |
| **Observable/BehaviorSubject** | Mittel | Stream-lastige, async-lastige Apps |
| **Redux-style Store** | Hoch | Große Teams, komplexe State-Graphen |

teiCrafters `DocumentModel extends EventTarget` ist korrekt: Zero Dependencies, native Browser-API, Standard-Semantik, natürliche Komposition mit DOM-Events.

### Snapshot-Undo ist pragmatisch korrekt

- TEI-XML-Dokumente typischerweise <1MB → Snapshots sind günstig
- `MAX_UNDO = 100` verhindert Speicherprobleme
- Keystroke-Gruppierung (500ms) verhindert Single-Character-Undo-Einträge
- Korrektheit ist garantiert – kein Risiko einer fehlerhaften `undo()`-Implementierung

### Walking Skeleton Pattern

Die Software-Engineering-Literatur (Cockburn 2004, Freeman & Pryce 2009, Hunt & Thomas 1999) ist eindeutig: **Walking Skeleton first, dann iterativ verbessern.** teiCrafters 10-Stufen-Stepper ist ein gut ausgeführtes Walking Skeleton. Der nächste Schritt ist nicht Architektur-Polish, sondern: das Skeleton unter Realbedingungen validieren.

---

## 8. Strategische Differenziatoren

| # | Differentiator | Begründung |
|---|---|---|
| 1 | **Zero Infrastructure** | Eliminiert die #1-Adoptionsbarriere in der DH-Tool-Landschaft. Kein Server, kein Account, kein Install. |
| 2 | **LLM als First-Pass-Annotator mit obligatorischem Human Review** | Adressiert sowohl das Tedium-Problem als auch die wissenschaftliche Accountability. |
| 3 | **Schema-Profil-geführter LLM-Output** | JSON-Schema-Profil verhindert halluziniertes Markup – echte Innovation. |
| 4 | **Bring Your Own API Key** | Kein Vendor Lock-in, kein laufender API-Kostenpunkt für das Tool selbst. |

---

## 9. Bekannte Lücken

| Lücke | Bedeutung | Zeithorizont |
|---|---|---|
| **Kollaboration** | Single-User. Multi-User enorm komplex. | Nicht absehbar |
| **IIIF/Bild-Integration** | Manuskript-Forscher brauchen Bild-Text-Alignment | Phase 3+ |
| **Große Dokumente** | Browser-Architektur ggf. problematisch >5–10 MB | Performance-Test nötig |
| **Normdaten/Register** | `<persName ref="">` → GND, VIAF, Wikidata | Phase 3 |
| **Annotations-Provenance** | Logging: welches LLM, welcher Prompt, welche Version | Empfohlen |
| **Konsistenz-Checks** | Gleiche Entität gleich annotieren | Phase 3 |

---

## Referenzen

- Cockburn, A. (2004). *Crystal Clear.* – Walking Skeleton
- Freeman, S. & Pryce, N. (2009). *Growing Object-Oriented Software, Guided by Tests.* – Evolutionary Design
- Hunt, A. & Thomas, D. (1999). *The Pragmatic Programmer.* – Tracer Bullets
- Kay, M. et al. (2016). „When (ish) is My Bus?" *CHI.* – Uncertainty Visualization
- Klie, J.-C. et al. (2018). „The INCEpTION Platform." *COLING.* – Human-in-the-Loop Annotation
- Montani, I. & Honnibal, M. (2018). Prodigy Annotation Tool. – Accept/Reject/Edit, Active Learning
- TEI Consortium. *TEI P5 Guidelines.* – TEI-XML Standard

---

**Verknüpfte Dokumente:**
- [VISION.md](VISION.md) — Projektübersicht und Positionierung
- [WORKFLOW.md](WORKFLOW.md) — Annotation, Review, Validierung
- [ARCHITECTURE.md](ARCHITECTURE.md) — Technische Architektur
- [DECISIONS.md](DECISIONS.md) — Offene Entscheidungen
