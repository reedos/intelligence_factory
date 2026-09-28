import { describe, it, expect } from 'vitest';
import indexHtml from '../../index.html?raw';
import evidenceHtml from '../../evidence.html?raw';
import methodHtml from '../../method.html?raw';
import glossaryHtml from '../../glossary.html?raw';
import { compute, ACCELERATORS, POWER, COOLING } from '../model/engine';
import { content } from '../data.js';
import { SOURCES } from '../sources.js';
import { TERMS } from './glossary-data.js';
import { SECTIONS } from './method-data.js';
import evidenceJs from './evidence.js?raw';

// every part id any scenario can show, per scene and layer
const parts = new Set<string>();
for (const accel of Object.keys(ACCELERATORS)) for (const power of Object.keys(POWER)) for (const cooling of Object.keys(COOLING)) {
  const C = content(compute({ meterMW: 100, accel, power, cooling } as any)) as any;
  C.SCENES.forEach((sc: any, i: number) => (['power', 'data', 'heat'] as const).forEach(mode => {
    for (const p of C[{ power: 'PARTS', data: 'PARTS_DATA', heat: 'PARTS_HEAT' }[mode]][sc.id] || []) parts.add(`${i}:${mode}:${p.id}`);
  }));
}

describe('glossary', () => {
  it('every term links to a part that exists and cites sources that exist', () => {
    for (const t of TERMS as any[]) {
      if (t.link) expect(parts, `${t.term} → ${t.link.scene}:${t.link.mode}:${t.link.part}`).toContain(`${t.link.scene}:${t.link.mode}:${t.link.part}`);
      for (const id of t.sources || []) expect(SOURCES, `${t.term} cites ${id}`).toHaveProperty(id);
      for (const s of [t.term, t.def]) expect(s).not.toMatch(/undefined|NaN|\[object/);
    }
  });
  it('has no duplicate terms', () => {
    const names = (TERMS as any[]).map(t => t.term.toLowerCase());
    expect(names.length).toBe(new Set(names).size);
  });
});

describe('optics review 2026-09-27 (item 1 + 18g consistency)', () => {
  // the item-1 fix updated the CPO glossary entry to NVIDIA's August 2026 "5x" power-efficiency update; the
  // hall-scene CPO card quotes the same NVIDIA claim independently and must not be left on the superseded 3.5x
  // figure, or a reader opening the card sees a different number than the one in the glossary for the same claim
  it('the hall CPO card and the CPO glossary entry lead with the same current power-efficiency figure', () => {
    const [accel] = Object.keys(ACCELERATORS), [power] = Object.keys(POWER), [cooling] = Object.keys(COOLING);
    const C = content(compute({ meterMW: 100, accel, power, cooling } as any)) as any;
    const cpoCard = C.PARTS_DATA.hall.find((p: any) => p.id === 'cpo');
    const cpoSpec = cpoCard.specs.find((s: any) => /Quantum-X/.test(s[0]))[1];
    const cpoTerm = (TERMS as any[]).find(t => t.term === 'CPO')!;
    expect(cpoSpec).toMatch(/5×/);
    expect(cpoTerm.def).toMatch(/5x/);
  });
  // item 18g: the audit found this ratio stated without a source; it turned out to be sourceable (NVIDIA's own
  // developer blog gives both halves), so it should be restored with a source, not left out
  it('the External laser source entry states the reconciled module-level ratio, sourced to NVIDIA', () => {
    const els = (TERMS as any[]).find(t => t.term === 'External laser source')!;
    expect(els.def).toMatch(/one laser for every eight links/);
    expect(els.sources).toContain('nvidia-cpo-industry-collaboration-blog');
  });
});

describe('method', () => {
  it('sections carry no scripts, inline styles or handlers', () => {
    for (const s of SECTIONS as any[]) expect(s.html, s.id).not.toMatch(/<script|<iframe|\son\w+\s*=|style\s*=|javascript:/i);
  });
  // audit item 17: the four choices drive the campus hardware, not every figure on the page (tokens add
  // their own workload/environment inputs, and Evidence shows a fixed reference scenario, not this one).
  it('does not claim every figure follows from the four choices alone', () => {
    const s1 = (SECTIONS as any[]).find(s => s.id === 's1').html;
    expect(s1).toMatch(/tokens|workload/i);
    expect(methodHtml).toMatch(/reference scenario|workload/i);
    expect(methodHtml).not.toMatch(/every figure on every page follows from them/i);
  });
  it('no longer claims a real-campus site changes nothing in the arithmetic', () => {
    const s2 = (SECTIONS as any[]).find(s => s.id === 's2').html;
    expect(s2).toMatch(/grid.carbon/i);
    expect(s2).not.toMatch(/it changes nothing in the arithmetic/i);
  });
});

describe('evidence', () => {
  // audit item 17: Evidence always computes from one reference scenario; the banner must say so rather than
  // reading as if it followed whatever campus the reader set on the visualizer.
  it('banner says the scenario is fixed, not the reader\'s own', () => {
    expect(evidenceJs).toMatch(/fixed|reference scenario/i);
  });
});

describe('site pages', () => {
  it('every page carries the same top bar, apart from which link is current', () => {
    const nav = (html: string) => html.match(/<nav class="topnav"[\s\S]*?<\/nav>/)![0]
      .replace(/ aria-current="page"/g, '').replace(/href="index\.html#/g, 'href="#');
    const main = nav(indexHtml);
    for (const [f, html] of [['evidence', evidenceHtml], ['method', methodHtml], ['glossary', glossaryHtml]]) expect(nav(html), f).toBe(main);
  });
});
