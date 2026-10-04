// Which figures are not yet backed the way their label says, strictly: no legacy labels, evidence on every figure,
// sources that exist, say where, and were checked. Walks every accelerator × power × cooling × size and every real
// campus. Usage: npx tsx tools/claims.mjs [keyPrefix ...]   e.g.  npx tsx tools/claims.mjs card:power:hall ledger bom
// Prints one line per distinct problem and a count; exits 1 if any.
import { compute, ACCELERATORS, POWER, COOLING } from '../src/model/engine.ts';
import { content } from '../src/data.js';
import { allClaims } from '../src/claims.js';
import { problems } from '../src/evidence.js';
import { SOURCES } from '../src/sources.js';
import { SITES } from '../src/model/sites.ts';

const prefixes = process.argv.slice(2);
const scenarios = [];
for (const accel of Object.keys(ACCELERATORS)) for (const power of Object.keys(POWER)) for (const cooling of Object.keys(COOLING))
  for (const meterMW of [10, 100, 1000, 5000]) scenarios.push({ meterMW, accel, power, cooling });
for (const [id, s] of Object.entries(SITES)) scenarios.push({ ...s.scenario, site: id });
const seen = new Map(); let claims = 0;
for (const s of scenarios) for (const moduleSide of ['switch', 'nic']) {   // the module level has two sides (store.moduleSide): both are checked
  const M = compute(s), C = content(M, { moduleSide });
  for (const c of allClaims(M, C)) {
    if (prefixes.length && !prefixes.some(p => c.key.startsWith(p))) continue;
    claims++;
    for (const p of problems(c, SOURCES, true)) {
      const k = `${c.key.replace(/:\d+$/, ':#')} · ${String(c.label).replace(/[\d.,]+/g, '#')} · ${p}`;
      if (!seen.has(k)) seen.set(k, `${c.key} (${c.label}): ${p}   [e.g. ${s.accel} ${s.power} ${s.cooling} ${s.meterMW} MW${s.site ? ` ${s.site}` : ''}]`);
    }
  }
}
for (const line of seen.values()) console.log(line);
console.log(`${seen.size} distinct problems across ${claims} claim instances${prefixes.length ? ` under ${prefixes.join(', ')}` : ''}`);
process.exitCode = seen.size ? 1 : 0;
