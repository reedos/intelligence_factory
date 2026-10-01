// Studio finish for the representative Blender module. This changes illumination
// and material response only: no geometry, physical connections, or signal colors.
import { THREE } from './side-kit.js';
import { moduleLabel } from './lid-labels.js';

export const MODULE_LOOK = Object.freeze({
  env: 'studio',
  envIntensity: 0.82,
  exposure: 1.0,
  bloom: 0.46,
  threshold: 1.65,
  ao: 0.1,
  dof: true,
});

// These names are authored in create_scene.py and survive the runtime export.
// Unknown materials keep their original appearance so additions fail visibly
// rather than silently inheriting the wrong physical treatment.
const FINISHES = [
  [/Satin nickel aluminium/i, { metalness: 0.84, roughness: 0.58, envMapIntensity: 0.9 }],
  // Studio light panels mirrored in glossier shell chamfers read as rows of glowing beads.
  [/Machined edge highlights/i, { metalness: 0.94, roughness: 0.42, envMapIntensity: 0.7 }],
  [/Dark anodized metal/i, { metalness: 0.75, roughness: 0.34, envMapIntensity: 0.85 }],
  [/Midnight green solder mask/i, { metalness: 0.06, roughness: 0.4, envMapIntensity: 0.55 }],
  [/Gold contacts and wire bonds/i, { metalness: 0.86, roughness: 0.27, envMapIntensity: 0.85 }],
  [/Copper circuitry/i, { metalness: 0.78, roughness: 0.34, envMapIntensity: 0.8 }],
  [/Molded packages/i, { metalness: 0.02, roughness: 0.46, envMapIntensity: 0.55 }],
  [/Bare silicon/i, { metalness: 0.6, roughness: 0.25, envMapIntensity: 0.7 }],
  [/Silkscreen|Label stock/i, { metalness: 0, roughness: 0.68, envMapIntensity: 0.35 }],
  [/Connector ferrule/i, { metalness: 0, roughness: 0.48, envMapIntensity: 0.45 }],
  // Receptacle bodies: a charcoal glass-filled moulding with a soft sheen, so their
  // walls, latch arms and openings separate from the black void at overview distance.
  [/Molded optical ports/i, { metalness: 0, roughness: 0.42, envMapIntensity: 0.9 }],
  [/Pull tab ochre/i, { metalness: 0.02, roughness: 0.4, envMapIntensity: 0.6 }],
  [/TX optical paths/i, { metalness: 0, roughness: 0.29, envMapIntensity: 0.6, emissiveIntensity: 0.12 }],
  [/RX optical paths/i, { metalness: 0, roughness: 0.29, envMapIntensity: 0.6, emissiveIntensity: 0.12 }],
  [/Laser carrier paths/i, { metalness: 0, roughness: 0.29, envMapIntensity: 0.6, emissiveIntensity: 0.14 }],
  [/Thermal interface pad/i, { metalness: 0, roughness: 0.85, envMapIntensity: 0.35 }],
];

// Silicone gap pads have a fine orange-peel surface. A tileable canvas normal
// map adds it without textures in the asset; skipped where no DOM exists (tests).
function orangePeelNormal() {
  if (typeof document === 'undefined') return null;
  const n = 128, h = new Float32Array(n * n);
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 260; k++) {
    const cx = rand() * n, cy = rand() * n, r = 2 + rand() * 4, a = 0.4 + rand() * 0.6;
    for (let y = -8; y <= 8; y++) for (let x = -8; x <= 8; x++) {
      const d = (x * x + y * y) / (r * r);
      if (d < 3) h[((Math.floor(cy) + y + n) % n) * n + ((Math.floor(cx) + x + n) % n)] += a * Math.exp(-d);
    }
  }
  const c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n), at = (x, y) => h[((y + n) % n) * n + ((x + n) % n)];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 0.9, dy = (at(x, y + 1) - at(x, y - 1)) * 0.9;
    const l = Math.hypot(dx, dy, 1), i = (y * n + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255;
    img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); t.anisotropy = 4;
  return t;
}

