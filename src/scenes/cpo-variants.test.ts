// The CPO level's engine toggle (Reed, 10/01/2026): ring, Mach-Zehnder and one-die views. Each view must draw its own
// dies and only its own, put its pins on its own parts, move its detail flows along its own layout without running
// through a die, and say what it draws in its cards and captions, while the package, counts and spec rows stay put.
import { beforeAll, describe, it, expect, vi } from 'vitest';
// @ts-expect-error Vitest supplies Node built-ins; app tsconfig intentionally excludes Node types.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CPO_VARIANTS, CPO_MZM, CPO_MONO, cpoVariantLayout } from './side-geometry.js';

function canvasDocument() {
  return { createElement(tag: string) {
    if (tag !== 'canvas') throw new Error(`Unexpected DOM dependency ${tag}`);
    const noop = () => undefined;
    const context = new Proxy({
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      measureText: (text: string) => ({ width: text.length * 24 }),
      createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    } as Record<string, unknown>, { get: (target, key: string) => key in target ? target[key] : noop });
    return { width: 1, height: 1, getContext: () => context };
  } };
}
let authored: any, native: any, variants: any, content: any, asset: any;
beforeAll(async () => {
  vi.stubGlobal('document', canvasDocument());
  const b = readFileSync(new URL('../../public/models/cpo-hardware.glb', import.meta.url));
  asset = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async () => asset);
  authored = await import('./side-cpo-blender.js'); native = await import('./side-cpo.js');
  variants = await import('./cpo-variants.js');
  await authored.preload();
  const data = await import('../data.js'), engine = await import('../model/engine');
  content = data.content(engine.compute({ meterMW: 300, accel: 'gb300', power: 'dc800', cooling: 'liquid' }));
});
const options = (mode = 'data') => ({ quality: { shadows: false }, state: { mode } });
const shown = (o: THREE.Object3D) => { for (let q: THREE.Object3D | null = o; q; q = q.parent) if (!q.visible) return false; return true; };
const meshes = (root: THREE.Object3D) => { const m: THREE.Mesh[] = []; root.traverse(o => { if (o instanceof THREE.Mesh) m.push(o); }); return m; };
const matNames = (root: THREE.Object3D) => new Set(meshes(root).filter(shown).flatMap(m => (Array.isArray(m.material) ? m.material : [m.material]).map(x => x.name)));

describe('CPO engine views: authored hardware', () => {
  it('the Blender layout input matches the runtime layout, and the asset names its view groups', () => {
    const layoutJson = JSON.parse(readFileSync(new URL('../../tools/blender/link-layout.json', import.meta.url), 'utf8'));
    expect(layoutJson.variants).toEqual(cpoVariantLayout());
    let meta: any; asset.scene.traverse((o: THREE.Object3D) => { if (o.userData.ifx) meta = JSON.parse(o.userData.ifx); });
    expect(meta.engineVariants).toEqual(CPO_VARIANTS);
    for (const k of CPO_VARIANTS) expect(meta.variantGroups[k]).toEqual([`CPO_${k.toUpperCase()}_ENGINES`, `CPO_${k.toUpperCase()}_DETAIL`]);
  });
  for (const kind of CPO_VARIANTS) it(`${kind}: shows its own dies and no other view's`, () => {
    const b = authored.build(options());
    b.variant.set(kind); b.update(1, 1 / 60);
    const groups = b.variant.groups;
    for (const k of CPO_VARIANTS) for (const g of groups[k]) expect(g.visible, `${k} group in the ${kind} view`).toBe(k === kind);
    const names = matNames(b.scene);
    // the stacked views keep an electronic die over a photonic die; the one-die view has neither
    expect(names.has('Electronic die face')).toBe(kind === 'ring');
    expect(names.has('MZM electronic die face')).toBe(kind === 'mzm');
    expect(names.has('Monolithic die face')).toBe(kind === 'mono');
    expect(names.has('Photonic die passivation')).toBe(kind !== 'mono');
    expect(names.has('Ring modulator rim')).toBe(kind !== 'mzm');
    expect(names.has('Mach-Zehnder arm')).toBe(kind === 'mzm');
    expect(names.has('Mach-Zehnder electrode')).toBe(kind === 'mzm');
    expect(names.has('Gold bond pads')).toBe(kind !== 'mono');
    // the package around the engines never changes
    for (const shared of ['Switch ASIC silicon', 'Silicon interposer', 'Transmit ribbon', 'Glass ferrule']) expect(names.has(shared), shared).toBe(true);
  });
  it('the packaged engines: eighteen per view, the one-die view one die per engine', () => {
    const groups = authored.build(options()).variant.groups;
    const box = (g: THREE.Object3D, mat: string) => meshes(g).filter(m => (m.material as THREE.Material).name === mat);
    const count = (m: THREE.Mesh) => m.geometry.attributes.position.count;
    // each die is one beveled box; equal vertex counts per die, eighteen of them
    const ring = box(groups.ring[0], 'Electronic die face'), mono = box(groups.mono[0], 'Monolithic die face');
    expect(ring).toHaveLength(1); expect(mono).toHaveLength(1);
    expect(count(ring[0]) % 18).toBe(0); expect(count(mono[0]) % 18).toBe(0);
    expect(box(groups.mono[0], 'Photonic die passivation')).toHaveLength(0);
  });
  it('Mach-Zehnder arms run many times a ring’s size, with three electrode segments per lane between them', () => {
    const b = authored.build(options()); b.scene.updateMatrixWorld(true);
    const [, detail] = b.variant.groups.mzm;
    const electrode = meshes(detail).find(m => (m.material as THREE.Material).name === 'Mach-Zehnder electrode')!;
    const arms = meshes(detail).find(m => (m.material as THREE.Material).name === 'Mach-Zehnder arm')!;
    const ring = meshes(b.variant.groups.ring[1]).find(m => (m.material as THREE.Material).name === 'Ring modulator rim')!;
    const size = (m: THREE.Mesh) => new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
    // one ring's diameter: the eight rings' box spans their positions, so measure a single lane from the layout
    const pw = 1.35 * 2.5, ringD = 12 / 512 * pw, armLen = (CPO_MZM.armOut - CPO_MZM.armIn) / 512 * pw;
    expect(armLen / ringD).toBeGreaterThan(15);
    expect(size(arms).x).toBeGreaterThan(armLen * .99);
    expect(ring).toBeDefined();
    // 8 lanes × 3 segments, each a flat-shaded box of 24 vertices after the merge
    expect(electrode.geometry.attributes.position.count).toBe(8 * 3 * 24);
  });
});

