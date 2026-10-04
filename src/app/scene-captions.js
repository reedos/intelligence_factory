// In-scene captions as page text. The side levels (module, CPO, coherent, copper) print their captions as sprites sized
// in world units, which land at 5 px type at the overview camera. Each such sprite (userData.caption = { text, color,
// height }) is hidden as a mesh and drawn as a DOM label at 11 px (12 px for a headline) instead, at the sprite's
// projected place; a label nudged off any pin, label, title or button it would cover, or left out if no place is clear.
import { overlapsRect } from './pin-layout.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
// the first of a few places down and up from (cx, cy) where a w x h box is clear of every obstacle, kept inside the view
export function placeCaption(cx, cy, w, h, obstacles, cw, ch, steps = [0, 14, -14, 28, -28, 42, -42, 56, -56, 70, -70]) {
  for (const dy of steps) {
    const left = clamp(cx - w / 2, 8, Math.max(8, cw - w - 8)), top = clamp(cy + dy - h / 2, 8, Math.max(8, ch - h - 8));
    const box = { left, right: left + w, top, bottom: top + h };
    if (!obstacles.some(o => overlapsRect(box, o, 2))) return box;
  }
  return null;
}

export function createSceneCaptions(container) {
  let owner = null, entries = [], frame = 0, lastW = 0;
  const v = { project: null };
  const collect = root => {
    const found = [];
    root.traverse(o => { if (o.isSprite && o.userData.caption) found.push(o); });
    const known = new Map(entries.map(e => [e.sprite, e]));
    entries = found.map(sprite => {
      let e = known.get(sprite);
      if (!e) {
        const { text, color, height } = sprite.userData.caption, el = document.createElement('div');
        el.className = 'scene-cap' + (height >= 0.3 ? ' head' : ''); el.textContent = text; el.style.color = color; el.style.display = 'none';
        container.appendChild(el); sprite.material.visible = false; e = { sprite, el, w: 0, h: 0, height };
      }
      return e;
    });
    for (const [s, e] of known) if (!found.includes(s)) e.el.remove();
  };
  const clear = () => { for (const e of entries) e.el.remove(); entries = []; owner = null; };
  return {
    // root: the level's THREE.Scene, or null where captions stay sprites; obstacles: boxes in the view's CSS pixels
    update(root, camera, cw, ch, obstacles, THREE) {
      if (root !== owner) { clear(); owner = root; frame = 0; }
      if (!root) return;
      if (frame++ % 30 === 0) collect(root);
      v.project ||= new THREE.Vector3();
      for (const e of entries) if (!e.el.isConnected) container.appendChild(e.el);   // a level's panel rebuild empties the container
      const placed = [], wide = cw !== lastW; lastW = cw;
      const live = entries.filter(e => { for (let o = e.sprite; o; o = o.parent) if (!o.visible) return false; return true; })
        .map(e => { e.sprite.getWorldPosition(v.project); const p = v.project.clone().project(camera); return { e, x: (p.x + 1) / 2 * cw, y: (1 - p.y) / 2 * ch, ok: p.z > -1 && p.z < 1 }; })
        .sort((a, b) => b.e.height - a.e.height || a.y - b.y);
      const show = new Set();
      for (const { e, x, y, ok } of live) {
        if (!ok) continue;
        if (!e.w || wide) { e.el.style.display = 'block'; e.el.style.transform = 'translate(-9999px,0)'; const r = e.el.getBoundingClientRect(); e.w = r.width; e.h = r.height; }
        const box = placeCaption(x, y, e.w, e.h, [...obstacles, ...placed], cw, ch);
        if (!box) continue;
        placed.push(box); show.add(e);
        e.el.style.display = 'block'; e.el.style.transform = `translate(${box.left.toFixed(1)}px, ${box.top.toFixed(1)}px)`;
      }
      for (const e of entries) if (!show.has(e)) e.el.style.display = 'none';
    },
  };
}
