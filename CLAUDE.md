# teiCrafter -- Claude Code Instruktionen

## Sprache und Stil
- **Keine Emojis** -- nie Emojis in Ausgaben, Dateien oder Commit-Messages verwenden
- Journal-Eintraege und Commit-Messages auf Deutsch
- Knowledge-Dokumente in reinem Standard-Markdown (kein Obsidian, kein YAML-Frontmatter)

## Projekt
- Browser-basiertes TEI-XML-Annotationstool fuer Digital Humanities
- Deployed via GitHub Pages aus `/docs`
- ES6-Module ohne Bundler, kein Build-Step
- Knowledge Base in `/knowledge/` (INDEX.md als Einstieg)

## Synchronisationsregeln
Am Ende jeder Session mit Code-Aenderungen:
1. STATUS.md -- Immer zuerst. Modul-Matrix und Workflow-Status aktualisieren
2. DECISIONS.md -- Bei neuen Entscheidungen oder erledigten offenen Punkten
3. STORIES.md -- Bei Status-Aenderungen
4. JOURNAL.md -- Session-Eintrag mit Datum und Zusammenfassung
5. MODULES.md -- Nur bei API-Aenderungen (neue Exports, geaenderte Signaturen)
