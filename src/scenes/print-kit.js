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
 *   or { p, n: [nx, ny, nz] surface normal, up?: text-up direction, roll, size? }
 * lift: distance off the surface along its normal (scene units).
 */
export function printDecals(parent, { texture, size, placements, lift = 0, name = 'Printed labels', material = {} }) {
  if (!texture || !placements.length) return null;
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = printMaterial(texture, { name, ...material });
  const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
  const o = new THREE.Object3D(), n = new THREE.Vector3();
  const bx = new THREE.Vector3(), by = new THREE.Vector3(), up = new THREE.Vector3(), basis = new THREE.Matrix4();
  placements.forEach((pl, i) => {
    if (pl.n) {
      // Explicit surface normal: the print faces n, its text "up" follows world +y (or -z on a level face).
      n.set(...pl.n).normalize();
      up.set(...(pl.up || (Math.abs(n.y) > 0.95 ? [0, 0, -1] : [0, 1, 0])));
      bx.crossVectors(up, n).normalize(); by.crossVectors(n, bx);
      basis.makeBasis(bx, by, n); o.quaternion.setFromRotationMatrix(basis);
      if (pl.roll) o.rotateZ(pl.roll);
    } else {
      const face = pl.face || 'top', [rx, ry] = FACE[face], yaw = pl.yaw || 0;
      o.rotation.set(rx, ry + yaw, pl.roll || 0, 'YXZ');
      n.set(...NORMAL[face]).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    }
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

/** First visible mesh surface along a ray (world space), optionally filtered; null when nothing is hit. */
export function surfaceHit(root, from, dir, filter = () => true) {
  root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(...from), new THREE.Vector3(...dir).normalize());
  ray.camera = new THREE.PerspectiveCamera();   // sprites need one to raycast
  const shown = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  return ray.intersectObject(root, true).find(h => h.object.isMesh && !isPrinted(h.object) && shown(h.object) && filter(h.object)) || null;
}

/** A placement on the first surface hit along a ray: the print faces back along the ray. */
export function stick(root, from, dir, filter, extra = {}) {
  const hit = surfaceHit(root, from, dir, filter);
  if (!hit) return null;
  const d = new THREE.Vector3(...dir).normalize().negate(), p = hit.point.clone();
  // With a footprint, a sign spans ribs or seams: it sits on the outermost surface under its corners.
  if (extra.footprint) {
    const [w, h] = extra.footprint, up = new THREE.Vector3(...(Math.abs(d.y) > .95 ? [0, 0, -1] : [0, 1, 0]));
    const right = new THREE.Vector3().crossVectors(up, d).normalize(), top = new THREE.Vector3().crossVectors(d, right);
    const origin = new THREE.Vector3(...from);
    for (const [a, b] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5], [0, .5], [0, -.5], [-.5, 0], [.5, 0]]) {
      const o = origin.clone().addScaledVector(right, a * w).addScaledVector(top, b * h);
      const c = surfaceHit(root, o.toArray(), dir, filter);
      if (c) { const lift = c.point.clone().sub(p).dot(d); if (lift > 0 && lift < Math.max(w, h)) p.addScaledVector(d, lift); }
    }
  }
  const { footprint, ...rest } = extra;
  return { p: p.toArray(), n: d.toArray(), ...rest };
}

// ---------- sign and plate stock ----------
/** An engraved nameplate: brushed metal stock, a thin border and engraved lines. */
export function plateTexture(lines, { aspect = 2, px = 96, stock = '#c8ccd1', ink = '#1d2126', align = 'left' } = {}) {
  const h = pow2(Math.round(px * lines.length * 1.5)), w = pow2(h * aspect);
  return printTexture(w, h, (g, W, H) => {
    g.fillStyle = stock; g.fillRect(0, 0, W, H);
    g.globalAlpha = 0.08; g.fillStyle = '#000';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);             // brushed grain
    g.globalAlpha = 1;
    g.strokeStyle = '#6d737b'; g.lineWidth = Math.max(2, H * 0.03); g.strokeRect(H * 0.05, H * 0.05, W - H * 0.1, H - H * 0.1);
    for (const [x, y] of [[0.06, 0.12], [0.94, 0.12], [0.06, 0.88], [0.94, 0.88]]) {      // corner rivets
      g.fillStyle = '#8c929a'; g.beginPath(); g.arc(W * x, H * y, H * 0.035, 0, Math.PI * 2); g.fill();
    }
    drawLines(g, W, H, lines, { ink, align, pad: 0.12, gap: 0.06 });
  });
}

