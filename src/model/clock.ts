// The clock: four ways a campus moves in time, sampled from the same model the page draws.
//   training   seconds: synchronized GPUs swing the load every step (0.2–3 Hz band), checkpoints dip it
//   outage     minutes: the grid drops, batteries carry the load, generators take it within 10 s (NFPA 110)
//   hotday     24 hours: outdoor heat raises cooling power; dry coolers turn to water above ≈35 °C
//   inference  24 hours: demand follows people awake; idle GPUs still draw power
// Pure functions of (model, time): the page samples them for charts, counters and the 3D flows.
import type { Model } from './engine';

export type SimId = 'training' | 'outage' | 'hotday' | 'inference';
export interface SimOpts { peakTrough?: number; hotMax?: number }
export interface Series { key: string; label: string; unit: string; color: string; axis?: 'right'; area?: boolean }
export interface SimEvent { t: number; label: string }
export interface Sample {
  t: number;
  meterMW: number;                 // what the utility meter reads (or the site draws, in an outage)
  values: Record<string, number>;  // one value per series key
  phase: string;                   // a short label for what is happening now
  // how the 3D flows react: 1 is the steady state
  levels: { grid: number; mv: number; standby: number; load: number; cool: number; vapor: number };
  waterM3h: number;                // on-site water use, m³ per hour
  tokensPerS: number;              // tokens served per second (inference only)
}
export interface Sim {
  id: SimId; label: string; unit: 's' | 'h'; duration: number;
  series: Series[]; events: SimEvent[];
  sample: (t: number) => Sample;
  speed: (t: number) => number;    // simulated units per real second, for playback
  notes: { text: string; basis: 'spec' | 'typical' | 'est' }[];
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (x: number) => x * x * (3 - 2 * x);

// GPU share of rack power: the part that swings with the math
function gpuMW(M: Model) {
  const r = M.rack;
  return M.racks * (r.pkgKW + r.vrmLossKW) / 1000 / (M.power.id === 'dc800' ? 0.985 : M.accel.psuEff);
}

// ---------- training: seconds ----------
function training(M: Model): Sim {
  const G = gpuMW(M), P = 2.0, comm = 0.3, low = 0.35;               // 0.5 Hz steps, 30% of each spent communicating
  const ckpt: [number, number] = [38, 44];                           // a checkpoint pause
  const storage = M.accel.id === 'gb300' || M.accel.id === 'rubin';  // rack energy storage (GB300 onward)
  const g = (t: number) => {
    if (t >= ckpt[0] && t < ckpt[1]) {                                // ramp down into the checkpoint, back up after
      const into = clamp((t - ckpt[0]) / 0.4), out = clamp((ckpt[1] - t) / 0.4);
      return 1 - (1 - 0.15) * Math.min(into, out);
    }
    const ph = (t % P) / P, e = 0.04, span = 1 - low;                 // compute, then a fast drop for the all-reduce
    if (ph < e) return low + span * smooth(0.5 + ph / (2 * e));       // second half of the ramp up
    if (ph < 1 - comm - e) return 1;
    if (ph < 1 - comm + e) return 1 - span * smooth((ph - (1 - comm - e)) / (2 * e));
    if (ph < 1 - e) return low;
    return low + span * smooth((ph - (1 - e)) / (2 * e));             // first half of the ramp up
  };
  // rack storage: a low-pass on what the grid sees (τ ≈ 0.6 s), computed by stepping from the start
  const tau = 0.6, dt = 0.01, N = Math.ceil(60 / dt) + 1, lp = new Float64Array(N);
  lp[0] = g(0);
  for (let i = 1; i < N; i++) lp[i] = lp[i - 1] + (g(i * dt) - lp[i - 1]) * (dt / tau);
  const lowPass = (t: number) => lp[Math.min(N - 1, Math.max(0, Math.round(t / dt)))];
  let mean = 0; for (let i = 0; i < N; i++) mean += g(i * dt); mean /= N;
  const at = (x: number) => M.meterMW - G * (1 - x);
  const series: Series[] = [
    { key: 'raw', label: 'Rack load, no smoothing', unit: 'MW', color: '#ff7f50' },
    ...(storage ? [{ key: 'rack', label: 'With rack energy storage', unit: 'MW', color: '#e8ff5a' }] : []),
    { key: 'site', label: 'Grid sees, with site batteries', unit: 'MW', color: '#b69cff' },
  ];
  return {
    id: 'training', label: 'Training step', unit: 's', duration: 60, series,
    events: [{ t: ckpt[0], label: 'Checkpoint' }, { t: ckpt[1], label: 'Resume' }],
    sample: t => {
      const x = g(t), shown = storage ? lowPass(t) : x;
      return {
        t, meterMW: at(shown),
        values: { raw: at(x), ...(storage ? { rack: at(lowPass(t)) } : {}), site: at(mean) },
        phase: t >= ckpt[0] && t < ckpt[1] ? 'Checkpoint: GPUs wait on storage' : x > 0.9 ? 'Compute: every GPU at full power' : x < low + 0.05 ? 'All-reduce: GPUs wait on the network' : 'Ramping',
        levels: { grid: 1, mv: 1, standby: 0, load: 0.25 + 0.95 * x, cool: 1, vapor: 1 },
        waterM3h: M.meterMW * 1000 * M.wue / 1000, tokensPerS: 0,
      };
    },
    speed: () => 1,
    notes: [
      { text: 'Production clusters swing in the 0.2–3 Hz band (Microsoft, OpenAI and NVIDIA, 2025). The 2-second step drawn here sits inside it.', basis: 'spec' },
      { text: `${storage ? 'GB300 racks store 65 J per GPU and cut peak grid demand by up to 30%; the smoothing drawn is a 0.6 s low-pass, an estimate. ' : ''}Site batteries can absorb the rest, so the grid sees the average.`, basis: storage ? 'spec' : 'typical' },
      { text: `GPUs are ${Math.round(G / M.meterMW * 100)}% of the meter here, so one step moves the campus by about ${Math.round(G * (1 - low))} MW.`, basis: 'est' },
    ],
  };
}

// ---------- outage: seconds, then minutes ----------
function outage(M: Model): Sim {
  const fail = 5, gensOn = fail + 10, chillersBack = gensOn + 120, gridBack = fail + 15 * 60, retransfer = gridBack + 5 * 60, end = retransfer + 60;
  const warm = M.cooling.id === 'warm', dc = M.power.id === 'dc800';
  const it = M.meterMW - M.coolMW / 0.99;                             // everything but cooling, at the meter
  const coolFull = M.coolMW / 0.99, coolCritical = coolFull * (warm ? 0.45 : 0.2);   // pumps and fans stay on backup power
  const cooling = (t: number) => {
    if (t < fail || t >= gridBack) return coolFull;
    if (t < gensOn) return coolCritical;
    if (warm) return coolFull;                                        // dry-cooler fans restart with the generators
    return coolCritical + (coolFull - coolCritical) * smooth(clamp((t - gensOn - 30) / (chillersBack - gensOn - 30)));
  };
  const sample = (t: number): Sample => {
    const load = it + cooling(t);
    const onGrid = t < fail || t >= retransfer;
    const battery = !onGrid && t < gensOn ? load : 0;
    const gens = !onGrid && t >= gensOn ? load * clamp((t - gensOn) / 1.5) : 0;   // generators pick up the load over ≈1.5 s
    const bridge = !onGrid && t >= gensOn && t < gensOn + 1.5 ? load - gens : 0;
    const phase = onGrid ? (t < fail ? 'Normal: on the grid' : 'Back on the grid') : t < gensOn ? `Batteries carry the load${dc ? ' on the 800 V DC bus' : ' through the UPS'}` : t < chillersBack && !warm ? 'Generators on; chillers restarting' : t < gridBack ? 'Generators carry the campus' : 'Grid back; waiting for it to hold steady';
    return {
      t, meterMW: onGrid ? load : 0,
      values: { grid: onGrid ? load : 0, gens, battery: battery + bridge },
      phase,
      levels: { grid: onGrid ? 1 : 0, mv: onGrid || t >= gensOn ? 1 : 0, standby: !onGrid && t >= gensOn ? 1 : 0, load: 1, cool: cooling(t) / coolFull, vapor: warm ? 0.3 : cooling(t) / coolFull },
      waterM3h: M.meterMW * M.wue * cooling(t) / coolFull, tokensPerS: 0,
    };
  };
  return {
    id: 'outage', label: 'Grid outage', unit: 's', duration: end,
    series: [
      { key: 'grid', label: 'From the grid', unit: 'MW', color: '#b69cff' },
      { key: 'battery', label: dc ? 'DC-bus batteries' : 'UPS batteries', unit: 'MW', color: '#47cfff' },
      { key: 'gens', label: 'Diesel generators', unit: 'MW', color: '#ffb14e' },
    ],
    events: [
      { t: fail, label: 'Grid lost' }, { t: gensOn, label: 'Generators on, 10 s' },
      ...(warm ? [] : [{ t: chillersBack, label: 'Chillers back' }]),
      { t: gridBack, label: 'Grid back' }, { t: retransfer, label: 'Back on the grid' },
    ],
    sample,
    speed: t => (t < 45 ? 2 : 60),
    notes: [
      { text: 'NFPA 110 Level 1: generators must carry the full emergency load within 10 seconds of a utility failure.', basis: 'spec' },
      { text: 'UPS batteries are commonly sized for 3–10 minutes, far longer than the 10 s they need here.', basis: 'typical' },
      { text: `Chiller restart (≈2 min), outage length (15 min) and the 5 minutes of grid stability before transfer back are illustrative.`, basis: 'est' },
    ],
  };
}

// ---------- hot day: 24 hours ----------
const crossings = (f: (h: number) => number, v: number) => {
  const out: number[] = [];
  for (let h = 0; h < 24; h += 0.05) if ((f(h) - v) * (f(h + 0.05) - v) < 0) out.push(+(h + 0.025).toFixed(2));
  return out;
};
function hotday(M: Model, o: SimOpts): Sim {
  const warm = M.cooling.id === 'warm', max = o.hotMax ?? 40, min = max - 16;
  const T = (h: number) => (max + min) / 2 + (max - min) / 2 * Math.cos(2 * Math.PI * (h - 15) / 24);   // coolest near 3 am, hottest at 3 pm
  const adiabatic = 35;
  const it = M.meterMW - M.coolMW / 0.99;
  const coolAt = (h: number) => {
    const t = T(h);
    if (warm) return M.coolMW * (0.75 + 0.5 * clamp((t - 20) / 20)) / 0.99;   // fans work harder as the air warms
    return M.coolMW * clamp(1 + 0.025 * (t - 25), 0.7, 1.6) / 0.99;          // chiller efficiency falls ≈2.5% per °C
  };
  const water = (h: number) => {                                          // m³ per hour
    const t = T(h), base = M.meterMW * M.wue;                             // MW × L/kWh = m³/h
    if (warm) return t >= adiabatic ? base * (4 + 2 * (t - adiabatic) / 5) : base * 0.4;
    return base * clamp(0.8 + 0.4 * (t - 22) / 18, 0.6, 1.4);
  };
  return {
    id: 'hotday', label: 'Hot day', unit: 'h', duration: 24,
    series: [
      { key: 'meter', label: 'Campus draw', unit: 'MW', color: '#ffb14e' },
      { key: 'temp', label: 'Outdoor air', unit: '°C', color: '#ff5a6e', axis: 'right', area: true },
      { key: 'water', label: 'Water on site', unit: 'm³/h', color: '#3f8cff', axis: 'right' },
    ],
    events: warm ? crossings(T, adiabatic).map((t, i) => ({ t, label: i ? 'Dry again' : `Above ${adiabatic} °C: water sprays on` })) : [{ t: 15, label: 'Hottest hour' }],
    sample: h => {
      const cool = coolAt(h), meter = it + cool, t = T(h);
      return {
        t: h, meterMW: meter, values: { meter, temp: t, water: water(h) },
        phase: `${Math.round(t)} °C outside · PUE ${(meter / M.IT_MW).toFixed(2)}${warm && t >= adiabatic ? ' · evaporating water' : ''}`,
        levels: { grid: 1, mv: 1, standby: 0, load: 1, cool: cool / (M.coolMW / 0.99), vapor: clamp(water(h) / (M.meterMW * M.wue * 2), 0.05, 2) },
        waterM3h: water(h), tokensPerS: 0,
      };
    },
    speed: () => 0.5,
    notes: [
      { text: `A ${min}–${max} °C day. ${warm ? 'Dry coolers alone cannot hold the loop above about 35 °C, so adiabatic sprays switch on and the campus starts using water.' : 'Chillers lose efficiency as the air warms, so cooling power climbs through the afternoon.'}`, basis: 'typical' },
      { text: 'No data-center dry-cooler derating curve was found, so the slopes here are estimates.', basis: 'est' },
    ],
  };
}

// ---------- inference day: 24 hours ----------
function inference(M: Model, o: SimOpts, tokPerGpu: number): Sim {
  const r = o.peakTrough ?? 2.5, G = gpuMW(M), idle = 0.3, peakU = 0.9;
  // shape: overnight trough, morning rise, midday dip, afternoon peak, evening decline (qualitative, from measurement studies)
  const bump = (h: number, c: number, w: number) => Math.exp(-((((h - c + 36) % 24) - 12) ** 2) / (2 * w * w));
  const raw = (h: number) => 0.2 + bump(h, 10.5, 1.8) * 0.75 + bump(h, 15.5, 2.4) + bump(h, 20.5, 2) * 0.55 - bump(h, 13, 0.9) * 0.18;
  let lo = Infinity, hi = -Infinity; for (let h = 0; h < 24; h += 0.05) { lo = Math.min(lo, raw(h)); hi = Math.max(hi, raw(h)); }
  const d = (h: number) => 1 / r + (1 - 1 / r) * (raw(h) - lo) / (hi - lo);   // 1 at peak, 1/r at trough
  return {
    id: 'inference', label: 'Inference day', unit: 'h', duration: 24,
    series: [
      { key: 'meter', label: 'Campus draw', unit: 'MW', color: '#ffb14e' },
      { key: 'demand', label: 'Demand, % of peak', unit: '%', color: '#a6f35a', axis: 'right', area: true },
      { key: 'jtok', label: 'Energy per token', unit: 'J', color: '#e9fbff', axis: 'right' },
    ],
    events: [{ t: 4, label: 'Trough' }, { t: 15.5, label: 'Peak' }],
    sample: h => {
      const u = peakU * d(h), gpu = G * (idle + (1 - idle) * u), meter = M.meterMW - G + gpu;
      const tps = M.gpus * tokPerGpu * u;
      return {
        t: h, meterMW: meter, values: { meter, demand: d(h) * 100, jtok: meter * 1e6 / tps },
        phase: `${Math.round(d(h) * 100)}% of peak demand · ${(meter * 1e6 / tps).toFixed(2)} J per token`,
        levels: { grid: 1, mv: 1, standby: 0, load: 0.3 + u, cool: 0.7 + 0.3 * meter / M.meterMW, vapor: 1 },
        waterM3h: meter * M.wue, tokensPerS: tps,
      };
    },
    speed: () => 0.5,
    notes: [
      { text: 'The shape (overnight trough, morning rise, midday dip, afternoon peak) comes from measurement studies of real LLM services.', basis: 'typical' },
      { text: `No provider publishes a peak-to-trough ratio; ${r}× is illustrative. Idle GPUs are assumed to draw 30% of full power, and the busiest hour runs at 90%.`, basis: 'est' },
    ],
  };
}

export function makeSim(M: Model, id: SimId, o: SimOpts = {}, tokPerGpu = M.tokPerGpuRef): Sim {
  return id === 'training' ? training(M) : id === 'outage' ? outage(M) : id === 'hotday' ? hotday(M, o) : inference(M, o, tokPerGpu);
}
export const SIMS: { id: SimId; label: string }[] = [
  { id: 'training', label: 'Training step' }, { id: 'outage', label: 'Grid outage' }, { id: 'hotday', label: 'Hot day' }, { id: 'inference', label: 'Inference day' },
];

// integrate a sim from 0 to t: energy, water and tokens, for the live counters
export function totals(sim: Sim, t: number, n = 400) {
  const scale = sim.unit === 'h' ? 1 : 1 / 3600;            // simulated units → hours
  let mwh = 0, water = 0, tokens = 0;
  for (let i = 0; i < n; i++) {
    const a = t * i / n, b = t * (i + 1) / n, s = sim.sample((a + b) / 2), dh = (b - a) * scale;
    mwh += s.meterMW * dh; water += s.waterM3h * dh; tokens += s.tokensPerS * dh * 3600;
  }
  return { mwh, water, tokens };
}
