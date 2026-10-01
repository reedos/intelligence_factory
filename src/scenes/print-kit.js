// Printed surface marks: lid labels, nameplates, signs and pipe markers drawn as thin decals on the surfaces
// that carry them. Each decal is a transparent, depth-test-only quad lifted a hair off its surface with a
// polygon offset, so it never z-fights the face below and never occludes anything behind it. The print is
// lit like the surface (a standard material), mip-mapped so it softens to a quiet tone at overview distance,
// and sharp enough to read in close-ups. Every decal mesh carries userData.printed so Blender reference
// export and authored-hardware swaps leave it alone.
import { THREE } from '../kit.js';

export const SANS = '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif';
export const MONO = '"IBM Plex Mono", Menlo, Consolas, monospace';
export const hasDom = () => typeof document !== 'undefined' && typeof document.createElement === 'function';

/** A canvas texture drawn by `draw(g, w, h)`; null where there is no DOM (tests). */
export function printTexture(w, h, draw) {
  if (!hasDom()) return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (!g) return null;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.userData = { redraw: fn => { g.clearRect(0, 0, w, h); fn(g, w, h); t.needsUpdate = true; } };
  return t;
}

/**
 * Text lines on a transparent ground. lines: [{ text, size (fraction of height), weight, font, color }] or strings.
 * align 'left' | 'center'. Optional plate: a background fill (e.g. sign or nameplate stock) with optional border.
 */
export function drawLines(g, w, h, lines, { ink = '#30353c', align = 'left', pad = 0.06, plate = null, border = null, gap = 0.1 } = {}) {
  if (plate) { g.fillStyle = plate; g.fillRect(0, 0, w, h); }
  if (border) { g.strokeStyle = border; g.lineWidth = Math.max(2, h * 0.04); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth); }
  const items = lines.map(l => (typeof l === 'string' ? { text: l } : l));
  const sizes = items.map(l => (l.size ?? 0.8 / items.length) * h);
  const total = sizes.reduce((a, b) => a + b, 0) + gap * h * (items.length - 1);
  let y = (h - total) / 2;
  g.textBaseline = 'top';
  items.forEach((l, i) => {
    let px = sizes[i];
    g.font = `${l.weight || 600} ${px}px ${l.font || SANS}`;
    const maxW = w * (1 - pad * 2);
    const measured = g.measureText(l.text).width;
    if (measured > maxW) { px *= maxW / measured; g.font = `${l.weight || 600} ${px}px ${l.font || SANS}`; }
    g.fillStyle = l.color || ink;
    g.textAlign = align;
    const x = align === 'center' ? w / 2 : w * pad;
    g.fillText(l.text, x, y + (sizes[i] - px) / 2);
    y += sizes[i] + gap * h;
  });
}

export function textTexture(lines, { px = 64, aspect = 4, ...opts } = {}) {
  const h = Math.max(32, Math.round(px * Math.max(1, lines.length) * 1.35)), w = Math.round(h * aspect);
  return printTexture(pow2(w), pow2(h), (g, W, H) => drawLines(g, W, H, lines, opts));
}
const pow2 = v => 2 ** Math.round(Math.log2(Math.min(4096, Math.max(16, v))));

export function printMaterial(map, { color = 0xffffff, roughness = 0.62, metalness = 0, emissive = 0, emissiveIntensity = 0, opacity = 1, name = 'Printed mark' } = {}) {
  const m = new THREE.MeshStandardMaterial({ map, color, roughness, metalness, transparent: true, opacity, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, alphaTest: 0.02 });
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emissiveIntensity; m.emissiveMap = map; }
  m.name = name;
  return m;
}

// Face normals: which way the printed side looks. Text "up" on a top face points away (-z) at yaw 0, so a
// viewer standing on +z reads it upright; front faces read upright with +y up.
const FACE = {
  top: [-Math.PI / 2, 0], bottom: [Math.PI / 2, 0], front: [0, 0], back: [0, Math.PI],
  right: [0, Math.PI / 2], left: [0, -Math.PI / 2],
};
const NORMAL = { top: [0, 1, 0], bottom: [0, -1, 0], front: [0, 0, 1], back: [0, 0, -1], right: [1, 0, 0], left: [-1, 0, 0] };

/**
 * One instanced decal per placement, sharing one texture.
 * placements: [{ p: [x, y, z] on the surface, face: 'top'|'front'|..., yaw (radians, about +y), roll, size?: [w, h] }]
 * lift: distance off the surface along its normal (scene units).
 */
export function printDecals(parent, { texture, size, placements, lift = 0, name = 'Printed labels', material = {} }) {
  if (!texture || !placements.length) return null;
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = printMaterial(texture, { name, ...material });
  const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
  const o = new THREE.Object3D(), n = new THREE.Vector3();
  placements.forEach((pl, i) => {
    const face = pl.face || 'top', [rx, ry] = FACE[face], yaw = pl.yaw || 0;
    o.rotation.set(rx, ry + yaw, pl.roll || 0, 'YXZ');
    n.set(...NORMAL[face]).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    o.position.set(...pl.p).addScaledVector(n, pl.lift ?? lift);
    const [w, h] = pl.size || size;
    o.scale.set(w, h, 1);
    o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere?.();
  mesh.name = name; mesh.userData.printed = true;
  mesh.castShadow = false; mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  parent.add(mesh);
  return mesh;
}

/** True for decals added by printDecals (skip them where static hardware is collected or replaced). */
export const isPrinted = o => !!o?.userData?.printed;
