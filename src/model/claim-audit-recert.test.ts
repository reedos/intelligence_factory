// Regression tests for the 10/08/2026 recertification fixes (research/ASTRA-CLAIMS-AUDIT-2026-10-07.md).
// Each derived or duplicated figure is recomputed through a path that does not reuse the displayed expression.
import { expect, it } from 'vitest';
import html from '../../index.html?raw';
import { compute, ACCELERATORS, DEFAULT_SCENARIO } from './engine';
import { SITES } from './sites';
import { content } from '../data.js';
import { allClaims } from '../claims.js';
import { GPU_PACKAGE } from '../scenes/gpu-package.js';

const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-12);
const M = compute({ ...DEFAULT_SCENARIO });
const C = content(M);
const claims = allClaims(M, C);

it('cross-hall strands: shown count is the endpoint-pair fiber count, in the hundreds of thousands', () => {
  // Independent path: 400G DR4 uses 8 fibers per link; one endpoint per GPU; half the endpoints' links cross between halls.
  const expected = (M.gpus ?? M.fleet.reduce((a: number, m: any) => a + m.gpus, 0)) / 2 * 8;
  expect(rel(M.NET.crossHallFibers, expected)).toBeLessThan(1e-9);
  expect(M.NET.crossHallFibers).toBeGreaterThan(100000);   // the old 'tens of thousands' text was wrong by 10x
  const row = claims.find(c => c.label === 'Strands' && c.key.startsWith('card:data:campus:interhall'))!;
  const shown = Number(/about (\d+)k/.exec(row.value)![1]) * 1000;
  expect(rel(shown, expected)).toBeLessThan(0.01);
  const intro = C.SCENES.find((s: any) => s.id === 'campus')!.dataIntro as string;
  expect(intro).not.toContain('thousands of strands');
  expect(intro).toContain(`about ${Math.round(expected / 1000)}k strands`);
});

it('HBM power-share label spans exactly the modeled per-accelerator shares', () => {
  const shares = Object.values(ACCELERATORS).map((a: any) => a.hbmShare);
  const lo = Math.round(Math.min(...shares) * 100), hi = Math.round(Math.max(...shares) * 100);
  for (const accel of Object.keys(ACCELERATORS)) {
    const m = compute({ ...DEFAULT_SCENARIO, accel: accel as any });
    const rows = allClaims(m, content(m)).filter(c => c.label === 'Share of package power');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.value).toBe(`≈${lo}–${hi}%`);
  }
});

it('interconnection voltage card, level headline and assumption agree on 345-500 kV', () => {
  const row = claims.find(c => c.key === 'card:power:across:grid:0')!;
  expect(row.value).toBe('345–500 kV');
  expect(C.SCENES.find((s: any) => s.id === 'across')!.intro).toContain('345–500 kV');
});

it('rack and chip scale labels follow the drawn geometry', () => {
  // Sunbird: 2,236 mm tall -> 2.2 m. The board is the substrate plus a 1.2 cm margin each side.
  expect(Math.round(2236 / 100) / 10).toBe(2.2);
  for (const accel of Object.keys(ACCELERATORS)) {
    const m = compute({ ...DEFAULT_SCENARIO, accel: accel as any });
    const s = (GPU_PACKAGE as any)[m.accel.id].substrate;
    const board = Math.max(s.w, s.d) + 2 * 1.2;
    const sc = content(m).SCENES;
    expect(sc.find((x: any) => x.id === 'chip')!.scale).toBe(`${Math.round(board)} cm across`);
    if (m.accel.id !== 'h100') expect(sc.find((x: any) => x.id === 'rack')!.scale).toBe('2.2 m tall');
  }
});

it('rack intro does not claim the whole rack is water-cooled when the model sends heat to air', () => {
  expect(M.accel.liquidShare).toBeLessThan(1);
  const intro = C.SCENES.find((s: any) => s.id === 'rack')!.intro as string;
  expect(intro).not.toContain('all cooled by water');
  expect(intro).toContain('cooled mostly by water');
});

it('index.html scale-out caption matches the default fabric', () => {
  expect(M.NET.tiers).toBe(3);
  expect(M.NET.planes).toBe(1);
  const cap = /id="cap-scaleout">.*?<\/b>([^<]*)</.exec(html)![1];
  expect(cap).toContain(`One ${M.accel.nicPortGbps ?? 400}G optical port per GPU`);
  expect(cap).toContain('three tiers of 64-port switches');
  expect(M.NET.fabric.radix).toBe(64);
});

it('static fallback text in index.html matches the default scenario', () => {
  const lede = /id="bom-lede">([^<]*)</.exec(html)![1];
  expect(lede).toContain(`PUE ${M.pue.toFixed(2)}`);
  expect(lede).toContain(`${Math.round(M.rack.kw)} kW ${M.accel.rackName.replace(/ rack$/, '')}`);
  expect(html).not.toMatch(/\d,\d{3} tests across \d+ files/);
  expect(html).not.toContain('leased fiber');
});

it('Epoch site figures match the 08/31/2026 and 09/24/2026 directory pages', () => {
  const p = SITES.prometheus;
  const text = JSON.stringify([p.facts, p.status, p.unknowns]);
  expect(text).toContain('471 MW');
  expect(text).toContain('536k H100-eq');
  expect(text).toContain('166k');
  expect(text).not.toContain('496');
  expect(text).not.toContain('237');
  // 471 MW of the projected 1,022 MW is still roughly half.
  expect(rel(471 / 1022, 0.5)).toBeLessThan(0.1);
});

it('removed unsourced phrases stay removed', () => {
  const all = JSON.stringify(claims.map(c => [c.label, c.value]));
  for (const phrase of ['half load', 'live traffic', 'not fewer fibers', 'per section', 'on one fiber pair'])
    expect(all, phrase).not.toContain(phrase);
  const eff = claims.find(c => c.label === 'Efficiency, 2500 kVA class')!;
  expect(eff.value).toBe('≈99.55%');
  expect(JSON.stringify(eff.ev)).toContain('99.55%');
});
