// Everything below the stage: the ledger, the staircases, the links diagrams and counts, temperatures,
// how a model is split, the inventory, and the cost-per-token calculator. Each redraws from the model.
import { VOLT, BASIS } from '../data.js';
import { store, on, emit } from './store.js';
import { goAttr } from './links.js';
import { calc, tokenFigures } from '../model/tokens.js';
import { MEDIA_LADDER, copperWallSVG, opticsCutawaySVG } from '../diagrams/links-media.js';
export { calc, tokenFigures };

const $ = id => document.getElementById(id);
const fmt = (n, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const n0 = v => Math.round(v).toLocaleString('en-US');
const kilo = v => v >= 1e6 ? `${(v / 1e6).toFixed(1)} M` : v >= 1e4 ? `${Math.round(v / 1000)}k` : n0(v);
const C = k => VOLT[k].css;
const TXT = (x, y, s, { a = 'middle', size = 12, fill = 'currentColor', w = 500, mono = false, op = 1 } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${a}" font-family="${mono ? 'IBM Plex Mono, monospace' : 'Manrope, sans-serif'}" font-size="${size}" font-weight="${w}" fill="${fill}" fill-opacity="${op}">${s}</text>`;

// ---------- ledger ----------
const KIND = { loss: 'var(--loss)', overhead: 'var(--overhead)', work: 'var(--work)', net: 'var(--net)' };
const SCENE_VOLT = ['hv', 'mv', 'lv', 'dc', 'bus12', 'core'];
function renderLedger() {
  const M = store.M, P = store.pinned, { LEDGER, LEDGER_MARKS, LEDGER_END } = store.C;
  const rows = [];
  let rem = M.meterMW, remP = P?.meterMW;
  const scale = M.meterMW;
  // the pinned scenario is scaled to this campus size, so a 1 GW campus compares with a 100 MW one share for share
  const k = P ? M.meterMW / P.meterMW : 1;
  const was = (v, now) => P == null || v == null ? '' : `<span class="was" title="Pinned scenario${k !== 1 ? ', scaled to this campus size' : ''}">${Math.abs(v * k - now) < 0.01 * Math.max(0.1, Math.abs(now)) ? '' : `A ${fmt(v * k, 1)}`}</span>`;
  const row = (cls, label, chip, bar, mw, sceneI, pinnedTxt = '', attrs = '') => rows.push(`<div class="lg-row ${cls}" data-scene="${sceneI ?? ''}" ${attrs}><div class="lab"><span>${label}</span>${chip}</div>${bar}<div class="mw ${cls.includes('minus') ? 'minus' : ''}">${mw}${pinnedTxt}</div></div>`);
  const trunk = (mw, cut, kind, v) => `<div class="bar" style="--c:${VOLT[v].css}"><div class="rem" style="width:${(mw - (cut || 0)) / scale * 100}%"></div>${cut ? `<div class="cut" style="--k:${KIND[kind]};left:${(mw - cut) / scale * 100}%;width:${cut / scale * 100}%"></div>` : ''}</div>`;
  row('mark', 'At the campus meter', '', trunk(rem, 0, null, 'hv'), `${fmt(rem, 1)} MW`, 1, was(remP, rem));
  LEDGER.forEach((l, i) => {
    const pl = P?.ledger[i];
    row('minus', l.label, `<button type="button" class="chip ${l.basis}" data-src="ledger:${i}" aria-expanded="false" aria-label="${BASIS[l.basis].label}: sources">${BASIS[l.basis].short}</button>`, trunk(rem, l.mw, l.kind, SCENE_VOLT[l.scene]), `−${fmt(l.mw, 1)}`, l.scene, pl ? was(-pl.mw, -l.mw) : '', `data-row="${i}" ${goAttr(l.link, l.label)}`);
    rem -= l.mw; if (P) remP -= pl.mw;
    const mark = LEDGER_MARKS.find(m => m.after === i);
    if (mark) row('mark', mark.label === 'IT load' ? `IT load, PUE ${M.pue.toFixed(2)}` : mark.label, '', trunk(rem, 0, null, SCENE_VOLT[Math.min(5, (LEDGER[i + 1] || l).scene)]), `${fmt(rem, 1)} MW`, l.scene, was(remP, rem));
  });
  row('mark end', `${LEDGER_END.label} <span style="color:var(--muted);font-weight:400">· ${LEDGER_END.sub}</span>`, '', trunk(rem, 0, null, 'core'), `${fmt(rem, 1)} MW`, 5, was(P?.gpuSiliconMW, rem), goAttr(LEDGER_END.link, LEDGER_END.label));
  $('ledger').innerHTML = rows.join('');
  const size = M.meterMW >= 1000 ? `${+(M.meterMW / 1000).toFixed(2)} GW` : `${Math.round(M.meterMW)} MW`;
  $('ledger-h').textContent = `Where ${size} goes`;
  $('ledger-lede').textContent = `Start with ${size} at the campus meter. Each row takes off what one stage turns into heat, spends on cooling, hands to silicon other than the GPU, or — for the last row before the silicon — is never drawn at all, spare capacity left when the racks round down to a whole number. The highlighted rows belong to the scale you are looking at. The grid already lost about 5% before the meter.${P && k !== 1 ? ' Pinned values (A) are scaled to this campus size.' : ''}`;
  highlightLedger(store.ui.scene);
}
function highlightLedger(i) { document.querySelectorAll('.lg-row').forEach(r => r.classList.toggle('here', r.dataset.scene === String(i) && r.classList.contains('minus'))); }

// ---------- charts: each column is a link into 3D ----------
const col = (link, label, x, y, w, h, body) => link ? `<g class="golink" ${goAttr(link, label)}><rect class="hit" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>${body}</g>` : body;

// ---------- staircases ----------
function renderStairs() {
  const STAIRCASE = store.C.STAIRCASE;
  const svg = $('stairs'), W = 1000, H = 380, L = 70, R = 24, T = 52, B = 130;
  const lo = Math.log10(0.5), hi = Math.log10(600000);
  const y = v => T + (hi - Math.log10(v)) / (hi - lo) * (H - T - B);
  const n = STAIRCASE.length, cw = (W - L - R) / n;
  let out = '';
  [1, 10, 100, 1000, 10000, 100000].forEach(v => {
    out += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#222b38" stroke-width="1"/>`;
    out += `<text x="${L - 10}" y="${y(v) + 4}" text-anchor="end" fill="#6b747c" font-family="IBM Plex Mono, monospace" font-size="12">${v >= 1000 ? v / 1000 + ' kV' : v + ' V'}</text>`;
  });
  STAIRCASE.forEach((s, i) => {
    const x0 = L + i * cw, x1 = x0 + cw, yy = y(s.v), c = VOLT[s.volt].css;
    const start = out.length;
    out += `<rect x="${x0 + 3}" y="${yy}" width="${cw - 6}" height="${H - B - yy}" fill="${c}" fill-opacity="0.12"/>`;
    out += `<line x1="${x0 + 3}" x2="${x1 - 3}" y1="${yy}" y2="${yy}" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`;
    if (i < n - 1) { const ny = y(STAIRCASE[i + 1].v); out += `<line x1="${x1 - 3}" x2="${x1 + 3}" y1="${yy}" y2="${ny}" stroke="#6b747c" stroke-width="1.5" stroke-dasharray="3 3"/>`; }
    out += `<text x="${x0 + cw / 2}" y="${yy - 10}" text-anchor="middle" fill="${c}" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="15">${s.label}</text>`;
    out += `<text x="${x0 + cw / 2}" y="${H - B + 24}" text-anchor="middle" fill="#f0f0fa" font-family="Manrope, sans-serif" font-weight="600" font-size="12.5">${s.where}</text>`;
    const [c1, c2] = s.current.split(/ (?=per )/);
    out += `<text x="${x0 + cw / 2}" y="${H - B + 46}" text-anchor="middle" fill="#e9fbff" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="13">${c1}</text>`;
    if (c2) out += `<text x="${x0 + cw / 2}" y="${H - B + 63}" text-anchor="middle" fill="#e9fbff" font-family="IBM Plex Mono, monospace" font-size="11.5">${c2}</text>`;
    out += `<text x="${x0 + cw / 2}" y="${H - B + (c2 ? 84 : 66)}" text-anchor="middle" fill="#aab2b9" font-family="Manrope, sans-serif" font-size="11.5">${s.note}</text>`;
    out = out.slice(0, start) + col(s.link, `${s.label}, ${s.where}`, x0 + 1, yy - 30, cw - 2, H - yy + 30 - 30, out.slice(start));
  });
  out += `<text x="${L}" y="18" fill="#aab2b9" font-family="Manrope, sans-serif" font-size="12.5">Voltage, log scale. Current is for the conductor named under each step. All currents are estimates from P ÷ V.</text>`;
  svg.innerHTML = out;
}
function renderBandwidth() {
  const BANDWIDTH = store.C.BANDWIDTH;
  const svg = $('bandwidth'), W = 1000, H = 400, L = 70, R = 24, T = 40, B = 130;
  const lo = Math.log10(0.5), hi = Math.log10(30000);
  const y = v => T + (hi - Math.log10(Math.max(0.6, v))) / (hi - lo) * (H - T - B);
  const n = BANDWIDTH.length, cw = (W - L - R) / n;
  let out = '';
  [1, 10, 100, 1000, 10000].forEach(v => {
    out += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#222b38" stroke-width="1"/>`;
    out += `<text x="${L - 10}" y="${y(v) + 4}" text-anchor="end" fill="#6b747c" font-family="IBM Plex Mono, monospace" font-size="12">${v >= 1000 ? v / 1000 + ' TB/s' : v + ' GB/s'}</text>`;
  });
  BANDWIDTH.forEach((b, i) => {
    const x0 = L + i * cw, yy = y(b.gbs), c = VOLT[b.cls].css;
    const start = out.length;
    const val = b.gbs >= 1000 ? `${+(b.gbs / 1000).toFixed(2)} TB/s` : `≈${b.gbs >= 10 ? Math.round(b.gbs) : b.gbs.toFixed(1)} GB/s`;
    out += `<rect x="${x0 + 14}" y="${yy}" width="${cw - 28}" height="${H - B - yy}" rx="4" fill="${c}" fill-opacity="0.22" stroke="${c}" stroke-opacity="0.8"/>`;
    out += `<text x="${x0 + cw / 2}" y="${yy - 10}" text-anchor="middle" fill="${c}" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="15">${val}</text>`;
    out += `<text x="${x0 + cw / 2}" y="${H - B + 24}" text-anchor="middle" fill="#f0f0fa" font-family="Manrope, sans-serif" font-weight="700" font-size="14">${b.label}</text>`;
    out += `<text x="${x0 + cw / 2}" y="${H - B + 42}" text-anchor="middle" fill="#aab2b9" font-family="Manrope, sans-serif" font-size="12.5">${b.where}</text>`;
    out += `<text x="${x0 + cw / 2}" y="${H - B + 66}" text-anchor="middle" fill="#e9fbff" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="12.5">${b.latency}</text>`;
    out += `<text x="${x0 + cw / 2}" y="${H - B + 86}" text-anchor="middle" fill="#6b747c" font-family="Manrope, sans-serif" font-size="11.5">${b.note}</text>`;
    out = out.slice(0, start) + col(b.link, `${b.label}, ${b.where}`, x0 + 4, yy - 30, cw - 8, H - yy + 30 - 30, out.slice(start));
  });
  out += `<text x="${L}" y="20" fill="#aab2b9" font-family="Manrope, sans-serif" font-size="12.5">Bandwidth per GPU, log scale, with one-way latency under each bar. Each row names its own direction and scope — aggregate, each way, or a shared link — so bars aren’t all measured the same way; latency runs on its own scale, not bandwidth’s.</text>`;
  svg.innerHTML = out;
}

// ---------- the links, drawn and counted ----------
function renderLinkText() {
  const M = store.M, A = M.accel, nvl = A.gpusPerRack === 72, F = M.NET.fabric;
  const size = M.meterMW >= 1000 ? `${+(M.meterMW / 1000).toFixed(2)} GW` : `${Math.round(M.meterMW)} MW`;
  const speed = A.nicGbps >= 1000 ? `${A.nicGbps / 1000}T` : `${A.nicGbps}G`;
  $('links-lede').textContent = `Three networks, three physical media. Copper ties ${nvl ? '72 GPUs into one machine inside a rack' : '8 GPUs into one machine inside each server'}; single-mode fiber and pluggable optics tie ${nvl ? 'racks' : 'servers'} into a campus fabric; coherent optics on leased fiber tie campuses together. Counts are for this ${size} campus and one common fabric layout, so treat them as estimates of scale, not a bill of materials.`;
  $('cap-scaleup').innerHTML = `<b style="color:var(--nvl)">Scale-up.</b> ` + (nvl
    ? `Inside one ${A.rackName} rack every GPU connects straight to all 18 NVLink switch chips, so any GPU reaches any other through exactly one switch. One GPU's 18 links are highlighted.`
    : 'Inside one DGX H100 every GPU spreads its 18 NVLink links over four NVSwitch chips on the baseboard. The domain ends at the server: the other 24 GPUs in the same rack are reached over the network.');
  $('cap-scaleout').innerHTML = `<b style="color:var(--eth)">Scale-out.</b> One ${speed} optical port per GPU climbs through ${M.NET.tiers === 2 ? 'two' : 'three'} tiers of ${F.radix}-port switches${M.NET.planes > 1 ? `, in ${M.NET.planes} parallel fabrics at this size` : ''}. Non-blocking means the same number of links at every tier, so each tier adds about one more link per GPU and two more optical modules per link.`;
}
function renderLinks() {
  renderLinkText();
  const M = store.M, A = M.accel, NET = M.NET, F = NET.fabric, GPUS = M.gpus, RACKS = M.racks;
  const speed = A.nicGbps >= 1000 ? `${A.nicGbps / 1000}T` : `${A.nicGbps}G`;
  const nvl72 = A.id !== 'h100';
  // 1. Scale-up
  {
    const W = 1000, nG = nvl72 ? 72 : 8, nS = nvl72 ? 18 : 4;
    const gx = i => nvl72 ? 40 + i * (920 / 71) : 180 + i * (640 / 7), sx = j => nvl72 ? 70 + j * (860 / 17) : 320 + j * (360 / 3), gy = 46, sy = 214;
    let lines = '', hi = '';
    const hiG = nvl72 ? 20 : 2;
    for (let i = 0; i < nG; i++) for (let j = 0; j < nS; j++) {
      const l = `<line x1="${gx(i)}" y1="${gy + 6}" x2="${sx(j)}" y2="${sy - 12}"`;
      if (i === hiG) hi += `${l} stroke="${C('nvl')}" stroke-width="1.6"/>`; else lines += `${l} stroke="currentColor" stroke-opacity="${nvl72 ? 0.05 : 0.25}"/>`;
    }
    let dots = '';
    for (let i = 0; i < nG; i++) dots += `<circle cx="${gx(i)}" cy="${gy}" r="${nvl72 ? 5 : 9}" fill="${i === hiG ? C('nvl') : '#6f7a8c'}"/>`;
    for (let j = 0; j < nS; j++) dots += `<rect x="${sx(j) - 16}" y="${sy - 12}" width="32" height="20" rx="3" fill="#1b2230" stroke="${C('nvl')}" stroke-opacity="0.7"/>`;
    const top = nvl72 ? `18 NVLink links from every GPU, one to each switch chip` : '18 NVLink links per GPU, spread over 4 NVSwitch chips';
    const bottom = nvl72 ? '18 NVLink switch chips, 2 per switch tray × 9 trays, 72 ports each' : '4 NVSwitch chips on the HGX board: the domain ends at the server';
    const foot = nvl72 ? '72 × 18 = 1,296 links · 4 copper pairs each = 5,184 connections · no optics, no hops outside the rack' : '8 GPUs × 18 links · beyond these 8, every byte goes out through the network';
    $('fig-scaleup').innerHTML = `<svg viewBox="0 0 ${W} 280" role="img" aria-label="Scale-up: ${nG} GPUs, each linked to all ${nS} NVLink switch chips">
      ${lines}${hi}${dots}
      ${TXT(40, 22, `${nG} GPUs`, { a: 'start', size: 13, w: 700 })}${TXT(960, 22, top, { a: 'end', size: 12, op: 0.7 })}
      ${TXT(gx(hiG), 22, 'one GPU', { fill: C('nvl'), size: 12, w: 600 })}
      ${TXT(500, 250, bottom, { size: 13, w: 700 })}
      ${TXT(500, 270, foot, { size: 12, op: 0.7, mono: true })}
    </svg>`;
  }
  // 2. Scale-out
  {
    const W = 1000, H = 400, three = NET.tiers === 3;
    const ys = three ? { core: 60, spine: 150, leaf: 240, rack: 330 } : { spine: 110, leaf: 220, rack: 330 };
    const x = (i, n, x0 = 80, x1 = 740) => x0 + (i + 0.5) * (x1 - x0) / n;
    let edges = '', nodes = '';
    const box = (cx, cy, w, h, stroke, label) => `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" rx="4" fill="#161d29" stroke="${stroke}"/>` + (label ? TXT(cx, cy + 4, label, { size: 11, mono: true, op: 0.85 }) : '');
    const pods = 2, per = 4;
    for (let p = 0; p < pods; p++) for (let i = 0; i < per; i++) {
      const k = p * per + i, lx = x(k, pods * per);
      edges += `<line x1="${lx}" y1="${ys.rack - 18}" x2="${lx}" y2="${ys.leaf + 12}" stroke="${C('eth')}" stroke-width="3"/>`;
      if (three) {
        for (let j = 0; j < per; j++) edges += `<line x1="${lx}" y1="${ys.leaf - 12}" x2="${x(p * per + j, pods * per)}" y2="${ys.spine + 12}" stroke="${C('eth')}" stroke-opacity="0.45"/>`;
        for (let c = 0; c < 4; c++) edges += `<line x1="${lx}" y1="${ys.spine - 12}" x2="${x(c, 4, 200, 620)}" y2="${ys.core + 12}" stroke="${C('eth')}" stroke-opacity="0.3"/>`;
      } else for (let j = 0; j < 4; j++) edges += `<line x1="${lx}" y1="${ys.leaf - 12}" x2="${x(j, 4, 200, 620)}" y2="${ys.spine + 12}" stroke="${C('eth')}" stroke-opacity="0.4"/>`;
    }
    for (let k = 0; k < pods * per; k++) { const lx = x(k, pods * per); nodes += box(lx, ys.rack, 64, 36, '#3a4658', nvl72 ? 'NVL72' : 'DGX') + box(lx, ys.leaf, 56, 22, C('eth'), '') + (three ? box(lx, ys.spine, 56, 22, C('eth'), '') : ''); }
    for (let c = 0; c < 4; c++) nodes += box(x(c, 4, 200, 620), three ? ys.core : ys.spine, 56, 22, C('eth'), '');
    const side = (y, t, s) => TXT(770, y - 2, t, { a: 'start', size: 13, w: 700 }) + TXT(770, y + 15, s, { a: 'start', size: 11.5, op: 0.7, mono: true });
    const edge = (y, t) => TXT(770, y, t, { a: 'start', size: 11.5, fill: C('eth'), mono: true });
    const half = F.radix / 2;
    $('fig-scaleout').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scale-out fabric of ${NET.tiers} tiers, one ${speed} link per GPU at each tier">
      ${edges}${nodes}
      ${three ? side(ys.core, `Core · ${n0(NET.core)} switches`, `${F.radix} × ${speed} down`) + edge((ys.core + ys.spine) / 2 + 4, `↕ ${n0(GPUS)} links`) : ''}
      ${side(ys.spine, `Spine · ${n0(NET.spine)} switches`, three ? `${half} down, ${half} up` : `${F.radix} × ${speed} down`)}
      ${edge((ys.spine + ys.leaf) / 2 + 4, `↕ ${n0(GPUS)} links`)}
      ${side(ys.leaf, `Leaf · ${n0(NET.leaf)} switches`, `${half} down, ${half} up`)}
      ${edge((ys.leaf + ys.rack) / 2 + 4, `↕ ${n0(GPUS)} links, 1 × ${speed} per GPU`)}
      ${side(ys.rack, `${n0(RACKS)} racks · ${n0(GPUS)} GPUs`, `${A.gpusPerRack} optical ports each`)}
      ${TXT(410, 388, three ? `Drawn: 8 racks in 2 pods.${NET.planes > 1 ? ` At this size the campus needs ${NET.planes} parallel fabrics.` : ' Every leaf reaches every spine in its pod; every spine reaches every core.'}` : 'Drawn: 8 racks. Small enough for two tiers: every leaf reaches every spine.', { size: 11.5, op: 0.6 })}
    </svg>`;
  }
  // 3. Scale across
  {
    const W = 1000, y = 90, d = NET.dci;
    const stops = [[60, 'Core', 'switches'], [180, 'DCI routers', `${n0(d.modulesPerEnd)} × 800ZR`], [300, 'Mux', `${d.lambdas} λ, C-band`], [390, 'Amp', 'EDFA']];
    const far = [[610, 'Amp', ''], [700, 'Mux', ''], [820, 'Routers', ''], [940, 'Remote', 'campus']];
    let out = '';
    const node = ([cx, t, s], hl) => `<rect x="${cx - 42}" y="${y - 20}" width="84" height="40" rx="5" fill="#161d29" stroke="${hl ? C('dci') : '#3a4658'}"/>` + TXT(cx, y - 2, t, { size: 12, w: 700 }) + (s ? TXT(cx, y + 13, s, { size: 10.5, op: 0.7, mono: true }) : '');
    out += `<line x1="102" y1="${y}" x2="138" y2="${y}" stroke="${C('eth')}" stroke-width="2"/><line x1="222" y1="${y}" x2="258" y2="${y}" stroke="${C('dci')}" stroke-width="2"/><line x1="342" y1="${y}" x2="348" y2="${y}" stroke="${C('dci')}" stroke-width="3"/>`;
    out += `<line x1="432" y1="${y}" x2="568" y2="${y}" stroke="${C('dci')}" stroke-width="3" stroke-dasharray="2 5"/>`;
    for (let k = 0; k < 5; k++) { const hx = 452 + k * 24; out += `<rect x="${hx - 6}" y="${y - 7}" width="12" height="14" rx="2" fill="#2a2f38" stroke="${C('dci')}"/>`; }
    out += `<line x1="652" y1="${y}" x2="658" y2="${y}" stroke="${C('dci')}" stroke-width="3"/><line x1="742" y1="${y}" x2="778" y2="${y}" stroke="${C('dci')}" stroke-width="2"/><line x1="862" y1="${y}" x2="898" y2="${y}" stroke="${C('eth')}" stroke-width="2"/>`;
    stops.forEach(s => out += node(s, s[1] === 'DCI routers'));
    far.forEach(s => out += node(s, false));
    out += TXT(500, y - 32, `${d.routeKm.toLocaleString('en-US')} km of fiber · ${d.huts} amplifier huts, one every ≈${d.spanKm} km`, { size: 12, w: 600, fill: C('dci') });
    out += TXT(500, y + 34, `≈${(d.routeKm * 0.0049).toFixed(1)} ms one way`, { size: 11.5, mono: true, op: 0.8 });
    const note = (x0, t, s) => TXT(x0, 170, t, { size: 12, w: 700 }) + TXT(x0, 188, s, { size: 11, op: 0.7, mono: true });
    out += note(180, 'Each wavelength', `${d.gbps}G, coherent`) + note(345, 'Each fiber pair', `${d.lambdas} × ${d.gbps}G = ${(d.lambdas * d.gbps / 1000).toFixed(1)} Tb/s`)
      + note(560, 'Each route', `${d.litPairs} lit pairs of a ${d.cableStrands}-strand cable`) + note(800, 'This campus', `${d.routes} routes · ≈${n0(d.tbpsPerRoute * d.routes)} Tb/s`);
    $('fig-across').innerHTML = `<svg viewBox="0 0 ${W} 210" role="img" aria-label="Scale across: routers with coherent optics, multiplexed onto fiber pairs, amplified every 80 km to the remote campus">${out}</svg>`;
  }
  // 4. The census
  const fl = F.fibersPerLink, d = NET.dci, hallGpus = GPUS / Math.max(1, M.halls);
  const dpus = nvl72 ? 36 : 8;
  const at = (scene, part) => ({ scene, mode: 'data', part });
  const cards = nvl72 ? [
    ['GPU package', 'nvl', [['NVLink links', '18'], ['Copper pairs out', '72'], ['CPU link', '1 × NVLink-C2C'], ['Scale-out port', `1 × ${speed}`], ['HBM stacks', `${A.hbm.stacks}`]], at(5, 'nvphy')],
    ['Compute tray', 'nvl', [['GPUs', '4'], ['NVLink links', '72'], ['Scale-out optical ports', '4'], ['BlueField-3 DPUs, 2 × 400G', '2'], ['Fibers out the front', `≈${n0(4 * fl + 2 * 8)}–${n0(4 * fl + 4 * 8)}`]], at(4, 'cx')],
    [`${A.rackName} rack`, 'nvl', [['NVLink links', '1,296'], ['Copper connections', '5,184'], ['NVLink cable cartridges', '4'], ['NVLink switch chips', '18'], ['Scale-out ports', '72'], ['BlueField-3 DPUs, 2 × 400G', `${dpus}`], ['Management switches', '2'], ['Fibers leaving the rack', `≈${n0(72 * fl + 36 * 8)}–${n0(72 * fl + 72 * 8)}`]], at(3, 'spine')],
  ] : [
    ['GPU package', 'nvl', [['NVLink links', '18'], ['NVLink domain', '8 GPUs, inside the server'], ['Scale-out port', `1 × ${speed}`], ['HBM stacks', `${A.hbm.stacks} active of 6`]], at(5, 'nvphy')],
    ['DGX H100 server', 'nvl', [['GPUs', '8'], ['NVSwitch chips', '4'], ['ConnectX-7 ports', '8 × 400G'], ['BlueField-3 DPUs', '2'], ['Fibers out', `≈${n0(8 * fl + 2 * 8)}`]], at(4, 'nvswitch')],
    ['Rack of 4 servers', 'nvl', [['GPUs', '32'], ['NVLink domains', '4 separate'], ['Scale-out ports', '32'], ['Fibers leaving the rack', `≈${n0(32 * fl + 8 * 8)}`]], at(3, 'uplinks')],
  ];
  cards.push(
    [`One data hall of ${M.halls}`, 'eth', [['Racks', `≈${n0(RACKS / M.halls)}`], ['GPU-to-leaf links', `≈${kilo(hallGpus)}`], ['Leaf + spine switches', `≈${n0((NET.leaf + NET.spine) / M.halls)}`], ['Optical modules', `≈${kilo(NET.modules / M.halls)}`], ['Fiber strands', `≈${kilo(NET.fibers / M.halls)}`], ['Patch housings, 576 fibers per 4U', `≈${n0(NET.fibers / M.halls / 576)}`]], at(2, 'leaf')],
    ['The campus fabric', 'eth', [['Fabric switches', n0(NET.switches)], ['Tiers', `${NET.tiers}${NET.planes > 1 ? ` · ${NET.planes} parallel fabrics` : ''}`], ['Optical links', kilo(NET.links)], ['Optical modules', `${kilo(NET.modules)} · ${(NET.modules / GPUS).toFixed(1)} per GPU`], ['Fiber strands', `≈${kilo(NET.fibers)}`], ['NVLink copper connections', `≈${kilo(NET.nvlinkPairs)}`], ['Network power outside the racks', `${(NET.switchMW + NET.opticsMW).toFixed(1)} MW`]], at(2, 'spine')],
    ['Campus to campus', 'dci', [['Diverse routes', `${d.routes}`], ['Lit fiber pairs per route', `${d.litPairs} of ${d.cableStrands / 2}`], ['Wavelengths per pair', `${d.lambdas} × ${d.gbps}G`], ['Coherent modules, each end', n0(d.modulesPerEnd)], ['Router line cards, 36 × 800G', `≈${Math.ceil(d.modulesPerEnd / d.portsPerLinecard)}`], ['Capacity', `≈${n0(d.tbpsPerRoute * d.routes)} Tb/s`], ['Amplifier huts per route', `${d.huts}`]], at(1, 'dci')],
  );
  $('census').innerHTML = cards.map(([t, cls, rows, link]) => `<div class="cz" style="--c:${C(cls)}"><h3 ${goAttr(link, t)}>${t}${link ? ' <span aria-hidden="true">↗</span>' : ''}</h3><dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div>`).join('');
}

// ---------- the media ladder, the copper wall, cutaway optics (static reference material) ----------
let mediaRendered = false;
function renderLinksMedia() {
  if (mediaRendered) return; // fixed reference figures: not scenario-dependent, render once
  mediaRendered = true;
  $('media-ladder').innerHTML = MEDIA_LADDER.map(r => `<div class="ml-row" style="--c:${C(r.cls)}">
    <h4>${r.name}</h4>
    <button type="button" class="chip ${r.basis}" data-src="links:${r.id}" aria-expanded="false" aria-label="${BASIS[r.basis].label}: sources">${BASIS[r.basis].short}</button>
    <p class="ml-scope">${r.scope}</p>
    <p class="ml-what">${r.what}</p>
    <div class="ml-facts">
      <div><dt>Reach</dt><dd>${r.reach}</dd></div>
      <div><dt>Power</dt><dd>${r.power}</dd></div>
      <div><dt>Where it sits here</dt><dd>${r.where}</dd></div>
    </div>
  </div>`).join('');
  $('fig-copperwall').innerHTML = copperWallSVG();
  $('cap-copperwall').innerHTML += ` <button type="button" class="chip typical" data-src="links:copperwall" aria-expanded="false" aria-label="Industry typical: sources">Typical</button>`;
  $('fig-optics-cutaway').innerHTML = opticsCutawaySVG();
  $('cap-optics-cutaway').innerHTML += ` <button type="button" class="chip spec" data-src="links:cutaway-dsp" aria-expanded="false" aria-label="Published spec: DSP module sources">Spec · DSP</button> <button type="button" class="chip spec" data-src="links:cutaway-lpo" aria-expanded="false" aria-label="Published spec: LPO sources">Spec · LPO</button> <button type="button" class="chip spec" data-src="links:cutaway-cpo" aria-expanded="false" aria-label="Published spec: CPO sources">Spec · CPO</button>`;
}

// ---------- temperatures ----------
function renderTemps() {
  const TEMPS = store.C.TEMPS;
  const svg = $('temps'), W = 1000, H = 340, L = 60, R = 24, T0 = 44, B = 96;
  const y = c => T0 + (100 - c) / 100 * (H - T0 - B);
  const n = TEMPS.length, cw = (W - L - R) / n;
  const tcol = c => c >= 70 ? '#ffc34a' : c >= 44 ? '#ff5a6e' : c >= 30 ? '#8b7bff' : '#3f8cff';
  let out = '';
  [0, 25, 50, 75, 100].forEach(c => {
    out += `<line x1="${L}" x2="${W - R}" y1="${y(c)}" y2="${y(c)}" stroke="#222b38"/>`;
    out += `<text x="${L - 10}" y="${y(c) + 4}" text-anchor="end" fill="#6b747c" font-family="IBM Plex Mono, monospace" font-size="12">${c} °C</text>`;
  });
  TEMPS.forEach((t, i) => {
    const x0 = L + i * cw, yy = y(t.c), c = tcol(t.c);
    const start = out.length;
    out += `<rect x="${x0 + 16}" y="${yy}" width="${cw - 32}" height="${H - B - yy}" rx="4" fill="${c}" fill-opacity="0.2" stroke="${c}" stroke-opacity="0.8"/>`;
    out += `<text x="${x0 + cw / 2}" y="${yy - 10}" text-anchor="middle" fill="${c}" font-family="IBM Plex Mono, monospace" font-weight="600" font-size="15">≈${t.c} °C</text>`;
    out += `<text x="${x0 + cw / 2}" y="${H - B + 24}" text-anchor="middle" fill="#f0f0fa" font-family="Manrope, sans-serif" font-weight="700" font-size="13.5">${t.label}</text>`;
    out += `<text x="${x0 + cw / 2}" y="${H - B + 44}" text-anchor="middle" fill="#aab2b9" font-family="Manrope, sans-serif" font-size="12">${t.note}</text>`;
    out = out.slice(0, start) + col(t.link, t.label, x0 + 8, yy - 30, cw - 16, H - yy + 30 - 40, out.slice(start));
    if (i < n - 1) { const d = t.c - TEMPS[i + 1].c; out += `<text x="${x0 + cw}" y="${(y(t.c) + y(TEMPS[i + 1].c)) / 2 + 4}" text-anchor="middle" fill="#6b747c" font-family="IBM Plex Mono, monospace" font-size="11.5">−${d}</text>`; }
  });
  out += `<text x="${L}" y="20" fill="#aab2b9" font-family="Manrope, sans-serif" font-size="12.5">Representative temperatures under load. The small numbers are the drop across each hop, the price of moving heat one step further.</text>`;
  svg.innerHTML = out;
}

// ---------- how a model is split ----------
function renderParallel() {
  const M = store.M, PARALLEL = store.C.PARALLEL;
  let html = `<div class="nest-core" style="--c:var(--hbm)"><b>One GPU</b><span>${M.accel.hbm.type} feeds the math at ${M.accel.hbm.tbs} TB/s. Serving a chat reply is mostly waiting on memory: each new token reads the weights and the conversation’s KV cache from HBM.</span></div>`;
  PARALLEL.forEach(p => {
    html = `<div class="nest" style="--c:${VOLT[p.cls].css}"><div class="nest-head"><b>${p.name}</b><span class="nest-where">${p.where}</span><span class="nest-need">${p.need}</span>${p.link ? `<button type="button" class="nest-go" ${goAttr(p.link, p.name)}>See it in 3D ↗</button>` : ''}</div><p>${p.what}</p>${html}</div>`;
  });
  $('parallel').innerHTML = html;
}

// ---------- inventory ----------
function renderBom() {
  const M = store.M, size = M.meterMW >= 1000 ? `${+(M.meterMW / 1000).toFixed(2)} GW` : `${Math.round(M.meterMW)} MW`;
  $('bom-h').textContent = `What it takes: a ${size} campus, counted`;
  $('bom-lede').textContent = `Sized from the same assumptions as the ledger: ${size} at the meter, PUE ${M.pue.toFixed(2)}, ${Math.round(M.rack.kw)} kW ${M.accel.rackName.replace(/ rack$/, "")} racks. Real campuses differ in redundancy and layout; the counts are here to give a sense of scale.`;
  $('bom').innerHTML = store.C.BOM.map((g, gi) => `<div class="bom-col"><h3>${g.group}</h3><dl>${g.rows.map(([k, v, b, link], ri) => `<div data-bom="${gi}-${ri}" ${goAttr(link, k)}><dt>${k}</dt><dd>${v} <button type="button" class="chip ${b}" data-src="bom:${gi}-${ri}" aria-expanded="false" aria-label="${BASIS[b].label}: sources">${BASIS[b].short}</button></dd></div>`).join('')}</dl></div>`).join('');
}

// ---------- cost per token ----------
const logSlider = (el, lo, hi) => ({ get: () => Math.pow(10, lo + (el.value / 1000) * (hi - lo)), set: v => (el.value = Math.round((Math.log10(v) - lo) / (hi - lo) * 1000)) });
// text: the value a screen reader should announce, displayed units and all - a log slider's raw position (2,000
// tok/s sits at 565) is meaningless read aloud, so every slider gets its aria-valuetext set here, not just its --pct
export function syncRange(el, text) {
  el.style.setProperty('--pct', `${(el.value - el.min) / (el.max - el.min) * 100}%`);
  if (text !== undefined) el.setAttribute('aria-valuetext', text);
}
const T = { tps: logSlider($('tps'), 2, Math.log10(20000)), train: logSlider($('train'), 0, Math.log10(300)), life: logSlider($('life'), 13, 17) };
const sig = (v, d = 2) => v >= 100 ? fmt(v) : v >= 10 ? v.toFixed(1) : v.toFixed(d);
const big = v => v >= 1e12 ? `${sig(v / 1e12)} T` : v >= 1e9 ? `${sig(v / 1e9)} B` : v >= 1e6 ? `${sig(v / 1e6)} M` : v >= 1e3 ? `${sig(v / 1e3)} k` : sig(v);
function renderTokens() {
  const M = store.M, f = tokenFigures(M);
  const tpsTxt = fmt(calc.tokPerGpu), utilTxt = `${Math.round(calc.util * 100)}%`, carbonTxt = `${fmt(calc.carbon)} g`;
  const trainTxt = `${sig(calc.trainGWh)} GWh`, lifeTxt = big(calc.lifeTokens);
  $('tps-v').textContent = tpsTxt;
  $('util-v').textContent = utilTxt; $('carbon-v').textContent = carbonTxt;
  $('train-v').textContent = trainTxt; $('life-v').textContent = lifeTxt;
  $('calc-from').innerHTML = `PUE <b>${M.pue.toFixed(2)}</b> · WUE <b>${M.wue.toFixed(2)} L/kWh IT</b> · <b>${n0(M.gpus)}</b> ${M.accel.short} GPUs, from the scenario above`;
  $('o-j').textContent = sig(f.j); $('o-kwh').textContent = big(3.6e6 / f.j);
  $('o-wh').textContent = sig(f.whReply, 3); $('o-co2').textContent = sig(f.co2Reply, 3);
  $('o-water').textContent = sig(f.waterReply, 3); $('o-train').textContent = `${sig(f.jTrain / f.j * 100, 1)}%`;
  document.querySelector('.train-ctl').classList.toggle('off', !calc.withTrain);
  // A benchmark preset names one accelerator; reusing its number on different hardware would be silently wrong,
  // so it only offers itself when the scenario above actually matches (issue 15).
  document.querySelectorAll('#presets button[data-accel]').forEach(b => {
    const matches = b.dataset.accel === M.accel.id;
    b.disabled = !matches;
    b.title = matches ? b.dataset.titleOn : `Benchmarked on ${b.dataset.accel.toUpperCase()}; pick that accelerator above to use this preset.`;
  });
  // the displayed value and its unit, not the log slider's raw position (WAI-ARIA slider pattern)
  syncRange($('tps'), `${tpsTxt} tok/s`); syncRange($('util'), utilTxt); syncRange($('carbon'), `${carbonTxt} CO₂/kWh`);
  syncRange($('train'), trainTxt); syncRange($('life'), `${lifeTxt} tokens`);
  emit('tokens');
}
T.tps.set(calc.tokPerGpu); T.train.set(calc.trainGWh); T.life.set(calc.lifeTokens);
$('tps').addEventListener('input', () => { calc.tokPerGpu = Math.round(T.tps.get()); calc.tpsTouched = true; calc.tpsAccel = null; renderTokens(); });
$('util').addEventListener('input', e => { calc.util = +e.target.value / 100; renderTokens(); });
$('carbon').addEventListener('input', e => { calc.carbon = +e.target.value; renderTokens(); });
$('train').addEventListener('input', () => { calc.trainGWh = T.train.get(); renderTokens(); });
$('life').addEventListener('input', () => { calc.lifeTokens = T.life.get(); renderTokens(); });
$('with-train').addEventListener('change', e => { calc.withTrain = e.target.checked; renderTokens(); });
document.querySelectorAll('#presets button').forEach(b => b.addEventListener('click', () => { calc.tokPerGpu = +b.dataset.tps; calc.tpsTouched = true; calc.tpsAccel = b.dataset.accel ?? null; T.tps.set(calc.tokPerGpu); renderTokens(); }));
document.querySelectorAll('#grid-presets button').forEach(b => b.addEventListener('click', () => setCarbon(+b.dataset.g)));
export function setCarbon(g) { calc.carbon = g; $('carbon').value = g; renderTokens(); }

// ---------- wiring ----------
function renderAll() {
  // A hardware-specific benchmark preset names one accelerator; switching to a different one can't go on quietly
  // reusing that number, so it falls back to the illustrative, memory-bandwidth-scaled default instead (issue 15).
  if (calc.tpsAccel && calc.tpsAccel !== store.M.accel.id) { calc.tpsTouched = false; calc.tpsAccel = null; }
  if (!calc.tpsTouched) { calc.tokPerGpu = store.M.tokPerGpuRef; T.tps.set(calc.tokPerGpu); }
  renderLedger(); renderStairs(); renderBandwidth(); renderLinks(); renderLinksMedia(); renderTemps(); renderParallel(); renderBom(); renderTokens();
}
on('scenario', renderAll);
on('pin', renderLedger);
on('scene', highlightLedger);
renderAll();
