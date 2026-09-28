// The copper-and-optics story for 3.2 · Links: a media ladder (data, rendered as HTML by sections.js),
// a copper-wall chart and a set of cutaway module diagrams (both exported as SVG strings). Every figure
// here traces to research/copper-optics-sources.md; source ids are added under 'links:*' in sources.js.

const TXT = (x, y, s, { a = 'middle', size = 12, fill = 'currentColor', w = 500, mono = false, op = 1 } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${a}" font-family="${mono ? 'IBM Plex Mono, monospace' : 'Manrope, sans-serif'}" font-size="${size}" font-weight="${w}" fill="${fill}" fill-opacity="${op}">${s}</text>`;

// ---------- (a) the media ladder ----------
// Each row's basis chip opens 'links:<id>' in sources.js (PART_SOURCES). 'cls' picks the layer color:
// copper rungs use --nvl (matches the rest of the page's scale-up color), direct-detect optics use --eth,
// coherent (which really is a separate scale-across function, not just "optics but longer") uses --dci.
export const MEDIA_LADDER = [
  { id: 'dac', cls: 'nvl', name: 'DAC — direct-attach copper', scope: 'scale-up, in the rack',
    what: 'A passive twinax cable: two copper conductors and a connector at each end, nothing active inside.',
    // IEEE's own P802.3dj objective is a floor ("reach of up to at least 1.0 m"), not a ceiling — keep this
    // consistent with the copper-wall chart's own note on the same 200 Gb/s/lane row, below.
    reach: '2–5 m at 25–100 Gb/s per lane (ratified clauses); at 200 Gb/s per lane, IEEE’s own P802.3dj objective is a floor of at least 1 m — trade estimates for what a design actually achieves spread from under 1 m to about 3 m',
    power: '0 W added — passive',
    where: 'NVLink spine inside a rack; GPU-to-switch links; tray and board backplanes',
    basis: 'reported',
    ev: { refs: [
      ['ieee-25gbe-wiki', '"25GBASE-CR (Direct Attach): 5 meters maximum reach... 25GBASE-CR-S: 3 meters"'],
      ['ieee-100gbe-wiki', '100GBASE-CR2 (2 lanes, 100G port) PHY row: 3 meters, 802.3cd-2018'],
      ['ieee-8023dj-electrical-adhoc', 'objectives table: "Reach of up to at least 1.0 meter," stated for 200/400/800/1600 Gb/s passive twin-ax alike'],
      ['ethernet-alliance-400g-lane', 'the project’s own scope table lists 400 Gb/s-per-lane copper cable reach as not yet defined'],
    ] } },
  { id: 'acc', cls: 'nvl', name: 'ACC — active copper cable', scope: 'Scale-up, one rack over',
    what: 'A linear redriver chip in each connector plug amplifies and cleans the signal; no clock-and-data recovery.',
    reach: '≈3 m at 200 Gb/s per lane, commonly reaching one adjacent rack; 3–5 m at 100 Gb/s per lane (NVIDIA LACC)',
    power: '≈2–3 W per end at 200 Gb/s per lane; 1.5 W max per end at 100 Gb/s per lane (NVIDIA LACC, 800G port)',
    where: 'Short multi-rack scale-up hops — “the rack next door”',
    basis: 'reported',
    ev: { refs: [
      ['nvidia-copper-dac-lacc-overview', 'defines LACC as a linear redriver/equalizer in each connector plug — amplifies and cleans the signal, no clock-and-data recovery'],
      ['nvidia-mca4j80n-datasheet', 'MCA4J80-Nxxx datasheet: 3/4/5 m reach by wire gauge, 1.5 W max per end, at 100 Gb/s per lane on an 800G port'],
      ['viksnewsletter-acc-power', '"pushes copper out to 3 meters at 200G/lane for just a couple of watts per end"'],
    ] } },
  { id: 'aec', cls: 'nvl', name: 'AEC — active electrical cable', scope: 'NIC to leaf, switch to switch',
    what: 'A full DSP retimer chip at each end regenerates the signal instead of just amplifying it. Credo’s HiWire cables and Astera Labs’ Taurus modules carry their own; Marvell’s Alaska A DSP goes into other makers’ cables.',
    reach: 'Commonly ≈7 m, demonstrated to 9 m',
    power: '≈20 W per end at 200 Gb/s per lane',
    where: 'Server/NIC-to-leaf and switch-to-switch links; also cross-rack scale-up in practice (AWS Trainium2/3, reportedly xAI Colossus)',
    basis: 'reported',
    ev: { refs: [
      ['nvidia-linkx-interconnect', '"AECs use digital signal processors (DSPs) at each end to restore and retime signals"'],
      ['credo-zeroflap-aec', 'product page: a 7 m 800G AEC, built on ahead of the 9 m part below'],
      ['infraeo-9m-aec-release', '9 m 800G OSFP AEC, pre-FEC BER < 1E-8, built on Credo’s prior 7 m 800G AEC product'],
      ['viksnewsletter-acc-power', '"[AEC] burns around 20 watts per end"'],
      ['marvell-aec-prnewswire', 'Marvell’s own framing: AEC DSPs for server/NIC-to-ToR and switch-to-switch links'],
    ] } },
  { id: 'lpo', cls: 'eth', name: 'LPO — linear pluggable optics', scope: 'leaf to spine',
    what: 'The module keeps the laser and photodetectors but drops the DSP; the host chip’s own SerDes drives and reads the line directly, doing the equalization the DSP used to.',
    reach: '500 m standard; ≈2 km in a DR variant',
    // Semtech states its own ≈10 W LPO target and ≈23–25 W fully-retimed baseline together, both at
    // 200 Gb/s/lane signaling — but Semtech ties that 23–25 W figure specifically to a complete 1.6T DR8
    // module elsewhere in the same piece, and never states the port capacity behind its 10 W LPO number.
    // So this is a same-generation, same-lane-rate comparison, not a confirmed same-capacity one — don't
    // paper over that by mechanically relabeling the LPO figure "1.6T" either.
    power: '≈10 W target per port at 200 Gb/s per lane (Semtech; the exact port capacity isn’t stated) — Semtech’s own retimed baseline at that lane rate is a complete 1.6T DR8 module at 23–25 W, not an 800G one',
    where: 'Leaf-to-spine fabric links; early commercial deployment as of 2026',
    basis: 'spec',
    ev: { refs: [
      ['semtech-200g-lpo-power-blog', '"200G LPO Power, Reach and Loss": Semtech’s own 200 Gb/s-per-lane ladder (retimed ≈23–25 W, LPO ≈10 W target), the 23–25 W figure tied elsewhere in the same piece to a complete 1.6T DR8 module'],
      ['lpo-msa-lightwave', 'LPO MSA’s 100 Gbps/lane spec completed March 31, 2025, a 200 Gbps/lane follow-on in development'],
    ] } },
  { id: 'dsp', cls: 'eth', name: 'DSP pluggable optics', scope: 'leaf to spine, hall to hall',
    what: 'Today’s default: a full DSP retimer regenerates the signal at each end, alongside a laser and photodetectors. The DSP comes from chipmakers such as Marvell (Ara), Broadcom (Sian) and Credo (Bluebird).',
    reach: '500 m (DR8) to 2 km (FR4/FR8)',
    power: '12 W max (400G QSFP-DD, today’s 100 Gb/s/lane generation); ≈15 W (800G 2×FR4, same generation); on the newest 3 nm, 200 Gb/s/lane DSPs: sub-13 W (800G) and sub-23 W (1.6T) — a different chip generation, not a lower price for the same part',
    where: 'Today’s default fabric backbone and campus-length links',
    basis: 'spec',
    ev: { refs: [
      ['cisco-400g-qsfpdd-datasheet', 'datasheet: 400G QSFP-DD (DR4/FR4), 12 W max'],
      ['semianalysis-cpo-newsletter', 'newsletter figure: 800G 2×FR4 ≈ 15 W'],
      ['broadcom-sian3-200g-lane-dsp', 'Broadcom’s own DSP spec: "sub-13 W" (800G modules) / "sub-23 W" (1.6T modules) on its newest 200 Gb/s-per-lane DSP'],
      ['marvell-ara-1-6t-prnewswire', 'Marvell’s own release: >20% lower 1.6T module power on its 3 nm, 200 Gbps/lane Ara platform vs. its prior Nova 2 generation'],
    ] } },
  { id: 'lr4', cls: 'eth', name: 'LR4 — direct-detect campus optics', scope: 'building to building, still direct detect',
    what: 'The same DSP-retimed, on/off (direct-detect) family as the leaf-spine backbone above, just tuned for reach instead of density: four CWDM wavelengths on one fiber pair. Not a coherent receiver, and not multiplexed with anything else on that fiber.',
    reach: '10 km, single-mode — sized to absorb a campus’s routing and conduit slack, no optical amplification needed',
    power: 'Same DSP-pluggable class as the backbone above (roughly 12–15 W in today’s generation) — a longer-reach optic, not a separate power class',
    where: 'Building-to-building campus links short enough that neither amplification nor coherent detection is needed',
    basis: 'reported',
    ev: { refs: [
      ['cisco-400g-qsfpdd-datasheet', 'the same datasheet’s LR4 variant sits alongside DR4/FR4 in the DSP-pluggable family cited for the rung above'],
      ['lcom-lr4-10km', '10 km, single-mode LR4 reach, sized to absorb a campus’s routing and conduit slack'],
    ] } },
  { id: 'coherent', cls: 'dci', name: 'Coherent (400ZR/800ZR-class)', scope: 'campus to campus',
    what: 'A coherent transceiver — a pluggable like Marvell’s COLORZ 800 or Ciena’s WaveLogic 6 Nano, or a transponder in a line-terminal shelf — encodes each wavelength in amplitude, phase and polarization together, carrying far more bits per symbol than direct-detect optics. A separate mux/demux combines many such wavelengths onto one fiber pair; separate optical amplifiers, not the transceiver, extend the run. None of that is what LR4 above does, and coherent detection isn’t what makes multiplexing possible — direct-detect wavelengths can be muxed too.',
    reach: '≈40 km unamplified at 400ZR’s standard 11 dB loss budget, extending toward ≈75 km in longer-reach variants (both per OIF); 80–120 km per amplified span for longer routes — repeating amplifiers every ≈80 km extends reach, but noise accumulates with every span, so it is not unlimited',
    // interconnect-sources.md:68 splits 800ZR (≈23-25 W) from the longer-reach 800ZR+ variant (≈26-30 W);
    // blending them into one "23-30 W at 800ZR" figure would misstate plain 800ZR's own power draw
    power: '≈15–20 W at 400ZR; ≈23–25 W at 800ZR (≈26–30 W in longer-reach 800ZR+ variants)',
    where: 'Scale-across: building-to-building and site-to-site links',
    basis: 'reported',
    ev: { refs: [
      ['edgeoptic-400g-coherent-guide', '"≈40 km unamplified" / "≈120 km amplified" for 400ZR, and 50–75 km unamplified for the longer-reach MZR-class variant'],
      ['ascentoptics-coherent-power', '"400ZR (Standard)... Typical Power 18 to 20 W... Maximum Power 22 W"; 800ZR "typically... 23 to 25 watts"; 800ZR+ "approximately 20–30W" with real modules rated to 30 W max'],
    ] } },
  { id: 'cpo', cls: 'eth', name: 'CPO — co-packaged optics', scope: 'built into the switch, leaf and spine',
    what: 'The optical engines move onto or next to the switch ASIC’s own package, shortening the electrical channel and removing the pluggable module and its connector — it does not by itself mean fewer traffic fibers.',
    reach: 'Same reach class as the pluggables it replaces; this is a switch-side packaging change, without its own separate reach spec',
    power: '≈5.5 W per 800G port, optics plus external laser (Broadcom Bailly, 2025); ≈3.5 W per 800G port (Broadcom Tomahawk 6 “Davisson,” newest) — both exclude the switch ASIC’s own host-side SerDes power',
    where: 'Leaf and spine switch packages; NVIDIA Quantum-X/Spectrum-X Photonics, Broadcom Tomahawk 5/6',
    basis: 'spec',
    ev: { refs: [
      ['nextplatform-broadcom-cpo', '≈ 5.5 W optical-engine-plus-laser power per 800G port on Broadcom Bailly (Tomahawk 5 CPO), a 14.1% cut vs. the prior Tomahawk-4 generation'],
      ['broadcom-davisson-cpo', 'Broadcom’s own release: Tomahawk 6 "Davisson," 102.4 Tbps, optics at ≈ 3.5 W per 800G port'],
      ['broadcom-davisson-servethehome', 'independent write-up of the same Davisson launch, corroborating the 3.5 W/port figure'],
    ] } },
];

// ---------- (b) the copper wall: passive reach vs. lane rate ----------
export const COPPER_WALL = [
  { lane: 25, lo: 3, hi: 5, basis: 'spec', note: '25GBASE-CR/CR-S, single lane (802.3by)' },
  { lane: 50, lo: 3, hi: 3, basis: 'spec', note: '100GBASE-CR2, 2 lanes (802.3cd)' },
  { lane: 100, lo: 2, hi: 2, alt: 5, basis: 'spec', note: '100GBASE-CR1 floor (802.3ck); Marvell’s own rounder public estimate: ≈5 m' },
  { lane: 200, lo: 0.7, hi: 3, floor: 1, alt: 2.5, basis: 'typical', note: 'draft P802.3dj — IEEE’s own objective is ≥1 m; trade estimates spread 1–3 m' },
  { lane: 400, lo: null, hi: null, basis: 'spec', note: 'not yet defined — IEEE’s own scope table lists this reach as TBD' },
];
// The claims the two figures make as a whole, each with its own basis chip under the figure. (The rungs above carry
// their own.) Evidence is added per claim, as everywhere (src/evidence.js).
export const FIGURE_CLAIMS = {
  copperwall: { label: 'Where copper runs out, by lane rate', basis: 'derived', ev: { calc: 'copper-wall-chart', refs: [
    ['ieee-25gbe-wiki', '25GBASE-CR/CR-S reach, the chart’s 25 Gb/s/lane bar'],
    ['ieee-100gbe-wiki', '100GBASE-CR2/CR1 reach, the chart’s 50 and 100 Gb/s/lane bars'],
    ['ieee-8023dj-electrical-adhoc', 'the draft P802.3dj objective (≥ 1 m), the chart’s 200 Gb/s/lane bar and its floor tick'],
    ['ethernet-alliance-400g-lane', 'the project’s own scope table lists 400 Gb/s/lane copper reach as not yet defined, the chart’s "not yet defined" bar'],
  ] } },
  'cutaway-dsp': { short: 'DSP', label: 'Inside a DSP pluggable module', basis: 'spec', ev: { refs: [
    ['cisco-400g-qsfpdd-datasheet', 'a full DSP retimer regenerates the signal at each end of a QSFP-DD/OSFP module, alongside a laser and photodetectors'],
    ['broadcom-sian3-200g-lane-dsp', 'Broadcom’s own description of its Sian3 DSP’s place inside a retimed pluggable module'],
  ] } },
  'cutaway-lpo': { short: 'LPO', label: 'Inside a linear pluggable module', basis: 'spec', ev: { refs: [
    ['semtech-200g-lpo-power-blog', 'the module keeps the laser and photodetectors but drops the DSP; the host chip’s own SerDes drives and reads the line directly'],
    ['lpo-msa-lightwave', 'the LPO MSA’s own scope: a linear pluggable module specification with no retiming DSP'],
  ] } },
  'cutaway-cpo': { short: 'CPO', label: 'Co-packaged optics', basis: 'spec', ev: { refs: [
    ['nvidia-spectrum-x-cpo', 'NVIDIA’s own description: optical engines co-packaged with the switch ASIC, fed by external laser source (ELS) modules as a separate side feed'],
    ['broadcom-davisson-cpo', 'Broadcom’s own description of Tomahawk 6 "Davisson": optical engines built onto the switch package with field-replaceable laser modules'],
  ] } },
};

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
      // yLo is the pixel row for the LOW reach and yHi for the HIGH reach, but the y-scale is inverted
      // (bigger reach => smaller pixel y), so yHi is always the smaller number when lo < hi. Anchor the
      // rect at whichever pixel is smaller and size it by the absolute gap, or a lo===hi row draws a sliver.
      const barTop = Math.min(yLo, yHi), barH = Math.max(2, Math.abs(yLo - yHi));
      out += `<rect x="${cx - 10}" y="${barTop}" width="20" height="${barH}" rx="3" fill="var(--nvl)" fill-opacity="0.85"/>`;
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
  // two lines: the single-line version overflowed this 1000-wide viewBox and got clipped by the SVG's own bounds
  out += TXT(L, 14, 'Passive copper reach at each PAM4 lane rate, log scale on both axes.', { a: 'start', size: 12, fill: 'var(--muted)' });
  out += TXT(L, 29, 'A bar spans a range — a variant’s own spread, or where sources disagree; ticks mark a stated floor or a vendor estimate.', { a: 'start', size: 12, fill: 'var(--muted)' });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Passive copper reach falls as lane rate rises: 3 to 5 meters at 25 gigabits per second per lane, down to under a meter at 200 gigabits per second per lane, not yet standardized at 400 gigabits per second per lane">${out}</svg>`;
}

