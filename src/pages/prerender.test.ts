// Checks the SEO pre-render pass: the functions tools/prerender-plugin.mjs calls at build time to bake the
// Evidence, Method, Glossary and Parts-index pages, the visualizer's text fallback, llms.txt and the JSON-LD, all
// generated from the same data modules the interactive pages read. These call the render functions directly rather
// than reading dist/*.html, so the suite runs under plain `vitest run` with no build step first (CI runs tsc, then
// this suite, then `npm run build`); tools/perf.mjs and friends check the live, built page separately.
import { describe, it, expect } from 'vitest';
import { compute, DEFAULT_SCENARIO } from '../model/engine';
import { content } from '../data.js';
import { BASIS, CALCS, ASSUMPTIONS } from '../evidence.js';
import { allClaims } from '../claims.js';
import { SOURCES } from '../sources.js';
import { scenarioNote, shownBasesOf, renderStats, renderClaims, renderSources } from './evidence-render.js';
import { SECTIONS as METHOD_WRITTEN } from './method-data.js';
import { buildMethodSections, buildBodyHtml, buildTocHtml } from './method-render.js';
import { TERMS } from './glossary-data.js';
import { sortedTerms, buildGlossaryHtml } from './glossary-render.js';
import { buildLevels, renderLevelsHtml, scenarioLine } from './visualizer-text.js';
import { buildLlmsTxt, buildLlmsFullTxt, PUB_STATEMENT } from '../../tools/llms-txt.mjs';
import { articleJsonLd, websiteJsonLd, jsonLdScript } from '../../tools/json-ld.mjs';

const M = compute(DEFAULT_SCENARIO);
const C = content(M);
const claims = allClaims(M, C);
const wordCount = (html: string) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

describe('evidence page pre-render', () => {
  const html = renderClaims(C, SOURCES, claims, M) + renderStats(claims, shownBasesOf(claims), Object.keys(SOURCES).length) + renderSources(claims, SOURCES) + scenarioNote(M);
  it('carries at least 2000 words of real content', () => { expect(wordCount(html)).toBeGreaterThanOrEqual(2000); });
  it('names a known part and a known source, not placeholders', () => {
    expect(html).toContain('Transmission line');
    expect(html).toContain('U.S. Energy Information Administration');
  });
  it('shows every basis label the claims actually use', () => {
    for (const b of shownBasesOf(claims)) expect(html).toContain((BASIS as any)[b].short);
  });
  it('the scenario note states the reference scenario, not whichever campus a reader set', () => {
    expect(scenarioNote(M)).toMatch(/fixed to one reference scenario/i);
    expect(scenarioNote(M)).toContain(`${Math.round(M.meterMW)} MW`);
  });
});

describe('method page pre-render', () => {
  const sections = buildMethodSections(METHOD_WRITTEN, CALCS, ASSUMPTIONS);
  const html = buildBodyHtml(sections) + buildTocHtml(sections);
  it('carries at least 1500 words of real content', () => { expect(wordCount(html)).toBeGreaterThanOrEqual(1500); });
  it('includes the written sections plus the generated Calculations and Assumptions registers', () => {
    expect(html).toMatch(/What the model is, and what it is not/);
    expect(html).toContain('Calculations');
    expect(html).toContain('Assumptions');
    // a named calc and a named assumption, straight from the registries, not hand-copied
    const [calcId, calc] = Object.entries(CALCS)[0];
    const [assumeId, assume] = Object.entries(ASSUMPTIONS)[0];
    expect(html).toContain(`id="calc-${calcId}"`);
    expect(html).toContain(calc.how);
    expect(html).toContain(`id="assume-${assumeId}"`);
    expect(html).toContain(assume.why);
  });
});

describe('glossary page pre-render', () => {
  const terms = sortedTerms(TERMS);
  const { listHtml, countText } = buildGlossaryHtml(terms, SOURCES);
  it('carries at least 1500 words of real content', () => { expect(wordCount(listHtml)).toBeGreaterThanOrEqual(1500); });
  it('lists every term by default (nothing filtered out)', () => {
    expect(countText).toBe(`${terms.length} of ${terms.length} terms`);
    for (const t of terms.slice(0, 5)) expect(listHtml).toContain(t.term);
  });
});

