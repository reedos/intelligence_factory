// The scenario bar: campus size, accelerator, power path and cooling, plus a summary strip that compares
// the current scenario with a pinned one. The scenario also lives in the URL query so a link reproduces it.
import { ACCELERATORS, POWER, COOLING } from '../model/engine.ts';
import { store, on, setScenario, pin } from './store.js';
import { syncRange, tokenFigures } from './sections.js';

const $ = id => document.getElementById(id);
const n0 = v => Math.round(v).toLocaleString('en-US');
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
  $('sc-mw-v').textContent = mwLabel(s.meterMW);
  const r = $('sc-mw'); r.value = sliderFrom(s.meterMW); syncRange(r);
  seg($('sc-accel'), Object.values(ACCELERATORS).map(a => [a.id, a.short, a.year]), s.accel, () => false, id => setScenario({ accel: id }));
  seg($('sc-power'), Object.values(POWER).map(p => [p.id, p.short]), s.power, id => id === 'dc800' && !A.dc800, id => setScenario({ power: id }));
  seg($('sc-cooling'), Object.values(COOLING).map(c => [c.id, c.short, c.sub]), s.cooling, id => !A.coolingOptions.includes(id), id => setScenario({ cooling: id }));
  const note = [];
  if (!A.dc800) note.push(`${A.short} servers take AC power supplies, so 800 V DC is off.`);
  if (!A.coolingOptions.includes('air')) note.push(`${A.rackName} racks are liquid-cooled only.`);
  if (!A.coolingOptions.includes('warm')) note.push(`${A.short} halls use chilled air or chilled water.`);
  if (A.id === 'rubin') note.push('Vera Rubin ships in 2026; its figures are pre-launch estimates.');
  $('sc-note').textContent = note.join(' ');
}
$('sc-mw').addEventListener('input', e => { $('sc-mw-v').textContent = mwLabel(mwFrom(+e.target.value)); syncRange(e.target); });
$('sc-mw').addEventListener('change', e => setScenario({ meterMW: mwFrom(+e.target.value) }));
document.querySelectorAll('[data-mw]').forEach(b => b.addEventListener('click', () => setScenario({ meterMW: +b.dataset.mw })));

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
    ['Per rack', M.rack.kw, v => `${Math.round(v)} kW`, 0],
    ['Network, outside racks', M.NET.switchMW + M.NET.opticsMW, power, 0],
    ['Reaches GPU silicon', M.gpuSiliconMW / M.meterMW * 100, v => `${v.toFixed(1)}%`, 1],
    ['Tokens per second', t.rate, v => compact(v), 1],
    ['Tokens per kWh', 3.6e6 / t.j, v => compact(v), 1],
    ['Water per day', M.meterMW * 24 * M.wue, v => compact(v, ' m³'), -1],
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
  try { history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`); } catch { /* sandboxed viewers refuse; the page still works */ }
}
function readUrl() {
  const q = new URLSearchParams(location.search), patch = {};
  const mw = +q.get('mw'); if (mw >= 10 && mw <= 5000) patch.meterMW = mw;
  if (ACCELERATORS[q.get('accel')]) patch.accel = q.get('accel');
  if (POWER[q.get('power')]) patch.power = q.get('power');
  if (COOLING[q.get('cooling')]) patch.cooling = q.get('cooling');
  if (Object.keys(patch).length) setScenario(patch);
}

on('scenario', () => { renderControls(); renderKpis(); writeUrl(); });
on('pin', renderKpis);
on('tokens', renderKpis);
renderControls(); renderKpis();
readUrl();
