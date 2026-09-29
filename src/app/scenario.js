// The scenario bar: campus size, accelerator, power path and cooling, plus a summary strip that compares
// the current scenario with a pinned one. The scenario also lives in the URL query so a link reproduces it.
import { ACCELERATORS, POWER, COOLING, waterM3h } from '../model/engine.ts';
import { store, on, setScenario, pin } from './store.js';
import { syncRange, tokenFigures, setCarbon } from './sections.js';
import { SITES, STATUS_WORD } from '../model/sites.ts';
import { SOURCES } from '../sources.js';
import { BASIS } from '../data.js';
import { chip } from '../evidence.js';
import { withScenario } from './scenario-links.js';

const $ = id => document.getElementById(id);
const n0 = v => Math.round(v).toLocaleString('en-US');
const kShort = v => v >= 1e6 ? `${+(v / 1e6).toFixed(2)}M` : `${Math.round(v / 1000)}k`;
const mwLabel = mw => mw >= 1000 ? `${+(mw / 1000).toFixed(mw >= 10000 ? 0 : 1)} GW` : `${Math.round(mw)} MW`;

// campus size on a log slider, 10 MW to 5 GW
const LO = 1, HI = Math.log10(5000);
const mwFrom = v => { const mw = Math.pow(10, LO + v / 1000 * (HI - LO)); return mw < 100 ? Math.round(mw) : mw < 1000 ? Math.round(mw / 5) * 5 : Math.round(mw / 50) * 50; };
const sliderFrom = mw => Math.round((Math.log10(mw) - LO) / (HI - LO) * 1000);

