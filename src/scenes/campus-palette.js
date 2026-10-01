// Material palettes: one draw where an assembly used to take one per finish.
// A Blender asset arrives with a handful of flat PBR finishes (enamel, galvanized steel, rubber, a lit fixture), and
// the Builder draws each as its own mesh, so a unit substation costs fourteen draw calls per pass. Where those
// finishes differ only in base color, roughness, metalness and emission, the values move onto the vertices and the
// parts share one material that reads them back: the same shading, one call. Anything else (a texture, a shader of
// its own, transparency, a clearcoat that differs) keeps its own material and its own draw, as before.
import * as THREE from 'three';

const PER_VERTEX = new Set(['uuid', 'name', 'color', 'roughness', 'metalness', 'emissive', 'emissiveIntensity']);
const plainPatch = THREE.Material.prototype.onBeforeCompile;
const keys = new WeakMap();
// the shading a palette cannot carry per vertex, as a key; null when the finish must keep its own material
function shadingKey(m) {
  if (keys.has(m)) return keys.get(m);
  let key = null;
  const eligible = (m.type === 'MeshStandardMaterial' || m.type === 'MeshPhysicalMaterial') && !m.transparent && !m.vertexColors &&
    m.onBeforeCompile === plainPatch && m.customProgramCacheKey === THREE.Material.prototype.customProgramCacheKey &&
    !Object.values(m).some(v => v?.isTexture);
  if (eligible) {
    const json = m.toJSON();
    for (const k of PER_VERTEX) delete json[k];
    delete json.metadata;
    key = JSON.stringify(json);
  }
  keys.set(m, key);
  return key;
}
const _c = new THREE.Color(), _e = new THREE.Color();
function paint(geo, m) {
  const n = geo.attributes.position.count, color = new Float32Array(n * 3), emissive = new Float32Array(n * 3), rm = new Float32Array(n * 2);
  _c.copy(m.color); _e.copy(m.emissive).multiplyScalar(m.emissiveIntensity);
  for (let i = 0; i < n; i++) {
    color[i * 3] = _c.r; color[i * 3 + 1] = _c.g; color[i * 3 + 2] = _c.b;
    emissive[i * 3] = _e.r; emissive[i * 3 + 1] = _e.g; emissive[i * 3 + 2] = _e.b;
    rm[i * 2] = m.roughness; rm[i * 2 + 1] = m.metalness;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
  geo.setAttribute('ifxEmissive', new THREE.BufferAttribute(emissive, 3));
  geo.setAttribute('ifxRM', new THREE.BufferAttribute(rm, 2));
}
function paletteMaterial(like) {
  const m = like.clone();
  m.name = 'Campus palette'; m.vertexColors = true;
  m.color.set(0xffffff); m.emissive.set(0x000000); m.emissiveIntensity = 1; m.roughness = 1; m.metalness = 1;
  m.userData = { ...like.userData, ifxPalette: true };
  m.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <color_pars_vertex>', '#include <color_pars_vertex>\nattribute vec3 ifxEmissive;\nattribute vec2 ifxRM;\nvarying vec3 vIfxEmissive;\nvarying vec2 vIfxRM;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvIfxEmissive = ifxEmissive;\nvIfxRM = ifxRM;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying vec3 vIfxEmissive;\nvarying vec2 vIfxRM;\nvoid main() {')
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vIfxEmissive;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vIfxRM.x;')    // palettes carry no maps
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vIfxRM.y;');
    if (!shader.fragmentShader.includes('vIfxRM.y;') || !shader.fragmentShader.includes('= vIfxEmissive;')) throw new Error('campus palette: shader hooks moved');
  };
  m.customProgramCacheKey = () => 'ifx-campus-palette';
  return m;
}
// Fold a Builder's compatible finishes into palettes, in place. Finishes that match the shading of no other part are
// left alone (a palette of one saves nothing). Returns the builder.
export function palette(builder) {
  const groups = new Map();
  for (const [mat, parts] of builder.parts) {
    const key = shadingKey(mat); if (key === null) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push([mat, parts]);
  }
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const pm = paletteMaterial(members[0][0]), merged = [];
    for (const [mat, parts] of members) {
      for (const g of parts) { paint(g, mat); merged.push(g); }
      builder.parts.delete(mat);
    }
    builder.parts.set(pm, merged);
  }
  return builder;
}
