import { readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const excluded = new Set(['port_parity.mjs', 'szd_loadability_sweep.mjs']);
const names = readdirSync(new URL('../../test/proofs/', import.meta.url))
  .filter(name => name.endsWith('.mjs') && !name.startsWith('_') && !excluded.has(name)).sort();
const results = names.map(name => {
  const run = spawnSync(process.execPath, ['test/proofs/' + name], { cwd: root, encoding: 'utf8' });
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const status = run.status === 0 ? (/^SKIP\b/m.test(output) ? 'skip' : 'pass') : 'fail';
  console.log(`${status}: ${name}`);
  return {name, status, exitCode: run.status, error: run.error?.message, output};
});
writeFileSync(new URL('./proof-results.json', import.meta.url), JSON.stringify({node: process.version, results}, null, 2));
const counts = results.reduce((out, item) => ({...out, [item.status]: (out[item.status] || 0) + 1}), {});
console.log(JSON.stringify(counts));
process.exitCode = results.some(item => item.status === 'fail') ? 1 : 0;