function seg(el, options, current, disabled, onPick) {
  el.innerHTML = options.map(([id, label, sub]) => `<button type="button" data-id="${id}" aria-pressed="${id === current}" ${disabled(id) ? 'disabled' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => onPick(b.dataset.id)));
}
function renderControls() {
  const s = store.scenario, A = ACCELERATORS[s.accel];
  const mwTxt = mwLabel(s.meterMW);
  $('sc-mw-v').textContent = mwTxt;
  const r = $('sc-mw'); r.value = sliderFrom(s.meterMW); syncRange(r, mwTxt);
  seg($('sc-accel'), Object.values(ACCELERATORS).map(a => [a.id, a.short, a.year]), s.accel, () => false, id => setScenario({ accel: id }));
  seg($('sc-power'), Object.values(POWER).map(p => [p.id, p.short]), s.power, id => id === 'dc800' && !A.dc800, id => setScenario({ power: id }));
  seg($('sc-cooling'), Object.values(COOLING).map(c => [c.id, c.short, c.sub]), s.cooling, id => !A.coolingOptions.includes(id), id => setScenario({ cooling: id }));
  seg($('sc-site'), [['', 'None', 'generic'], ...Object.values(SITES).map(x => [x.id, x.name.replace(/^(Microsoft|Meta|SpaceXAI) /, ''), `${x.status.rank ? '★ ' : ''}${STATUS_WORD[x.status.state].toLowerCase()}`])], s.site || '', () => false, id => pickSite(id));
  renderSiteCard();
  const note = [];
  if (!A.dc800) note.push(`${A.short} servers take AC power supplies, so 800 V DC is off.`);
  if (!A.coolingOptions.includes('air')) note.push(`${A.rackName} racks are liquid-cooled only.`);
  if (A.coolingOptions.length === 1 && A.coolingOptions[0] === 'air') note.push(`NVIDIA's DGX ${A.short} reference design is air-cooled; some vendors sell liquid-cooled ${A.short} servers, not modeled here.`);
  if (A.id === 'rubin') note.push('Vera Rubin ships in 2026; its figures are pre-launch estimates.');
  $('sc-note').textContent = note.join(' ');
}
// a real campus sets the four choices to its closest match, moves the map pin and sets the grid carbon
function pickSite(id) {
  if (!id) { setScenario({ site: undefined }); return; }
  const x = SITES[id];
  setScenario({ ...x.scenario, site: id });
  setCarbon(x.carbonG);
}
function renderSiteCard() {
  const s = store.scenario, x = s.site && SITES[s.site], box = $('site-card');
  box.hidden = !x; if (!x) return;
  // a campus sized from its fleet derives its meter, so the meter is no drift; leaving the fleet is
  const staged = x.fleet && store.M.stage != null;
  const drift = [...(x.fleet ? (staged ? [] : ['stage']) : ['meterMW']), 'accel', 'power', 'cooling'].filter(k => k === 'stage' || s[k] !== x.scenario[k]);
  const st = x.status, src = SOURCES[st.source];
  box.innerHTML = `<div class="site-head"><div><span class="eyebrow">${x.owner} · ${x.place}</span><h3>${x.name}</h3></div>${drift.length ? `<button type="button" class="btn" id="site-reset">Back to the preset</button>` : ''}</div>
    <div class="site-status s-${st.state}"><span class="st-badge">${STATUS_WORD[st.state]}</span><p>${st.line} <span class="st-src">As of ${st.asOf}${src ? `, <a href="${src.url}" target="_blank" rel="noopener">${src.publisher}</a>` : ''}.</span></p>${st.rank ? `<p class="st-rank">★ ${st.rank}</p>` : ''}</div>
    ${x.fleet ? stageBlock(x) : ''}
    <dl class="site-facts">${x.facts.map(([k, v, b], i) => `<div><dt>${k}</dt><dd>${v}</dd>${chip(b, `site:${s.site}:${i}`, k)}</div>`).join('')}</dl>
    <div class="site-notes"><p class="sp-k">What this preset assumes${drift.length ? ' (you have since changed it)' : ''}</p><ul>${x.unknowns.map(u => `<li>${u}</li>`).join('')}<li>Grid carbon: ${x.carbonNote}</li></ul></div>
    ${x.sources.length ? `<p class="site-src">Sources: ${x.sources.map(id => SOURCES[id]).filter(Boolean).map(r => `<a href="${r.url}" target="_blank" rel="noopener">${r.publisher}</a>`).join(' · ')}</p>` : ''}`;
  $('site-reset')?.addEventListener('click', () => pickSite(x.id));
  box.querySelectorAll('[data-stage]').forEach(b => b.addEventListener('click', () => setScenario({ ...x.scenario, site: x.id, stage: +b.dataset.stage })));
}
// a campus sized from its operator's GPU counts: which dated stage, what that stage is, and what the model adds to it
function stageBlock(x) {
  const i = store.M.stage, st = i != null ? x.fleet[i] : null;
  const total = f => f.parts.reduce((n, p) => n + p.gpus, 0);
  const head = st ? `${x.name.replace(/^SpaceXAI /, '')} · ${i === 0 ? `Elon Musk, ${st.when}` : `planned for ${st.when}, per Elon Musk`} · ${kShort(total(st))} GPUs` : 'Sized from the scenario bar, not the operator’s GPU counts';
  return `<div class="site-stage"><span class="lab">${head}</span>
    <div class="sc-seg" role="group" aria-label="Fleet stage">${x.fleet.map((f, k) => `<button type="button" data-stage="${k}" aria-pressed="${k === i}">${f.label}<small>${kShort(total(f))}</small></button>`).join('')}</div>
    <p class="note">${st ? `${st.note}. ` : ''}GPU counts from Elon Musk; the halls, CDUs, cables and tokens are this model, sized from them.</p></div>`;
}
$('sc-mw').addEventListener('input', e => { const t = mwLabel(mwFrom(+e.target.value)); $('sc-mw-v').textContent = t; syncRange(e.target, t); });
// picking a size leaves a published fleet: that campus's size comes from its GPU counts, not the slider
$('sc-mw').addEventListener('change', e => setScenario({ meterMW: mwFrom(+e.target.value), stage: undefined }));
document.querySelectorAll('[data-mw]').forEach(b => b.addEventListener('click', () => setScenario({ meterMW: +b.dataset.mw, stage: undefined })));

// ---------- summary strip ----------
// Compact numbers so a figure never wraps: 3 significant digits and a unit prefix.
const compact = (v, unit = '') => {
  const [d, s] = v >= 1e9 ? [1e9, ' B'] : v >= 1e6 ? [1e6, ' M'] : v >= 1e4 ? [1e3, 'k'] : [1, ''];
  const x = v / d;
  return `${x >= 100 ? Math.round(x).toLocaleString('en-US') : x >= 10 ? x.toFixed(1) : x.toFixed(2)}${s}${unit}`;
};
const power = v => v >= 1000 ? `${(v / 1000).toFixed(2)} GW` : v >= 100 ? `${Math.round(v)} MW` : `${v.toFixed(1)} MW`;
// better: +1 when higher is better, −1 when lower is better, 0 when it is only a size
function kpis(M) {
  const t = tokenFigures(M);
  return [
    ['IT load', M.IT_MW, power, 0],
    ['PUE', M.pue, v => v.toFixed(2), -1],
    ['Racks', M.racks, v => compact(v), 0],
    ['GPUs', M.gpus, v => compact(v), 0],
    [M.mixed ? 'Per rack, average' : 'Per rack', M.mixed ? M.rackAvgKW : M.rack.kw, v => `${Math.round(v)} kW`, 0],
    ['Network, outside racks', M.NET.switchMW + M.NET.opticsMW, power, 0],
    ['Reaches GPU silicon', M.gpuSiliconMW / M.meterMW * 100, v => `${v.toFixed(1)}%`, 1],
    ['Tokens per second', t.rate, v => compact(v), 1],
    ['Tokens per kWh', 3.6e6 / t.j, v => compact(v), 1],
    ['Water per day', waterM3h(M) * 24, v => compact(v, ' m³'), -1],
  ];
}
function renderKpis() {
  const now = kpis(store.M), was = store.pinned ? kpis(store.pinned) : null;
  $('kpis').innerHTML = now.map(([label, v, f, better], i) => {
    let delta = '';
    if (was) {
      const w = was[i][1], pct = w ? (v - w) / w * 100 : 0;
      const cls = Math.abs(pct) < 0.5 ? 'same' : better === 0 ? 'size' : pct * better > 0 ? 'up' : 'down';
      delta = `<span class="kd ${cls}">A ${f(w)}${cls === 'same' ? '' : ` · ${pct > 0 ? '+' : '−'}${Math.abs(pct) >= 10 ? Math.round(Math.abs(pct)) : Math.abs(pct).toFixed(1)}%`}</span>`;
    }
    return `<div class="kpi"><span class="kv">${f(v)}</span><span class="kl">${label}</span>${delta}</div>`;
  }).join('');
  const P = store.pinned;
  $('sc-pin').textContent = P ? 'Unpin' : 'Pin to compare';
  $('sc-pin').setAttribute('aria-pressed', String(!!P));
  $('sc-pinned').textContent = P ? `A = ${mwLabel(P.meterMW)} · ${P.accel.short} · ${P.power.short} · ${P.cooling.short}` : 'Pin this scenario, then change a setting to see what moves.';
}
$('sc-pin').addEventListener('click', () => pin(!store.pinned));

// ---------- URL ----------
function writeUrl() {
  const s = store.scenario, q = new URLSearchParams(location.search);
  q.set('mw', s.meterMW); q.set('accel', s.accel); q.set('power', s.power); q.set('cooling', s.cooling);
  if (s.site) q.set('site', s.site); else q.delete('site');
  if (s.stage != null) q.set('stage', s.stage); else q.delete('stage');
  // Keep a complete link for normal clicks, copying, and opening in a new tab.
  const open = $('sc-open');
  if (open) open.href = withScenario(q.toString(), 'visualizer.html?view=1.power');
  try { history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`); } catch { /* sandboxed viewers refuse; the page still works */ }
}
function readUrl() {
  const q = new URLSearchParams(location.search), patch = {};
  const mw = +q.get('mw'); if (mw >= 10 && mw <= 5000) patch.meterMW = mw;
  if (ACCELERATORS[q.get('accel')]) patch.accel = q.get('accel');
  if (POWER[q.get('power')]) patch.power = q.get('power');
  if (COOLING[q.get('cooling')]) patch.cooling = q.get('cooling');
  if (SITES[q.get('site')]) { patch.site = q.get('site'); setCarbon(SITES[q.get('site')].carbonG); }
  if (q.has('stage') && SITES[q.get('site')]?.fleet?.[+q.get('stage')]) patch.stage = +q.get('stage');
  if (Object.keys(patch).length) setScenario(patch);
}

on('scenario', () => { renderControls(); renderKpis(); writeUrl(); });
on('pin', renderKpis);
on('tokens', renderKpis);
renderControls(); renderKpis();
readUrl();
