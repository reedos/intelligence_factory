// The four clocks as charts: the simulated day, outage, training swing and inference load, drawn from the model with
// their notes. Used by the story page's "Four clocks" section and by the visualizer's clock strip (clock-ui.js).
// Nothing here touches the 3D stage, so the story page can load it without one.
import { makeSim, SIMS } from '../model/clock.ts';
import { store } from './store.js';
import { calc } from './sections.js';
import { chip } from '../evidence.js';

const $ = id => document.getElementById(id);
export const n0 = v => Math.round(v).toLocaleString('en-US');
export const mwTxt = v => v >= 1000 ? `${(v / 1000).toFixed(2)} GW` : v >= 100 ? `${n0(v)} MW` : `${v.toFixed(1)} MW`;
export const mwhTxt = v => v >= 10 ? `${n0(v)} MWh` : `${v.toFixed(2)} MWh`;
export const big = v => v >= 1e12 ? `${+(v / 1e12).toFixed(1)} T` : v >= 1e9 ? `${+(v / 1e9).toFixed(1)} B` : v >= 1e6 ? `${+(v / 1e6).toFixed(1)} M` : v >= 1e4 ? `${n0(v / 1000)}k` : n0(v);
export const opts = { peakTrough: 2.5, hotMax: 40 };
export const simFor = id => makeSim(store.M, id, opts, calc.tpsTouched ? calc.tokPerGpu : store.M.tokPerGpuRef);
export const clockTxt = (sim, t) => sim.unit === 'h'
  ? `${String(Math.floor(t) % 24).padStart(2, '0')}:${String(Math.floor((t % 1) * 60)).padStart(2, '0')}`
  : t < 60 ? `${t.toFixed(1)} s` : `${Math.floor(t / 60)} min ${String(Math.floor(t % 60)).padStart(2, '0')} s`;

// ---------- a line chart: primary series on the left axis, others on the right ----------
// outage time runs on a warped axis: the first 45 s get as much room as the next 25 minutes
export const warp = sim => sim.id === 'outage' ? (t => t < 45 ? t / 45 * 0.45 : 0.45 + (t - 45) / (sim.duration - 45) * 0.55) : (t => t / sim.duration);
export function chart(sim, { W = 1000, H = 220, pad = [46, 58, 18, 30], n = 480, compact = false } = {}) {
  const [L, R, T, B] = pad, w = W - L - R, h = H - T - B, X = warp(sim);
  const pts = Array.from({ length: n + 1 }, (_, i) => sim.sample(sim.id === 'outage' ? inv(sim, i / n) : sim.duration * i / n));
  const left = sim.series.filter(s => s.axis !== 'right'), right = sim.series.filter(s => s.axis === 'right');
  const range = keys => {
    let lo = Infinity, hi = -Infinity;
    for (const p of pts) for (const k of keys) { lo = Math.min(lo, p.values[k]); hi = Math.max(hi, p.values[k]); }
    if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
    const padV = (hi - lo) * 0.12; return [Math.max(0, lo - padV), hi + padV];
  };
  const [l0, l1] = range(left.map(s => s.key));
  const rights = right.map(s => ({ s, r: range([s.key]) }));
  const x = t => L + X(t) * w, yl = v => T + (1 - (v - l0) / (l1 - l0)) * h;
  let out = `<rect x="${L}" y="${T}" width="${w}" height="${h}" fill="none" stroke="#1e2630"/>`;
  if (!compact) for (let k = 0; k <= 4; k++) { const v = l0 + (l1 - l0) * k / 4; out += `<line x1="${L}" x2="${L + w}" y1="${yl(v)}" y2="${yl(v)}" stroke="#1a212b"/><text x="${L - 8}" y="${yl(v) + 4}" text-anchor="end" fill="#6b747c" font-family="IBM Plex Mono, monospace" font-size="11">${v >= 100 ? n0(v) : v.toFixed(1)}</text>`; }
  for (const e of sim.events) out += `<line x1="${x(e.t)}" x2="${x(e.t)}" y1="${T}" y2="${T + h}" stroke="#e6ba82" stroke-opacity=".35" stroke-dasharray="3 4"/>` + (compact ? '' : `<text x="${x(e.t) + 4}" y="${T + 12}" fill="#e6ba82" font-family="Manrope, sans-serif" font-size="11">${e.label}</text>`);
  const line = (key, y, color, width) => `<polyline fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" points="${pts.map(p => `${x(p.t).toFixed(1)},${y(p.values[key]).toFixed(1)}`).join(' ')}"/>`;
  rights.forEach(({ s, r }) => {
    const y = v => T + (1 - (v - r[0]) / (r[1] - r[0])) * h;
    if (s.area) out = `<polygon fill="${s.color}" fill-opacity=".13" points="${x(pts[0].t)},${T + h} ${pts.map(p => `${x(p.t).toFixed(1)},${y(p.values[s.key]).toFixed(1)}`).join(' ')} ${x(pts[pts.length - 1].t)},${T + h}"/>` + out;
    else out += line(s.key, y, s.color, 1.2).replace('<polyline', '<polyline stroke-dasharray="4 3"');
  });
  left.forEach(s => (out += line(s.key, yl, s.color, 2)));
  if (!compact) {
    out += `<text x="${L - 8}" y="${T - 6}" text-anchor="end" fill="#aab2b9" font-family="IBM Plex Mono, monospace" font-size="11">${left[0].unit}</text>`;
    rights.forEach(({ s, r }, i) => { out += `<text x="${L + w + 8}" y="${T + 12 + i * 30}" fill="${s.color}" font-family="IBM Plex Mono, monospace" font-size="11">${r[1] >= 100 ? n0(r[1]) : r[1].toFixed(1)}</text><text x="${L + w + 8}" y="${T + 24 + i * 30}" fill="${s.color}" font-family="IBM Plex Mono, monospace" font-size="10" fill-opacity=".7">${s.unit}</text>`; });
    const ticks = sim.id === 'outage' ? [0, 5, 15, 30, 45, 300, 600, 900, 1200, sim.duration] : sim.unit === 'h' ? [0, 6, 12, 18, 24] : [0, 10, 20, 30, 40, 50, 60];
    ticks.forEach(t => (out += `<text x="${x(t)}" y="${T + h + 18}" text-anchor="middle" fill="#6b747c" font-family="IBM Plex Mono, monospace" font-size="11">${sim.unit === 'h' ? `${String(t).padStart(2, '0')}:00` : t < 60 ? `${t} s` : `${Math.round(t / 60)} min`}</text>`));
  }
  return { svg: out, x, T, h };
}
// inverse of the outage warp, for sampling evenly along the drawn axis
export function inv(sim, u) { return u < 0.45 ? u / 0.45 * 45 : 45 + (u - 0.45) / 0.55 * (sim.duration - 45); }

