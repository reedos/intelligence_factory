// Printed lid labels on the pluggable modules drawn in the 3D scenes. The text names the class of module the
// scenario's hardware uses, never a vendor part number; the module side level prints the same way.
// Tiers follow the scenario's accelerator: H100 and GB200 are the 400G-per-GPU fabric, GB300 the 800G one, and
// Vera Rubin the 1.6T one (its optical module type is unpublished, so its label carries no optics suffix).
//
// Sources (src/sources.js):
//   switch, 400G tier   OSFP 800G 2xDR4   NVIDIA MMS4X00-NS "800Gb/s Twin-port OSFP, 2x400Gb/s Single Mode 2xDR4"
//                                         (nvidia-mms4x00-ns; DR8 datasheet nvidia-800g-dr8-datasheet)
//   switch, 800G tier   OSFP 1.6T 2xDR4   NVIDIA MMS4A00 "1600Gbps, 2xDR4, Twin-port OSFP" (nvidia-mms4a00,
//                                         nvidia-mms4a00-specs; switch side in nvidia-quantum-x800-clusters)
//   NIC, GB200          OSFP 400G DR4     NVIDIA MMS4X00-NS400 "400Gb/s single-port OSFP DR4" (nvidia-mms4x00-ns400)
//   NIC, H100           OSFP 800G 2xDR4   twin-port cages of the DGX H100 (nvidia-mms4x00-ns)
//   NIC, GB300          OSFP 800G DR4     "NVIDIA single port transceiver, 800Gbps, OSFP DR4", platform NIC
//                                         (nvidia-quantum-x800-clusters)
//   Vera Rubin, both    OSFP 1.6T         module type not published: rate and form factor only
//   module side level   the scenario's switch label (+ " LPO" in its LPO view): the level opens the switch-side
//                                         module, so it prints what the hall prints. LPO naming as vendors list it
//                                         (stordis-s-osfpc-16tdr4l, eoptolink-800g-lpo-osfp)
//   coherent            800ZR             OIF 800ZR (the side level's own sources)
//   copper heads        DAC / ACC / AEC   the cable class each head belongs to
const SWITCH = { 400: 'OSFP 800G 2xDR4', 800: 'OSFP 1.6T 2xDR4', 1600: 'OSFP 1.6T' };
const NIC = { h100: 'OSFP 800G 2xDR4', gb200: 'OSFP 400G DR4', gb300: 'OSFP 800G DR4', rubin: 'OSFP 1.6T' };
const NIC_TIER = { 400: 'OSFP 400G DR4', 800: 'OSFP 800G DR4', 1600: 'OSFP 1.6T' };

export const COHERENT_LABEL = '800ZR';
export const COPPER_LABELS = { dac: 'DAC', acc: 'ACC', aec: 'AEC' };

const accelOf = accel => (typeof accel === 'string' ? { id: accel } : accel || {});
const tierOf = a => a.nicGbps ?? ({ h100: 400, gb200: 400, gb300: 800, rubin: 1600 })[a.id];

/** Label printed on the switch-side modules in the hall (leaf, spine, storage faces). */
export function switchLabel(accel) {
  return SWITCH[tierOf(accelOf(accel))] || SWITCH[400];
}
/** Label printed on the modules seated in a compute tray's (or DGX server's) NIC cages. */
export function nicLabel(accel) {
  const a = accelOf(accel);
  return NIC[a.id] || NIC_TIER[tierOf(a)] || NIC.gb200;
}
/** Optical connectors (MPO-12 receptacles) on the face of one module seated in a compute tray's NIC cages: two on a twin-port
 *  ("2xDR4", the DGX H100's), one on a single-port (GB200 400G DR4, GB300 800G DR4, Rubin 1.6T). Read from the label above so
 *  the count a module is printed with and the count it is drawn with cannot differ; the rack, the tray and the hall's
 *  breakout all take it from here. */
export function modulePorts(accel) {
  return /2x/i.test(nicLabel(accel)) ? 2 : 1;
}
/** The hall's switch-side modules: every one is a twin-port (switchLabel, "2xDR4"), so two MPO-12 receptacles. */
export function switchModulePorts(accel) {
  return /2x/i.test(switchLabel(accel)) ? 2 : 1;
}
export const MODULE_SIDES = ['switch', 'nic'];
export const normSide = side => (side === 'nic' ? 'nic' : 'switch');
/** Lid print of the module side level: the module on screen (the scenario's switch-side module, or the NIC-cage module
 *  when the level is on its NIC side), plus LPO in the LPO view (LRO keeps the plain print). */
