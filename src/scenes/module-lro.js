// The module side level's three receive/transmit architectures, shared by the authored (Blender) and the native module:
//   dsp  a full DSP retimes both directions
//   lro  half-retimed (LRO / RTLR / TRO): the DSP retimes transmit only; receive runs linear, TIA straight to the host
//   lpo  linear pluggable: no module DSP, both directions linear
// The LRO drawing reuses the full-DSP package and the LPO module's receive copper; it is representative (evidence.js
// 'module-lro-drawing'). Sources: OIF RTLR announcement, LPO MSA FAQ, Marvell Ara T, Credo Dove 850, Semtech.
import { THREE, canvasTex } from './side-kit.js';

export const MODULE_VARIANTS = ['dsp', 'lro', 'lpo'];
export const LRO_COLOR = '#c4a8ff';

// Whether a flow belongs on screen in this variant. `owner` is the variant whose layout the flow follows ('dsp' for
// the paths through the DSP, 'lpo' for the direct host routing, 'common' otherwise) and `rx` its direction. LRO keeps
// the DSP's transmit paths and the linear receive paths.
export function inVariant(kind, owner, rx) {
  if (owner === 'common' || !owner) return true;
  if (kind === 'lro') return owner === 'dsp' ? !rx : rx;
  return owner === kind;
}

// Split one merged copper mesh into its two halves by triangle centroid: transmit lanes sit at +z, receive at -z
// (verified against the exported routes: TX z ≥ 0.07 cm, RX z ≤ -0.06 cm). Both halves share the source attributes
// and material and sit beside the untouched source mesh under its parent, hidden: LRO shows one half in place of the
// source, so the parent's visibility still governs both and the draw-call count does not change.
export function splitByZ(mesh) {
  const geo = mesh.geometry, pos = geo.attributes.position;
  const index = geo.index ? geo.index.array : Array.from({ length: pos.count }, (_, i) => i);
  const tx = [], rx = [];
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], c = index[t + 2];
    ((pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3 >= 0 ? tx : rx).push(a, b, c);
  }
  const half = (list, name) => {
    const g = new THREE.BufferGeometry();
    for (const [k, v] of Object.entries(geo.attributes)) g.setAttribute(k, v);
    g.setIndex(list); g.boundingBox = null; g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mesh.material);
    Object.assign(m, { name, castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow });
    m.position.copy(mesh.position); m.quaternion.copy(mesh.quaternion); m.scale.copy(mesh.scale);
    return m;
  };
  const halves = { source: mesh, tx: half(tx, `${mesh.name} · TX`), rx: half(rx, `${mesh.name} · RX`) };
  halves.tx.visible = halves.rx.visible = false;
  mesh.parent.add(halves.tx, halves.rx);
  return halves;
}

// The die-top marking a transmit-only retimer gets in this drawing: the transmit half lit and named, the receive half
// hatched and dark. The texture's bottom edge faces +z (the transmit lanes, toward the default camera).
export function lroDieTop({ w, d, lanes = '8 × 200G' }) {
  const tex = canvasTex(512, 512, (g, W, H) => {
    g.fillStyle = '#20283a'; g.fillRect(0, 0, W, H);
    // receive half (far, -z): no DSP processing on this side
    g.save(); g.beginPath(); g.rect(0, 0, W, H / 2); g.clip();
    g.strokeStyle = 'rgba(196,168,255,0.28)'; g.lineWidth = 6;
    for (let x = -H; x < W; x += 34) { g.beginPath(); g.moveTo(x, H / 2); g.lineTo(x + H / 2, 0); g.stroke(); }
    g.restore();
    g.fillStyle = 'rgba(8,10,16,0.62)'; g.fillRect(70, 112, W - 140, 64);
    g.fillStyle = '#cdbbff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 40px monospace'; g.fillText('RX · NO DSP', W / 2, 146);
    // the divide
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, H / 2 - 3, W, 6);
    // transmit half (near, +z): the retimer
    const grad = g.createLinearGradient(0, H / 2, 0, H); grad.addColorStop(0, '#2c4a3a'); grad.addColorStop(1, '#1f3329');
    g.fillStyle = grad; g.fillRect(0, H / 2 + 3, W, H / 2 - 3);
    g.fillStyle = '#e9ffe0'; g.font = 'bold 50px monospace'; g.fillText('TX RETIMER', W / 2, H * 0.66);
    g.fillStyle = '#a6f35a'; g.font = 'bold 38px monospace'; g.fillText(lanes, W / 2, H * 0.83);
  });
  tex.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.38, metalness: 0.35, envMapIntensity: 0.4,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.32, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  top.rotation.x = -Math.PI / 2; top.name = 'LRO transmit-only DSP marking';
  return top;
}