// ---------- (c) cutaway module diagrams: DSP pluggable, LPO, CPO ----------
// Three separate SVGs (one per module), each self-contained, so a narrow viewport can stack them instead of
// forcing one wide row (that was audit item 19 — see styles.css). Each pluggable module (DSP, LPO) is drawn as
// two directed lanes sharing one package boundary: TX runs host -> [DSP] -> driver -> modulator+laser -> fiber
// out; RX runs fiber in -> photodiode+TIA -> [DSP] -> host. Electrical segments are muted-colored, optical
// segments (from the modulator, or into the photodiode) are fiber-colored, so the medium changes with the
// color, not just the block label. CPO has no discrete module: the ASIC's SerDes and the optical engine share
// one package (dashed, since "co-packaged" means on/next to the ASIC, not always one sealed enclosure), traffic
// fibers leave the engine directly, and the external laser source (ELS) feeds it as a separate, clearly dashed
// side branch — never inline with the traffic fibers, so it can't be mistaken for their destination.
const BW = 108, BH = 58, GAP = 16, ROW_GAP = 78, PAD_L = 96, PAD_R = 54;
const TITLE_Y = 24, SUB_Y = 44, ROW1_Y = 116; // title, subtitle and first row all stack top-down, no side-by-side text to collide

function arrowDefs(id) {
  // one marker per direction/color combination this module's rows use; SVGs are independent documents so each
  // needs its own <defs>, but the ids are stable strings, cheap to repeat.
  return `<defs>
    <marker id="${id}-ae" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="var(--muted)"/></marker>
    <marker id="${id}-ao" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="var(--fiber)"/></marker>
  </defs>`;
}