describe('visualizer text / parts index', () => {
  const levels = buildLevels(M, C, SOURCES);
  const html = renderLevelsHtml(levels);
  it('carries at least 3000 words of real content across every level', () => { expect(wordCount(html)).toBeGreaterThanOrEqual(3000); });
  it('covers all six main levels plus the side levels', () => {
    expect(levels.filter((l: any) => !l.side).length).toBe(6);
    expect(levels.some((l: any) => l.side)).toBe(true);
  });
  it('every part card carries its evidence labels and at least one source title where it cites one', () => {
    let sawLabeled = false, sawSourced = false;
    for (const lv of levels) for (const m of lv.modes) for (const p of m.parts) for (const s of p.specs) {
      if (['Spec', 'Vendor', 'Reported', 'Calc.', 'Assumed'].includes(s.basis)) sawLabeled = true;
      if (s.sourceTitles.length) sawSourced = true;
    }
    expect(sawLabeled).toBe(true);
    expect(sawSourced).toBe(true);
  });
  it('states the reference scenario', () => { expect(scenarioLine(M)).toMatch(/Reference scenario/); });
});

describe('llms.txt', () => {
  const txt = buildLlmsTxt(M);
  it('is plain text in the llmstxt.org shape: an H1 title, then ## sections of links', () => {
    expect(txt).toMatch(/^# The Intelligence Factory/);
    expect(txt).toMatch(/^## Pages/m);
    expect(txt).toMatch(/^- \[.+\]\(https:\/\/reedos\.dev\/intelligence_factory\/.*\): .+/m);
  });
  it('carries the publication statement verbatim', () => {
    expect(PUB_STATEMENT).toBe('Personal educational project based on cited public sources. Not an official publication of my employer or the companies discussed. Models are schematic; estimates and assumptions are identified.');
    expect(txt).toContain(PUB_STATEMENT);
  });
  it('links to the story page, visualizer, evidence, method, glossary and the parts index', () => {
    for (const path of ['', 'visualizer.html', 'evidence.html', 'method.html', 'glossary.html', 'parts.html']) expect(txt).toContain(`https://reedos.dev/intelligence_factory/${path}`);
  });
  it('explains how the evidence labels work', () => {
    for (const w of ['Spec', 'Vendor', 'Reported', 'Calc.', 'Assumed']) expect(txt).toContain(w);
  });
});

describe('llms-full.txt', () => {
  const sections = buildMethodSections(METHOD_WRITTEN, CALCS, ASSUMPTIONS);
  const txt = buildLlmsFullTxt({ M, SECTIONS: sections, TERMS: sortedTerms(TERMS), claims, SOURCES });
  it('carries the publication statement and real generated text, not a stub', () => {
    expect(txt).toContain(PUB_STATEMENT);
    expect(wordCount(txt)).toBeGreaterThanOrEqual(2000);
  });
});

describe('JSON-LD', () => {
  it('parses as valid JSON and carries no invented fields', () => {
    for (const page of ['index.html', 'evidence.html', 'method.html', 'glossary.html']) {
      const obj = articleJsonLd(page, '2026-10-01T00:00:00.000Z');
      expect(obj).toBeTruthy();
      const parsed = JSON.parse(jsonLdScript(obj).replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
      expect(parsed['@type']).toBe('TechArticle');
      expect(parsed.author).toEqual({ '@type': 'Person', name: 'Reed Osaki', url: 'https://reedos.dev/' });
      expect(parsed.publisher).toEqual(parsed.author);
      expect(parsed.inLanguage).toBe('en-US');
      expect(parsed.dateModified).toBe('2026-10-01T00:00:00.000Z');
      expect(parsed).not.toHaveProperty('logo');
      expect(parsed).not.toHaveProperty('image');
      expect(parsed).not.toHaveProperty('aggregateRating');
    }
  });
  it('the WebSite entry on the home page parses too', () => {
    const parsed = JSON.parse(jsonLdScript(websiteJsonLd()).replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
    expect(parsed['@type']).toBe('WebSite');
    expect(parsed.url).toBe('https://reedos.dev/intelligence_factory/');
  });
  it('returns nothing for pages that are not one of the article pages', () => {
    expect(articleJsonLd('visualizer.html', '2026-10-01T00:00:00.000Z')).toBeNull();
    expect(articleJsonLd('parts.html', '2026-10-01T00:00:00.000Z')).toBeNull();
  });
});
