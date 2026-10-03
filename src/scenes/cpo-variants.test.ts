// The CPO level's two packages (Reed, 10/01/2026): NVIDIA-style (micro-rings, the default) and Broadcom-style
// (Mach-Zehnder, a 51.2T Bailly-class package). Each must draw its own hardware and only its own, put its pins on its
// own parts and on the right layer, move its flows along its own layout without running through a die, keep each
// driver over its modulator and each TIA over its photodiode, face every engine's electrical edge to the switch chip,
// and say what it draws in its own cards and captions.
import { beforeAll, describe, it, expect, vi } from 'vitest';
// @ts-expect-error Vitest supplies Node built-ins; app tsconfig intentionally excludes Node types.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CPO_VARIANTS, CPO_RING, CPO_MZM, CPO_EIC, CPO_DIE, BAILLY, cpoBlocks, cpoVariantLayout, engineLayout, baillyLayout, eicBox, asicTap, baillyAsicTap } from './side-geometry.js';

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
let authored: any, native: any, variants: any, content: any, asset: any, meta: any;
beforeAll(async () => {
  vi.stubGlobal('document', canvasDocument());
  const b = readFileSync(new URL('../../public/models/cpo-hardware.glb', import.meta.url));
  asset = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  asset.scene.traverse((o: THREE.Object3D) => { if (o.userData.ifx) meta = JSON.parse(o.userData.ifx); });
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
const RING_KEYS = { power: ['asic', 'engine', 'els', 'today', 'next'], data: ['asic', 'serdes', 'eic', 'rings', 'pd', 'els', 'fiberout', 'today', 'next'], heat: ['asic', 'coldplate'] };
const MZM_KEYS = { power: ['mzm-asic', 'mzm-engine', 'mzm-laser', 'today', 'next'], data: ['mzm-asic', 'mzm-serdes', 'mzm-eic', 'mzm-mod', 'mzm-pd', 'mzm-laser', 'mzm-fiberout', 'today', 'next'], heat: ['mzm-asic', 'mzm-sink'] };
// each design's detail (ring 2.5x, Mach-Zehnder at BAILLY.detail.s): center and scale, and the photonic frame
const DETAIL = { ring: { DX: -(10.4 / 2 + 6.2), DY: 1.4, DZ: -(10.4 / 2 + 3.2), s: 2.5 }, mzm: BAILLY.detail };
const toPx = (kind: 'ring' | 'mzm', p: number[]) => {
  const { DX, DZ, s } = DETAIL[kind], d = CPO_DIE[kind];
  return [(DX - p[0] + d.L * s / 2) / (d.L * s) * d.fw, (DZ - p[2] + d.W * s / 2) / (d.W * s) * d.fh];
};

describe('CPO packages: authored hardware', () => {
  it('the Blender layout input matches the runtime layout, and the asset names each package’s groups', () => {
    const layoutJson = JSON.parse(readFileSync(new URL('../../tools/blender/link-layout.json', import.meta.url), 'utf8'));
    expect(layoutJson.variants).toEqual(JSON.parse(JSON.stringify(cpoVariantLayout())));
    expect(meta.engineVariants).toEqual(CPO_VARIANTS);
    expect(meta.variantGroups.ring).toEqual(expect.arrayContaining(['CPO_RING_ENGINES', 'CPO_RING_DETAIL', 'CPO_RING_PACKAGE', 'CPO_FIBERS', 'CPO_RETAINERS']));
    expect(meta.variantGroups.mzm).toEqual(expect.arrayContaining(['CPO_MZM_ENGINES', 'CPO_MZM_DETAIL', 'CPO_MZM_PACKAGE', 'CPO_MZM_FIBERS']));
    expect(meta.coolingGroups).toEqual({ ring: 'CPO_COLDPLATE', mzm: 'CPO_MZM_HEATSINK' });
    expect(meta.baillyTiles).toBe(8); expect(meta.engineCount).toBe(18);
  });
  for (const kind of CPO_VARIANTS) it(`${kind}: shows its own package and no other`, () => {
    const b = authored.build(options());
    b.variant.set(kind); b.update(1, 1 / 60);
    for (const k of CPO_VARIANTS) for (const g of b.variant.groups[k]) expect(g.visible, `${g.name} in the ${kind} view`).toBe(k === kind);
    const names = matNames(b.scene), ring = kind === 'ring';
    for (const n of ['Electronic die face', 'Ring modulator rim', 'Silicon interposer', 'Fiber array lid glass']) expect(names.has(n), n).toBe(ring);
    for (const n of ['MZM electronic die face', 'MZM photonic die face', 'Mach-Zehnder arm', 'Mach-Zehnder electrode', 'Wavelength multiplexer', 'Fiber connector body', 'Organic build-up layers']) expect(names.has(n), n).toBe(!ring);
    for (const n of ['Switch ASIC silicon', 'Laser module anodized body', 'Transmit ribbon']) expect(names.has(n), n).toBe(true);
    // heat: the cold plate for the NVIDIA-style package, the heat sink for the Broadcom-style one
    const opts = options('heat'), h = authored.build(opts); h.variant.set(kind); h.update(1, 1 / 60);
    expect(shown(h.scene.getObjectByName('CPO_COLDPLATE'))).toBe(ring);
    expect(shown(h.scene.getObjectByName('CPO_MZM_HEATSINK'))).toBe(!ring);
    expect(h.coolingHardware.visible).toBe(ring);
  });
  it('eighteen NVIDIA-style engines, eight Broadcom-style tiles in the vendor image’s proportions, all 64 lanes drawn, the arms running past the electronic die', () => {
    const b = authored.build(options()); b.scene.updateMatrixWorld(true);
    const mzmEngines = b.variant.groups.mzm.find((g: THREE.Object3D) => g.name === 'CPO_MZM_ENGINES');
    const eicMesh = meshes(mzmEngines).find(m => (m.material as THREE.Material).name === 'MZM electronic die face')!;
    const ringEic = meshes(b.variant.groups.ring.find((g: THREE.Object3D) => g.name === 'CPO_RING_ENGINES')).find(m => (m.material as THREE.Material).name === 'Electronic die face')!;
    const per = (m: THREE.Mesh, n: number) => { expect(m.geometry.attributes.position.count % n).toBe(0); return m.geometry.attributes.position.count / n; };
    expect(per(eicMesh, 8)).toBe(per(ringEic, 18));   // the same beveled box per die
    // Broadcom's package images: an engine with its connector reads about 2 to 2.5 times as long as it is wide
    const withConn = (BAILLY.conn[1] - BAILLY.rIn) / CPO_DIE.mzm.W;
    expect(withConn).toBeGreaterThanOrEqual(2); expect(withConn).toBeLessThanOrEqual(2.5);
    const detail = b.variant.groups.mzm.find((g: THREE.Object3D) => g.name === 'CPO_MZM_DETAIL');
    const arms = meshes(detail).find(m => (m.material as THREE.Material).name === 'Mach-Zehnder arm')!;
    const eic = meshes(detail).find(m => (m.material as THREE.Material).name === 'Detail MZM electronic die face')!;
    const armBox = new THREE.Box3().setFromObject(arms), eicB = new THREE.Box3().setFromObject(eic);
    // the detail is turned half a turn: the fiber edge is world -x
    expect(eicB.min.x - armBox.min.x).toBeGreaterThan(.4 * (armBox.max.x - armBox.min.x));
    const ringD = 12 / 512 * 1.35, armLen = (CPO_MZM.armOut - CPO_MZM.armIn) / CPO_DIE.mzm.fw * CPO_DIE.mzm.L;
    expect(armLen / ringD).toBeGreaterThan(30);   // many times a ring's size
    const electrode = meshes(detail).find(m => (m.material as THREE.Material).name === 'Mach-Zehnder electrode')!;
    expect(electrode.geometry.attributes.position.count).toBe(64 * 3 * 24);   // all 64 lanes × 3 segments (one bar over both arms)
  });
});

describe('CPO packages: pins, flows and captions', () => {
  for (const builder of ['native', 'authored']) for (const kind of ['ring', 'mzm'] as const) it(`${builder} ${kind}: its own pins on the right layer, its own flows, its own captions`, () => {
    const b = (builder === 'native' ? native : authored).build(options());
    b.variant.set(kind); b.update(1, 1 / 60); b.scene.updateMatrixWorld(true);
    const KEYS = kind === 'ring' ? RING_KEYS : MZM_KEYS, { DY } = DETAIL[kind];
    expect(Object.keys(b.hotspots)).toEqual(KEYS.power); expect(Object.keys(b.dataHotspots)).toEqual(KEYS.data); expect(Object.keys(b.heatHotspots)).toEqual(KEYS.heat);
    const pins = b.dataHotspots, id = (k: string) => kind === 'ring' ? k : `mzm-${k === 'rings' ? 'mod' : k}`;
    const [mpx, mpy] = toPx(kind, pins[id('rings')].pos), [epx, epy] = toPx(kind, pins[id('eic')].pos), [dpx, dpy] = toPx(kind, pins[id('pd')].pos);
    // modulator and photodiode pins on the photonic die; the electronic chip's pin on the electronic die, over a driver
    expect(pins[id('rings')].pos[1] - DY).toBeLessThan(.3); expect(pins[id('pd')].pos[1] - DY).toBeLessThan(.3); expect(pins[id('eic')].pos[1] - DY).toBeGreaterThan(.95);
    if (kind === 'ring') expect(Math.hypot(mpx - CPO_RING.ringX(3), mpy - CPO_RING.ringZ(3))).toBeLessThan(1);
    else { expect(mpx).toBeGreaterThan(CPO_EIC.mzm[2]); expect(mpx).toBeLessThan(CPO_MZM.armOut); expect(Math.abs(mpy - CPO_MZM.row(0))).toBeLessThan(1); }
    if (kind === 'ring') { const [bx, by] = cpoBlocks(kind).drivers[6]; expect(Math.hypot(epx - bx, epy - by)).toBeLessThan(1); }
    else {   // over the last transmit lane's driver cell, which spans its three electrode segments
      expect(Math.abs(epy - CPO_MZM.row(63))).toBeLessThan(1);
      expect(epx).toBeGreaterThan(CPO_MZM.seg(0)[0]); expect(epx).toBeLessThan(CPO_MZM.seg(2)[1]);
    }
    expect(Math.abs(dpx - (kind === 'ring' ? CPO_RING.pdX : CPO_MZM.pdX))).toBeLessThan(1);
    expect(Math.abs(dpy - (kind === 'ring' ? CPO_RING.rxRow(4) : CPO_MZM.rxRow(63)))).toBeLessThan(1);
    // the flows on screen are this package's (and the shared switch-chip and laser-module ones)
    const visible = b.dataFlows.filter((f: any) => shown(f.group));
    const own = visible.filter((f: any) => f.group.parent?.name?.startsWith('CPO engine view'));
    for (const f of own) expect(f.group.parent.name).toBe(`CPO engine view ${kind} flows`);
    expect(own).toHaveLength(kind === 'ring' ? 18 * 5 + 15 : 8 * 5 + 15);
    // no detail flow runs through a die: above the photonic die's waveguides, or straight down a bond, or inside the
    // electronic die it serves
    const pads = kind === 'ring'
      ? [...Array.from({ length: 8 }, (_, i) => CPO_RING.pad(i)), ...Array.from({ length: 8 }, (_, i) => [CPO_RING.pdX, CPO_RING.rxRow(i)])]
      : [...Array.from({ length: 64 }, (_, i) => [0, 1, 2].map(k => [CPO_MZM.pad(k), CPO_MZM.row(i)])).flat(), ...Array.from({ length: 64 }, (_, i) => [CPO_MZM.pdX, CPO_MZM.rxRow(i)])];
    const d = CPO_DIE[kind];
    for (const f of own) for (let t = 0; t <= 1; t += .02) {
      const p = f.path.getPoint(t), y = p.y - DY, [px, py] = toPx(kind, p.toArray());
      if (!(px > 0 && px < d.fw && py > 0 && py < d.fh) || Math.abs(p.z - DETAIL[kind].DZ) > 3) continue;
      expect(y, `${kind} ${f.cls} at t=${t.toFixed(2)}`).toBeGreaterThan(.0865);
      const inEic = y >= .8875 && y <= 1.01, inGap = y > .1025 && y < .8875;
      if (inGap) expect(pads.some(([x, z]) => Math.hypot(px - x, py - z) < 1.5), `${kind} ${f.cls} crosses the gap away from a bond`).toBe(true);
      else expect(inEic || y <= .1025 || y >= 1.01, `${kind} ${f.cls} at height ${y.toFixed(3)}`).toBe(true);
    }
    // captions naming the other package stay hidden
    const tagged = b.scene.children.filter((o: any) => o.isSprite && o.userData.cpoVariant);
    for (const sp of tagged) if (sp.userData.cpoVariant !== kind) expect(sp.visible).toBe(false);
    const texts = tagged.filter((sp: any) => sp.userData.cpoVariant === kind).map((sp: any) => sp.userData.caption.text).join(' | ');
    expect(texts).toMatch(kind === 'ring' ? /counts are NVIDIA’s/ : /counts are Broadcom’s, 51\.2T Bailly/);
  });
});

describe('CPO packages: cards', () => {
  const layer = (name: string) => (content as any)[name].cpo as any[];
  it('each package lists its own parts; the landscape cards are shared', () => {
    for (const [name, mode] of [['PARTS', 'power'], ['PARTS_DATA', 'data'], ['PARTS_HEAT', 'heat']] as const) {
      const ids = layer(name).map(p => p.id);
      expect(ids.filter(i => !i.startsWith('mzm-'))).toEqual((RING_KEYS as any)[mode]);
      expect(ids.filter(i => i.startsWith('mzm-') || (mode !== 'heat' && ['today', 'next'].includes(i)))).toEqual((MZM_KEYS as any)[mode]);
    }
    for (const mode of ['power', 'data', 'heat']) { expect(variants.cpoIntro('ring', mode)).toBeNull(); expect(variants.cpoIntro('mzm', mode)).toMatch(/Bailly|eight|heat sink/); }
  });
  it('the Broadcom-style cards carry Broadcom’s published counts and the reported engine design', () => {
    const card = (name: string, id: string) => layer(name).find(p => p.id === id);
    const labels = (name: string, id: string) => card(name, id).specs.map((r: any) => r[0]);
    expect(labels('PARTS', 'mzm-asic')).toEqual(expect.arrayContaining(['Package, Broadcom', 'Optics power, Broadcom figure']));
    expect(labels('PARTS_DATA', 'mzm-eic')).toEqual(expect.arrayContaining(['Broadcom’s engine, as reported', 'Broadcom’s transmit drive, as reported', 'Broadcom’s engine, lanes']));
    expect(labels('PARTS_DATA', 'mzm-mod')).toEqual(expect.arrayContaining(['Broadcom, for comparison', '400G FR4']));
    expect(labels('PARTS_DATA', 'mzm-fiberout')).toEqual(expect.arrayContaining(['Front panel, Broadcom reference system', 'Data fibers per engine']));
    expect(labels('PARTS_HEAT', 'mzm-sink')).toEqual(expect.arrayContaining(['Cooling, Broadcom reference system']));
    expect(card('PARTS_DATA', 'mzm-mod').body).toMatch(/three segments/);
    // the one-die designs: a sentence and two rows on "Where CPO is heading", not a view
    const next = card('PARTS', 'next');
    expect(next.body).toMatch(/Ranovus/); expect(next.body).toMatch(/Ayar Labs/);
    expect(next.specs.map((r: any) => r[0])).toEqual(expect.arrayContaining(['Ranovus Odin', 'Ayar Labs TeraPHY']));
    for (const id of ['eic', 'rings', 'pd']) expect(labels('PARTS_DATA', id)).not.toContain('Ranovus Odin');
    expect(card('PARTS_DATA', 'eic').specs.find((r: any) => r[0] === 'Engine partition, as reported')[2]).toBe('reported');
  });
});

describe('CPO engine layouts', () => {
  for (const kind of ['ring', 'mzm'] as const) it(`${kind}: each driver block lies over its modulator and each TIA over its photodiode, in lane order`, () => {
    const { drivers, tias } = variants.eicBlocks(kind), [CW, CH] = variants.EIC_CANVAS[kind];
    const modulator = (i: number) => kind === 'ring' ? [CPO_RING.ringX(i), CPO_RING.ringZ(i)] : [(CPO_MZM.seg(0)[0] + CPO_MZM.seg(2)[1]) / 2, CPO_MZM.row(i)];
    const pd = (i: number) => kind === 'ring' ? [CPO_RING.pdX, CPO_RING.rxRow(i)] : [CPO_MZM.pdX, CPO_MZM.rxRow(i)];
    const [x0, y0, x1, y1] = CPO_EIC[kind];
    const toFrame = ([c, r]: number[]) => [x1 - c / CW * (x1 - x0), y1 - r / CH * (y1 - y0)];
    const center = (b: number[]) => toFrame([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]);
    const N = kind === 'mzm' ? 64 : 8;   // every lane: 8 per ring engine, 64 per Mach-Zehnder engine
    expect(drivers).toHaveLength(N); expect(tias).toHaveLength(N);
    for (let i = 0; i < N; i++) {
      const [dx, dy] = center(drivers[i]), [mx, my] = modulator(i), [tx, ty] = center(tias[i]), [px, py] = pd(i);
      expect(Math.hypot(dx - mx, dy - my), `driver ${i}`).toBeLessThan(.5);
      expect(Math.hypot(tx - px, ty - py), `TIA ${i}`).toBeLessThan(.5);
      const padsOf = kind === 'ring' ? [CPO_RING.pad(i)] : [0, 1, 2].map(k => [CPO_MZM.pad(k), CPO_MZM.row(i)]);
      for (const [qx, qy] of padsOf) {
        const [c, r] = variants.eicPixel(kind, qx, qy), b = drivers[i];
        expect(c > b[0] && c < b[2] && r > b[1] && r < b[3], `${kind} lane ${i} pad under its driver`).toBe(true);
      }
    }
    for (let i = 1; i < N; i++) { expect(center(drivers[i])[1]).toBeGreaterThan(center(drivers[i - 1])[1]); expect(center(tias[i])[1]).toBeGreaterThan(center(tias[i - 1])[1]); }
    for (const b of [...drivers, ...tias]) { expect(b[0]).toBeGreaterThan(29); expect(b[1]).toBeGreaterThan(29); expect(b[2]).toBeLessThan(CW - 29); expect(b[3]).toBeLessThan(CH - 29); }
    const all = [...drivers, ...tias, ...variants.eicBlocks(kind).support.map((s: any) => s.rect)];
    for (let a = 0; a < all.length; a++) for (let c = a + 1; c < all.length; c++) {
      const [p, q] = [all[a], all[c]];
      expect(p[2] <= q[0] || q[2] <= p[0] || p[3] <= q[1] || q[3] <= p[1], `blocks ${a} and ${c}`).toBe(true);
    }
  });
  it('the Mach-Zehnder tile: all 64 lanes each way in 16 FR4 groups, arms and electrodes within the lane pitch, the arms showing past the electronic die', () => {
    const M = CPO_MZM, rows = Array.from({ length: 64 }, (_, i) => M.row(i)), rx = Array.from({ length: 64 }, (_, i) => M.rxRow(i));
    expect(M.lanes).toBe(64); expect(M.groups * M.perGroup).toBe(64); expect(M.groups).toBe(16);
    for (const list of [rows, rx]) for (let i = 1; i < 64; i++) expect(list[i] - list[i - 1]).toBeGreaterThanOrEqual(M.pitch);
    expect(rows[63]).toBeLessThan(rx[0]);                                   // transmit half, then receive half
    expect(2 * M.arm).toBeLessThan(M.pitch); expect(M.elecW).toBeLessThan(M.pitch);   // a lane's arms and electrode stay in its pitch
    for (let k = 0; k < M.segments; k++) { const [a, b] = M.seg(k); expect(M.pad(k)).toBeGreaterThan(a); expect(M.pad(k)).toBeLessThan(b); expect(a).toBeGreaterThan(M.armIn); expect(b).toBeLessThan(CPO_EIC.mzm[2]); }
    expect(M.heater[0]).toBeGreaterThan(CPO_EIC.mzm[2]); expect(M.heater[1]).toBeLessThan(M.armOut);
    expect(M.armOut - CPO_EIC.mzm[2]).toBeGreaterThan(150);
    // each group: four lanes on one transmit fiber row, four photodiodes off one receive fiber row, its boxes spanning its lanes
    for (let g = 0; g < M.groups; g++) {
      const lanes = [0, 1, 2, 3].map(k => 4 * g + k);
      for (const [box, list] of [[M.demux(g), rows], [M.mux(g), rows], [M.rxDemux(g), rx]] as const) for (const i of lanes) { expect(list[i]).toBeGreaterThan(box[1]); expect(list[i]).toBeLessThan(box[3]); }
      expect(M.txOut(g)).toBeGreaterThan(rows[lanes[0]]); expect(M.txOut(g)).toBeLessThan(rows[lanes[3]]);
      expect(M.rxIn(g)).toBeGreaterThan(rx[lanes[0]]); expect(M.rxIn(g)).toBeLessThan(rx[lanes[3]]);
      if (g) { expect(M.demux(g)[1]).toBeGreaterThan(M.demux(g - 1)[3]); expect(M.rxDemux(g)[1]).toBeGreaterThan(M.rxDemux(g - 1)[3]); }
    }
    // the two laser buses run clear of every lane, and each feeds half the groups
    expect(M.lasers[0]).toBeLessThan(M.demux(0)[1]); expect(M.lasers[1]).toBeGreaterThan(M.demux(15)[3]); expect(M.lasers[1]).toBeLessThan(M.rxDemux(0)[1]);
    expect(Array.from({ length: 16 }, (_, g) => M.feed(g)).filter(f => f === 0)).toHaveLength(8);
    expect(M.trunkX).toBeLessThan(M.demux(0)[0]);
    expect(M.pdX + M.pdW / 2).toBeLessThan(CPO_EIC.mzm[2]);   // the photodiodes under the electronic die, under their TIAs
  });
  it('every engine faces the switch chip: electrical edge nearest the ASIC, fiber edge farthest, in both packages', () => {
    const check = (e: any, L: number, kind: 'ring' | 'mzm') => {
      const along = (d: number) => [e.x + Math.cos(e.rot) * d, e.z + Math.sin(e.rot) * d], dist = (p: number[]) => Math.hypot(p[0], p[1]);
      expect(Math.cos(e.rot) * e.out[0] + Math.sin(e.rot) * e.out[1]).toBeCloseTo(1);
      const electrical = along(-L / 2), fiber = along(L / 2), tap = (kind === 'mzm' ? baillyAsicTap : asicTap)(e);
      expect(dist(electrical)).toBeLessThan(dist(fiber));
      expect(Math.hypot(tap[0] - electrical[0], tap[1] - electrical[1])).toBeLessThan(Math.hypot(tap[0] - fiber[0], tap[1] - fiber[1]));
      const b = eicBox(kind);
      expect(b.cx - b.w / 2).toBeLessThan(-L / 2 + .05);   // the electronic die at the electrical end
    };
    for (const e of engineLayout()) check(e, CPO_DIE.ring.L, 'ring');
    for (const t of baillyLayout()) { check(t, CPO_DIE.mzm.L, 'mzm'); expect(t.r - CPO_DIE.mzm.L / 2).toBeCloseTo(BAILLY.rIn); }
  });
});
