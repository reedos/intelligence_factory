// The copper-and-optics story for 3.2 · Links: a media ladder (data, rendered as HTML by sections.js),
// a copper-wall chart and a set of cutaway module diagrams (both exported as SVG strings). Every figure
// here traces to research/copper-optics-sources.md; source ids are added under 'links:*' in sources.js.

const TXT = (x, y, s, { a = 'middle', size = 12, fill = 'currentColor', w = 500, mono = false, op = 1 } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${a}" font-family="${mono ? 'IBM Plex Mono, monospace' : 'Manrope, sans-serif'}" font-size="${size}" font-weight="${w}" fill="${fill}" fill-opacity="${op}">${s}</text>`;

// ---------- (a) the media ladder ----------
// Each row's basis chip opens 'links:<id>' in sources.js (PART_SOURCES). 'cls' picks the layer color:
// copper rungs use --nvl (matches the rest of the page's scale-up color), optics use --eth, coherent uses --dci.
export const MEDIA_LADDER = [
  { id: 'dac', cls: 'nvl', name: 'DAC — direct-attach copper', scope: 'scale-up, in the rack',
    what: 'A passive twinax cable: two copper conductors and a connector at each end, nothing active inside.',
    reach: '2–5 m at 25–100 Gb/s per lane (ratified clauses); under 1 m at 200 Gb/s per lane, per IEEE’s own draft objective — trade estimates spread 1–3 m',
    power: '0 W added — passive',
    where: 'NVLink spine inside a rack; GPU-to-switch links; tray and board backplanes',
    basis: 'typical' },
  { id: 'acc', cls: 'nvl', name: 'ACC — active copper cable', scope: 'NIC to leaf, one rack over',
    what: 'A linear redriver chip in each connector plug amplifies and cleans the signal; no clock-and-data recovery.',
    reach: '≈3 m at 200 Gb/s per lane, commonly reaching one adjacent rack; 3–5 m at 100 Gb/s per lane (NVIDIA LACC)',
    power: '≈2–3 W per end at 200 Gb/s per lane; 1.5 W max per end at 100 Gb/s per lane (NVIDIA LACC, 800G port)',
    where: 'Short multi-rack scale-up hops — “the rack next door”',
    basis: 'typical' },
  { id: 'aec', cls: 'nvl', name: 'AEC — active electrical cable', scope: 'NIC to leaf, switch to switch',
    what: 'A full DSP retimer chip at each end regenerates the signal instead of just amplifying it.',
    reach: 'Commonly ≈7 m, demonstrated to 9 m',
    power: '≈20 W per end at 200 Gb/s per lane',
    where: 'Server/NIC-to-leaf and switch-to-switch links; also cross-rack scale-up in practice (AWS Trainium2/3, reportedly xAI Colossus)',
    basis: 'typical' },
  { id: 'lpo', cls: 'eth', name: 'LPO — linear pluggable optics', scope: 'leaf to spine',
    what: 'The module keeps the laser and photodetectors but drops the DSP; the host chip’s own SerDes drives the line directly.',
    reach: '500 m standard; ≈2 km in a DR variant',
    power: '≈10 W target per 800G-class port at 200 Gb/s per lane, against 23–25 W for a fully retimed module at the same lane rate',
    where: 'Leaf-to-spine fabric links; early commercial deployment as of 2026',
    basis: 'spec' },
  { id: 'dsp', cls: 'eth', name: 'DSP pluggable optics', scope: 'leaf to spine, hall to hall',
    what: 'Today’s default: a full DSP retimer regenerates the signal at each end, alongside a laser and photodetectors.',
    reach: '500 m (DR8) to 2 km (FR4/FR8)',
    power: '12 W max (400G QSFP-DD); ≈15 W (800G 2×FR4); sub-13 W (800G) and sub-23 W (1.6T) on the newest 3 nm DSPs',
    where: 'Today’s default fabric backbone and campus-length links',
    basis: 'spec' },
  { id: 'cpo', cls: 'eth', name: 'CPO — co-packaged optics', scope: 'built into the switch, leaf and spine',
    what: 'The optical engines move onto the switch ASIC’s own package, removing the pluggable module and its connector.',
    reach: 'Same reach class as the pluggables it replaces; this is a switch-side packaging change, without its own separate reach spec',
    power: '≈5.5 W per 800G port (Broadcom Bailly, 2025); ≈3.5 W per 800G port (Broadcom Tomahawk 6 “Davisson,” newest)',
    where: 'Leaf and spine switch packages; NVIDIA Quantum-X/Spectrum-X Photonics, Broadcom Tomahawk 5/6',
    basis: 'spec' },
  { id: 'coherent', cls: 'dci', name: 'Coherent (400ZR/800ZR-class)', scope: 'campus to campus',
    what: 'Puts many wavelengths of light on one fiber pair and amplifies them optically for the run between buildings.',
    reach: '10 km (LR4) for campus-only links; 80–120 km amplified for longer routes',
    power: '≈15–20 W at 400ZR; ≈23–30 W at 800ZR',
    where: 'Scale-across: building-to-building and site-to-site links',
    basis: 'typical' },
];

// ---------- (b) the copper wall: passive reach vs. lane rate ----------
export const COPPER_WALL = [
  { lane: 25, lo: 3, hi: 5, basis: 'spec', note: '25GBASE-CR/CR-S, single lane (802.3by)' },
  { lane: 50, lo: 3, hi: 3, basis: 'spec', note: '100GBASE-CR2, 2 lanes (802.3cd)' },
  { lane: 100, lo: 2, hi: 2, alt: 5, basis: 'spec', note: '100GBASE-CR1 floor (802.3ck); Marvell’s own rounder public estimate: ≈5 m' },
  { lane: 200, lo: 0.7, hi: 3, floor: 1, basis: 'typical', note: 'draft P802.3dj — IEEE’s own objective is ≥1 m; trade estimates spread 1–3 m; Marvell’s own estimate: ≈2.5 m' },
  { lane: 400, lo: null, hi: null, basis: 'spec', note: 'not yet defined — IEEE’s own scope table lists this reach as TBD' },
];
export const OPTICS_CROSSOVER_M = 7; // upper end of the "on the margin" band a 200G-class signal hits (SemiEngineering)

export function copperWallSVG() {
  const W = 1000, H = 360, L = 90, R = 40, T = 34, B = 96;
  const lanes = COPPER_WALL.map(d => d.lane);
  const x = lane => L + (Math.log10(lane) - Math.log10(20)) / (Math.log10(500) - Math.log10(20)) * (W - L - R);
  const yMax = 10, yMin = 0.4;
  const y = m => T + (Math.log10(yMax) - Math.log10(Math.max(yMin, m))) / (Math.log10(yMax) - Math.log10(yMin)) * (H - T - B);
  let out = '';
  // gridlines
  [0.5, 1, 2, 5, 10].forEach(m => {
    out += `<line x1="${L}" x2="${W - R}" y1="${y(m)}" y2="${y(m)}" stroke="var(--line)" stroke-width="1"/>`;
    out += TXT(L - 12, y(m) + 4, `${m} m`, { a: 'end', size: 12, fill: 'var(--faint)', mono: true });
  });
  // crossover band
  const yc = y(OPTICS_CROSSOVER_M);
  out += `<rect x="${L}" y="${T}" width="${W - L - R}" height="${yc - T}" fill="var(--eth)" fill-opacity="0.05"/>`;
  out += `<line x1="${L}" x2="${W - R}" y1="${yc}" y2="${yc}" stroke="var(--eth)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  out += TXT(W - R, yc - 8, `optics take over above ≈${OPTICS_CROSSOVER_M} m, any lane rate`, { a: 'end', size: 11.5, fill: 'var(--eth)', mono: true });
  // bars per lane rate
  const bw = 64;
  COPPER_WALL.forEach(d => {
    const cx = x(d.lane);
    if (d.lo == null) {
      out += `<rect x="${cx - bw / 2}" y="${T}" width="${bw}" height="${H - T - B}" fill="var(--ink)" fill-opacity="0.04"/>`;
      out += `<line x1="${cx}" x2="${cx}" y1="${T}" y2="${H - B}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="2 4"/>`;
      out += `<rect x="${cx - 44}" y="${(T + H - B) / 2 - 20}" width="88" height="44" fill="var(--ground, #05070a)"/>`;
      out += TXT(cx, (T + H - B) / 2 - 6, 'not yet', { size: 13, w: 700, fill: 'var(--muted)' });
      out += TXT(cx, (T + H - B) / 2 + 12, 'defined', { size: 13, w: 700, fill: 'var(--muted)' });
    } else {
      const yLo = y(d.lo), yHi = y(d.hi);
      out += `<rect x="${cx - 10}" y="${yLo}" width="20" height="${Math.max(2, yHi - yLo)}" rx="3" fill="var(--nvl)" fill-opacity="0.85"/>`;
      if (d.floor != null && d.floor !== d.hi) out += `<line x1="${cx - 16}" x2="${cx + 16}" y1="${y(d.floor)}" y2="${y(d.floor)}" stroke="var(--nvl)" stroke-width="2"/>`;
      if (d.alt != null) {
        out += `<line x1="${cx - 16}" x2="${cx + 16}" y1="${y(d.alt)}" y2="${y(d.alt)}" stroke="var(--muted)" stroke-width="2" stroke-dasharray="3 3"/>`;
        out += TXT(cx + 22, y(d.alt) + 4, 'vendor est.', { a: 'start', size: 10.5, fill: 'var(--muted)', mono: true });
      }
      out += TXT(cx, yHi - 10, d.lo === d.hi ? `${d.hi} m` : `${d.lo}–${d.hi} m`, { size: 12.5, w: 700, fill: 'var(--nvl)', mono: true });
    }
    out += TXT(cx, H - B + 26, `${d.lane} Gb/s`, { size: 13.5, w: 700 });
    out += TXT(cx, H - B + 44, 'per lane', { size: 11, fill: 'var(--faint)', mono: true });
  });
  out += TXT(L, 18, 'Passive copper reach at each PAM4 lane rate, log scale on both axes. Bars are the spread where sources disagree; ticks mark a standard’s stated floor.', { a: 'start', size: 12, fill: 'var(--muted)' });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Passive copper reach falls as lane rate rises: 3 to 5 meters at 25 gigabits per second per lane, down to under a meter at 200 gigabits per second per lane, not yet standardized at 400 gigabits per second per lane">${out}</svg>`;
}

