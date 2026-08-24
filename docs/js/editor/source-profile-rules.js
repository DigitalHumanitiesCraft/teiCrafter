/** Composable capability rules. No project-name or filename dispatch. */

const RULES = Object.freeze([
  { id: "pages", present: (i) => i.has("pb"), evidence: (i) => `${i.count("pb")} page break(s)` },
  { id: "corpus-members", present: (i) => i.root === "teiCorpus" || i.count("TEI") > 1, evidence: (i) => `${i.count("TEI")} TEI corpus member(s)` },
  { id: "entries", present: (i) => i.has("entry") || i.has("entryFree") || i.has("superEntry"), evidence: (i) => `${i.count("entry") + i.count("entryFree") + i.count("superEntry")} dictionary entry element(s)` },
  { id: "speech-turns", present: (i) => i.has("u") || i.has("sp") || i.has("annotationBlock"), evidence: (i) => `${i.count("u") + i.count("sp") + i.count("annotationBlock")} speech turn(s)` },
  { id: "dramatic-context", present: (i) => i.has("castList") || i.has("stage") || i.has("performance"), evidence: (i) => `${i.count("castList")} cast list(s), ${i.count("stage")} stage direction(s)` },
  { id: "token-analysis", present: (i) => i.has("w") || i.has("s") || i.has("fs"), evidence: (i) => `${i.count("w")} token(s), ${i.count("s")} sentence(s), ${i.count("fs")} feature structure(s)` },
  { id: "correspondence-metadata", present: (i) => i.has("correspDesc"), evidence: (i) => `${i.count("correspDesc")} correspondence description(s)` },
  { id: "apparatus", present: (i) => i.has("app") || i.has("listApp"), evidence: (i) => `${i.count("app")} apparatus entry/entries` },
  { id: "facsimile-resource", present: (i) => i.has("surface") || i.has("sourceDoc") || i.facsimileRefs.external > 0, evidence: (i) => `${i.count("surface")} surface(s), ${i.facsimileRefs.external} external facsimile reference(s)` },
  { id: "source-document", present: (i) => i.has("sourceDoc"), evidence: (i) => `${i.count("sourceDoc")} source document(s)` },
  { id: "tabular", present: (i) => i.has("table") || i.has("row"), evidence: (i) => `${i.count("table")} table(s)` },
  { id: "descriptive-records", present: (i) => i.count("biblFull") > 1 || i.count("msDesc") > 1, evidence: (i) => `${i.count("biblFull")} bibliographic and ${i.count("msDesc")} manuscript record(s)` },
  { id: "verse", present: (i) => i.has("lg") || i.has("l"), evidence: (i) => `${i.count("l")} verse line(s)` },
  { id: "logical-flow", present: (i) => i.reading.characters > 0, evidence: (i) => `${i.reading.characters} reading character(s)` },
  { id: "header-metadata", present: (i) => i.has("teiHeader"), evidence: (i) => `${i.count("teiHeader")} TEI header(s)` },
]);

/** Capabilities observed in the current document; schema allowance is merged later. */
export function structuralCapabilities(inventory) {
  return RULES.map((rule) => {
    const present = rule.present(inventory);
    return {
      id: rule.id,
      present,
      allowed: null,
      enabled: present,
      source: present ? "structure" : "fallback",
      evidence: present ? [rule.evidence(inventory)] : [],
    };
  });
}
