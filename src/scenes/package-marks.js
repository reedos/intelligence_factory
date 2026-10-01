// Text-only package markings (no logos, no part numbers): the device name each scenario's hardware uses.
export const GPU_NAME = { h100: 'H100', gb200: 'B200', gb300: 'B300', rubin: 'Rubin' };
export const CPU_NAME = { h100: 'XEON', gb200: 'GRACE', gb300: 'GRACE', rubin: 'VERA' };   // as printed on the CPU package tops (tray.js, tray-rubin.js)
export const NIC_NAME = { h100: 'ConnectX-7', gb200: 'ConnectX-7', gb300: 'ConnectX-8', rubin: 'ConnectX-9' };
export const DPU_NAME = { gb200: 'BlueField-3', gb300: 'BlueField-3', rubin: 'BlueField-4' };
export const SWITCH_NAME = 'NVLink Switch';

/** A print group for realizeSpots: one marking repeated on several packages, laser-etched grey on dark mould. */
export function etch(name, text, size, spots, { ink = '#8f99a5', aspect = size[0] / size[1] } = {}) {
  return { name, lines: [{ text, size: .62, weight: 700 }], text: { px: 96, aspect, ink, align: 'center', pad: .04 }, size, spots,
    material: { roughness: .5, metalness: .2 } };
}
