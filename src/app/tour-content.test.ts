// What the narrated tours say, held to the failures Astra's tour audit found (research/tour-audit-2026-09-27.md):
// temperatures that disagreed between the tour, the cards and the chart; package power narrated as die power; a watt
// that "does the math"; training said to be included when it was switched off; a request whose stops read as a
// timeline they were not; water rounded to nothing. Each test restates the complaint, not the generator's own strings.
import { describe, it, expect, afterEach } from 'vitest';
import { compute, ACCELERATORS, POWER, COOLING, loopTemps } from '../model/engine';
import { content, dieFlux } from '../data.js';
import { story, watt, request, heat, TOUR_NOTES } from './journeys.js';
import { calc } from '../model/tokens.js';
import { claimByKey } from '../claims.js';
import { SITES } from '../model/sites';

const scenarios: any[] = [];
for (const accel of Object.keys(ACCELERATORS)) for (const power of Object.keys(POWER)) for (const cooling of Object.keys(COOLING))
  scenarios.push({ meterMW: 100, accel, power, cooling });
for (const [id, s] of Object.entries(SITES)) scenarios.push({ ...s.scenario, site: id });
const num = (s: string) => [...s.matchAll(/(-?\d+(?:\.\d+)?)\s*°C/g)].map(m => +m[1]);
const specOf = (C: any, mode: string, scene: number, part: string, label: string) =>
  ({ power: C.PARTS, data: C.PARTS_DATA, heat: C.PARTS_HEAT } as any)[mode][C.SCENES[scene].id].find((p: any) => p.id === part)?.specs.find((r: any) => r[0].startsWith(label));

describe('one set of loop temperatures', () => {
  it.each(scenarios)('the heat tour, the cards and the chart agree: $accel / $cooling $site', s => {
    const M = compute(s) as any, C = content(M) as any, T = M.temps, beats = heat(M) as any[];
    expect(T).toEqual(loopTemps(M.cooling.id));
    const known = new Set(Object.values(T));
    // every temperature the tour states, in a tally or in its text, is one of the operating point's own
    for (const b of beats) for (const v of num(`${b.tally} ${b.text}`)) if (v !== 85) expect(known, `${b.title}: ${v} °C`).toContain(v);
    // and every bar of the chart
    for (const r of C.TEMPS) expect(known, r.label).toContain(r.c);
    // the water leaving the hall is return water, never the hot-air temperature (the H100 riser once said 40 °C)
    const riser = beats.find(b => b.link.part === 'riser');
    expect(riser.tally).toBe(`≈${T.fwsReturn} °C return`);
    if (M.cooling.id === 'air') expect(T.fwsReturn).not.toBe(T.hotAisle);
    // the rack-loop card names the same supply and return as the tour, in every liquid mode (it once kept 45 → 55 °C)
    if (M.cooling.id !== 'air') {
      expect(specOf(C, 'heat', 3, 'manifold', 'Supply → return')[1]).toBe(`≈${T.tcsSupply} → ${T.tcsReturn} °C`);
      expect(beats.find(b => b.link.part === 'cdu').text).toContain(`about ${T.fwsSupply} °C and leaves at about ${T.fwsReturn} °C`);
    }
  });
  it('the CDU sits between its two loops, and each loop warms on the way out', () => {
    for (const cooling of ['liquid', 'warm']) {
      const T = loopTemps(cooling as any) as any;
      expect(T.tcsSupply).toBeGreaterThan(T.fwsSupply); expect(T.tcsReturn).toBeGreaterThan(T.fwsReturn);
      expect(T.tcsReturn).toBeGreaterThan(T.tcsSupply); expect(T.die).toBeGreaterThan(T.tcsReturn); expect(T.lid).toBeLessThan(T.die);
    }
    const A = loopTemps('air') as any;
    expect(A.hotAisle).toBeGreaterThan(A.coldAisle); expect(A.fwsReturn).toBeGreaterThan(A.fwsSupply); expect(A.coldAisle).toBeGreaterThan(A.fwsSupply);
  });
});

describe('the GPU dies, not the package and not "the math"', () => {
  it.each(scenarios)('power, area and flux describe one boundary: $accel $site', s => {
    const M = compute(s) as any, A = M.accel, die = heat(M)[0] as any, dieW = Math.round(A.gpuW * (1 - A.hbmShare));
    expect(die.title).toContain(`${dieW.toLocaleString('en-US')} W`);
    expect(die.text).toContain(`${dieFlux(A)} W per square centimeter`);
    // the watt's last beat and the overview's package beat: GPU-die power, with no claim about useful arithmetic
    const w = watt(M) as any[], last = w[w.length - 1];
    expect(last.title).toMatch(/reaches the GPU dies$/);
    for (const b of [...w, ...story(M)] as any[]) for (const t of [b.title, b.tally ?? '', b.text])
      expect(t, b.title).not.toMatch(/does the math|for the math|model math|any math|transistors that do the arithmetic|becomes a token/);
    expect(last.text).toContain('does not estimate how much of it is useful arithmetic');
    // and the watt still lands on the ledger's own GPU-die figure
    expect(+last.tally.split(' ')[0]).toBeCloseTo(M.gpuSiliconMW / M.meterMW, 3);
  });
});

