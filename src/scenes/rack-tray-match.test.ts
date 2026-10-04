// Reed (10/03/2026): "The GPU tray as viewed from the NVL72 rack view is not representative of our actual GPU
// tray when viewed as the GPU tray." The rack's pulled compute tray (rack.js) draws its cold plates from the same
// layout constants tray.js and tray-rubin.js build the tray level from (NVL_BOARD_X/NVL_CPU/NVL_GPU_Z/NVL_GPU_SIZE,
// RUBIN_COLD_PLATES), so the two views cannot drift apart without this test catching it: it imports those
// constants directly (not through rack.js) and checks the rack's built pulled-tray plates land on them.
// NOTE (10/04/2026): this file checks the constants the two levels share (plates, front, rear, Blender hand-off). That proved a proxy:
// the rack's pulled tray looked different while it passed. rack-tray-parts.test.ts compares every part the two levels actually draw.
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { compute, DEFAULT_SCENARIO } from '../model/engine';

let rack: any, tray: any, trayJs: any, trayRubin: any;
beforeAll(async () => {
  const noop = () => undefined;
  const target: Record<string, any> = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), measureText: (t: string) => ({ width: t.length * 24 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
    fillRect: (...a: number[]) => { fills.push({ style: target.fillStyle, a }); } };   // painted textures are read back below (the rack's E1.S sleds)
  const ctx = new Proxy(target, { get: (t, k: string) => k in t ? t[k] : noop });
  vi.stubGlobal('document', { createElement: () => ({ width: 1, height: 1, getContext: () => ctx }) });
  [rack, tray, trayJs, trayRubin] = await Promise.all([import('./rack.js'), import('./tray.js'), import('./tray.js'), import('./tray-rubin.js')]);
}, 30000);
afterAll(() => { vi.unstubAllGlobals(); });

const opts = (scenario: any) => ({ quality: { mobile: true, shadows: false, reflections: false }, state: { mode: 'power' }, model: compute({ ...DEFAULT_SCENARIO, ...scenario }) });
const TRAY_UNIT = 0.1;
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
// every point in `found` must have an exact match in `expected` (both ways, so counts agree too)
function sameSet(found: Array<{ x: number; z: number }>, expected: Array<{ x: number; z: number }>, label: string) {
  expect(found.length, `${label}: count`).toBe(expected.length);
  for (const e of expected) {
    const hit = found.some(f => near(f.x, e.x) && near(f.z, e.z));
    expect(hit, `${label}: no rack plate at tray position (${e.x.toFixed(3)}, ${e.z.toFixed(3)})`).toBe(true);
  }
}
const pulled = (PD: any[], kind: string) => PD.filter(p => p.id.startsWith(`pulled-${kind}-`)).map((p: any) => ({ x: p.at[0], z: p.at[2] - pzOf(PD) }));
// the pulled tray's own z offset (pz) cancels out of a relative comparison; instead of recovering pz, compare
// positions relative to the tray's own first GPU plate on each side, which both layouts give unambiguously
function pzOf(_PD: any[]) { return 0; }

describe('rack pulled compute tray matches the tray level (GB200/GB300)', () => {
  for (const accel of ['gb200', 'gb300']) it(`${accel}: six cold plates, at the tray level's board/CPU/GPU positions`, () => {
    const r = rack.build(opts({ accel }));
    const expected = tray.NVL_BOARD_X.flatMap((bx: number) => [
      { x: bx * TRAY_UNIT, z: tray.NVL_CPU.z * TRAY_UNIT },
      { x: bx * TRAY_UNIT, z: tray.NVL_GPU_Z[0] * TRAY_UNIT },
      { x: bx * TRAY_UNIT, z: tray.NVL_GPU_Z[1] * TRAY_UNIT },
    ]);
    const z0 = r.powerDraw.find((p: any) => p.id === 'pulled-cpu-0').at[2] - expected[0].z;   // recover the tray's pz offset
    const found = r.powerDraw.filter((p: any) => /^pulled-(cpu|gpu)-/.test(p.id)).map((p: any) => ({ x: p.at[0], z: p.at[2] - z0 }));
    sameSet(found, expected, `${accel} rack pulled tray`);
  });
});