// ---------- (c) cutaway module diagrams: DSP pluggable, LPO, CPO ----------
// A pluggable module, left to right: host connector -> DSP/retimer -> driver+laser (modulator) -> photodiode+TIA
// -> fiber out. CPO removes the pluggable and the connector: the switch ASIC's SerDes feeds an on-package
// optical engine directly, fed in turn by a laser source moved off the package (a dashed link, not a solid one,
// marks that the laser sits somewhere else).
const BOX_W = 520, BOX_GAP = 60, BOX_L = 40;
function moduleCutaway(col, { title, sub, dsp, cpo, wattNote }) {
  const x0 = BOX_L + col * (BOX_W + BOX_GAP), w = BOX_W, cx = x0 + w / 2;
  const y0 = 56, bh = 170;
  const blocks = cpo
    ? [
        { key: 'asic', label: 'Switch ASIC\nSerDes' },
        { key: 'engine', label: 'Optical\nengine', hl: true, note: wattNote },
        { key: 'laser', label: 'External\nlaser source', dashedBox: true, dashedIn: true, note: 'off the package' },
      ]
    : [
        { key: 'host', label: 'Host\nconnector' },
        { key: 'dsp', label: 'DSP /\nretimer', strike: !dsp, note: dsp === 'chip' ? wattNote : null },
        { key: 'drv', label: 'Driver' },
        { key: 'mod', label: 'Modulator\n+ CW laser', hl: true },
        { key: 'pd', label: 'Photodiode\n+ TIA' },
      ];
  const n = blocks.length, bw = (w - 24) / n - 8;
  let out = `<rect x="${x0}" y="${y0}" width="${w}" height="${bh}" rx="6" fill="var(--surface)" stroke="var(--line-2)" stroke-width="1.5"/>`;
  out += TXT(cx, y0 - 34, title, { size: 16, w: 700 });
  out += TXT(cx, y0 - 16, sub, { size: 11, fill: 'var(--muted)', mono: true });
  let px = x0 + 12;
  const midY = y0 + 70;
  blocks.forEach((b, i) => {
    const bx = px, by = midY - 35, bcx = bx + bw / 2;
    const fill = b.hl ? 'var(--eth)' : 'var(--ink)';
    const op = b.strike ? 0.08 : b.hl ? 0.16 : 0.06;
    out += `<rect x="${bx}" y="${by}" width="${bw}" height="70" rx="4" fill="${fill}" fill-opacity="${op}" stroke="${b.hl ? 'var(--eth)' : 'var(--line-2)'}" stroke-opacity="${b.strike ? 0.35 : 0.9}" stroke-dasharray="${b.dashedBox ? '4 3' : '0'}"/>`;
    const lines = b.label.split('\n');
    const ly0 = by + 35 - (lines.length - 1) * 8;
    lines.forEach((ln, li) => out += TXT(bcx, ly0 + li * 16, ln, { size: 11.5, w: 600, fill: b.strike ? 'var(--muted)' : 'var(--ink)', op: b.strike ? 0.55 : 1 }));
    if (b.strike) out += `<line x1="${bx + 4}" x2="${bx + bw - 4}" y1="${by + 8}" y2="${by + 62}" stroke="var(--muted)" stroke-width="2"/>`;
    if (b.note) out += TXT(bcx, by + 86, b.note, { size: 10, fill: 'var(--eth)', mono: true });
    if (i < n - 1) out += `<line x1="${bx + bw}" x2="${bx + bw + 8}" y1="${midY}" y2="${midY}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="${blocks[i + 1].dashedIn ? '3 3' : '0'}"/>`;
    px += bw + 8;
  });
  // fiber stub out the right edge (skipped for CPO: the last block is the external laser feed, not a fiber exit)
  if (!cpo) {
    out += `<line x1="${x0 + w}" x2="${x0 + w + 18}" y1="${midY}" y2="${midY}" stroke="var(--fiber)" stroke-width="3"/>`;
    out += `<circle cx="${x0 + w + 20}" cy="${midY}" r="3.5" fill="var(--fiber)"/>`;
  }
  return out;
}

