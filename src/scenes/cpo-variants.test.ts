// The CPO level's engine toggle (Reed, 10/01/2026): ring, Mach-Zehnder and one-die views. Each view must draw its own
// dies and only its own, put its pins on its own parts, move its detail flows along its own layout without running
// through a die, and say what it draws in its cards and captions, while the package, counts and spec rows stay put.
import { beforeAll, describe, it, expect, vi } from 'vitest';
// @ts-expect-error Vitest supplies Node built-ins; app tsconfig intentionally excludes Node types.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CPO_VARIANTS, CPO_RING, CPO_MZM, CPO_MONO, CPO_EIC, cpoBlocks, cpoVariantLayout, engineLayout, eicBox, asicTap } from './side-geometry.js';

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
    // 8 lanes × 2 arms × 3 segments, each a flat-shaded box of 24 vertices after the merge
    expect(electrode.geometry.attributes.position.count).toBe(8 * 2 * 3 * 24);
    // the arms run on past the electronic die, which covers only the electrical end
    const eic = meshes(detail).find(m => (m.material as THREE.Material).name === 'Detail MZM electronic die face')!;
    const armBox = new THREE.Box3().setFromObject(arms), eicBoxW = new THREE.Box3().setFromObject(eic);
    // the detail is turned half a turn: the fiber edge (frame x 512) is world -x
    expect(eicBoxW.min.x - armBox.min.x).toBeGreaterThan(.25 * size(arms).x);
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
      // on the arms, past the electronic die, so the pin marks an optical part on the photonic die
      expect(rpx).toBeGreaterThan(CPO_EIC.mzm[2]); expect(rpx).toBeLessThan(CPO_MZM.armOut); expect(pins.rings.pos[1] - DY).toBeLessThan(.3);
      expect(Math.abs(rpy - CPO_MZM.row(3))).toBeLessThan(1);
    } else {
      const [cx, cy] = kind === 'ring' ? [110 + 3 * 40, 50 + 3 * 20 - 10] : [CPO_MONO.ringX(3), CPO_MONO.ringZ(3)];
      expect(Math.hypot(rpx - cx, rpy - cy)).toBeLessThan(1);
    }
    if (kind === 'mono') {
      const [x0, y0, x1, y1] = CPO_MONO.driver(6);   // lane 6's driver, clear of the rings pin on lane 3
      expect(epx).toBeGreaterThan(x0); expect(epx).toBeLessThan(x1); expect(epy).toBeGreaterThan(y0); expect(epy).toBeLessThan(y1);
      expect(pins.eic.pos[1] - DY).toBeLessThan(.3);   // on the one die, not over a missing electronic die
    } else {
      // on the electronic die, over a driver block: over a lane's ring, or over its Mach-Zehnder electrode run
      expect(pins.eic.pos[1] - DY).toBeGreaterThan(.95);
      const [bx, by] = cpoBlocks(kind).drivers[kind === 'mzm' ? 2 : 6];   // a lane clear of the die lettering
      expect(Math.hypot(epx - bx, epy - by)).toBeLessThan(1);
    }
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
            : [...Array.from({ length: 8 }, (_, i) => [0, 1, 2].map(k => [CPO_MZM.pad(k), CPO_MZM.row(i) - CPO_MZM.strip])).flat(), ...Array.from({ length: 8 }, (_, i) => [77, 214 + i * 20])];
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
    expect(variants.cpoPartCopy('mzm', card('PARTS_DATA', 'eic'), 'data').body).toMatch(/one driver block per lane over that modulator’s electrode segments/);
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
  it('Mach-Zehnder arms, electrodes and heaters keep clear of each other and of the next lane', () => {
    const M = CPO_MZM;
    expect(M.row(1) - M.row(0) - 2 * (M.strip + M.stripW / 2)).toBeGreaterThan(3);   // a lane's lower strip and the next lane's upper strip
    expect(M.strip - M.stripW / 2 - M.arm).toBeGreaterThan(1.5);                      // each strip runs alongside its arm, clear of it
    expect(M.rxRow(0) - (M.row(7) + M.strip)).toBeGreaterThan(10);                     // transmit and receive banks apart
    for (let k = 0; k < M.segments; k++) { const [a, b] = M.seg(k); expect(M.pad(k)).toBeGreaterThan(a); expect(M.pad(k)).toBeLessThan(b); expect(a).toBeGreaterThan(M.armIn); expect(b).toBeLessThan(CPO_EIC.mzm[2]); }
    for (let k = 1; k < M.segments; k++) expect(M.seg(k)[0]).toBeGreaterThan(M.seg(k - 1)[1]);
    expect(M.heater[0]).toBeGreaterThan(CPO_EIC.mzm[2]); expect(M.heater[1]).toBeLessThan(M.armOut);
    expect(M.armOut - CPO_EIC.mzm[2]).toBeGreaterThan(80);                                // the arms show past the electronic die
  });
  for (const kind of ['ring', 'mzm'] as const) it(`${kind}: each driver block lies over its modulator and each TIA over its photodiode, in lane order`, () => {
    const { drivers, tias } = variants.eicBlocks(kind), pos = cpoBlocks(kind);
    const modulator = (i: number) => kind === 'ring' ? [CPO_RING.ringX(i), CPO_RING.ringZ(i)] : [(CPO_MZM.seg(0)[0] + CPO_MZM.seg(2)[1]) / 2, CPO_MZM.row(i)];
    const [x0, y0, x1, y1] = CPO_EIC[kind];
    // back from the electronic die's canvas to the photonic frame: u mirrored, canvas top at the receive edge
    const toFrame = ([c, r]: number[]) => [x1 - c / 1024 * (x1 - x0), y1 - r / 768 * (y1 - y0)];
    const center = (b: number[]) => toFrame([(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]);
    expect(drivers).toHaveLength(8); expect(tias).toHaveLength(8);
    for (let i = 0; i < 8; i++) {
      const [dx, dy] = center(drivers[i]), [mx, my] = modulator(i), [tx, ty] = center(tias[i]);
      expect(Math.hypot(dx - mx, dy - my), `driver ${i}`).toBeLessThan(.5);
      expect(Math.hypot(tx - CPO_RING.pdX, ty - CPO_RING.rxRow(i)), `TIA ${i}`).toBeLessThan(.5);
      expect(pos.drivers[i]).toEqual(modulator(i));
      // the modulator's bond pads lie inside its driver block
      const pads = kind === 'ring' ? [CPO_RING.pad(i)] : [0, 1, 2].map(k => [CPO_MZM.pad(k), CPO_MZM.row(i) - CPO_MZM.strip]);
      for (const [px, py] of pads) {
        const [c, r] = variants.eicPixel(kind, px, py), b = drivers[i];
        expect(c > b[0] && c < b[2] && r > b[1] && r < b[3], `${kind} lane ${i} pad under its driver`).toBe(true);
      }
    }
    // lane order: transmit lanes and receive lanes step the same way on both dies
    for (let i = 1; i < 8; i++) {
      expect(center(drivers[i])[1]).toBeGreaterThan(center(drivers[i - 1])[1]);
      expect(center(tias[i])[1]).toBeGreaterThan(center(tias[i - 1])[1]);
    }
    for (const b of [...drivers, ...tias]) { expect(b[0]).toBeGreaterThan(29); expect(b[1]).toBeGreaterThan(29); expect(b[2]).toBeLessThan(1024 - 29); expect(b[3]).toBeLessThan(768 - 29); }
    const all = [...drivers, ...tias];
    for (let a = 0; a < all.length; a++) for (let c = a + 1; c < all.length; c++) {
      const [p, q] = [all[a], all[c]];
      expect(p[2] <= q[0] || q[2] <= p[0] || p[3] <= q[1] || q[3] <= p[1]).toBe(true);
    }
  });
  it('every engine faces the switch chip: electrical edge nearest the ASIC, fiber edge farthest, for every view', () => {
    // the build places each engine's local +x along its outward vector (rotation by side × 90°)
    for (const e of engineLayout()) {
      const along = (d: number) => [e.x + Math.cos(e.rot) * d, e.z + Math.sin(e.rot) * d];
      const dist = (p: number[]) => Math.hypot(p[0], p[1]);
      const electrical = along(-1.35 / 2), fiber = along(1.35 / 2);
      expect(dist(electrical)).toBeLessThan(dist(fiber));
      expect(Math.cos(e.rot) * e.out[0] + Math.sin(e.rot) * e.out[1]).toBeCloseTo(1);
      // package traces arrive at the electrical side: the ASIC tap is nearer the electrical edge than the fiber edge
      const tap = asicTap(e);
      expect(Math.hypot(tap[0] - electrical[0], tap[1] - electrical[1])).toBeLessThan(Math.hypot(tap[0] - fiber[0], tap[1] - fiber[1]));
      for (const kind of ['ring', 'mzm'] as const) {
        const b = eicBox(kind);
        expect(dist(along(b.cx - b.w / 2))).toBeLessThan(dist(along(b.cx + b.w / 2)));   // its electrical edge inward
        expect(b.cx - b.w / 2).toBeLessThan(-1.35 / 2 + .05);                               // and at the photonic die's electrical end
      }
    }
    // in the frame, the electronics sit at the electrical end and the fiber couplers at x 512 in every view
    expect(CPO_MONO.tia(0)[0]).toBeLessThan(CPO_MONO.pdX); expect(CPO_MONO.driver(0)[2]).toBeLessThan(CPO_MONO.ringX(0));
    expect(CPO_EIC.mzm[0]).toBeLessThan(CPO_MZM.seg(0)[0]);
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
