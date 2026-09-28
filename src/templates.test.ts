// A string written in plain quotes instead of backticks shows its ${...} to the reader instead of the value (a
// compute tray card read "${X.nic} cards carry scale-out traffic" on the live site, 09/28/2026). Every text the page
// builds from a scenario, and every tour, must come out with no template left in it.
import { describe, it, expect } from 'vitest';
import { compute, ACCELERATORS, POWER, COOLING } from './model/engine';
import { content } from './data.js';
import { story, watt, request, heat } from './app/journeys.js';
import { SITES } from './model/sites';

const scenarios: any[] = [];
for (const accel of Object.keys(ACCELERATORS)) for (const power of Object.keys(POWER)) for (const cooling of Object.keys(COOLING))
  scenarios.push({ meterMW: 100, accel, power, cooling });
for (const [id, s] of Object.entries(SITES)) scenarios.push({ ...(s as any).scenario, site: id });

describe('no unfilled template reaches the page', () => {
  it.each(scenarios)('$accel / $power / $cooling $site', s => {
    const M = compute(s);
    const text = JSON.stringify([content(M), story(M), watt(M), request(M), heat(M)]);
    const hit = text.match(/.{0,60}\$\{[^}]*\}.{0,40}/);
    expect(hit?.[0] ?? null).toBeNull();
  });
});