export function opticsCutawaySVG() {
  const W = BOX_L + 3 * BOX_W + 2 * BOX_GAP + BOX_L, H = 300;
  let out = '';
  out += moduleCutaway(0, { title: 'DSP pluggable (today’s default)', sub: '≈15 W (800G 2×FR4) · sub-23 W (1.6T, newest DSP)', dsp: 'chip', cpo: false, wattNote: '≈12–14 W, DSP chip alone' });
  out += moduleCutaway(1, { title: 'LPO — no DSP', sub: '≈10 W target per 800G port — host SerDes drives the line', dsp: false, cpo: false, wattNote: null });
  out += moduleCutaway(2, { title: 'CPO — built into the switch', sub: '≈3.5–5.5 W per 800G port — optics only, no pluggable', dsp: false, cpo: true, wattNote: '≈3.5–5.5 W / 800G port' });
  out += TXT(W / 2, H - 14, 'Same three jobs — connector, retimer, optics — with each approach removing one: LPO drops the DSP, CPO drops the pluggable and its connector, and moves the laser off the package.', { size: 12.5, fill: 'var(--muted)' });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cutaway diagrams of an 800G DSP pluggable optical module, a linear pluggable optics (LPO) module with the DSP removed, and co-packaged optics (CPO) with the optical engines built into the switch package and the laser moved to an external source">${out}</svg>`;
}