// a single labeled block; 'hl' marks the optical-conversion block (modulator or photodiode). A block a
// variant removes (LPO's DSP) is simply left out of that row's block list, not drawn struck-through in
// place — the row is shorter than the DSP row, and the title/subtitle/caption already say what's missing.
function block(x, y, label, { hl = false } = {}) {
  const fill = hl ? 'var(--eth)' : 'var(--ink)';
  const op = hl ? 0.16 : 0.07;
  let out = `<rect x="${x}" y="${y}" width="${BW}" height="${BH}" rx="4" fill="${fill}" fill-opacity="${op}" stroke="${hl ? 'var(--eth)' : 'var(--line-2)'}" stroke-opacity="0.9"/>`;
  const lines = label.split('\n'), cx = x + BW / 2, ly0 = y + BH / 2 - (lines.length - 1) * 8 + 4;
  lines.forEach((ln, i) => out += TXT(cx, ly0 + i * 16, ln, { size: 11.5, w: 600 }));
  return out;
}

// a connecting arrow between two block edges (or a stub to/from the faceplate); 'rev' points it right-to-left
function wire(markerId, x1, x2, y, { optical = false, rev = false } = {}) {
  const [xa, xb] = rev ? [x2, x1] : [x1, x2];
  const marker = optical ? `${markerId}-ao` : `${markerId}-ae`;
  const color = optical ? 'var(--fiber)' : 'var(--muted)';
  return `<line x1="${xa}" x2="${xb}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="2" marker-end="url(#${marker})"/>`;
}

