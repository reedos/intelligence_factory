/// <reference types="vite/client" />
// Chip and PIC faces must read as real layouts: waveguides and traces enter components at their ports, never run under
// an outline, cross only where marked, and labels stay clear of every line. The coherent dies are described as data
// and checked strictly (checkDiagram); every other procedurally drawn face is recorded through a stand-in canvas and
// audited for the same faults (auditDrawing).
import { describe, it, expect, beforeAll } from 'vitest';
import { checkDiagram, recordContext, auditDrawing } from './face-diagram.js';
import { icrDiagram, iqDiagram, RF_ROWS } from './coherent-faces.js';

const clone = (d: any) => JSON.parse(JSON.stringify(d));

describe('coherent die faces (checked as data)', () => {
  for (const [name, make] of [['receiver (micro-ICR)', icrDiagram], ['IQ modulator (HB-CDM)', iqDiagram]] as const) {
    it(`${name}: no path through a component, no unmarked crossing, no label collision`, () => {
      expect(checkDiagram(make())).toEqual([]);
    });
  }
  it('receiver topology: signal PBS, LO splitter, two hybrids, four balanced PD pairs, RF pads opposite the fibers', () => {
    const d = icrDiagram(), path = (id: string): any => d.paths.find((p: any) => p.id === id);
    expect(path('sig')).toMatchObject({ from: 'fiber.sig', to: 'pbs.in' });
    expect(path('lo')).toMatchObject({ from: 'fiber.lo', to: 'split.in' });
    expect([path('sX').to, path('sY').to, path('loX').to, path('loY').to]).toEqual(['hx.s', 'hy.s', 'hx.lo', 'hy.lo']);
    for (let k = 0; k < 4; k++) {
      const hyb = k < 2 ? 'hx' : 'hy';
      expect(path(`out${k}a`).from.startsWith(hyb) && path(`out${k}b`).from.startsWith(hyb)).toBe(true);
      expect(path(`rf${k}`)).toMatchObject({ from: `pd${k}.out`, to: `rf${k}.out` });
    }
    // only the one crossing a planar layout cannot avoid
    expect(d.crossings).toEqual([['loY', 'sX']]);
  });
  it('modulator topology: carrier in, four Mach-Zehnders fed from the RF pads, PR on Y, PBC out', () => {
    const d = iqDiagram(), path = (id: string): any => d.paths.find((p: any) => p.id === id);
    expect(path('trunk').from).toBe('fiber.in');
    expect(path('out')).toMatchObject({ from: 'pbc.out', to: 'fiber.out' });
    expect([path('yout').to, path('yrot').to, path('xout').to]).toEqual(['pr.in', 'pbc.y', 'pbc.x']);
    expect(['rfXI', 'rfXQ', 'rfYI', 'rfYQ'].map(id => path(id).from)).toEqual(['rf0.out', 'rf1.out', 'rf2.out', 'rf3.out']);
    expect(d.crossings.length).toBe(3);
  });
  it('fiber ports and RF rows stay where the scene and the Blender asset attach to them', () => {
    const icr = icrDiagram(), iq = iqDiagram(), port = (d: any, ref: string) => { const [b, p] = ref.split('.'); return d.boxes.find((x: any) => x.id === b).ports[p]; };
    expect(port(icr, 'fiber.sig')).toEqual([500, 128]);          // icrSig at the die's z center
    expect(port(icr, 'fiber.lo')).toEqual([500, 24]);            // icrLo: icrZ - .33 + 24/256 * .66
    expect(port(iq, 'fiber.in')).toEqual([628, 256 - 14]);       // cdmIn: cdmZ + .33 - 14/256 * .66
    expect(port(iq, 'fiber.out')).toEqual([628, 128]);
    for (const d of [icr, iq]) RF_ROWS.forEach((y, k) => expect(port(d, `rf${k}.out`)).toEqual([26, y]));   // bond offsets (58 + 46k)/256
  });
});

