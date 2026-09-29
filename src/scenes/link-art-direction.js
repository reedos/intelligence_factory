// Presentation only. Native signal paths, physical dimensions and part anchors
// remain authoritative. Material clones prevent edits leaking to other scenes.
import { THREE, MAT } from './side-kit.js';
import { surfaceDetail } from '../kit.js';
import { applyArtDirection } from './module-art-direction.js';

function finishCaption(sprite) {
  const { text, color, height } = sprite.userData.caption;
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  const font = '500 44px "IBM Plex Sans", system-ui, sans-serif';
  ctx.font = font;
  canvas.width = Math.ceil(ctx.measureText(text).width) + 24; canvas.height = 72;
  ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#050910'; ctx.shadowBlur = 8;
  ctx.fillText(text, 12, 36);
  sprite.material.map.dispose();
  sprite.material.map = new THREE.CanvasTexture(canvas);
  sprite.material.map.colorSpace = THREE.SRGBColorSpace;
  sprite.material.toneMapped = false;
  sprite.material.needsUpdate = true;
  sprite.scale.set(canvas.width / 72 * height, height, 1);
}

export function directLink({ built, model, kind, quality, state }) {
  const local = new Map();
  const shared = new Set(Object.values(MAT));
  const copy = original => {
    if (!original?.isMeshStandardMaterial) return original;
    if (local.has(original)) return local.get(original);
    const m = shared.has(original) ? original.clone() : original;
    // Native shared materials carry scene-scale detail shaders. Re-author only
    // these local copies at centimeter scale, without invented circuit traces.
    if (original === MAT.pcb || original === MAT.pcbBlack) {
      m.color.set(original === MAT.pcb ? 0x123d36 : 0x171f28);
      m.metalness = .08; m.roughness = .43; m.envMapIntensity = .65;
      surfaceDetail(m, { meters: .003, amount: .025, roughness: .08 });
    } else if (original === MAT.copper || original === MAT.gold) {
      m.color.set(original === MAT.copper ? 0xc48b54 : 0xd9b875);
      m.metalness = .8; m.roughness = .3; m.envMapIntensity = .85;
    }
    if (/nickel|aluminium|retainer|machined|satin/i.test(m.name) && !m.transparent) {
      m.metalness = .82; m.roughness = quality.mobile ? .4 : .3; m.envMapIntensity = .95;
      surfaceDetail(m, { pattern: 'brushed', meters: .018, amount: .035, roughness: .065 });
    }
    local.set(original, m); return m;
  };
  built.scene.traverse(o => { if (o.material) o.material = Array.isArray(o.material) ? o.material.map(copy) : copy(o.material); });
  built.look = { ...applyArtDirection({ scene: built.scene, model, quality }), grain: .003, vignette: .14, ao: kind === 'cpo' ? .16 : .1 };
  built.scene.userData.linkArtDirection = 'studio-v1';
  // A brighter moving core carries the spectacle; stationary conductors remain
  // restrained and preserve their electrical versus optical distinction.
  for (const f of [...built.flows, ...built.dataFlows, ...built.heatFlows]) {
    f.size *= 1.18;
    f.base.color.multiplyScalar(1.45);
    f.mesh.material.color.copy(f.base.color);
  }
  const captions = built.scene.children.filter(o => o.isSprite && o.userData.caption);
  captions.forEach(sprite => {
    if (kind === 'cpo') sprite.userData.caption.height *= 1.4;
    finishCaption(sprite);
  });
  const essential = /representative|Footprint to scale|Size and layout|Detail ·|bonded|x-ray|shields opened|DAC ·|ACC ·|AEC ·|Coherent pluggable|Co-packaged optics ·|Copper cables ·/i;
  let annotations = false;
  built.inspection = {
    get annotations() { return annotations; },
    setAnnotations(value) { annotations = !!value; },
  };
  const update = built.update;
  built.update = (t, dt) => {
    const changed = update(t, dt);
    for (const sprite of captions) {
      const text = sprite.userData.caption.text;
      sprite.visible = annotations || (!state.selected && essential.test(text));
    }
    return changed;
  };
  built.update(0, 0);
}
