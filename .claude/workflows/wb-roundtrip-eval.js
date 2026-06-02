export const meta = {
  name: 'wb-roundtrip-eval',
  description: 'Wenzelsbibel round-trip eval loop: guard the ONB licence, run the deterministic L1/L2/L3 harness over every fixture, then LLM-triage any failure and propose the next DETERMINISTIC (non-LLM) fix. This is the feedback loop; re-run it after every change.',
  phases: [
    { title: 'Guard', detail: 'refuse to run if any ONB-derived fixture is git-tracked' },
    { title: 'Eval', detail: 'node test/harness/run.mjs over all fixtures (deterministic)' },
    { title: 'Triage', detail: 'LLM reads each failing report, ranks issues, proposes next deterministic fix' },
  ],
}

const GUARD = {
  type: 'object',
  properties: {
    clean: { type: 'boolean', description: 'true if no ONB-derived fixture is git-tracked' },
    tracked: { type: 'array', items: { type: 'string' }, description: 'any git-tracked paths under test/fixtures/ (must be empty)' },
    note: { type: 'string' },
  },
  required: ['clean', 'tracked', 'note'],
}

const EVAL = {
  type: 'object',
  properties: {
    ranCommand: { type: 'string' },
    exitCode: { type: 'number' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fixture: { type: 'string' },
          verdict: { type: 'string' },
          score: { type: 'number' },
          l1Pass: { type: 'boolean' },
          l3CountsPreserved: { type: 'boolean' },
          l2SchematronValid: { type: ['boolean', 'null'] },
          reportPath: { type: 'string' },
        },
        required: ['fixture', 'verdict', 'score', 'reportPath'],
      },
    },
  },
  required: ['ranCommand', 'exitCode', 'results'],
}

const TRIAGE = {
  type: 'object',
  properties: {
    fixture: { type: 'string' },
    diagnosis: { type: 'string', description: 'what failed and why, from the report' },
    nextFix: { type: 'string', description: 'the next concrete fix to make' },
    deterministic: { type: 'boolean', description: 'true if the proposed fix is a code/rule change, NOT LLM annotation' },
  },
  required: ['fixture', 'diagnosis', 'nextFix', 'deterministic'],
}

phase('Guard')
const guard = await agent(
  `Run this exact command from the repo root and report the result:\n` +
  `  git ls-files test/fixtures\n` +
  `It lists git-TRACKED files under test/fixtures/. That directory holds ONB-derived ` +
  `Wenzelsbibel slices that must NEVER be committed (third-party licence). ` +
  `Also confirm test/.gitignore contains a line ignoring "fixtures/". ` +
  `Return clean=true only if git ls-files output is empty AND the gitignore rule is present. ` +
  `List any tracked paths in "tracked".`,
  { label: 'licence-guard', phase: 'Guard', schema: GUARD }
)

if (!guard || !guard.clean) {
  log(`Guard FAILED: ${guard ? JSON.stringify(guard.tracked) : 'no result'}. Stopping; do not run with ONB data tracked.`)
  return { stopped: 'licence-guard', guard }
}
log('Licence guard clean: no ONB-derived fixture is tracked.')

phase('Eval')
const evalRes = await agent(
  `Run the teiCrafter eval harness and report results.\n` +
  `1. From the repo root run: node test/harness/run.mjs\n` +
  `2. Then read ONLY the per-fixture reports that run.mjs wrote: files whose basename is exactly ` +
  `"report.json" under test/reports/<fixtureId>/. IGNORE any other *.report.json (e.g. the ` +
  `test/reports/selftest/ directory holds negative-test artifacts that are deliberately corrupted; ` +
  `they are NOT fixtures and must not be reported here).\n` +
  `For each, extract: fixtureId (as fixture), verdict, score, levels.L1.pass (l1Pass), ` +
  `levels.L3.countsPreserved (l3CountsPreserved), levels.L2.sch.valid (l2SchematronValid), and the report path. ` +
  `Report the run.mjs exit code. Do not edit anything.`,
  { label: 'eval-runner', phase: 'Eval', schema: EVAL }
)

const results = evalRes?.results ?? []
// Compare case-insensitively: the deterministic report.json uses lowercase "pass",
// but a reporting agent may upper-case the verdict. The harness report is the source of truth.
const failures = results.filter(r => String(r.verdict).toLowerCase() !== 'pass')
log(`Harness: ${results.length} fixture(s), ${failures.length} failing.`)

phase('Triage')
let triage = []
if (failures.length === 0) {
  log('All fixtures pass. Nothing to triage; the round-trip is lossless and structure-preserving.')
} else {
  triage = await parallel(failures.map(f => () =>
    agent(
      `Read the eval report at ${f.reportPath} (JSON). Fixture ${f.fixture} did not pass.\n` +
      `Diagnose what failed using levels.L1 (word fidelity), levels.L3 (counts/namespace/pointers) ` +
      `and levels.L2 (RelaxNG/Schematron, look at newErrorsVsInput) and topIssues.\n` +
      `Propose the single next concrete fix. CONSTRAINT: the Wenzelsbibel mandate excludes LLM from ` +
      `annotation, so any fix must be a deterministic code or rule change (set deterministic=true). ` +
      `Never propose hand-writing or LLM-generating TEI annotation content. Do not edit anything.`,
      { label: `triage:${f.fixture}`, phase: 'Triage', schema: TRIAGE }
    )
  )).then(a => a.filter(Boolean))
}

return {
  guard,
  exitCode: evalRes?.exitCode,
  total: results.length,
  passing: results.length - failures.length,
  failing: failures.length,
  results,
  triage,
}