// one directed lane (TX or RX): a row of blocks plus a stub at each end, spanning from x0 to x0+rowW regardless
// of how many blocks it holds, so the TX and RX rows of one module still meet the same host and faceplate
// edges. Every inter-block wire inside the module is electrical; only the two end stubs cross the electrical/
// optical boundary — into the fiber stub always, out of the host stub never (that boundary sits at the
// modulator or the photodiode, which is always this row's last or first block, never in between).
function lane(markerId, x0, rowW, y, blocks, { rev = false } = {}) {
  const n = blocks.length, gap = n > 1 ? (rowW - n * BW) / (n - 1) : 0;
  let out = '', xs = [];
  for (let i = 0; i < n; i++) { xs.push(x0 + i * (BW + gap)); out += block(xs[i], y - BH / 2, blocks[i].label, blocks[i]); }
  for (let i = 0; i < n - 1; i++) out += wire(markerId, xs[i] + BW, xs[i + 1], y, { rev, optical: false });
  // stubs: the host-board edge (electrical, always) and the faceplate fiber (optical, always)
  const hostX = x0 - 14, fiberX = x0 + rowW + 14;
  out += wire(markerId, hostX, xs[0], y, { rev, optical: false });
  out += wire(markerId, xs[n - 1] + BW, fiberX, y, { rev, optical: true });
  return out;
}

