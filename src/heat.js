// One rule for every heat visual: watts in, visual heat weight out.
//
// Components in one view span about 1 W to about 1 kW, so a linear mapping would erase the small sources and a flat
// one (every source drawn alike) says nothing. The rule is log-compressed: every 10× in power is the same step in
// motion, one fifth as much (visual weight ∝ watts^log10(5), about watts^0.7), normalized to the largest source in
// the view. Sources under half a watt draw no stream at all. Rank order within a view always holds: more watts never
// draws less heat. ASSUMPTIONS['heat-visual-scale'] in evidence.js states the rule for readers; heat.test.ts and
// scenes/heat-scale.test.ts check it.
//
// What counts as one source: one part as the view draws it (one GPU package, one HBM stack, one optical engine, one
// redriver). Streams are tagged with tagHeat(flow, source, watts, role). role 'source' is heat leaving a part;
// role 'carrier' is a coolant or air loop moving heat collected elsewhere (supply legs belong to their loop).
// Sources are compared with sources and carriers with carriers, each against the largest in its view.
//
// Visual heat weight of a stream = moving cores × core size × peak color × opacity, the same quantities a reader
// sees: how many pulses, how big, how bright. A source's weight is the sum over its streams.

export const HEAT_SCALE = {
  minW: 0.5,          // below this a part draws no heat stream (at most a faint tint)
  perDecade: 5,       // each 10× in watts is 5× in visual weight
  minOpacity: 0.3,    // the faintest stream still drawn, for a source just above minW in a busy view
};
export const HEAT_GAMMA = Math.log10(HEAT_SCALE.perDecade);   // ≈0.699

// 0..1 relative to the largest source in the view; 0 below the threshold
export function heatWeight(watts, refWatts) {
  if (!(watts >= HEAT_SCALE.minW) || !(refWatts > 0)) return 0;
  return Math.min(1, (watts / refWatts) ** HEAT_GAMMA);
}

// Tag a flow (or any object with a `heat` slot) with the part it shows heat from.
export function tagHeat(f, source, watts, role = 'source') {
  f.heat = { source, watts, role };
  return f;
}

const peak = c => Math.max(c.r, c.g, c.b);
// What a reader sees of one stream: pulses × size × brightness × opacity. Reads the live flow, after any art
// direction (density, core radius, brightness), so tests measure what renders.
export function flowHeatWeight(f) {
  if (!f || !(f.count > 0)) return 0;
  const radius = f.motionStyle?.radius ?? 1, color = f.base?.color ?? f.color;
  return f.count * f.size * radius * (color ? peak(color) : 1) * (f.base?.opacity ?? 1);
}

// Per-source totals for one list of flows: [{ source, role, watts, weight, streams }]
export function heatSources(flows) {
  const by = new Map();
  for (const f of flows || []) {
    if (!f?.heat) continue;
    const key = `${f.heat.role}:${f.heat.source}`;
    const s = by.get(key) || { source: f.heat.source, role: f.heat.role, watts: f.heat.watts, weight: 0, streams: 0 };
    s.weight += flowHeatWeight(f); s.streams++;
    by.set(key, s);
  }
  return [...by.values()];
}

// Change how much one flow emits: more or fewer moving cores first, the remainder as opacity, never fainter than
// HEAT_SCALE.minOpacity of the authored opacity. factor 1 leaves it alone; otherwise count × opacity scales by
// `factor` exactly, down to that floor. Safe to call again after art direction has changed the count.
export function scaleEmission(f, factor) {
  if (!(factor > 0) || Math.abs(factor - 1) < 1e-6) return f;
  const o0 = f.heatOpacity0 ??= (f.base.opacity ?? 1);
  const want = f.count * (f.base.opacity / o0) * factor, n = Math.max(1, Math.ceil(want - 1e-9));
  const fade = Math.max(HEAT_SCALE.minOpacity, Math.min(1, want / n));
  if (n !== f.count) {
    if (n > f.mesh.instanceMatrix.count) {
      const A = f.mesh.instanceMatrix.constructor;
      f.mesh.instanceMatrix = new A(new Float32Array(n * 16), 16);
    }
    f.mesh.count = f.count = n;
  }
  f.base.opacity = o0 * fade;
  const m = f.mesh.material;
  m.opacity = Math.min(1, f.base.opacity * (f.bright ?? 1)); m.transparent = true;
  if (typeof f.update === 'function') f.update(f.lastT ?? 0);
  return f;
}

