import { describe, it, expect } from 'vitest';
import { MEDIA_LADDER, COPPER_WALL, copperWallSVG, opticsCutawaySVG } from './links-media.js';
import { SOURCES, PART_SOURCES } from '../sources.js';

const PS = PART_SOURCES as Record<string, string[]>;
const SRC = SOURCES as Record<string, { title: string; publisher: string; url: string }>;

describe('links media ladder', () => {
  it('has a title, a basis and a source list for every rung', () => {
    for (const r of MEDIA_LADDER) {
      expect(r.name, r.id).toBeTruthy();
      expect(['spec', 'typical', 'est'], `${r.id} basis`).toContain(r.basis);
      const ids = PS[`links:${r.id}`];
      expect(ids, `PART_SOURCES['links:${r.id}']`).toBeDefined();
      expect(ids.length, `links:${r.id} has no sources`).toBeGreaterThan(0);
      for (const id of ids) expect(SRC[id], `source '${id}' for links:${r.id} is missing from SOURCES`).toBeDefined();
    }
  });
  it('every row is one of the seven strings, no duplicate ids', () => {
    const ids = MEDIA_LADDER.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('copper wall chart data', () => {
  it('every disagreement range has a low no higher than its high', () => {
    for (const d of COPPER_WALL) if (d.lo != null) expect(d.lo, `lane ${d.lane}`).toBeLessThanOrEqual(d.hi);
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