function pluggableSVG(kind) {
  // kind: 'dsp' (today's default, fully retimed) or 'lpo' (linear, no DSP)
  const hasDSP = kind === 'dsp';
  const txBlocks = hasDSP
    ? [{ label: 'Host\nconnector' }, { label: 'DSP\n(TX)' }, { label: 'Driver' }, { label: 'Modulator\n+ CW laser', hl: true }]
    : [{ label: 'Host\nconnector' }, { label: 'Driver' }, { label: 'Modulator\n+ CW laser', hl: true }];
  const rxBlocks = hasDSP
    ? [{ label: 'Host\nconnector' }, { label: 'DSP\n(RX)' }, { label: 'Photodiode\n+ TIA', hl: true }]
    : [{ label: 'Host\nconnector' }, { label: 'Photodiode\n+ TIA', hl: true }];
  const rowW = txBlocks.length * BW + (txBlocks.length - 1) * GAP;
  const W = PAD_L + rowW + PAD_R;
  const x0 = PAD_L, yTX = ROW1_Y, yRX = yTX + ROW_GAP;
  const boxTop = yTX - BH / 2 - 30, boxBottom = yRX + BH / 2 + 26, capY = boxBottom + 26;
  const H = capY + 14;
  const id = `oc-${kind}`;
  let out = arrowDefs(id);
  // module package boundary — both rows and both edge connectors are one physical device
  out += `<rect x="${x0 - 30}" y="${boxTop}" width="${rowW + 60}" height="${boxBottom - boxTop}" rx="6" fill="var(--surface)" stroke="var(--line-2)" stroke-width="1.5"/>`;
  out += TXT(x0 - 30 + rowW + 60 - 10, boxBottom - 10, 'module package boundary', { a: 'end', size: 10, fill: 'var(--faint)', mono: true });
  out += TXT(x0 - 14, yTX - BH / 2 - 10, 'TX', { a: 'start', size: 11, w: 700, fill: 'var(--fiber)', mono: true });
  out += lane(id, x0, rowW, yTX, txBlocks, { rev: false });
  out += TXT(x0 - 14, yRX - BH / 2 - 10, 'RX', { a: 'start', size: 11, w: 700, fill: 'var(--fiber)', mono: true });
  out += lane(id, x0, rowW, yRX, rxBlocks, { rev: true });
  out += TXT(x0 - 30, TITLE_Y, hasDSP ? 'DSP pluggable (today’s default)' : 'LPO — no DSP', { a: 'start', size: 16, w: 700 });
  out += TXT(x0 - 30, SUB_Y, hasDSP ? '≈15 W typical, complete 800G 2×FR4 module' : '≈10 W target, 200 Gb/s/lane (Semtech), capacity unstated', { a: 'start', size: 11.5, fill: 'var(--muted)', mono: true });
  out += TXT(W / 2, capY, hasDSP
    ? 'Electrical (muted) in, optical (gold) out — same path in reverse on RX.'
    : 'No DSP: the host’s SerDes drives and reads the line directly.',
    { size: 11, fill: 'var(--muted)' });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${hasDSP ? 'A DSP-retimed pluggable module' : 'A linear pluggable optics (LPO) module'}: separate transmit and receive lanes, host connector to fiber, electrical and optical segments in different colors">${out}</svg>`;
}