// Representative cover label, printed as a texture on the authored label plate:
// the scenario's switch-side module, as the hall prints it (OSFP 800G 2xDR4, OSFP 1.6T 2xDR4 or,
// for Vera Rubin, OSFP 1.6T), and the LPO view adds "LPO" the way vendors name linear-drive
// modules (lid-labels.js). Not a vendor label.
function drawLabel(g, w, h, text) {
  g.fillStyle = '#e9e8e2'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#16181c'; g.textBaseline = 'alphabetic';
  g.font = '600 150px "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif'; g.fillText('OSFP', 70, 200);
  const [, rate] = text.match(/^OSFP (.*)$/);
  g.font = '500 92px "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif'; g.fillText(rate, 70, 330);
  g.font = '500 44px "IBM Plex Mono", Menlo, Consolas, monospace'; g.fillText('DESIGN STUDY · REPRESENTATIVE', 72, 410);
  // Evenly weighted bars from a fixed sequence; no encoded data.
  let x = 70, seed = 11;
  const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  while (x < 690) { const bar = 5 + Math.floor(rand() * 3) * 5; g.fillRect(x, 480, bar, 250); x += bar + 5 + Math.floor(rand() * 3) * 5; }
  // A 2D code block: a finder square in three corners plus a fixed pattern.
  const cx = 740, cy = 480, cell = 12, n = 21;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const finder = (a, b) => i >= a && i < a + 7 && j >= b && j < b + 7;
    const f = finder(0, 0) || finder(0, n - 7) || finder(n - 7, 0);
    const ring = f && ((i % (n - 7)) === 1 || (j % (n - 7)) === 1 || (i % (n - 7)) === 5 || (j % (n - 7)) === 5) && !((i % (n - 7)) >= 2 && (i % (n - 7)) <= 4 && (j % (n - 7)) >= 2 && (j % (n - 7)) <= 4);
    if (f ? !ring : rand() < 0.48) g.fillRect(cx + i * cell, cy + j * cell, cell, cell);
  }
}
function labelTexture(accel) {
  if (typeof document === 'undefined') return null;
  const w = 1024, h = 840, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  drawLabel(g, w, h, moduleLabel(accel, false));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.userData.text = moduleLabel(accel, false);
  t.userData.setLpo = lpo => { t.userData.text = moduleLabel(accel, !!lpo); drawLabel(g, w, h, t.userData.text); t.needsUpdate = true; };
  return t;
}
function printLabel(mesh, accel) {
  const tex = labelTexture(accel);
  if (!tex) return;
  const geometry = mesh.geometry, position = geometry.attributes.position;
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox, uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = (position.getX(i) - min.x) / (max.x - min.x);
    uv[i * 2 + 1] = 1 - (position.getZ(i) - min.z) / (max.z - min.z);
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  mesh.material.map = tex; mesh.material.color.set(0xffffff); mesh.material.needsUpdate = true;
  return tex;
}

/** Apply only to a build-owned clone, never the cached glTF source. */
export function applyArtDirection({ scene, model, quality = {}, accel }) {
  const seen = new Set();
  model.traverse(object => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material?.isMeshStandardMaterial || seen.has(material)) continue;
      seen.add(material);
      const finish = FINISHES.find(([pattern]) => pattern.test(material.name));
      if (finish) Object.assign(material, finish[1]);
      if (/Molded optical ports/i.test(material.name)) material.color.set(0x4b5059);
      if (/Thermal interface pad/i.test(material.name) && !material.normalMap) {
        const peel = orangePeelNormal();
        if (peel) { material.normalMap = peel; material.normalScale.set(0.3, 0.3); material.needsUpdate = true; }
      }
      if (quality.mobile && /Satin nickel aluminium|Machined edge highlights/i.test(material.name)) material.roughness = Math.max(material.roughness, 0.42);
    }
  });

  const labels = [];
  model.traverse(object => { if (object.isMesh && /Label stock/i.test(object.material?.name || '')) { const t = printLabel(object, accel); if (t) labels.push(t); } });

  // Preserve setup()'s one shadow map. The studio environment supplies broad
  // softbox reflections; these lights illuminate the board and expose bevels.
  const hemisphere = scene.children.find(object => object.isHemisphereLight);
  if (hemisphere) {
    hemisphere.color.set(0xcbd6e6);
    hemisphere.groundColor.set(0x171e27);
    hemisphere.intensity = 0.65;
  }
  const directional = scene.children.filter(object => object.isDirectionalLight && !object.userData.moduleStudioFill);
  const [key, rim] = directional;
  if (key) {
    key.color.set(0xfff4e6);
    key.intensity = 2.15;
    key.position.set(-3, 11, 7);
    key.target.position.set(0, 2, 0);
    if (!key.target.parent) scene.add(key.target);
    // Centimeter scene: avoid detached shadows on tiny bonds and passives.
    key.shadow.normalBias = 0.004;
    key.shadow.bias = -0.00015;
  }
  if (rim) {
    rim.color.set(0xa9c9f5);
    rim.intensity = 1.4;
    rim.position.set(4, 7, -6);
    rim.target.position.set(0, 2, 0);
    if (!rim.target.parent) scene.add(rim.target);
  }
  let fill = scene.children.find(object => object.userData.moduleStudioFill);
  if (!fill) {
    fill = new THREE.DirectionalLight(0xd7e5f3, 0.42);
    fill.name = 'Module studio front fill';
    fill.userData.moduleStudioFill = true;
    fill.position.set(7, 3, 8);
    fill.target.position.set(1, 1.5, 0);
    scene.add(fill, fill.target);
  }
  // No extra shadow or transparency passes on either desktop or mobile.
  fill.castShadow = false;
  scene.background = new THREE.Color(0x070b12);
  scene.userData.moduleArtDirection = 'studio-v2';
  return { setLabelLpo: lpo => labels.forEach(t => t.userData.setLpo(lpo)), labelText: () => labels[0]?.userData.text, ...MODULE_LOOK, bloom: quality.mobile ? 0.28 : MODULE_LOOK.bloom,
    envIntensity: quality.mobile ? 0.65 : MODULE_LOOK.envIntensity,
    dof: !quality.mobile && quality.dof !== false };
}
