// The token matrix math on the Tokens card ("Show the math"): the FLOPs and HBM bytes per token, and the
// memory-bound comparison, must follow from the named model and the scenario's accelerator, and every row must
// carry the evidence its basis promises.
import { describe, it, expect } from 'vitest';
import { compute } from './engine';
import { content } from '../data.js';
import { claimByKey } from '../claims.js';
import { CALCS, ASSUMPTIONS } from '../evidence.js';
import { TOKEN_MATH_MODEL, tokenMath, tokenMathRows } from './token-math.js';

describe('token matrix math', () => {
  it('arithmetic is 2 FLOPs per parameter, and bytes are parameters times bytes per parameter', () => {
    const t = tokenMath(compute({ meterMW: 100, accel: 'gb200', power: 'ac415', cooling: 'warm' }) as any);
    expect(TOKEN_MATH_MODEL.params).toBe(70e9);
    expect(TOKEN_MATH_MODEL.bytesPerParam).toBe(1);        // FP8
    expect(t.flops).toBe(140e9);
    expect(t.bytes).toBe(70e9);
    expect(t.intensity).toBe(2);
    expect(tokenMath({ accel: { hbm: { tbs: 8 }, fp8PF: 5 } } as any, { ...TOKEN_MATH_MODEL, params: 8e9, bytesPerParam: 2 }).bytes).toBe(16e9);
  });
  it('the GPU balance and step times follow the accelerator’s published peak and HBM bandwidth', () => {
    const gb = tokenMath(compute({ meterMW: 100, accel: 'gb200', power: 'ac415', cooling: 'warm' }) as any);
    expect(gb.mathPrecision).toBe('FP8');
    expect(gb.balance).toBeCloseTo(5e15 / 8e12, 6);         // 625 FLOP per byte
    expect(gb.readS).toBeCloseTo(70e9 / 8e12, 12);           // ≈8.75 ms
    expect(gb.mathS).toBeCloseTo(140e9 / 5e15, 12);          // ≈0.028 ms
    expect(gb.readS / gb.mathS!).toBeGreaterThan(100);       // decode, one stream, is memory-bound
    const h = tokenMath(compute({ meterMW: 100, accel: 'h100', power: 'ac415', cooling: 'air' }) as any);
    expect(h.readS).toBeCloseTo(70e9 / 3.35e12, 12);
    const r = tokenMath(compute({ meterMW: 100, accel: 'rubin', power: 'dc800', cooling: 'warm' }) as any);
    expect(r.mathPrecision).toBe('FP4');                     // no published FP8 peak: the row says FP4
    expect(r.balance).toBeCloseTo(35e15 / 19.2e12, 6);
  });
  it('the rows show those figures, labeled derived, and every chip key finds its row', () => {
    const M = compute({ meterMW: 100, accel: 'gb200', power: 'ac415', cooling: 'warm' }) as any, C = content(M) as any;
    const rows = tokenMathRows(M);
    const by = Object.fromEntries(rows.map(r => [r[0], r]));
    expect(by['Arithmetic per token'][1]).toContain('≈140 GFLOP');
    expect(by['Read from HBM per token'][1]).toContain('≈70 GB');
    expect(by['Arithmetic per byte read'][1]).toMatch(/≈2 FLOP; GB200 can do ≈625 \(FP8\)/);
    expect(by['One stream on one GPU'][1]).toMatch(/≈8\.8 ms reading weights vs ≈0\.028 ms of math/);
    for (const r of rows.slice(1)) { expect(r[2]).toBe('derived'); expect((CALCS as any)[(r[3] as any).calc], String(r[0])).toBeTruthy(); }
    expect(rows[0][2]).toBe('assumed'); expect((ASSUMPTIONS as any)[(rows[0][3] as any).assume]).toBeTruthy();
    for (const mode of ['power', 'data']) rows.forEach((r, i) => expect((claimByKey(M, C, `card:${mode}:chip:tokens:math:${i}`) as any)?.label).toBe(r[0]));
  });
});