function cpoSVG() {
  const asicW = BW + 20, engineW = BW + 26, gap = 64, tail = 172; // tail: room for the "TX/RX traffic fiber" labels past the engine
  const x0 = PAD_L, xAsic = x0, xEngine = xAsic + asicW + gap;
  const W = PAD_L + asicW + gap + engineW + tail;
  const yMid = 150, bh = BH + 10;
  const boxTop = yMid - bh / 2 - 30, boxRight = xEngine + engineW + 26, boxBottom = boxTop + bh + 60;
  // elsY sits far enough below the ASIC/engine row that the "CW light in" annotation (which lives in the gap
  // between them) doesn't crowd the "switch package boundary" label above it — the two used to land on almost
  // the same row and read as one run-on line
  const elsY = yMid + bh / 2 + 94, elsW = 168, elsX = xEngine + engineW / 2 - elsW / 2;
  const capY = elsY + 24 + 26;
  const H = capY + 14;
  const id = 'oc-cpo';
  let out = arrowDefs(id);
  // switch package boundary — dashed: CPO means the optical engine sits on or immediately next to the ASIC
  // package, not necessarily inside one sealed enclosure, so the boundary itself is drawn less certain
  out += `<rect x="${xAsic - 26}" y="${boxTop}" width="${boxRight - (xAsic - 26)}" height="${boxBottom - boxTop}" rx="6" fill="var(--surface)" stroke="var(--line-2)" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  out += TXT(xAsic - 16, boxBottom - 10, 'switch package (on/adjacent to the ASIC)', { a: 'start', size: 10, fill: 'var(--faint)', mono: true });
  out += `<rect x="${xAsic}" y="${yMid - bh / 2}" width="${asicW}" height="${bh}" rx="4" fill="var(--ink)" fill-opacity="0.07" stroke="var(--line-2)"/>`;
  out += TXT(xAsic + asicW / 2, yMid - 3, 'Switch ASIC', { size: 12, w: 600 });
  out += TXT(xAsic + asicW / 2, yMid + 13, 'SerDes', { size: 12, w: 600 });
  out += `<rect x="${xEngine}" y="${yMid - bh / 2}" width="${engineW}" height="${bh}" rx="4" fill="var(--eth)" fill-opacity="0.16" stroke="var(--eth)"/>`;
  out += TXT(xEngine + engineW / 2, yMid - 3, 'Optical', { size: 12, w: 600 });
  out += TXT(xEngine + engineW / 2, yMid + 13, 'engine', { size: 12, w: 600 });
  // ASIC <-> engine: short, on-package, electrical both ways
  out += `<line x1="${xAsic + asicW}" x2="${xEngine}" y1="${yMid}" y2="${yMid}" stroke="var(--muted)" stroke-width="2" marker-end="url(#${id}-ae)" marker-start="url(#${id}-ae)"/>`;
  // traffic fibers: TX out (upper) leaves the engine; RX in (lower) arrives at the engine — both cross the
  // package boundary and exit to the network, never touching the laser feed below
  const txY = yMid - 20, rxY = yMid + 20, fiberX = xEngine + engineW + 60;
  out += wire(id, xEngine + engineW, fiberX, txY, { optical: true });
  out += TXT(xEngine + engineW + 8, txY - 8, 'TX · traffic fiber out', { a: 'start', size: 10, fill: 'var(--fiber)', mono: true });
  out += wire(id, xEngine + engineW, fiberX, rxY, { optical: true, rev: true });
  out += TXT(xEngine + engineW + 8, rxY + 18, 'RX · traffic fiber in', { a: 'start', size: 10, fill: 'var(--fiber)', mono: true });
  // external laser source: below the engine, dashed box (off the package), dashed feed (a side branch, not
  // the data path) so it can't be read as a third fiber headed the same place as TX/RX
  out += `<rect x="${elsX}" y="${elsY - 24}" width="${elsW}" height="48" rx="4" fill="var(--ink)" fill-opacity="0.05" stroke="var(--line-2)" stroke-dasharray="4 3"/>`;
  out += TXT(elsX + elsW / 2, elsY - 4, 'External laser', { size: 11.5, w: 600 });
  out += TXT(elsX + elsW / 2, elsY + 13, 'source (ELS)', { size: 11.5, w: 600 });
  out += `<line x1="${xEngine + engineW / 2}" x2="${xEngine + engineW / 2}" y1="${elsY - 24}" y2="${yMid + bh / 2}" stroke="var(--muted)" stroke-width="2" stroke-dasharray="3 3" marker-end="url(#${id}-ae)"/>`;
  // sits just above the ELS box, clear of the "switch package boundary" label near the top of this same gap
  out += TXT(xEngine + engineW / 2 + 12, elsY - 42, 'CW light in — a side feed, not data', { a: 'start', size: 10, fill: 'var(--muted)', mono: true });
  out += TXT(x0 - 30, TITLE_Y, 'CPO — built into the switch', { a: 'start', size: 16, w: 700 });
  out += TXT(x0 - 30, SUB_Y, '≈3.5–5.5 W per 800G port — optics + laser, no host SerDes', { a: 'start', size: 11.5, fill: 'var(--muted)', mono: true });
  out += TXT(W / 2, capY, 'The laser is a side feed only — traffic runs TX/RX straight through the engine.', { size: 11, fill: 'var(--muted)' });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Co-packaged optics: the switch ASIC's SerDes and an optical engine share one package, traffic fibers run TX and RX directly out of the engine, and an external laser source feeds the engine as a separate side branch, not a third fiber">${out}</svg>`;
}