describe('CPO engine views: pins, flows and captions', () => {
  for (const builder of ['native', 'authored']) for (const kind of CPO_VARIANTS) it(`${builder} ${kind}: pins on its parts, flows on its layout, its own captions`, () => {
    const b = (builder === 'native' ? native : authored).build(options());
    b.variant.set(kind); b.update(1, 1 / 60); b.scene.updateMatrixWorld(true);
    // detail coordinates: the detail is turned half a turn, so local (x, z) is (DX - x, DZ - z) in the world
    const DX = -(10.4 / 2 + 6.2), DY = 1.4, DZ = -(10.4 / 2 + 3.2), PW = 1.35 * 2.5, PD = .95 * 2.5;
    const toPx = (p: number[]) => [(DX - p[0] + PW / 2) / PW * 512, (DZ - p[2] + PD / 2) / PD * 384];
    const pins = b.dataHotspots;
    const [rpx, rpy] = toPx(pins.rings.pos), [epx, epy] = toPx(pins.eic.pos), [dpx, dpy] = toPx(pins.pd.pos);
    expect(Math.abs(dpx - 77)).toBeLessThan(1); expect(Math.abs(dpy - (214 + 4 * 20))).toBeLessThan(1);
    if (kind === 'mzm') {
      expect(rpx).toBeGreaterThan(CPO_MZM.armIn); expect(rpx).toBeLessThan(CPO_MZM.armOut);
      expect(Math.abs(rpy - CPO_MZM.row(3))).toBeLessThan(1);
    } else {
      const [cx, cy] = kind === 'ring' ? [110 + 3 * 40, 50 + 3 * 20 - 10] : [CPO_MONO.ringX(3), CPO_MONO.ringZ(3)];
      expect(Math.hypot(rpx - cx, rpy - cy)).toBeLessThan(1);
    }
    if (kind === 'mono') {
      const [x0, y0, x1, y1] = CPO_MONO.driver(6);   // lane 6's driver, clear of the rings pin on lane 3
      expect(epx).toBeGreaterThan(x0); expect(epx).toBeLessThan(x1); expect(epy).toBeGreaterThan(y0); expect(epy).toBeLessThan(y1);
      expect(pins.eic.pos[1] - DY).toBeLessThan(.3);   // on the one die, not over a missing electronic die
    } else expect(pins.eic.pos[1] - DY).toBeGreaterThan(.95);
    for (const id of ['eic', 'rings', 'pd']) expect(pins[id].view.focus).toEqual(pins[id].pos);
    // the detail flows on screen are this view's, fifteen of them (three sampled lanes × five paths)
    const detail = b.dataFlows.filter((f: any) => f.group.parent?.name?.startsWith('CPO engine view'));
    const visible = detail.filter((f: any) => f.group.parent.visible);
    expect(detail).toHaveLength(45); expect(visible).toHaveLength(15);
    for (const f of visible) expect(f.group.parent.name).toBe(`CPO engine view ${kind} flows`);
    // none of them runs through a die: in the one-die view everything stays above its face and waveguides; in the
    // stacked views a path is either above the photonic die or inside the electronic die it serves
    for (const f of visible) for (let t = 0; t <= 1; t += .02) {
      const p = f.path.getPoint(t), y = p.y - DY, [px, py] = toPx(p.toArray());
      const overDie = px > 0 && px < 512 && py > 0 && py < 384;
      if (!overDie) continue;
      expect(y, `${kind} ${f.cls} at t=${t.toFixed(2)}`).toBeGreaterThan(.0865);
      if (kind !== 'mono' && y > .0865) {
        // between the dies only straight down a bond guide (a pad), or inside the electronic die
        const inEic = y >= .89 && y <= 1.01, inGap = y > .1025 && y < .8875;
        if (inGap) {
          const pads = kind === 'ring'
            ? [...Array.from({ length: 8 }, (_, i) => [110 + i * 40 + 13, 50 + i * 20 - 10]), ...Array.from({ length: 8 }, (_, i) => [77, 214 + i * 20])]
            : [...Array.from({ length: 8 }, (_, i) => [0, 1, 2].map(k => [CPO_MZM.pad(k), CPO_MZM.row(i)])).flat(), ...Array.from({ length: 8 }, (_, i) => [77, 214 + i * 20])];
          expect(pads.some(([x, z]) => Math.hypot(px - x, py - z) < 1.5), `${kind} ${f.cls} crosses the gap away from a bond`).toBe(true);
        } else expect(inEic || y <= .1025 || y >= 1.01, `${kind} ${f.cls} at height ${y.toFixed(3)}`).toBe(true);
      }
    }
    // captions naming another view's chips stay hidden
    const tagged = b.scene.children.filter((o: any) => o.isSprite && o.userData.cpoVariant);
    expect(tagged.length).toBeGreaterThan(0);
    for (const s of tagged) if (s.userData.cpoVariant !== kind) expect(s.visible).toBe(false);
    if (builder === 'native') for (const s of tagged) if (s.userData.cpoVariant === kind) expect(s.visible).toBe(true);
    const texts = tagged.filter((s: any) => s.userData.cpoVariant === kind).map((s: any) => s.userData.caption.text).join(' | ');
    expect(texts).toMatch({ ring: /ring modulators/, mzm: /Mach-Zehnder/, mono: /One die/ }[kind]!);
  });
  it('the views keep every package flow and the hotspot keys', () => {
    const b = authored.build(options()), keys = (o: any) => Object.keys(o).join();
    const before = { power: keys(b.hotspots), data: keys(b.dataHotspots), heat: keys(b.heatHotspots), flows: b.flows.length, heat2: b.heatFlows.length };
    for (const k of CPO_VARIANTS) {
      b.variant.set(k);
      expect({ power: keys(b.hotspots), data: keys(b.dataHotspots), heat: keys(b.heatHotspots), flows: b.flows.length, heat2: b.heatFlows.length }).toEqual(before);
    }
  });
});

