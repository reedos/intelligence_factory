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
/** Lid print of the module side level: the scenario's switch-side module, plus LPO in the LPO view (LRO keeps the plain print). */
export function moduleLabel(accel, lpo = false) {
  return switchLabel(accel) + (lpo ? ' LPO' : '');
}
/** The switch-side twin-port module the module side level opens for this scenario: H100 and GB200 use the 800G
 *  twin-port (NVIDIA MMS4X00, 2 × 400G DR4, 8 × 100G PAM4 each way), GB300 the 1.6T twin-port (MMS4A00, 2 × 800G DR4,
 *  8 × 200G PAM4), and Vera Rubin a 1.6T-class module whose exact type is unpublished (drawn as the 1.6T twin-port). */
export function moduleTier(accel) {
  const t = tierOf(accelOf(accel)) ?? 400, label = switchLabel(accel);
  if (t === 400) return { key: '800g', label, rate: '800G', port: '400G', lane: '100G', laneGbps: 100, part: 'MMS4X00', published: true };
  return { key: t === 800 ? '1.6t' : 'rubin', label, rate: '1.6T', port: '800G', lane: '200G', laneGbps: 200, part: t === 800 ? 'MMS4A00' : null, published: t === 800 };
}
/** Two printed lines: the form factor, then the rate and optics. */
export function labelLines(text) {
  const [form, ...rest] = text.split(' ');
  return rest.length ? [form, rest.join(' ')] : [form];
}