/** A yellow safety sign: a hazard triangle with a lightning bolt beside one or two lines of text. No figures. */
export function warningTexture(lines, { aspect = 2.4, px = 96 } = {}) {
  const h = pow2(Math.round(px * 2.6)), w = pow2(h * aspect);
  return printTexture(w, h, (g, W, H) => {
    g.fillStyle = '#f2c230'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#141414'; g.lineWidth = H * 0.05; g.strokeRect(H * 0.05, H * 0.05, W - H * 0.1, H - H * 0.1);
    const s = H * 0.62, cx = H * 0.5, cy = H * 0.52;
    g.fillStyle = '#141414'; g.beginPath(); g.moveTo(cx, cy - s * 0.55); g.lineTo(cx + s * 0.55, cy + s * 0.42); g.lineTo(cx - s * 0.55, cy + s * 0.42); g.closePath(); g.fill();
    g.fillStyle = '#f2c230'; g.beginPath(); g.moveTo(cx, cy - s * 0.36); g.lineTo(cx + s * 0.4, cy + s * 0.32); g.lineTo(cx - s * 0.4, cy + s * 0.32); g.closePath(); g.fill();
    g.fillStyle = '#141414'; g.beginPath();                                                    // lightning bolt
    g.moveTo(cx + s * 0.06, cy - s * 0.24); g.lineTo(cx - s * 0.12, cy + s * 0.06); g.lineTo(cx + s * 0.0, cy + s * 0.06);
    g.lineTo(cx - s * 0.07, cy + s * 0.28); g.lineTo(cx + s * 0.13, cy - s * 0.02); g.lineTo(cx + s * 0.01, cy - s * 0.02); g.closePath(); g.fill();
    g.save(); g.translate(H * 0.95, 0);
    drawLines(g, W - H * 1.0, H, lines, { ink: '#141414', align: 'left', pad: 0.03, gap: 0.08 });
    g.restore();
  });
}

/** Stencilled text straight on a surface (paint, no stock): transparent ground. */
export function stencilTexture(lines, { aspect = 4, px = 96, ink = '#e9e6dc', align = 'center' } = {}) {
  return textTexture(lines, { px, aspect, ink, align, pad: 0.04 });
}

// ---------- pipe markers ----------
/**
 * A pipe marker band, ASME A13.1 style: coloured ground, a line of text and a flow arrow (pointing +u, or -u with
 * flow -1). The texture spans the band's length (u) by half the pipe's circumference (v; it repeats twice round),
 * so pass the band length, the pipe radius and the letter height in scene units to keep the letters in proportion.
 */
export function pipeMarkerTexture(text, { length, radius, letter, ground = '#00824a', ink = '#ffffff', flow = 1, px = 1024 } = {}) {
  const half = Math.PI * radius, H = pow2(px), W = pow2(H * length / half), frac = letter / half;
  return printTexture(W, H, (g, w, h) => {
    g.fillStyle = ground; g.fillRect(0, 0, w, h);
    const t = h * frac, a = t * 1.25, cy = h / 2;   // arrow head as tall as 1.25 letters
    const ax = flow > 0 ? w - t * 0.6 : t * 0.6, sgn = flow > 0 ? 1 : -1;
    g.fillStyle = ink; g.beginPath(); g.moveTo(ax, cy); g.lineTo(ax - sgn * a * 0.8, cy - a / 2); g.lineTo(ax - sgn * a * 0.8, cy - a / 5);
    g.lineTo(ax - sgn * a * 2.0, cy - a / 5); g.lineTo(ax - sgn * a * 2.0, cy + a / 5); g.lineTo(ax - sgn * a * 0.8, cy + a / 5); g.lineTo(ax - sgn * a * 0.8, cy + a / 2); g.closePath(); g.fill();
    const room = w - a * 2.4 - t * 0.6, x0 = flow > 0 ? 0 : w - room;
    g.font = `700 ${t * 1.3}px ${SANS}`; g.textBaseline = 'middle'; g.textAlign = 'center';
    const m = g.measureText(text).width, k = Math.min(1, room * 0.92 / m);
    g.save(); g.translate(x0 + room / 2, cy); g.scale(k, 1); g.fillText(text, 0, 0); g.restore();
  });
}

/**
 * Bands wrapped on round pipes. placements: [{ p: centre on the pipe axis, axis: [x, y, z] (the way the text reads) }];
 * the flow arrow's direction is in the texture (pipeMarkerTexture flow).
 * The band's text reads along the flow; the texture repeats twice round the pipe so it reads from either side.
 */
export function pipeMarkers(parent, { texture, radius, length, placements, name = 'Pipe markers', segments = 32 }) {
  if (!texture || !placements.length) return null;
  const pos = [], uv = [], idx = [];
  for (let k = 0; k <= segments; k++) {
    const t = k / segments * Math.PI * 2 - Math.PI / 2;   // the texture's middle (v = 0.5) faces +z, and -z
    for (const s of [0, 1]) { pos.push((s - 0.5), Math.sin(t), Math.cos(t)); uv.push(s, k / segments * 2); }
  }
  for (let k = 0; k < segments; k++) { const a = k * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  texture.wrapT = THREE.RepeatWrapping;
  const mat = printMaterial(texture, { name, roughness: .5 });
  mat.side = THREE.FrontSide;
  const mesh = new THREE.InstancedMesh(geo, mat, placements.length);
  const o = new THREE.Object3D(), X = new THREE.Vector3(1, 0, 0);
  placements.forEach((pl, i) => {
    o.position.set(...pl.p); o.quaternion.setFromUnitVectors(X, new THREE.Vector3(...pl.axis).normalize());
    if (pl.spin) o.rotateX(pl.spin);
    o.scale.set(pl.length || length, pl.radius || radius, pl.radius || radius); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere?.();
  mesh.name = name; mesh.userData.printed = true; mesh.castShadow = false; mesh.receiveShadow = true; mesh.renderOrder = 1;
  parent.add(mesh);
  return mesh;
}
