// Audit item 17 ("preserve scenario parameters between pages"): the topbar's cross-page links must carry
// the reader's campus along, not drop it. withScenario is the pure part of that (site.js does the DOM side),
// so it is checked directly here.
import { describe, it, expect } from 'vitest';
import { withScenario } from './scenario-links.js';

describe('withScenario', () => {
  it('leaves a link alone when the current URL carries no scenario', () => {
    expect(withScenario('', 'evidence.html')).toBe('evidence.html');
    expect(withScenario('?other=1', 'index.html#explore')).toBe('index.html#explore');
  });

  it('copies every scenario key present onto a plain page link, in order', () => {
    expect(withScenario('?mw=250&accel=gb300&power=ac415&cooling=warm', 'evidence.html'))
      .toBe('evidence.html?mw=250&accel=gb300&power=ac415&cooling=warm');
  });

  it('keeps the hash after the query on a back-to-visualizer anchor', () => {
    expect(withScenario('?mw=250&accel=gb300', 'index.html#explore'))
      .toBe('index.html?mw=250&accel=gb300#explore');
  });

  it('only carries the five scenario keys, not an arbitrary query param', () => {
    expect(withScenario('?mw=250&utm_source=x', 'method.html')).toBe('method.html?mw=250');
  });

  it('overwrites a stale scenario already on the link rather than duplicating it', () => {
    expect(withScenario('?mw=250&accel=h100', 'evidence.html?mw=10&accel=gb200'))
      .toBe('evidence.html?mw=250&accel=h100');
  });

  it('carries a real-campus site id too', () => {
    expect(withScenario('?mw=946&accel=gb300&power=ac415&cooling=liquid&site=xai-colossus2', 'glossary.html'))
      .toBe('glossary.html?mw=946&accel=gb300&power=ac415&cooling=liquid&site=xai-colossus2');
  });
});
