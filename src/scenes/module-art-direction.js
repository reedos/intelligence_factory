// Studio finish for the representative Blender module. This changes illumination
// and material response only: no geometry, physical connections, or signal colors.
import { THREE } from './side-kit.js';

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
  [/Satin nickel aluminium/i, { metalness: 0.84, roughness: 0.34, envMapIntensity: 0.9 }],
  [/Machined edge highlights/i, { metalness: 0.94, roughness: 0.23, envMapIntensity: 1.0 }],
  [/Dark anodized metal/i, { metalness: 0.75, roughness: 0.34, envMapIntensity: 0.85 }],
  [/Midnight green solder mask/i, { metalness: 0.06, roughness: 0.4, envMapIntensity: 0.55 }],
  [/Gold contacts and wire bonds/i, { metalness: 0.86, roughness: 0.27, envMapIntensity: 0.85 }],
  [/Copper circuitry/i, { metalness: 0.78, roughness: 0.34, envMapIntensity: 0.8 }],
  [/Molded packages/i, { metalness: 0.02, roughness: 0.46, envMapIntensity: 0.55 }],
  [/Bare silicon/i, { metalness: 0.6, roughness: 0.25, envMapIntensity: 0.7 }],
  [/Silkscreen|Label stock/i, { metalness: 0, roughness: 0.68, envMapIntensity: 0.35 }],
  [/Connector ferrule/i, { metalness: 0, roughness: 0.48, envMapIntensity: 0.45 }],
  [/Molded optical ports/i, { metalness: 0, roughness: 0.55, envMapIntensity: 0.45 }],
  [/Pull tab ochre/i, { metalness: 0.02, roughness: 0.4, envMapIntensity: 0.6 }],
  [/TX optical paths/i, { metalness: 0, roughness: 0.29, envMapIntensity: 0.6, emissiveIntensity: 0.12 }],
  [/RX optical paths/i, { metalness: 0, roughness: 0.29, envMapIntensity: 0.6, emissiveIntensity: 0.12 }],
  [/Laser carrier paths/i, { metalness: 0, roughness: 0.29, envMapIntensity: 0.6, emissiveIntensity: 0.14 }],
  [/Thermal interface pad/i, { metalness: 0, roughness: 0.8, envMapIntensity: 0.3 }],
];

/** Apply only to a build-owned clone, never the cached glTF source. */
export function applyArtDirection({ scene, model, quality = {} }) {
  const seen = new Set();
  model.traverse(object => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material?.isMeshStandardMaterial || seen.has(material)) continue;
      seen.add(material);
      const finish = FINISHES.find(([pattern]) => pattern.test(material.name));
      if (finish) Object.assign(material, finish[1]);
      if (quality.mobile && /Satin nickel aluminium|Machined edge highlights/i.test(material.name)) material.roughness = Math.max(material.roughness, 0.42);
    }
  });

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
  return { ...MODULE_LOOK, bloom: quality.mobile ? 0.28 : MODULE_LOOK.bloom,
    envIntensity: quality.mobile ? 0.65 : MODULE_LOOK.envIntensity,
    dof: !quality.mobile && quality.dof !== false };
}
