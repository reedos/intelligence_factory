// DGX H100 layout shared by the server level (tray.js buildHGX) and the pulled server in the rack (rack.js), in
// tray units (10 cm), front +z. Arrangement from NVIDIA's DGX H100 user guide figures; every dimension inside the
// chassis is representative (assumption 'dgx-h100-internal-layout', research/dgx-h100-2026-10-01.md).
export const DGX = {
  W: 4.4, D: 9, H: 3.56, ZF: 4.5, ZB: -4.5,
  ZM: 3.3,                                     // midplane, its rear face toward the trays
  my: 0.545, gy: 1.46,                         // board tops: motherboard tray, GPU tray (HGX baseboard)
  deck: 1.4,                                   // the GPU tray's pan: below it is the motherboard tray (tray-pcb.js decks)
  gpuX: [-1.62, -0.54, 0.54, 1.62], gpuZ: [1.2, -0.62], lifted: 3,
  swX: [-1.55, -0.52, 0.52, 1.55], swZ: -2.3,
  connX: [-1.6, -0.53, 0.53, 1.6],             // midplane connectors, both trays
  ibcX: [-1.85, -1.3, -0.75, 0.75, 1.3, 1.85], ibcZ: 2.62,
  cpuX: [-1.07, 1.07], cpuZ: -1.15,
  bankX: [-1.74, -0.4, 0.4, 1.74], dimmPitch: 0.072, dimmLen: 1.34,
  modX: [-1.05, 1.05], modZ: 2.0, cxD: [0.36, 0.32], ny: 0.6275,
  pcieX: [-0.35, 0.35], pcieZ: -0.15, hgxPcie: [0, 2.62],
  cageX: [-0.375, -0.125, 0.125, 0.375], cageY: 0.94,
  riserX: 0.66, cardX: 1.42, cardY: [0.93, 1.17], cardZ: -3.62,
  psuX: i => -1.83 + i * 0.73, psuY: 0.24,
  fanX: [-1.62, -0.54, 0.54, 1.62], fanY: [0.965, 1.975, 2.985],
  driveX: [-1.68, -0.88, 0.87, 1.67], driveY: [0.35, 0.185],
  busX: 0.6,
};