// What the panel says in the half-retimed view. Spec rows stay those of the full card (their evidence chips are keyed
// by position), so only titles, kickers and bodies change.
export function lroIntro(mode) {
  return {
    data: 'Half-retimed (LRO): the DSP stays, but only on transmit. Host lanes enter it, are retimed, and leave for the driver and modulators. On receive there is no DSP: the TIA’s output runs straight to the host, whose own signal processing does the receive work. Internal placement and routing are representative.',
    power: 'Half-retimed (LRO): the DSP keeps its power branch, but retimes transmit only. The driver, TIA, laser sources and power conversion are unchanged. Semtech puts such modules at about 16 W at 200G per lane, between full-DSP and LPO modules. Arrows show the functional power path, not a board routing design.',
    heat: 'Half-retimed (LRO): the transmit-only DSP still makes heat under its gap pad, but it retimes one direction instead of two; fewer arrows leave it: three of six, on the site’s log heat scale. The driver, TIA and laser sources are unchanged.',
  }[mode];
}
export function lroPartCopy(part, mode) {
  if (part.id === 'dsp') return { ...part, title: 'DSP, transmit only', kicker: 'Half-retimed (LRO)',
    body: mode === 'data'
      ? 'In this half-retimed (LRO) view the DSP retimes and equalizes the eight transmit lanes only, then feeds the driver. Receive lanes skip it: the TIA drives the host directly, and the host’s own signal processing does what a receive DSP did. The OIF calls this a retimed-transmitter, linear-receiver (RTLR) link; the LPO MSA marks such modules “-LRO”. Drawn on the same package, its receive half hatched; a real transmit-only DSP is its own chip.'
      : mode === 'heat'
        ? 'A transmit-only DSP still sits under the gap pad and still makes heat, but it retimes one direction instead of two. Credo claims up to 50% less DSP power for its LRO DSP; Semtech puts LRO modules near 16 W against 23–25 W for full-DSP modules at 200G per lane.'
        : 'Only the transmit path is retimed. Credo claims up to 50% less DSP power for its LRO DSP. Semtech puts LRO modules near 16 W, against 23–25 W for full-DSP modules and a 10 W LPO target, at 200G per lane. Marvell’s Ara T, which Marvell calls the first 8 × 200G transmit-retimed optics (TRO) DSP, began sampling to customers in Q1 2026.' };
  if (part.id === 'tia') return { ...part, body: 'The transimpedance amplifier turns each photodiode’s current into a voltage. In this half-retimed (LRO) view it sends that voltage straight to the host over the linear receive copper, as in an LPO module; the host’s own signal processing recovers the data.' };
  if (part.id === 'dcdc') return { ...part, body: 'The host supplies one voltage. Small converters on the module make the rails for the transmit-only DSP, the driver, the TIA and the lasers.' };
  return part;
}

// A die-top capacity marking printed on a transparent plane, for a scenario whose module rate differs from the one
// modeled into the asset (DSP / 8 × 200G / 1.6T): the 800G twin-port's DSP reads DSP / 8 × 100G / 800G. The
// texture's top edge faces -z, as the modeled text reads.
export function dspMarkingTop({ w, d, lines }) {
  const W = 512, H = Math.max(64, Math.round(512 * d / w));
  const tex = canvasTex(W, H, (g, cw, ch) => {
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = '#e4e8ee'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const px = Math.floor(Math.min(ch / (lines.length * 1.2), cw / 6.2));
    g.font = `bold ${px}px monospace`;
    lines.forEach((t, i) => g.fillText(t, cw / 2, ch / 2 + (i - (lines.length - 1) / 2) * px * 1.15));
  });
  tex.anisotropy = 8;
  const material = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.5, metalness: 0,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.15, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  top.rotation.x = -Math.PI / 2; top.name = 'DSP capacity marking';
  top.userData.capacityMarking = lines.join('\n');
  return top;
}
