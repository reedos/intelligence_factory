// DGX H100 layout shared by the server level (tray.js buildHGX) and the pulled server in the rack (rack.js), in
// tray units (10 cm), front +z. Arrangement from NVIDIA's DGX H100 user guide figures; every dimension inside the
// chassis is representative (assumption 'dgx-h100-internal-layout', research/dgx-h100-2026-10-01.md).
import { U, BASE } from './nvl72-layout.js';
export const DGX = {
  W: 4.4, D: 9, H: 3.56, ZF: 4.5, ZB: -4.5,
  ZM: 3.3,                                     // midplane, its rear face toward the trays
  my: 0.545, gy: 1.46,                         // board tops: motherboard tray, GPU tray (HGX baseboard)
  deck: 1.4,                                   // the GPU tray's pan: below it is the motherboard tray (tray-pcb.js decks)
  gpuX: [-1.62, -0.54, 0.54, 1.62], gpuZ: [1.2, -0.62], lifted: 3,
  swX: [-1.55, -0.52, 0.52, 1.55], swZ: -2.3,
  // Placement by signal flow (design rules 1-3). GPU tray front edge: a PCIe connector straight in front of each GPU
  // column, 54 V connectors in the two outer strips and the center, a sideband connector either side; the bus
  // converters sit straight behind the 54 V connectors, clear of every PCIe channel, beside the regulator rows they feed.
  connX: [-1.62, -0.54, 0.54, 1.62], gpuPwrX: [-1.97, 0, 1.97], sigX: [-1.08, 1.08],
  ibcs: [[-1.95, 2.75, 0.3], [-1.95, 2.3, 0.3], [0, 2.75, 0.36], [0, 2.3, 0.36], [1.95, 2.75, 0.3], [1.95, 2.3, 0.3]],
  // Motherboard tray front edge: GPU PCIe straight in front of each ConnectX-7 column, NVMe in the center channel,
  // power in the outer strips. On the midplane, PCIe runs down the stiles at +-1.08 and 54 V up the outer and
  // center stiles, so power and signal never share a channel and nothing sits in front of a fan opening.
  mbPcieX: [-1.43, -0.71, 0.71, 1.43], mbPwrX: [-1.9, 1.9], nvmeX: [-0.25, 0.25],
  pciStileX: [-1.08, 1.08], pwrStileX: [-2.08, 0, 2.08], busX: [-2.0, 0, 2.0],
  cpuPcieDX: 0.18, cpuSwDX: 0.31, cpuVrmX: [-0.07, 0.29], mbPwrRunX: 1.09,
  cpuX: [-1.07, 1.07], cpuZ: -1.15,
  bankX: [-1.74, -0.4, 0.4, 1.74], dimmPitch: 0.072, dimmLen: 1.34,
  modX: [-1.07, 1.07], modZ: 2.0, cxD: [0.36, 0.32], ny: 0.6275,
  pcieX: [-0.35, 0.35], pcieZ: -0.15, hgxPcie: [-1.08, 2.5],
  cageX: [-0.375, -0.125, 0.125, 0.375], cageY: 0.94,
  riserX: 0.66, cardX: 1.42, cardY: [0.93, 1.17], cardZ: -3.62,
  // The storage ConnectX-7 cards' QSFP112 cages at the rear bracket (left card: slots 1 and 3, right: 2): x across the tray,
  // dy above the card; the rack draws the same four on its server rears (rack-optics.js).
  storageX: [-1.67, -1.37, 1.17, 1.47], storageDY: 0.055,
  psuX: i => -1.825 + i * 0.73, psuY: 0.24,
  fanX: [-1.62, -0.54, 0.54, 1.62], fanY: [0.965, 1.975, 2.985],
  driveX: [-1.68, -0.88, 0.87, 1.67], driveY: [0.35, 0.185],
};

// The seated rear OSFP modules' MPO face and printed lid label (tray.js draws them, the rack's pulled server leads its patch cords from them)
DGX.cageFaceZ = DGX.ZB - 0.156; DGX.cageLidZ = DGX.ZB - 0.09;
// The front fans' spinning rotors (tray.js; the rack's pulled server spins the same twenty-four at the same spots): z and radius.
DGX.fanRotorZ = DGX.ZF - 0.3; DGX.fanRotorR = 0.21;

// The DGX H100 rack's front, in meters in rack.js's frame (front +z, floor at y 0): four 8U chassis, each closed by a
// removable metal-foam bezel (NVIDIA: "decorative metal foam") with two carry handles and a small control panel, one
// 1U management switch above them. rack.js builds its closed servers from this and the hall's rack faces (hall-rack-face.js,
// and tools/blender/build-hall-finish.py through references/hall-layout.json) draw the same bezels, so the two levels
// cannot disagree about what a DGX H100 rack looks like from the aisle.
const SU = 8 * U;
export const DGX_RACK = {
  servers: 4, SU, first: 0.06, gap: 0.004,           // chassis pitch is SU + gap, the first chassis starts BASE + first
  chassisW: 0.44, chassisD: 0.84,                    // DGX.W (4.4 tray units) x 10 cm; the chassis sits 0.07 behind the rack front
  fans: DGX.fanX.length * DGX.fanY.length,           // twelve fan modules behind the bezel (not visible on a closed server)
  bezel: { w: 0.44 - 0.016, h: SU * 0.89, rgb: [204, 178, 128] },                // the foam's base color; rack.js shades it with pores
  ears: { x: [-0.245, 0.245], w: 0.03, h: SU * 0.9 },                            // galvanized mounting ears either side
  handle: { x: [-0.19, 0.19], dy: -0.02, w: 0.014, h: 0.13, standoffDy: [-0.055, 0.055] },
  panel: { x: 0.155, dy: SU * 0.3, w: 0.022, h: 0.078, buttonsDy: [0.024, 0, -0.024] },   // power button, ID button, fault LED
  mgmt: { h: U * 0.94 },                                                         // the 1U switch above the top chassis
};
// the chassis centers, bottom up
export const dgxServerY = k => BASE + DGX_RACK.first + k * (SU + DGX_RACK.gap) + SU / 2;
