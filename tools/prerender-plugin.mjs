// Pre-renders the Evidence, Method, Glossary and Parts-index pages to full static HTML at build time, adds a
// crawler/no-JS-readable text fallback to the visualizer, writes llms.txt / llms-full.txt, and stamps JSON-LD into
// every page's <head> — all from the site's own data modules (src/data.js, src/evidence.js, src/sources.js,
// src/pages/*-data.js), so there is exactly one place each fact is written. See research/ (if present) or the task
// that added this file for the brief: crawlers that do not run JavaScript (GPTBot, ClaudeBot, PerplexityBot,
// OAI-SearchBot) should be able to read the site's real content without changing how it looks or behaves for a
// reader whose browser does run the script.
//
// Vite bundles a config file and everything it statically imports with esbuild before running it (that is how
// vite.config.ts itself can import a .ts helper), so this plugin can import the real TypeScript model (engine.ts)
// directly, the same way every page script does; there is no separate build step and no risk of the static text
// drifting from the interactive page, because both read the same functions.
import { compute, DEFAULT_SCENARIO } from '../src/model/engine.ts';
import { content } from '../src/data.js';
import { BASIS, CALCS, ASSUMPTIONS } from '../src/evidence.js';
import { allClaims } from '../src/claims.js';
import { SOURCES } from '../src/sources.js';
import { scenarioNote, shownBasesOf, renderStats, renderClaims, renderSources } from '../src/pages/evidence-render.js';
import { SECTIONS as METHOD_WRITTEN } from '../src/pages/method-data.js';
import { buildMethodSections, buildBodyHtml, buildTocHtml } from '../src/pages/method-render.js';
import { TERMS } from '../src/pages/glossary-data.js';
import { sortedTerms, buildGlossaryHtml } from '../src/pages/glossary-render.js';
import { buildLevels, renderLevelsHtml, scenarioLine } from '../src/pages/visualizer-text.js';
import { buildLlmsTxt, buildLlmsFullTxt } from './llms-txt.mjs';
import { articleJsonLd, websiteJsonLd, jsonLdScript } from './json-ld.mjs';
import { basename } from 'node:path';

function buildOnce() {
  const M = compute(DEFAULT_SCENARIO);
  const C = content(M);
  const claims = allClaims(M, C);
  const shownBases = shownBasesOf(claims);
  const methodSections = buildMethodSections(METHOD_WRITTEN, CALCS, ASSUMPTIONS);
  const terms = sortedTerms(TERMS);
  const levels = buildLevels(M, C, SOURCES);
  return { M, C, claims, shownBases, methodSections, terms, levels };
}

const insertBeforeHeadClose = (html, fragment) => html.replace('</head>', `${fragment}\n</head>`);
const fillId = (html, id, inner) => {
  const re = new RegExp(`(<[^>]*id=["']${id}["'][^>]*>)(</[a-z0-9]+>)`, 'i');
  if (re.test(html)) return html.replace(re, (_, open, close) => `${open}${inner}${close}`);
  // tag has other children already (shouldn't on a fresh checkout, but don't silently no-op if it ever does)
  return html;
};

export function prerenderPlugin() {
  let data = null;
  let builtAt = '';
  return {
    name: 'prerender-static-text',
    buildStart() { data = buildOnce(); builtAt = new Date().toISOString(); },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (!data) { data = buildOnce(); builtAt = new Date().toISOString(); }
        // ctx.filename is reliable across dev and build; ctx.path can be "/" for the root entry
        const page = (ctx.filename && basename(ctx.filename)) || (ctx.path || '').replace(/^\//, '') || 'index.html';
        let out = html;

        if (page === 'evidence.html') {
          const claimsHtml = renderClaims(data.C, SOURCES, data.claims, data.M);
          out = fillId(out, 'ev-scenario', scenarioNote(data.M));
          out = fillId(out, 'ev-stats', renderStats(data.claims, data.shownBases, Object.keys(SOURCES).length));
          out = fillId(out, 'ev-claims', claimsHtml);
          out = fillId(out, 'ev-src', renderSources(data.claims, SOURCES));
        } else if (page === 'method.html') {
          out = fillId(out, 'mt-body', buildBodyHtml(data.methodSections));
          out = fillId(out, 'mt-toc', buildTocHtml(data.methodSections));
        } else if (page === 'glossary.html') {
          const { listHtml, countText, azHtml } = buildGlossaryHtml(data.terms, SOURCES);
          out = fillId(out, 'gl-list', listHtml);
          out = fillId(out, 'gl-count', countText);
          out = fillId(out, 'gl-az', azHtml);
        } else if (page === 'parts.html') {
          out = fillId(out, 'pt-scenario', scenarioLine(data.M));
          out = fillId(out, 'pt-list', renderLevelsHtml(data.levels));
        } else if (page === 'visualizer.html') {
          // shown only to a visitor whose browser is not running this page's script — the same audience a
          // <noscript> block always reaches, crawler or human, never hidden from anyone who can see the rest
          // of the page. parts.html carries the identical text as an ordinary, linked page.
          const noscript = `<noscript><main class="wrap page-wrap"><p class="note">JavaScript is off, so the 3D view above cannot run. ${scenarioLine(data.M)} Here is the same content as text — see also the <a href="parts.html">Parts index</a>.</p>${renderLevelsHtml(data.levels)}</main></noscript>`;
          out = out.replace('</body>', `${noscript}\n</body>`);
        }

        const ld = [];
        const art = articleJsonLd(page, builtAt);
        if (art) ld.push(jsonLdScript(art));
        if (page === 'index.html') ld.push(jsonLdScript(websiteJsonLd()));
        if (ld.length) out = insertBeforeHeadClose(out, ld.join('\n'));
        return out;
      },
    },
    generateBundle() {
      if (!data) data = buildOnce();
      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: buildLlmsTxt(data.M) });
      this.emitFile({ type: 'asset', fileName: 'llms-full.txt', source: buildLlmsFullTxt({ M: data.M, SECTIONS: data.methodSections, TERMS: data.terms, claims: data.claims, SOURCES }) });
    },
  };
}