describe('CPO engine views: cards', () => {
  const card = (layer: string, id: string) => (content as any)[layer].cpo.find((p: any) => p.id === id);
  it('each view retitles only what it draws and keeps every spec row in place', () => {
    for (const [layer, mode] of [['PARTS', 'power'], ['PARTS_DATA', 'data'], ['PARTS_HEAT', 'heat']] as const) for (const part of (content as any)[layer].cpo) {
      for (const kind of CPO_VARIANTS) {
        const out = variants.cpoPartCopy(kind, part, mode);
        expect(out.id).toBe(part.id); expect(out.specs).toBe(part.specs);
        if (kind === 'ring') expect(out).toBe(part);
        if (['today', 'next', 'els', 'fiberout', 'serdes', 'coldplate'].includes(part.id)) expect(out).toBe(part);
      }
    }
    expect(variants.cpoPartCopy('mzm', card('PARTS_DATA', 'rings'), 'data').title).toBe('Mach-Zehnder modulators');
    expect(variants.cpoPartCopy('mono', card('PARTS_DATA', 'rings'), 'data').title).toBe('Ring modulators');
    expect(variants.cpoPartCopy('mono', card('PARTS_DATA', 'eic'), 'data').title).toBe('Drivers and TIAs, on the same die');
    expect(variants.cpoPartCopy('mzm', card('PARTS_DATA', 'eic'), 'data').body).toMatch(/three driver blocks per lane/);
    expect(variants.cpoPartCopy('mzm', card('PARTS_DATA', 'eic'), 'data').body).toMatch(/106\.25 Gb\/s/);
    for (const mode of ['power', 'data', 'heat']) {
      expect(variants.cpoIntro('ring', mode)).toBeNull();
      expect(variants.cpoIntro('mzm', mode)).toMatch(/Mach-Zehnder/);
      expect(variants.cpoIntro('mono', mode)).toMatch(/One-die/);
    }
  });
  it('the cards carry the rows behind every view: reported partition, Broadcom, Ranovus, Ayar Labs, Marvell', () => {
    const labels = (layer: string, id: string) => card(layer, id).specs.map((r: any) => r[0]);
    expect(labels('PARTS_DATA', 'eic')).toEqual(expect.arrayContaining(['Engine partition, as reported', 'Broadcom’s engine, as reported', 'Broadcom’s transmit drive, as reported', 'Marvell’s 6.4T engine', 'Ranovus Odin', 'Ayar Labs TeraPHY', 'Engine views drawn']));
    expect(labels('PARTS_DATA', 'rings')).toEqual(expect.arrayContaining(['Modulator size, SemiAnalysis', 'Broadcom’s transmit drive, as reported', 'Ranovus Odin']));
    expect(labels('PARTS_DATA', 'pd')).toEqual(expect.arrayContaining(['Broadcom’s receive, as reported', 'Ranovus Odin']));
    expect(card('PARTS_DATA', 'eic').specs.find((r: any) => r[0] === 'Engine partition, as reported')[2]).toBe('reported');
    expect(card('PARTS_DATA', 'eic').specs.find((r: any) => r[0] === 'Electronic die floorplan drawn')[2]).toBe('assumed');
  });
});

