// Keep the engineering paths and hardware intact; shed presentation cost first.
export const TIERS = [
  { mirror: true, ao: true, dof: true, msaa: 4, liveShadows: true, ratio: Infinity, bloom: true, halo: true, particles: 1 },
  { mirror: false, ao: true, dof: true, msaa: 4, liveShadows: true, ratio: Infinity, bloom: true, halo: true, particles: 1 },
  { mirror: false, ao: false, dof: false, msaa: 4, liveShadows: true, ratio: Infinity, bloom: true, halo: true, particles: 1 },
  { mirror: false, ao: false, dof: false, msaa: 0, liveShadows: false, ratio: Infinity, bloom: true, halo: false, particles: .8 },
  { mirror: false, ao: false, dof: false, msaa: 0, liveShadows: false, ratio: 1.25, bloom: false, halo: false, particles: .6 },
  { mirror: false, ao: false, dof: false, msaa: 0, liveShadows: false, ratio: 1, bloom: false, halo: false, particles: .45 },
  { mirror: false, ao: false, dof: false, msaa: 0, liveShadows: false, ratio: .75, bloom: false, halo: false, particles: .3 },
];

// GPU timers distinguish rendering pressure from an idle GPU at a battery-saver
// frame cap. Without timers, sustained frame intervals remain the fallback.
export function qualityPressure({ frame, gpu, cpu }) {
  if (!Number.isFinite(frame) || !Number.isFinite(cpu)) return 0;
  const measuredGpu = Number.isFinite(gpu);
  if (frame > 20.5 && (!measuredGpu || gpu > 11 || cpu > 11)) return frame > 40 ? 2 : 1;
  // Recovery must have both visible smoothness and measured rendering headroom.
  if (frame < 18 && measuredGpu && gpu < 5 && cpu < 5) return -1;
  return 0;
}

export const particleBudget = (count, fraction) => Math.min(count, Math.max(Math.min(count, 3), Math.ceil(count * fraction)));
