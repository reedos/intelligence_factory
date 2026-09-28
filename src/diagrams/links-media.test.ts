import { describe, it, expect } from 'vitest';
import { MEDIA_LADDER, COPPER_WALL, copperWallSVG, opticsCutawaySVG } from './links-media.js';
import { SOURCES, PART_SOURCES } from '../sources.js';
import { BASIS } from '../evidence.js';

const PS = PART_SOURCES as Record<string, string[]>;
const SRC = SOURCES as Record<string, { title: string; publisher: string; url: string }>;

describe('links media ladder', () => {
  it('has a title, a basis and a source list for every rung', () => {
    for (const r of MEDIA_LADDER) {
      expect(r.name, r.id).toBeTruthy();
      expect(Object.keys(BASIS), `${r.id} basis`).toContain(r.basis);
      const ids = PS[`links:${r.id}`];
      expect(ids, `PART_SOURCES['links:${r.id}']`).toBeDefined();
      expect(ids.length, `links:${r.id} has no sources`).toBeGreaterThan(0);
      for (const id of ids) expect(SRC[id], `source '${id}' for links:${r.id} is missing from SOURCES`).toBeDefined();
    }
  });
  // was "the seven strings" before the audit split LR4 out of the coherent row into its own direct-detect
  // rung (item 5) — the count changed, the no-duplicate-ids invariant this test actually checks did not
  it('every row has a unique id', () => {
    const ids = MEDIA_LADDER.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('copper wall chart data', () => {
  it('every disagreement range has a low no higher than its high', () => {
    for (const d of COPPER_WALL) if (d.lo != null) expect(d.lo, `lane ${d.lane}`).toBeLessThanOrEqual(d.hi);
  });
});

describe('audit 2026-09-27 — optics workstream invariants', () => {
  // item 5: LR4 is direct-detect campus optics, not a coherent (400ZR/800ZR-class) rung
  it('LR4 has its own direct-detect rung, and the coherent row no longer names it', () => {
    const lr4 = MEDIA_LADDER.find(r => r.id === 'lr4');
    expect(lr4, 'a direct-detect LR4 rung').toBeDefined();
    expect(lr4!.cls).not.toBe('dci');
    const coherent = MEDIA_LADDER.find(r => r.id === 'coherent')!;
    expect(coherent.reach).not.toMatch(/LR4/);
    expect(coherent.what).toMatch(/mux|multiplex/i); // transceiver, mux and amplifier roles must read as separate
  });
  // item 18c: links-media.js used to say "under 1 m" here and "≥1 m" in the copper-wall data for the same
  // IEEE P802.3dj objective at 200 Gb/s/lane — the objective is a floor ("at least 1.0 m"), not a ceiling
  it('the 200 Gb/s/lane copper objective reads as a floor everywhere it appears', () => {
    const dac = MEDIA_LADDER.find(r => r.id === 'dac')!;
    expect(dac.reach).toMatch(/at least 1/);
    const row200 = COPPER_WALL.find(d => d.lane === 200)!;
    expect(row200.note).toMatch(/≥1/);
  });
  // item 3, revised 09/28/2026 (tracing pass): the LPO row's 23-25 W retimed figure was previously tied to
  // "a complete 1.6T DR8 module," but re-reading the cited Semtech source (blog.semtech.com, full text
  // checked) found it never states a port/module capacity for either its ~10 W LPO figure or its ~23-25 W
  // retimed figure -- no "1.6T", "800G" or "DR8" appears anywhere in the piece. Asserting "1.6T" here was
  // itself the silent, unlabeled swap the original item 3 finding was trying to catch. The corrected
  // invariant: the row must say the capacity is unstated, not assert one the source doesn't give.
  it('the LPO row does not attribute an unstated port/module capacity to its 23–25 W comparison', () => {
    const lpo = MEDIA_LADDER.find(r => r.id === 'lpo')!;
    expect(lpo.power).not.toMatch(/1\.6T|800G/);
    expect(lpo.power).toMatch(/capacity.*(not|isn.t) stated/i);
  });
  // reviewer pass: interconnect-sources.md:68 gives 800ZR ≈23-25 W separately from the longer-reach 800ZR+
  // variant at ≈26-30 W; a blended "23-30 W at 800ZR" figure misstates plain 800ZR's own draw
  it('the coherent row states 800ZR power separately from its longer-reach 800ZR+ variant', () => {
    const coherent = MEDIA_LADDER.find(r => r.id === 'coherent')!;
    expect(coherent.power).toMatch(/23–25 W at 800ZR/);
    expect(coherent.power).toMatch(/800ZR\+/);
  });
});

describe('optics cutaway diagrams (audit item 1: directed TX/RX, item 19: three independent SVGs)', () => {
  it('renders one independent SVG per module, not one wide merged diagram', () => {
    const html = opticsCutawaySVG();
    expect((html.match(/<svg/g) || []).length).toBe(3);
    expect(html).toContain('oc-grid'); // a CSS grid that can stack modules, not a fixed-width row
  });
  it('the DSP and LPO modules each draw a TX lane and a separate RX lane', () => {
    const html = opticsCutawaySVG();
    for (const label of ['DSP pluggable', 'LPO']) {
      expect(html, label).toMatch(/>TX</);
      expect(html, label).toMatch(/>RX</);
    }
  });
  it('CPO keeps its external-laser feed out of the traffic-fiber path', () => {
    const html = opticsCutawaySVG();
    expect(html).toMatch(/traffic fiber out/);
    expect(html).toMatch(/traffic fiber in/);
    expect(html).toMatch(/side feed, not data/);
    // the laser feed line must be dashed (visually distinct from the solid traffic-fiber wires)
    expect(html).toMatch(/External laser[\s\S]{0,400}stroke-dasharray/);
  });
});

describe('links media SVG output', () => {
  it('the copper-wall chart has no undefined or NaN', () => {
    const svg = copperWallSVG();
    expect(svg).toContain('<svg');
    expect(svg).not.toMatch(/undefined|NaN|\[object/);
  });
  it('every lo-vs-hi range bar actually spans a range, not a flat sliver', () => {
    const svg = copperWallSVG();
    // one <rect ... width="20" height="H" rx="3" fill="var(--nvl)" .../> per row that has a reach value at all
    const heights = [...svg.matchAll(/<rect x="[-\d.]+" y="[-\d.]+" width="20" height="([-\d.]+)" rx="3" fill="var\(--nvl\)"/g)].map(m => Number(m[1]));
    const withReach = COPPER_WALL.filter(d => d.lo != null);
    expect(heights.length).toBe(withReach.length);
    // rows where lo !== hi (25 and 200 Gb/s/lane, per today's data) must clear the 2px clamp floor by a wide
    // margin, or the bar never actually visually spans the range it is supposed to draw
    withReach.forEach((d, i) => {
      if (d.lo !== d.hi) expect(heights[i], `lane ${d.lane} range-bar height`).toBeGreaterThan(10);
    });
  });
  it('the optics cutaway diagrams have no undefined or NaN', () => {
    const svg = opticsCutawaySVG();
    expect(svg).toContain('<svg');
    expect(svg).not.toMatch(/undefined|NaN|\[object/);
  });
  it('the copperwall and cutaway-* source keys exist and resolve', () => {
    for (const key of ['links:copperwall', 'links:cutaway-dsp', 'links:cutaway-lpo', 'links:cutaway-cpo']) {
      const ids = PS[key];
      expect(ids, key).toBeDefined();
      expect(ids.length, key).toBeGreaterThan(0);
      for (const id of ids) expect(SRC[id], `source '${id}' for ${key}`).toBeDefined();
    }
  });
});