export function moduleLabel(accel, lpo = false, side = 'switch') {
  return (normSide(side) === 'nic' ? nicLabel(accel) : switchLabel(accel)) + (lpo ? ' LPO' : '');
}
/** The module side level's lid print as three lines (matching the coherent pluggable's own three-line label,
 *  module-art-direction.js's drawLabel): OSFP, the tier's rate (plus LPO in that view), then the reach. Every
 *  module this level draws is a DR4-style twin-port (moduleTier), reported at 1310 nm up to 500 m: the OSFP MSA's
 *  own DR4 color-code row (rev 5.22 sec. 3.8, Table 3-3, "OSFP 1310nm solutions for up to 500m ... DR4") and
 *  NVIDIA's MMS4X00/MMS4A00 datasheets (module-lid-labels) agree. */
export function moduleLabelLines(accel, lpo = false, side = 'switch') {
  const [, rate] = moduleLabel(accel, lpo, side).match(/^OSFP (.*)$/);
  return ['OSFP', rate, '1310 nm · 500 m'];
}
const NIC_NAME = { h100: 'H100', gb200: 'GB200', gb300: 'GB300', rubin: 'Rubin' };
/** The module the module side level draws for this scenario and side.
 *  switch side: the 800G twin-port for H100 and GB200 (NVIDIA MMS4X00, 2 x 400G DR4, 8 x 100G PAM4 each way), the 1.6T
 *    twin-port for GB300 (MMS4A00, 2 x 800G DR4, 8 x 200G), and for Vera Rubin a 1.6T-class module of unpublished type
 *    (drawn as the 1.6T twin-port).
 *  nic side (the compute tray's own cages): GB200 a single-port 400G DR4 (MMS4X00-NS400, 4 x 100G), GB300 a single-port
 *    800G DR4 (4 x 200G); H100 the same 800G twin-port as the switch, and Vera Rubin the same unpublished 1.6T class.
 *  `lanes` is per direction, `ports` the optical ports, `same` whether both ends carry one module. */
export function moduleTier(accel, side = 'switch') {
  const a = accelOf(accel), t = tierOf(a) ?? 400, label = switchLabel(accel), nicName = NIC_NAME[a.id] || 'NIC';
  const sw = t === 400
    ? { key: '800g', label, rate: '800G', port: '400G', lane: '100G', laneGbps: 100, part: 'MMS4X00', published: true }
    : { key: t === 800 ? '1.6t' : 'rubin', label, rate: '1.6T', port: '800G', lane: '200G', laneGbps: 200, part: t === 800 ? 'MMS4A00' : null, published: t === 800 };
  const nic = normSide(side) === 'nic', same = a.id === 'h100' || a.id === 'rubin';
  if (!nic || same) return { ...sw, side: nic ? 'nic' : 'switch', lanes: 8, ports: 2, engines: 2, same, nicName, endName: nic ? `${nicName} NIC` : 'switch' };
  const g2 = a.id === 'gb200';
  return { key: g2 ? 'nic-400' : 'nic-800', label: nicLabel(accel), rate: g2 ? '400G' : '800G', port: g2 ? '400G' : '800G',
    lane: g2 ? '100G' : '200G', laneGbps: g2 ? 100 : 200, part: g2 ? 'MMS4X00-NS400' : null, published: true,
    side: 'nic', lanes: 4, ports: 1, engines: 1, same: false, nicName, endName: `${nicName} NIC` };
}
/** What the module on screen is, in a phrase: "800G single-port OSFP, DR4", "1.6T twin-port OSFP, 2 × DR4". */
export function moduleName(t) {
  return t.ports === 1 ? `${t.rate} single-port OSFP, DR4` : t.published ? `${t.rate} twin-port OSFP, 2 × DR4` : `${t.rate} OSFP, type unpublished`;
}
/** Short names for the top bar's tab and the level's sub-title: "1.6T 2×DR4 · switch", "800G DR4 · GB300 NIC". */
export function moduleTabName(t) {
  const kind = t.ports === 1 ? 'DR4' : t.published ? '2×DR4' : '';
  return `${t.rate}${kind ? ` ${kind}` : ''} · ${t.endName}`;
}
/** Two printed lines: the form factor, then the rate and optics. */
export function labelLines(text) {
  const [form, ...rest] = text.split(' ');
  return rest.length ? [form, rest.join(' ')] : [form];
}
