/** A missing optional corpus is the only accepted non-browser-specific skip. */
export function evaluateBrowserReport(report, { codex = false, images = false, urfehde = false,
  expectedProjects = null, expectedRepeat = 1 } = {}) {
  const problems = [], cases = [], coverage = new Map();
  const optional = new Map([
    ["real Wenzelsbibel codex preserves readings and validates an explicitly repaired copy", ["wenzelsbibel-workspace.spec.js", codex]],
    ["real Wenzelsbibel image annotations retain all bytes outside a title edit", ["wenzelsbibel-workspace.spec.js", images]],
    ["real Urfehde book supports the complete paged review workflow", ["app.spec.js", urfehde]],
  ]);
  function visit(suite, parents = []) {
    const trail = [...parents, suite.title || ""];
    for (const spec of suite.specs || []) {
      const file = String(spec.file || suite.file || "").replaceAll("\\", "/");
      const key = JSON.stringify([file, spec.line || 0, spec.column || 0, trail, spec.title]);
      if (!coverage.has(key)) coverage.set(key, { label: `${file} / ${spec.title}`, repetitions: new Map() });
      const { repetitions } = coverage.get(key);
      for (const test of spec.tests || []) {
      const repeat = repetitions.get(test.projectName) || 0;
      repetitions.set(test.projectName, repeat + 1);
      const id = `${file}:${spec.line || 0} / ${spec.title} / ${test.projectName} / repeat ${repeat}`;
      const results = test.results || [];
      const skipped = results.length === 1 && results[0].status === "skipped";
      const missing = optional.get(spec.title);
      const permittedSkip = missing && missing[0] === file && !missing[1]
        || file === "app.spec.js" && spec.title === "Firefox uses capability-gated file input and schema-gated download fallbacks"
          && test.projectName === "chromium";
      const singleAttempt = results.length === 1 && (results[0].retry ?? 0) === 0
        && !results[0].error && !(results[0].errors || []).length;
      const passed = singleAttempt && results[0].status === "passed"
        && (!test.status || test.status === "expected") && (!test.expectedStatus || test.expectedStatus === "passed");
      const allowedSkip = skipped && permittedSkip && singleAttempt
        && (!test.status || test.status === "skipped") && (!test.expectedStatus || test.expectedStatus === "skipped");
      if (!passed && !allowedSkip) {
        problems.push(`${id}: ${results.map((result) => result.status).join(", ") || "not executed"}`);
      }
      cases.push({ id, skipped, passed, durationMs: results.reduce((sum, result) => sum + (result.duration || 0), 0), annotations: test.annotations || [] });
      }
    }
    for (const child of suite.suites || []) visit(child, trail);
  }
  for (const suite of report.suites || []) visit(suite);
  if (expectedProjects) for (const { label, repetitions } of coverage.values()) {
    for (const project of expectedProjects) if (repetitions.get(project) !== expectedRepeat) {
      problems.push(`${label}: expected ${expectedRepeat} execution(s) in ${project}, found ${repetitions.get(project) || 0}.`);
    }
    for (const project of repetitions.keys()) if (!expectedProjects.includes(project)) problems.push(`Unexpected browser project: ${project}`);
  }
  if (!cases.length) problems.push("No browser tests were executed.");
  for (const error of report.errors || []) problems.push(error.message || "Playwright reported an infrastructure error.");
  return { ok: problems.length === 0, passed: cases.filter((entry) => entry.passed).length,
    failed: cases.filter((entry) => !entry.skipped && !entry.passed).length,
    skipped: cases.filter((entry) => entry.skipped).length, problems, cases };
}
