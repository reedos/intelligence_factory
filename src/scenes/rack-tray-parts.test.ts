// Reed (10/04/2026): "The Rubin tray from rack view doesn't line up with the tray view." rack-tray-match.test.ts passed while it
// did not: it checks the plates' centres and the front and rear connectors, a proxy, and the visible tray still differed (the
// central midplane bar, the plates' proportions, the boards, fans and front parts). This test makes the claim itself: for every
// accelerator it builds the tray level and the rack level exactly as the app does (the shipped GLBs, the runtime composition in
// compute-blender.js) and compares EVERY part each draws - material, centre, size and height, in the tray's own millimetres -
// part by part (tools/tray-parts.mjs, the walk tools/tray-overlay.mjs makes in the browser with the same code).
//
// A part is a connected piece of surface (a screw, a cold-plate lid, a board). Parts under 8 mm in plan are the level of detail the
// rack may omit. What is not compared is not the tray's hardware: the rack's patch leads, cable manager and closed trays' cage
// shells beside it, and printed decals (RACK_OWNED in tray-parts.mjs).
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
// @ts-expect-error test-only Node built-in
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { compute, DEFAULT_SCENARIO } from '../model/engine';
// @ts-ignore plain module shared with the browser tool
import { levelParts, trayBounds, trayRegion, compareParts, RACK_OWNED } from '../../tools/tray-parts.mjs';

const ids = ['gb200', 'gb300', 'rubin', 'h100'];
const assets = new Map<string, any>();
let rackBuilder: any, trayBuilder: any;
function canvasDocument() {
  return { createElement(tag: string) {
    if (tag !== 'canvas') throw new Error(`Unexpected DOM ${tag}`);
    const noop = () => undefined;
    const context = new Proxy({ measureText: (text: string) => ({ width: text.length * 24 }), createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }) } as Record<string, unknown>, { get: (t, k: string) => k in t ? t[k] : noop });
    return { width: 1, height: 1, getContext: () => context };
  } };
}
beforeAll(async () => {
  vi.stubGlobal('document', canvasDocument()); vi.stubGlobal('self', { URL });
  vi.stubGlobal('createImageBitmap', async () => ({ width: 1, height: 1, close() {} }));
  for (const name of ['compute-rotor', ...['rack', 'tray'].flatMap(k => ids.map(id => `compute-${k}-${id}`))]) {
    const b = readFileSync(new URL(`../../public/models/${name}.glb`, import.meta.url));
    assets.set(name, await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''));
  }
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async (url: string) => {
    const key = url.split('/').pop()!.split('.glb')[0]; if (!assets.has(key)) throw new Error(`Unexpected asset ${url}`); return assets.get(key);
  });
  const m = await import('./compute-blender.js'); rackBuilder = m.rackBuilder; trayBuilder = m.trayBuilder;
  for (const id of ids) for (const b of [rackBuilder, trayBuilder]) await b.preload({ model: compute({ ...DEFAULT_SCENARIO, accel: id as any }) });
}, 90000);
afterAll(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const options = (id: string) => ({ quality: { shadows: false, reflections: false, mobile: false }, state: { mode: 'data' }, model: compute({ ...DEFAULT_SCENARIO, accel: id as any }) });
const line = (p: any) => `${p.material} x ${p.x} z ${p.z} ${p.w} x ${p.d} mm y ${p.y0}..${p.y1}`;

describe('the rack pulls out the tray the tray level draws: every part, in the same place, size and material', () => {
  for (const id of ids) it(`${id}: no part missing, extra, offset by more than 5 mm, resized or in another material`, () => {
    const tray = trayBuilder.build(options(id)), rack = rackBuilder.build(options(id));
    const hook = rack.scene.userData.pulledTray;
    expect(hook, 'rack.js reports where it pulled the tray out (scene.userData.pulledTray)').toBeTruthy();
    const frame = trayBounds(tray.scene, THREE), zRear = (hook.front - hook.z) * 1000;
    const region = trayRegion(frame, zRear);
    const A = levelParts(tray.scene, THREE, { toMm: [0, 0, 0, 100], box: region, ignore: RACK_OWNED });
    const B = levelParts(rack.scene, THREE, { toMm: [hook.x, hook.floor, hook.z, 1000], box: region, ignore: RACK_OWNED });
    const cmp = compareParts(A, B, { tol: 5, minMm: 8 });
    const report = (title: string, list: any[], f: (q: any) => string) => list.length ? `\n${title} (${list.length}): ${list.slice(0, 8).map(f).join('; ')}` : '';
    const text = report('only at the tray level', cmp.missing, line) + report('only in the rack', cmp.extra, line) + report('offset', cmp.offset, (q: any) => `${line(q.a)} -> ${q.by} mm`)
      + report('different size', cmp.resized, (q: any) => `${line(q.a)} -> ${q.b.w} x ${q.b.d}`) + report('different material', cmp.material, (q: any) => `${line(q.a)} -> #${q.b.mat.hex.toString(16)}`);
    expect(text, `${id}: the rack's pulled tray differs from the tray level's${text}`).toBe('');
    // a comparison that finds nothing to compare would pass for the wrong reason: the tray draws hundreds of parts this size
    expect(cmp.matched, 'parts compared').toBeGreaterThan(300);
    // and the fans: one rotor per fan at the same place (GB200/GB300: six, H100: twenty-four, Rubin: none)
    const rotors = (l: any[]) => l.filter(p => p.material === 'fan rotor');
    expect(rotors(B).length).toBe(rotors(A).length);
  }, 60000);
});