describe('CPO engine view layouts', () => {
  it('Mach-Zehnder arms and electrodes keep clear of the next lane, and each driver block sits over its pad', () => {
    const M = CPO_MZM;
    expect(M.row(1) - M.row(0) - 2 * M.arm).toBeGreaterThan(6);                   // a lane's lower arm and the next lane's upper arm
    expect(M.arm - M.segW / 2).toBeGreaterThan(2);                                // the electrode between its arms, clear of both
    expect(M.rxRow(0) - (M.row(7) + M.arm)).toBeGreaterThan(10);                  // transmit and receive banks apart
    for (let k = 0; k < M.segments; k++) { const [a, b] = M.seg(k); expect(M.pad(k)).toBeGreaterThan(a); expect(M.pad(k)).toBeLessThan(b); expect(a).toBeGreaterThan(M.armIn); expect(b).toBeLessThan(M.armOut); }
    for (let k = 1; k < M.segments; k++) expect(M.seg(k)[0]).toBeGreaterThan(M.seg(k - 1)[1]);
    const { drivers, tias } = variants.MZM_EIC;
    expect(drivers).toHaveLength(24); expect(tias).toHaveLength(8);
    for (let i = 0; i < 8; i++) for (let k = 0; k < 3; k++) {
      const [x0, y0, x1, y1] = drivers[i * 3 + k], [cx, cy] = variants.eicPixel(M.pad(k), M.row(i));
      expect(cx).toBeGreaterThan(x0); expect(cx).toBeLessThan(x1); expect(cy).toBeGreaterThan(y0); expect(cy).toBeLessThan(y1);
    }
    for (const [x0, y0, x1, y1] of [...drivers, ...tias]) { expect(x0).toBeGreaterThan(29); expect(y0).toBeGreaterThan(29); expect(x1).toBeLessThan(1024 - 29); expect(y1).toBeLessThan(768 - 29); }
    for (let a = 0; a < drivers.length; a++) for (let c = a + 1; c < drivers.length; c++) {
      const [p, q] = [drivers[a], drivers[c]];
      expect(p[2] <= q[0] || q[2] <= p[0] || p[3] <= q[1] || q[3] <= p[1]).toBe(true);
    }
  });
  it('one-die drivers sit beside their rings, clear of every waveguide, and TIAs beside their photodiodes', () => {
    const O = CPO_MONO;
    for (let i = 0; i < 8; i++) {
      const [x0, y0, x1, y1] = O.driver(i), ringLeft = O.ringX(i) - O.ringR;
      expect(ringLeft - x1).toBeGreaterThan(2); expect(ringLeft - x1).toBeLessThan(10);   // beside its ring
      expect(O.ringZ(i)).toBeGreaterThan(y0); expect(O.ringZ(i)).toBeLessThan(y1);          // level with it
      expect(O.row(i) - y1).toBeGreaterThan(2);                                             // above its own branch
      if (i) expect(y0 - O.row(i - 1)).toBeGreaterThan(2);                                  // below the previous lane's waveguide
      expect(y0 - O.busY).toBeGreaterThan(2); expect(x0).toBeGreaterThan(O.manX + 2);
      const [t0, , t1] = O.tia(i); expect(O.pdX - 13 - t1).toBeGreaterThan(2); expect(t0).toBeGreaterThan(14);
    }
  });
});