export function opticsCutawaySVG() {
  const modules = [
    ['dsp', pluggableSVG('dsp')],
    ['lpo', pluggableSVG('lpo')],
    ['cpo', cpoSVG()],
  ];
  const cards = modules.map(([k, svg]) => `<div class="oc-module" data-module="${k}">${svg}</div>`).join('');
  const legend = `<div class="oc-legend">
    <span><i class="oc-sw" style="--c:var(--muted)"></i>Electrical</span>
    <span><i class="oc-sw" style="--c:var(--fiber)"></i>Optical (fiber)</span>
    <span><i class="oc-sw oc-dash" style="--c:var(--muted)"></i>Laser feed, not traffic</span>
    <span><i class="oc-sw oc-dash" style="--c:var(--line-2)"></i>Package boundary</span>
  </div>`;
  // A 1.6T-generation comparison belongs beside these, not folded into the 800G figures above: Broadcom and
  // Marvell's newest 3 nm, 200 Gb/s/lane DSPs bring a complete 1.6T module to sub-23 W and the bare DSP chip
  // alone (not the module) to ≈12–14 W — a different generation and a different accounting boundary from the
  // 800G figures on the three cards, not a smaller version of the same number.
  const note = `<p class="oc-note">A separate, newer generation: on the latest 3 nm, 200 Gb/s-per-lane DSPs, a complete 1.6T retimed module runs sub-23 W (Broadcom, Marvell), and the bare DSP chip by itself — not the assembled module — draws ≈12–14 W. Both are 1.6T-generation figures; don’t read them onto the 800G cards above.</p>`;
  return `<div class="oc-grid">${cards}</div>${legend}${note}`;
}