describe('the Blender hand-off file stays in step with the layout', () => {
  it('tools/blender/references/rack-tray-layout.json (read by rack-inspection-detail.py) matches the exported constants', async () => {
    // @ts-ignore vite ?raw import
    const j = JSON.parse((await import('../../tools/blender/references/rack-tray-layout.json?raw')).default);
    expect(j.nvl.plates).toEqual(rack.NVL_COLD_PLATES);
    expect(j.nvl.fanX).toEqual(tray.NVL_FAN_X);
    expect(j.nvl.cpu).toEqual(tray.NVL_CPU);
    expect(j.nvl.gpuZ).toEqual(tray.NVL_GPU_Z);
    expect(j.rubin.plates).toEqual(trayRubin.RUBIN_COLD_PLATES);
  });
});

describe('rack pulled compute tray matches the tray level (Rubin)', () => {
  it('nine cold plates (4 GPU, 2 CPU, 2 NIC board, 1 DPU), at tray-rubin.js\'s own positions', () => {
    const r = rack.build(opts({ accel: 'rubin' }));
    const expected = trayRubin.RUBIN_COLD_PLATES.map((p: any) => ({ x: p.x * TRAY_UNIT, z: p.z * TRAY_UNIT }));
    const z0 = r.powerDraw.find((p: any) => p.id === 'pulled-cpu-4').at[2] - trayRubin.RUBIN_CPU[0][1] * TRAY_UNIT;
    const found = r.powerDraw.filter((p: any) => /^pulled-(gpu|cpu|nic|dpu)-/.test(p.id)).map((p: any) => ({ x: p.at[0], z: p.at[2] - z0 }));
    sameSet(found, expected, 'rubin rack pulled tray');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The tray's FRONT and REAR against the rack's seated trays (10/03/2026 drift audit, items 1, 2, 4, 5). Every figure below is
// read off what each level actually draws, not off the constants they share: the tray side from the boxes tray.js and
// tray-rubin.js add to their builders (recorded as they are built), the rack side from the modules, cages, texture fills and
// plan the rack reports. Re-typing a number at either end breaks the match.
// ---------------------------------------------------------------------------------------------------------------------
type Box = { mat: any; x: number; y: number; z: number; w: number; h: number; d: number };
let kit: any, osfp: any, labels: any, dgxMod: any, hallMod: any;
const fills: Array<{ style: string; a: number[] }> = [];
beforeAll(async () => {
  [kit, osfp, labels, dgxMod, hallMod] = await Promise.all([import('../kit.js'), import('./osfp-size.js'), import('./lid-labels.js'), import('./dgx-h100-layout.js'), import('./hall.js')]);
}, 30000);

function record<T>(fn: () => T): { out: T; boxes: Box[]; cyls: any[]; struts: any[] } {
  const boxes: Box[] = [], cyls: any[] = [], struts: any[] = [];
  const add = kit.Builder.prototype.add, strut = kit.Builder.prototype.strut;
  kit.Builder.prototype.add = function (this: any, geo: any, mat: any, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    if (geo.type === 'BoxGeometry') boxes.push({ mat, x, y, z, w: sx, h: sy, d: sz });
    else if (geo.type === 'CylinderGeometry') cyls.push({ mat, x, y, z, r: sx, len: sy, rx });
    return add.call(this, geo, mat, x, y, z, rx, ry, rz, sx, sy, sz);
  };
  kit.Builder.prototype.strut = function (this: any, a: number[], b: number[], r: number, mat: any, seg?: number) { struts.push({ a, b, r, mat }); return strut.call(this, a, b, r, mat, seg); };
  try { return { out: fn(), boxes, cyls, struts }; } finally { kit.Builder.prototype.add = add; kit.Builder.prototype.strut = strut; }
}
const cache = new Map<string, any>();
function built(level: 'rack' | 'tray', accel: string) {
  const key = `${level}:${accel}`;
  if (!cache.has(key)) cache.set(key, record(() => (level === 'rack' ? rack : tray).build(opts({ accel }))));
  return cache.get(key);
}
const uniq = (xs: number[], eps = 1e-6) => xs.slice().sort((a, b) => a - b).filter((x, i, s) => !i || x - s[i - 1] > eps);
const sorted = (xs: number[]) => xs.slice().sort((a, b) => a - b);
const r6 = (xs: number[]) => xs.map(v => +v.toFixed(6));

// what the tray level seats in its cages: the nose of a module of the OSFP envelope, with its MPO faces in front of it
function trayFront(accel: string) {
  const T = built('tray', accel), O = osfp.OSFP_U, g = (v: number, w: number) => Math.abs(v - w) < 1e-9;
  const noses = T.boxes.filter((b: Box) => b.mat === kit.MAT.nickel && g(b.w, O.w) && g(b.h, O.h));
  // a cage is a solid frame the height of the OSFP cage (GB, Rubin) or its sheet-metal top and bottom plates (the DGX H100's)
  const cages = T.boxes.filter((b: Box) => b.mat === kit.MAT.galv && g(b.w, O.cageW) && (g(b.h, O.cageH) || g(b.h, O.wall)));
  const faces = (n: Box) => T.boxes.filter((b: Box) => b.mat === kit.MAT.polymer && g(b.d, .006) && Math.abs(b.y - n.y) < 1e-9 && Math.abs(b.x - n.x) < O.w / 2 && Math.abs(Math.abs(b.z) - Math.abs(n.z)) < .2);
  return { T, noses, cages, faces };
}
const rackModules = (accel: string) => {
  const info = built('rack', accel).out.scene.userData.rackOptics, row = info.modules[0].row;
  return { info, mods: info.modules.filter((m: any) => m.row === row), row };
};
const rackFloor = (accel: string, row: number) => accel === 'h100' ? .16 + row * (8 * .04445 + .004) : .12 + row * .04445;

describe('rack seated trays: OSFP cages and modules sit where the tray level puts them', () => {
  for (const accel of ['gb200', 'gb300', 'rubin', 'h100']) it(`${accel}: every cage the tray populates is populated, at the tray's x and height`, () => {
    const { noses } = trayFront(accel), { mods, row } = rackModules(accel);
    expect(noses.length, 'the tray seats a module in each cage').toBe(accel === 'rubin' ? 8 : 4);
    expect(mods.length, 'the rack populates as many').toBe(noses.length);
    const trayXY = noses.map((n: Box) => [n.x * TRAY_UNIT, n.y * TRAY_UNIT]).sort((a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1]);
    const rackXY = mods.map((m: any) => [m.position[0], m.position[1] - rackFloor(accel, row)]).sort((a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1]);
    trayXY.forEach(([x, y]: number[], i: number) => { expect(rackXY[i][0], `cage ${i} x`).toBeCloseTo(x, 6); expect(rackXY[i][1], `cage ${i} height above the tray floor`).toBeCloseTo(y, 6); });
  });
  for (const accel of ['gb200', 'gb300', 'rubin', 'h100']) it(`${accel}: the seated modules are the OSFP envelope and fit their cages`, () => {
    const O = osfp.OSFP_U, { noses, cages } = trayFront(accel), pitch = (xs: number[]) => Math.min(...xs.slice(1).map((x, i) => x - xs[i]));
    expect(O.w).toBeCloseTo(.2258, 6); expect(O.h).toBeCloseTo(.13, 6);   // OSFP MSA: 22.58 x 13.0 mm
    expect(O.innerW).toBeGreaterThan(O.w); expect(O.innerH).toBeGreaterThan(O.h);
    expect(noses.length).toBeGreaterThan(0); expect(cages.length).toBeGreaterThan(0);
    // neighbouring cages (tray units) do not touch: along x, and along y where a tray stacks two rows
    expect(pitch(uniq(cages.map((c: Box) => c.x)))).toBeGreaterThanOrEqual(O.cageW - 1e-9);
    const ys = uniq(cages.filter((c: Box) => Math.abs(c.h - O.cageH) < 1e-9).map((c: Box) => c.y)); if (ys.length > 1) expect(pitch(ys)).toBeGreaterThanOrEqual(O.cageH - 1e-9);
    // the rack's module is the same envelope (rack-optics seats a module of OSFP.w x OSFP.h in a cage frame of OSFP.cageW)
    const R = built('rack', accel), shell = (b: Box) => b.mat.name === 'Inserted flat top OSFP shell';
    expect(R.boxes.filter((b: Box) => shell(b) && Math.abs(b.w - osfp.OSFP.w) < 1e-9 && Math.abs(b.h - osfp.OSFP.h) < 1e-9).length).toBeGreaterThan(0);
    expect(R.boxes.some((b: Box) => shell(b) && Math.abs(b.w - osfp.OSFP.cageW) < 1e-9)).toBe(true);
  });
  it('the hall draws its switch modules at the same OSFP width and height', () => {
    const H = record(() => hallMod.build(opts({ accel: 'gb200' })));
    expect(H.boxes.filter(b => Math.abs(b.w - osfp.OSFP.w) < 1e-9 && Math.abs(b.h - osfp.OSFP.h) < 1e-9).length).toBeGreaterThan(100);
  }, 60000);
});

describe('rack seated trays: optical connectors per module come from one source (lid-labels.js)', () => {
  for (const [accel, ports] of [['h100', 2], ['gb200', 1], ['gb300', 1], ['rubin', 1]] as const) it(`${accel}: ${ports} MPO per module in the tray, on the rack's module and in its leads`, () => {
    expect(labels.modulePorts(accel)).toBe(ports);
    const { noses, faces } = trayFront(accel);
    for (const n of noses) expect(faces(n).length, `MPO faces on the tray module at x ${n.x}`).toBe(ports);
    const { info, mods } = rackModules(accel);
    for (const m of mods) expect(m.connectors).toBe(ports);
    expect(info.links.filter((l: any) => l.row === mods[0].row).length, 'one patch lead per connector').toBe(mods.length * ports);
  });
  it('GB300: single-port 800G DR4 everywhere (label, tray, rack), not the twin-port that GB300 once drew in the rack', () => {
    expect(labels.nicLabel('gb300')).toBe('OSFP 800G DR4');
    expect(rackModules('gb300').mods.every((m: any) => m.connectors === 1)).toBe(true);
  });
  it('the hall switch modules are twin-port (two receptacles in the breakout)', () => {
    expect(labels.switchModulePorts('gb200')).toBe(2);
  });
});

describe('rack seated trays: storage cages, service sockets and E1.S drives match the tray front', () => {
  for (const accel of ['gb200', 'gb300', 'h100']) it(`${accel}: the QSFP cages are the ones the tray draws, at its x and height`, () => {
    const { T } = trayFront(accel), Q = osfp.QSFP_U;
    const qx = T.boxes.filter((b: Box) => b.mat === kit.MAT.galv && Math.abs(b.w - Q.cageW) < 1e-9);
    // H100: the tray draws these on its storage cards (slot 1 and 2 at the card height, and slot 3's above); the rack draws the first card height's
    const yTray = accel === 'h100' ? dgxMod.DGX.cardY[0] + dgxMod.DGX.storageDY : tray.NVL_FRONT[accel].storageY;
    const trayXs = uniq(qx.filter((b: Box) => accel !== 'h100' || Math.abs(b.y - yTray) < 1e-9).map((b: Box) => b.x));
    const { info, row } = rackModules(accel), mine = info.storageCages.filter((c: any) => c.row === row);
    expect(r6(sorted(mine.map((c: any) => c.position[0])))).toEqual(r6(trayXs.map((x: number) => x * TRAY_UNIT)));
    for (const c of mine) expect(c.position[1] - rackFloor(accel, row)).toBeCloseTo(yTray * TRAY_UNIT, 6);
  });
  it('GB200 two DPUs, GB300 one: two QSFP cages each, and the tray has the DPUs the cages belong to', () => {
    for (const [accel, dpus] of [['gb200', 2], ['gb300', 1]] as const) {
      expect(built('tray', accel).out.scene.userData.computeGeneration.dpuCount).toBe(dpus);
      const { info, row } = rackModules(accel);
      expect(info.storageCages.filter((c: any) => c.row === row)).toHaveLength(2 * dpus);
    }
  });
  it('Rubin: the tray draws four service sockets and no QSFP; the rack draws those four, and no QSFP', () => {
    const { T } = trayFront('rubin'), io = trayRubin.RUBIN_FRONT.serviceIo;
    const sockets = T.boxes.filter((b: Box) => b.mat === kit.MAT.darkSteel && Math.abs(b.w - io.w) < 1e-9 && Math.abs(b.h - io.h) < 1e-9 && Math.abs(b.d - io.d) < 1e-9);
    expect(sockets).toHaveLength(4);
    expect(T.boxes.some((b: Box) => b.mat === kit.MAT.galv && Math.abs(b.w - osfp.QSFP_U.cageW) < 1e-9)).toBe(false);
    const { info, row } = rackModules('rubin'), mine = info.storageCages.filter((c: any) => c.row === row);
    expect(mine.every((c: any) => c.form === 'service socket')).toBe(true);
    expect(r6(sorted(mine.map((c: any) => c.position[0])))).toEqual(r6(sorted(sockets.map((b: Box) => b.x * TRAY_UNIT))));
  });
  const sleds = (accel: string) => { fills.length = 0; rack.build(opts({ accel })); return fills.filter(f => f.style === '#545c64' && f.a[1] === 10 && f.a[3] === 76).map(f => ((f.a[0] + f.a[2] / 2) / 1024 * 4.4 - 2.2)); };
  for (const accel of ['gb200', 'gb300']) it(`${accel}: the E1.S sleds painted on the rack's tray face are at the tray's drive x`, () => {
    const drives = built('tray', accel).boxes.filter((b: Box) => b.mat === kit.MAT.darkSteel && Math.abs(b.w - .22) < 1e-9 && Math.abs(b.h - .34) < 1e-9 && Math.abs(b.d - 1.1) < 1e-9).map((b: Box) => b.x);
    expect(drives).toHaveLength(4);
    const painted = sorted(sleds(accel)); expect(painted).toHaveLength(4);
    sorted(drives).forEach((x, i) => expect(Math.abs(painted[i] - x), `sled ${i}: within a texel (4.4 units / 1024)`).toBeLessThan(0.005));
  });
  it('Rubin: the tray has no E1.S drive and the rack paints none', () => {
    expect(built('tray', 'rubin').boxes.some((b: Box) => Math.abs(b.w - .22) < 1e-9 && Math.abs(b.h - .34) < 1e-9 && Math.abs(b.d - 1.1) < 1e-9)).toBe(false);
    expect(sleds('rubin')).toHaveLength(0);
  });
});

describe('rack rear: NVLink cartridges and coolant couplings are where the tray ends them', () => {
  const nv = (accel: string) => built('tray', accel).boxes.filter((b: Box) => b.mat === kit.MAT.black && Math.abs(b.w - .46) < 1e-9 && Math.abs(b.d - (accel === 'rubin' ? .26 : .32)) < 1e-9).map((b: Box) => b.x);
  for (const accel of ['gb200', 'gb300', 'rubin']) it(`${accel}: one cartridge behind each of the tray's four NVLink connectors`, () => {
    const trayX = sorted(nv(accel)); expect(trayX).toHaveLength(4);
    const cart = sorted(built('rack', accel).out.scene.userData.rackPlan.cartridgeX);
    trayX.forEach((x, i) => expect(cart[i]).toBeCloseTo(x * TRAY_UNIT, 6));
  });
  for (const accel of ['gb200', 'gb300', 'rubin']) it(`${accel}: each manifold's nozzle ends on a coupling the tray draws, and the stub reaches it`, () => {
    const T = built('tray', accel), R = built('rack', accel), plan = R.out.scene.userData.rackPlan;
    const couplings = T.cyls.filter((c: any) => c.mat === kit.MAT.nickel && Math.abs(c.rx - Math.PI / 2) < 1e-9 && Math.abs(c.r - (accel === 'rubin' ? .075 : .07)) < 1e-9).map((c: any) => c.x);
    expect(couplings.length).toBeGreaterThanOrEqual(2);
    expect(plan.nozzleX).toHaveLength(2);
    plan.nozzleX.forEach((nx: number, side: number) => {
      expect(couplings.some((x: number) => Math.abs(x * TRAY_UNIT - nx) < 0.003), `a tray coupling within 3 mm of the nozzle at ${nx}`).toBe(true);
      expect(Math.sign(nx)).toBe(Math.sign(plan.manifoldX[side]));
      const stub = R.struts.find((s: any) => s.r === 0.0045 && Math.abs(s.a[0] - plan.manifoldX[side]) < 1e-9);
      expect(stub, 'a stub from the manifold').toBeTruthy(); expect(stub.b[0]).toBeCloseTo(nx, 9);
    });
  });
  it('Rubin feed cords drop clear of the repositioned cartridges', () => {
    const plan = built('rack', 'rubin').out.scene.userData.rackPlan, feeds = built('rack', 'rubin').out.scene.userData.rackFeeds;
    for (const f of feeds) { const p = f.path.at(-1); for (const cx of plan.cartridgeX) expect(Math.abs(p[0] - cx)).toBeGreaterThan(.03 + .009); }
  });
});

describe('the Blender hand-off carries the tray front, rear and OSFP envelope', () => {
  const plain = (v: unknown) => JSON.parse(JSON.stringify(v));
  it('rack-tray-layout.json matches the exported front/rear/OSFP constants', async () => {
    // @ts-ignore vite ?raw import
    const j = JSON.parse((await import('../../tools/blender/references/rack-tray-layout.json?raw')).default);
    expect(j.nvl.front).toEqual(plain(tray.NVL_FRONT));
    expect(j.nvl.rear).toEqual(plain(tray.NVL_REAR));
    expect(j.rubin.front).toEqual(plain(trayRubin.RUBIN_FRONT));
    expect(j.rubin.rear).toEqual(plain(trayRubin.RUBIN_REAR));
    expect(j.osfp).toEqual(plain(osfp.OSFP_U));
    expect(j.qsfp).toEqual(plain(osfp.QSFP_U));
    expect(j.modulePorts).toEqual({ h100: 2, gb200: 1, gb300: 1, rubin: 1 });
    expect(j.h100.cageX).toEqual(dgxMod.DGX.cageX); expect(j.h100.storageX).toEqual(dgxMod.DGX.storageX);
  });
  it('rack-tray-layout.json carries the pulled tray frame rack.js builds, for the slide rails of the rack script', async () => {
    // @ts-ignore vite ?raw import
    const j = JSON.parse((await import('../../tools/blender/references/rack-tray-layout.json?raw')).default);
    for (const accel of ['gb200', 'gb300', 'rubin', 'h100']) expect(j.rack.pulledTray[accel]).toEqual(plain(rack.build(opts({ accel })).scene.userData.pulledTray));
  });
  it('the Blender scripts read those keys instead of re-typing the front', async () => {
    // @ts-ignore vite ?raw imports
    const [build, hero, insp] = await Promise.all([import('../../tools/blender/build-compute.py?raw'), import('../../tools/blender/compute-hero-detail.py?raw'), import('../../tools/blender/rack-inspection-detail.py?raw')]);
    expect(build.default).toMatch(/\['bezelX'\]/); expect(build.default).toMatch(/\['rubin'\]\['front'\]/); expect(build.default).toMatch(/\['h100'\]\['cageX'\]/);
    expect(hero.default).toMatch(/\['drives'\]/); expect(hero.default).toMatch(/\['cageX'\]/); expect(hero.default).toMatch(/\['dpuX'\]/);
    // the pulled tray is no longer authored here at all (compute-blender.js seats the tray level's own GLB): the rack script keeps only
    // the slide rails, at the frame rack.js reports, with no retyped tray position or tray part left
    expect(insp.default).toMatch(/\['pulledTray'\]/); expect(insp.default).not.toMatch(/pz\s*=\s*[0-9.]/);
    expect(insp.default).not.toMatch(/cold plate perimeter seal|milled cold plate crown|network package|support memory package|'VRM inductor'|fan cassette rim/);
    for (const src of [build.default, hero.default, insp.default]) { expect(src).not.toMatch(/\[\.2,\.7,1\.2,1\.7\]/); expect(src).not.toMatch(/-1\.66,-1\.04,1\.04,1\.66/); }
  });
});