describe('the request, told honestly', () => {
  afterEach(() => { calc.withTrain = true; });
  it.each(scenarios)('illustrative timing, one copy, real water: $accel / $cooling $site', s => {
    const M = compute(s) as any, beats = request(M) as any[];
    expect(TOUR_NOTES.request).toMatch(/illustrative/i);
    const ids = beats.map(b => b.link.part);
    expect(ids).not.toContain('dp');                                   // a training card is not where requests queue
    const tp = beats.findIndex(b => b.link.part === 'tp');
    expect(beats[tp].tally).toBe(beats[tp - 1].tally);                 // the look ahead at the rack adds no time
    expect(beats[tp].text).not.toMatch(/microsecond|µs/);
    expect(beats.find(b => b.link.part === 'dies').text).toMatch(/compute rather than memory/);
    expect(beats.find(b => b.link.part === 'dies').text).toMatch(/time to first token/);
    const out = beats[beats.length - 1].text;
    if (M.closedLoop) expect(out).toMatch(/counts no cooling water/);
    else { expect(out).toMatch(/per kWh of IT energy/); expect(out).not.toMatch(/about 0 mL|about 0\.0 mL/); }
  });
  it('the timeline is the same for every GPU choice, as the note says', () => {
    const tallies = Object.keys(ACCELERATORS).map(accel => (request(compute({ meterMW: 100, accel, power: 'ac415', cooling: accel === 'h100' ? 'air' : 'liquid' } as any)) as any[]).map(b => b.tally).join('|'));
    expect(new Set(tallies).size).toBe(1);
  });
  it('switching training off changes the words as well as the numbers', () => {
    const M = compute({ meterMW: 100, accel: 'gb200', power: 'dc800', cooling: 'liquid' } as any);
    const say = () => [(story(M) as any[]).at(-1).text, (request(M) as any[]).find(b => b.sim === 'inference').text].join(' ');
    calc.withTrain = true; const on = say();
    calc.withTrain = false; const off = say();
    expect(on).toMatch(/training/); expect(off).not.toMatch(/including its share of training|and a share of training/);
    expect(off).toMatch(/training share is switched off/);
  });
});

describe('qualified lessons', () => {
  it.each(scenarios)('sync, NVLink and memory claims keep their scope: $accel $site', s => {
    const M = compute(s) as any, text = (story(M) as any[]).map(b => b.text).join(' ');
    expect(text).not.toMatch(/sites sync rarely/);
    expect(text).toMatch(/some methods, such as DiLoCo/);
    expect(text).not.toMatch(/900 GB\/s each/);
    expect(text).toMatch(/per GPU, both directions combined/);
    expect(text).toMatch(/usually limited by memory bandwidth/);
    expect(text).toMatch(/per phase on each of the line’s two circuits/);
    expect(text).not.toMatch(/outside the racks/);
  });
});

describe('every figure a narrated tour states carries its evidence', () => {
  it.each(scenarios)('each beat has rows, and each row is a claim: $accel / $power / $cooling $site', s => {
    const M = compute(s) as any, C = content(M);
    for (const f of [story, watt, request, heat]) for (const b of f(M) as any[]) {
      expect(b.specs?.length, `${b.title}`).toBeGreaterThan(0);
      b.specs.forEach((row: any[], j: number) => expect((claimByKey(M, C, `${b.specKey}:${j}`) as any)?.label, `${b.title}: ${row[0]}`).toBe(row[0]));
    }
  });
});

describe('a closed loop counts no water, whichever plant rejects the heat', () => {
  it.each(['colossus2', 'fairwater-atl'])('%s', id => {
    const M = compute({ ...(SITES as any)[id].scenario, site: id }) as any, C = content(M) as any;
    expect(M.closedLoop).toBe(true); expect(M.wue).toBe(0); expect(M.layout.towers).toBe(0);
    const words = [...story(M), ...request(M), ...heat(M)].map((b: any) => b.text).join(' ') + C.SCENES[1].heatIntro;
    expect(words).not.toMatch(/sprays help|cost water|m³ of water a day|mL of water/);
    expect(words).toMatch(/closed loop|loop is closed/);
    // the text cites the operator's own cooling statement, not another operator's
    const own = (SITES as any)[id].facts.find((r: any) => r[0].startsWith('Cooling'));
    for (const b of [...story(M), ...request(M), ...heat(M)] as any[]) for (const r of b.specs) if (/Cooling/.test(r[0]) && r[2] === 'spec') expect(r).toEqual(own);
  });
});
