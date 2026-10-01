// Pure HTML-generation for the Method page, shared by method.js (browser) and tools/prerender-plugin.mjs (build
// time, baking the same sections into method.html for crawlers that do not run JS). The written sections plus the
// two generated registers (Calculations, Assumptions) are built from the same data this page has always used:
// src/pages/method-data.js and the CALCS/ASSUMPTIONS registries in src/evidence.js.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// titles carry their own numbers ("3. Power: ..."); the contents list shows them apart
const split = t => { const m = t.match(/^(\d+)\.\s*(.*)$/); return m ? [m[1], m[2]] : ['', t]; };

export function buildMethodSections(WRITTEN, CALCS, ASSUMPTIONS) {
  const n = WRITTEN.length;
  return [...WRITTEN,
    { id: 'calculations', title: `${n + 1}. Calculations`, html: `<p>What the model calculates, how, and from what. A figure labeled <b>Calc.</b> names one of these.</p><dl class="mt-reg">${Object.entries(CALCS).map(([id, c]) => `<div id="calc-${esc(id)}"><dt>${esc(c.title)}</dt><dd>${esc(c.how)}${c.inputs?.length ? `<span class="mt-in">From: ${c.inputs.map(esc).join(', ')}</span>` : ''}</dd></div>`).join('')}</dl>` },
    { id: 'assumptions', title: `${n + 2}. Assumptions`, html: `<p>Values the model chooses where no single published figure applies, and why. A figure labeled <b>Assumed</b> names one of these. Change one and the figures that rest on it change with it.</p><dl class="mt-reg">${Object.entries(ASSUMPTIONS).map(([id, a]) => `<div id="assume-${esc(id)}"><dt>${esc(a.title)}: ${esc(a.value)}</dt><dd>${esc(a.why)}</dd></div>`).join('')}</dl>` },
  ];
}
export const buildBodyHtml = SECTIONS => SECTIONS.map(s => { const [n, t] = split(s.title); return `
  <section class="mt-sec" id="${esc(s.id)}"><h2><span>${n}</span>${esc(t)}</h2><div class="mt-html">${s.html}</div></section>`; }).join('');
export const buildTocHtml = SECTIONS => `<p class="eyebrow">On this page</p><ol>${SECTIONS.map(s => { const [n, t] = split(s.title); return `<li><a href="#${esc(s.id)}"><span>${n}</span>${esc(t)}</a></li>`; }).join('')}</ol>`;
