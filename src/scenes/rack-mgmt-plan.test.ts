import { describe, it, expect } from 'vitest';
// @ts-ignore plain JS module
import { planMgmtLeads, segDist, LEAD_R, MGMT_ROWS, trayY } from './rack-mgmt-plan.js';

type P = number[];
const visible = (a: P, b: P) => a[2] > 0.4725 || b[2] > 0.4725;      // segments inside the brush strip are hidden
const segs = (l: { up: P[]; down: P[] }) => {
  const pts = [...l.up, ...l.down.slice(1)], out: [P, P][] = [];
  for (let i = 1; i < pts.length; i++) if (visible(pts[i - 1], pts[i])) out.push([pts[i - 1], pts[i]]);
  return out;
};

describe('rack management leads', () => {
  it('one lead to every compute and switch tray still in the rack, none to the two pulled out', () => {
    expect(MGMT_ROWS.length).toBe(25);
    expect(MGMT_ROWS).not.toContain(25);
    expect(MGMT_ROWS).not.toContain(16);
    for (const r of [4, 11, 12, 20, 21, 30]) expect(MGMT_ROWS).toContain(r);
  });
  for (const accel of ['gb200', 'gb300', 'rubin']) it(`${accel}: no two visible leads touch`, () => {
    const leads = planMgmtLeads(accel), all = leads.map(segs);
    let worst = Infinity;
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++)
      for (const [a, b] of all[i]) for (const [c, d] of all[j]) worst = Math.min(worst, segDist(a, b, c, d));
    expect(worst).toBeGreaterThan(2 * LEAD_R);
  });
  it('each lead ends at a jack on its own tray', () => {
    for (const l of planMgmtLeads('gb200')) {
      const end = l.down[l.down.length - 1] as number[];
      expect(Math.abs(end[1] - trayY(l.row))).toBeLessThan(0.01);
      expect(end[0]).toBeCloseTo(l.jack.x, 6);
    }
  });
});