// Apply the rule to a view's heat flows: within each role, every source is scaled to heatWeight(its watts, the
// largest's watts) of the largest source's visual weight. The largest keeps its authored look unless that would
// draw more pulses than the view drew before (then the whole view is scaled down together, ratios kept), or a
// small source cannot fade far enough (one pulse per stream at the faintest opacity; then it is raised).
// Flows of a source under the threshold must not be built at all; this throws if one was.
export function balanceHeat(flows, { refWatts } = {}) {
  const sources = heatSources(flows);
  // pulses a flow draws, counted at its authored opacity; what one such pulse weighs
  const pulses = f => f.count * (f.base.opacity / (f.heatOpacity0 ?? f.base.opacity));
  for (const role of new Set(sources.map(s => s.role))) {
    const group = sources.filter(s => s.role === role);
    const hero = group.reduce((a, b) => (b.watts > a.watts ? b : a));
    const ref = refWatts?.[role] ?? hero.watts;
    const members = new Map(group.map(s => [s, flows.filter(f => f.heat && f.heat.role === role && f.heat.source === s.source)]));
    let heroWeight = hero.weight / (heatWeight(hero.watts, ref) || 1), floor = 0;
    for (const s of group) {
      const w = heatWeight(s.watts, ref);
      if (!w) throw new Error(`heat source ${s.source} at ${s.watts} W is under ${HEAT_SCALE.minW} W and must not draw a stream`);
      const faintest = members.get(s).reduce((a, f) => a + flowHeatWeight(f) / pulses(f) * HEAT_SCALE.minOpacity, 0);
      floor = Math.max(floor, faintest / w);
    }
    heroWeight = Math.max(heroWeight, floor);
    // the pulse budget: no more moving cores than the view had
    const budget = group.reduce((a, s) => a + members.get(s).reduce((b, f) => b + f.count, 0), 0);
    const project = hw => group.reduce((a, s) => a + members.get(s).reduce((b, f) =>
      b + Math.max(1, Math.ceil(pulses(f) * hw * heatWeight(s.watts, ref) / s.weight - 1e-9)), 0), 0);
    if (project(heroWeight) > budget) {
      let lo = floor, hi = heroWeight;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (project(mid) > budget) hi = mid; else lo = mid; }
      heroWeight = Math.max(floor, lo);
    }
    for (const s of group) {
      const factor = (heroWeight * heatWeight(s.watts, ref)) / s.weight;
      for (const f of members.get(s)) scaleEmission(f, factor);
    }
  }
  return flows;
}

// Assumed heat of drawn parts the model does not size, in watts: order-of-magnitude allocations used only to scale
// the heat drawing (ASSUMPTIONS['heat-visual-scale'] says where each comes from). Only ratios within a view matter.
export const PART_W = {
  // Pluggable module, 200G per lane: Semtech's full-DSP 23–25 W, LRO ≈16 W and LPO ≈10 W figures. What the LPO
  // module keeps (≈10 W) is split over the drivers, TIAs, lasers and the converter/controller (≈2 W, not drawn);
  // the DSP is the rest, and a transmit-only LRO DSP is the LRO module less the same 10 W.
  module: { dsp: 14, lroDsp: 6, driver: 3, tia: 2, lasers: 3, total: 24, lro: 16, lpo: 10 },
  // 800ZR module, 24–25 W: the nano-ITLA's published 2.9 W; driver and TIA a few watts and about one; the optical
  // modulator's bias and the photodiodes' bias well under half a watt; the DSP most of the rest.
  coherent: { dsp: 16, itla: 2.9, driver: 2, tia: 1, modulator: 0.3, receiverOptics: 0.05, total: 24.5 },
  // CPO switch package: NVIDIA's 3.95 kW Q3450 less its optics (≈9 W per port) and fans, over four packages, puts a
  // switch ASIC near 550 W; each 1.6T engine at the package about 13 W (laser light comes from the front panel).
  // A Broadcom-style 6.4T engine (Bailly-class): Broadcom puts its Tomahawk 6 CPO port at about 3.5 W per 800G,
  // 36.4% below the Tomahawk 5 CPO port, so a Tomahawk 5 port near 5.5 W; eight 800G ports per engine ≈ 44 W. Its
  // switch chip is drawn at the same 550 W.
  cpo: { asic: 550, engine: 13, tile: 44 },
  // Copper cable ends: NVIDIA's DAC 0.1 W per end (no chip); "a couple of watts" for an ACC redriver; an AEC
  // retimer between the cited 2.5–3.5 W and ≈20 W at 200G per lane, taken as 10 W.
  copper: { dac: 0.1, acc: 2, aec: 10 },
};

// For glows and plumes: an authored intensity for the largest source, scaled for this one.
export const heatIntensity = (authored, watts, refWatts) => authored * heatWeight(watts, refWatts);