// ---------- the strip in the 3D view ----------
// ---------- the page section: all four, with notes and a button to play each in 3D ----------
const WHERE_ = { training: { scene: 1, mode: 'power', part: 'bess' }, outage: { scene: 1, mode: 'power', part: 'gensets' }, hotday: { scene: 1, mode: 'heat', part: 'towers' }, inference: { scene: 2, mode: 'power', part: 'racks' } };
// a campus with battery backup has no generator yard, and one on a closed loop no towers: open on what it has
export const WHERE = new Proxy(WHERE_, { get: (w, id) => {
  const v = w[id], M = store.M;
  if (id === 'outage' && M?.backup === 'battery') return { ...v, part: 'bess' };
  if (id === 'hotday' && M?.closedLoop) return { ...v, part: M.cooling.id === 'warm' ? 'drycoolers' : 'chillers' };
  return v;
} });
// onPlay(id): what "Play in 3D" does on this page; onOpts(): after a slider changes the settings
export function renderSection(onPlay, onOpts = () => {}) {
  const grid = $('clock-grid'); if (!grid) return;
  grid.innerHTML = SIMS.map(({ id }) => {
    const s = simFor(id), c = chart(s, { W: 640, H: 250, pad: [44, 52, 20, 28], n: 360 });
    const legend = s.series.map(x => `<span class="legend-item" style="--c:${x.color}"><span class="sw"${x.area ? ' data-area' : x.axis === 'right' ? ' data-dash' : ''}></span>${x.label}</span>`).join('');
    return `<article class="ck-card"><div class="ck-card-head"><h3>${s.label}</h3><button type="button" class="btn" data-play="${id}">Play in 3D ↗</button></div>
      <div class="ck-legend">${legend}</div>
      <div class="chart-box"><svg viewBox="0 0 640 250" role="img" aria-label="${s.label}: ${s.series.map(x => x.label).join(', ')} over ${s.unit === 'h' ? '24 hours' : 'time'}">${c.svg}</svg></div>
      <ul class="ck-notes">${s.notes.map((nn, i) => `<li>${chip(nn.basis, `clock:${id}:${i}`, nn.text.slice(0, 60))}<span>${nn.text}</span></li>`).join('')}</ul>
      ${id === 'inference' ? `<div class="ctl"><div class="ctl-head"><label for="ck-ratio">Peak-to-trough ratio, illustrative</label><output id="ck-ratio-v">${opts.peakTrough}×</output></div><input type="range" id="ck-ratio" min="12" max="50" step="1" value="${opts.peakTrough * 10}"></div>` : ''}
      ${id === 'hotday' ? `<div class="ctl"><div class="ctl-head"><label for="ck-hot">Hottest hour</label><output id="ck-hot-v">${opts.hotMax} °C</output></div><input type="range" id="ck-hot" min="28" max="46" step="1" value="${opts.hotMax}"></div>` : ''}
    </article>`;
  }).join('');
  grid.querySelectorAll('[data-play]').forEach(b => b.addEventListener('click', () => onPlay(b.dataset.play)));
  const ratio = $('ck-ratio'), hot = $('ck-hot');
  ratio?.addEventListener('change', () => { opts.peakTrough = +ratio.value / 10; renderSection(onPlay, onOpts); onOpts(); });
  ratio?.addEventListener('input', () => { $('ck-ratio-v').textContent = `${(+ratio.value / 10).toFixed(1)}×`; });
  hot?.addEventListener('change', () => { opts.hotMax = +hot.value; renderSection(onPlay, onOpts); onOpts(); });
  hot?.addEventListener('input', () => { $('ck-hot-v').textContent = `${hot.value} °C`; });
  grid.querySelectorAll('input[type=range]').forEach(r => r.style.setProperty('--pct', `${(r.value - r.min) / (r.max - r.min) * 100}%`));
}