describe('the checker catches each fault', () => {
  it('a path through a component', () => {
    const d = clone(icrDiagram());
    d.paths.find((p: any) => p.id === 'sX').pts.splice(1, 2, [310, 118], [200, 118], [200, 100]);
    expect(checkDiagram(d).some(v => v.includes('runs through box hx'))).toBe(true);
  });
  it('an unmarked crossing', () => {
    const d = clone(icrDiagram()); d.crossings = [];
    expect(checkDiagram(d).some(v => v.includes('crosses') && v.includes('without a marked crossing'))).toBe(true);
  });
  it('a declared crossing that does not happen', () => {
    const d = clone(icrDiagram()); d.crossings.push(['lo', 'sig']);
    expect(checkDiagram(d).some(v => v.includes('never cross'))).toBe(true);
  });
  it('a line over a label, and labels on each other', () => {
    const d = clone(icrDiagram());
    d.texts.push({ text: 'TAP', x: 330, y: 80, size: 11, color: '#fff' }, { text: 'TAP', x: 470, y: 14, size: 11, color: '#fff' });
    const v = checkDiagram(d);
    expect(v.some(s => s.includes('loY') && s.includes('runs over label "TAP"'))).toBe(true);
    expect(v.some(s => s.includes('labels "LO" and "TAP" collide'))).toBe(true);
  });
  it('a label too big for its box, a port off its outline, a loose end', () => {
    const d = clone(icrDiagram());
    d.boxes.find((b: any) => b.id === 'pbs').label = 'POLARIZATION';
    d.boxes.find((b: any) => b.id === 'hx').ports.lo = [250, 62];
    d.paths.push({ id: 'stub', pts: [[300, 230], [320, 230]], color: '#fff', width: 2 });
    const v = checkDiagram(d);
    expect(v.some(s => s.includes('does not fit inside box pbs'))).toBe(true);
    expect(v.some(s => s.includes('port hx.lo is not on its outline'))).toBe(true);
    expect(v.some(s => s.includes('stub: loose end'))).toBe(true);
  });
  it('paths crowding each other', () => {
    const d = clone(icrDiagram());
    d.paths.find((p: any) => p.id === 'loY').pts = [[384, 32], [313, 32], [313, 150], [262, 150]];   // 3 px from sX's riser
    expect(checkDiagram(d).some(v => v.includes('come within'))).toBe(true);
  });
});

// Every other procedurally drawn face, recorded through a stand-in canvas: component rectangles, stroked lines, text.
describe('freehand faces (recorded and audited)', () => {
  const recs: any[] = [];
  beforeAll(() => {
    (globalThis as any).document = { createElement: () => {
      const c: any = { width: 0, height: 0 };
      c.getContext = () => { const r = recordContext(c.width, c.height); recs.push(r.rec); return r.ctx; };
      return c;
    } };
  });
  const audit = (f: () => unknown) => { recs.length = 0; f(); expect(recs.length).toBeGreaterThan(0); return recs.flatMap(r => auditDrawing(r)); };
  it('the auditor flags the old receiver face Reed reported (lines through both hybrids)', () => {
    const { ctx, rec } = recordContext(512, 256) as { ctx: any, rec: any };
    ctx.strokeStyle = 'pink'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(270, 111); ctx.lineTo(65, 146); ctx.stroke();
    ctx.strokeStyle = 'white'; ctx.strokeRect(140, 100, 100, 70);
    expect(auditDrawing(rec).some(v => v.includes('runs through stroke rect 140,100,100,70'))).toBe(true);
  });
  const faces: [string, () => Promise<() => unknown>][] = [
    ['module PIC (side-kit mzmPicTex)', async () => (await import('./side-kit.js')).mzmPicTex],
    ['CPO ring PIC (side-kit ringPicTex)', async () => (await import('./side-kit.js')).ringPicTex],
    ['CPO electronic chip (eicTex)', async () => (await import('./side-kit.js')).eicTex],
    ['switch ASIC (asicTex)', async () => (await import('./side-kit.js')).asicTex],
    ['coherent DSP (dspTex)', async () => (await import('./side-kit.js')).dspTex],
    ['pluggable PIC, native module (ePicTex)', async () => (await import('./side-module.js')).ePicTex],
    ['coherent driver/TIA package mark', async () => { const m = await import('./side-coherent.js'); return () => m.analogTex('TIA'); }],
    ['LRO transmit-only DSP top', async () => { const m = await import('./module-lro.js'); return () => m.lroDieTop({ w: 1, d: 1 }); }],
    ['DSP capacity marking', async () => { const m = await import('./module-lro.js'); return () => m.dspMarkingTop({ w: 1, d: .5, lines: ['DSP', '8 × 100G', '800G'] }); }],
    ['tray package top', async () => { const m = await import('./tray.js'); return () => m.pkgTex('GPU'); }],
    ['tray bare die', async () => (await import('./tray.js')).dieTex],
    ['GPU die floorplan, twin die', async () => { const m = await import('./chip.js'); return () => m.floorplanTexture('z', true); }],
    ['GPU die floorplan, H100', async () => { const m = await import('./chip.js'); return () => m.floorplanTexture('x', false); }],
  ];
  for (const [name, load] of faces) it(name, async () => { expect(audit(await load())).toEqual([]); });
});

// The authored CPO detail is modeled in Blender from the same pixel layout as ringPicTex; its ring bond pads must
// follow RING.bondAt, beside each ring, not on the previous lane's waveguide.
import cpoScript from '../../tools/blender/build-cpo.py?raw';
it('Blender CPO ring bond pads follow RING.bondAt', async () => {
  const { RING } = await import('./side-kit.js');   // after the canvas stand-in: kit.js paints at import
  expect(RING.bondAt(0)).toEqual([RING.ringX(0) + 13, RING.row(0) - RING.ringR - RING.ringGap]);
  expect(cpoScript).toContain('(px(rx+13),pz(ringz),.020)');
  expect(cpoScript).toMatch(/ringz=row-10/);
});
