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

describe('method', () => {
  it('sections carry no scripts, inline styles or handlers', () => {
    for (const s of SECTIONS as any[]) expect(s.html, s.id).not.toMatch(/<script|<iframe|\son\w+\s*=|style\s*=|javascript:/i);
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
