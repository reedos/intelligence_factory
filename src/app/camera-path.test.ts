import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { poseAt, samplePath, clearPath, planPath, pathLength } from './camera-path.js';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
function arcMove(p0: THREE.Vector3, t0: THREE.Vector3, p1: THREE.Vector3, t1: THREE.Vector3, lift = 0.055, pull = 0.025) {
  const s0 = new THREE.Spherical().setFromVector3(p0.clone().sub(t0)), s1 = new THREE.Spherical().setFromVector3(p1.clone().sub(t1));
  let dTheta = s1.theta - s0.theta; dTheta -= Math.round(dTheta / (2 * Math.PI)) * 2 * Math.PI;
  return { p0, t0, p1, t1, arc: { s0, s1, dTheta, lift, pull }, hop: null as null | { up: number; back: number } };
}
const line = (p0: THREE.Vector3, t0: THREE.Vector3, p1: THREE.Vector3, t1: THREE.Vector3) => ({ p0, t0, p1, t1, arc: null, hop: null as null | { up: number; back: number } });
// a wall: the box x in [-1, 1], y below `top`, any z
const through = (top: number) => (a: { pos: THREE.Vector3 }, b: { pos: THREE.Vector3 }) => {
  const box = new THREE.Box3(V(-1, -100, -100), V(1, top, 100));
  const d = b.pos.clone().sub(a.pos), len = d.length();
  if (len < 1e-9) return box.containsPoint(a.pos);
  const hit = new THREE.Ray(a.pos, d.normalize()).intersectBox(box, new THREE.Vector3());
  return !!hit && hit.distanceTo(a.pos) <= len;
};

describe('camera path sampler', () => {
  it('starts and ends exactly on the move’s framing, arcs and straight moves alike, raised or not', () => {
    const p0 = V(10, 5, 0), t0 = V(0, 0, 0), p1 = V(-10, 4, 3), t1 = V(-2, 0, 1);
    for (const m of [arcMove(p0, t0, p1, t1), line(p0, t0, p1, t1), { ...line(p0, t0, p1, t1), hop: { up: 7, back: 0.4 } }, arcMove(p0, t0, p1, t1, 0.9, 1.2), (() => { const q = arcMove(p0, t0, p1, t1); Object.assign(q.arc, { xlift: 0.8, xpull: 1 }); return q; })()]) {
      const a = poseAt(m, 0), b = poseAt(m, 1);
      expect(a.pos.distanceTo(p0)).toBeLessThan(1e-9); expect(a.target.distanceTo(t0)).toBeLessThan(1e-9);
      expect(b.pos.distanceTo(p1)).toBeLessThan(1e-9); expect(b.target.distanceTo(t1)).toBeLessThan(1e-9);
    }
  });
  it('matches the playback math: the eased lerp for straight moves, the lifted swing for arcs', () => {
    const m = line(V(0, 0, 0), V(0, 0, -5), V(10, 0, 0), V(10, 0, -5));
    expect(poseAt(m, 0.5).pos.x).toBeCloseTo(5, 9);
    const a = arcMove(V(10, 0.01, 0), V(0, 0, 0), V(0, 0.01, 10), V(0, 0, 0), 0.3, 0);
    const mid = poseAt(a, 0.5).pos, flat = poseAt({ ...a, arc: { ...a.arc, lift: 0 } }, 0.5).pos;
    expect(mid.y).toBeGreaterThan(flat.y + 1);                 // lift raises the camera mid-move
    expect(mid.length()).toBeCloseTo(10, 4);                    // at the same distance: no pull
  });
  it('samples n + 1 evenly spaced poses', () => {
    const pts = samplePath(line(V(0, 0, 0), V(0, 0, -1), V(4, 0, 0), V(4, 0, -1)), 32);
    expect(pts).toHaveLength(33);
    expect(pts[0].u).toBe(0); expect(pts[32].u).toBe(1);
    expect(pathLength(pts)).toBeCloseTo(4, 6);
  });
});

describe('clearing a path', () => {
  it('leaves a clear move alone', () => {
    const m = line(V(-10, 5, 0), V(-10, 0, -5), V(-4, 5, 0), V(-4, 0, -5));
    expect(clearPath(m, through(3))).toMatchObject({ clear: true, tries: 0, stretch: 1 });
    expect(m.hop).toBeNull();
  });
  it('hops a straight move up and over a wall, keeping both ends', () => {
    const p0 = V(-10, 2, 0), p1 = V(10, 2, 0), t0 = V(-10, 0, -5), t1 = V(10, 0, -5);
    const m = line(p0, t0, p1, t1), got = clearPath(m, through(4));
    expect(got.clear).toBe(true);
    expect(m.hop!.up).toBeGreaterThan(0);
    expect(got.stretch).toBeGreaterThan(1);
    const pts = samplePath(m, 64);
    for (let k = 1; k < pts.length; k++) expect(through(4)(pts[k - 1], pts[k])).toBe(false);
    expect(pts[0].pos.distanceTo(p0)).toBeLessThan(1e-9); expect(pts[64].pos.distanceTo(p1)).toBeLessThan(1e-9);
  });
  it('lifts an arc over a wall between two views', () => {
    const t0 = V(-6, 0, 0), t1 = V(6, 0, 0);
    const m = arcMove(V(-6, 1.5, 8), t0, V(6, 1.5, 8), t1);
    const got = clearPath(m, through(3));
    expect(got.clear).toBe(true);
    expect((m.arc as { xlift?: number }).xlift).toBeGreaterThan(0);
  });
  it('never makes a move worse: with nothing clear it keeps the least obstructed path, the unraised one on a tie', () => {
    const m = line(V(-10, 2, 0), V(-10, 0, -5), V(10, 2, 0), V(10, 0, -5));
    const got = clearPath(m, () => 1);
    expect(got).toMatchObject({ clear: false, stretch: 1 });
    expect(m.hop).toBeNull();
    // only the camera's height counts here: raised paths hit less, so the most raised one is kept
    const n = line(V(-10, 2, 0), V(-10, 0, -5), V(10, 2, 0), V(10, 0, -5));
    const low = (a: { pos: THREE.Vector3 }) => (a.pos.y < 5 ? 1 : 0);
    const got2 = clearPath(n, low);
    expect(got2.clear).toBe(false);
    expect(n.hop!.up).toBeGreaterThan(0);
  });
  it('keeps the authored move when every detour still passes through something', () => {
    const m = line(V(-10, 2, 0), V(-10, 0, -5), V(10, 2, 0), V(10, 0, -5));
    const got = clearPath(m, (a: { u: number; pos: THREE.Vector3 }, b: { pos: THREE.Vector3 }) => (m.hop || (m as { via?: unknown }).via ? (a.u === 0.5 ? 100 : 0) : through(4)(a, b) ? 100 : 0), { through: 100 });
    expect(got).toMatchObject({ clear: false, stretch: 1 });
    expect(m.hop).toBeNull();
  });
  it('passes through a surface is worse than skimming one', () => {
    const m = line(V(-10, 2, 0), V(-10, 0, -5), V(10, 2, 0), V(10, 0, -5));
    // the straight path passes through (2); every hop skims once (1): a hop is kept though none is clear
    const got = clearPath(m, (a: { u: number; pos: THREE.Vector3 }, b: { pos: THREE.Vector3 }) => (m.hop || (m as { via?: unknown }).via ? (a.u === 0.5 ? 1 : 0) : through(4)(a, b) ? 2 : 0));
    expect(got.clear).toBe(false);
    expect(m.hop).not.toBeNull();
  });
  it('routes through waypoints when no bump clears: out along the start view, in along the end view', () => {
    // the end framing sits in a slot: walls on both sides and above, open only behind the camera (+z)
    const p0 = V(-10, 1, 6), t0 = V(-10, 0, 0), p1 = V(0, 1, 2), t1 = V(0, 0, -3);
    const boxes = [new THREE.Box3(V(-1.5, -1, -4), V(-0.5, 3, 4)), new THREE.Box3(V(0.5, -1, -4), V(1.5, 3, 4)), new THREE.Box3(V(-1.5, 3, -4), V(1.5, 3.5, 4))];
    const hits = (a: { pos: THREE.Vector3 }, b: { pos: THREE.Vector3 }) => {
      const d = b.pos.clone().sub(a.pos), len = d.length(); if (len < 1e-9) return 0;
      const r = new THREE.Ray(a.pos, d.normalize()), q = new THREE.Vector3();
      return boxes.some(bx => r.intersectBox(bx, q) && q.distanceTo(a.pos) <= len) ? 100 : 0;
    };
    // (every bump is ruled out here, to make the waypoints the only way)
    const m = line(p0, t0, p1, t1), got = clearPath(m, (a: { pos: THREE.Vector3 }, b: { pos: THREE.Vector3 }) => (m.hop ? 100 : hits(a, b)));
    expect(got.clear).toBe(true);
    expect((m as { via?: THREE.Vector3[] }).via?.length).toBeGreaterThan(0);
    const pts = samplePath(m, 64);
    for (let k = 1; k < pts.length; k++) expect(hits(pts[k - 1], pts[k])).toBe(0);
    expect(pts[64].pos.distanceTo(p1)).toBeLessThan(1e-6);
  });
  it('runs in slices to the same plan', () => {
    const mk = () => line(V(-10, 2, 0), V(-10, 0, -5), V(10, 2, 0), V(10, 0, -5));
    const a = mk(), b = mk(), g = planPath(b, through(4));
    const whole = clearPath(a, through(4));
    let r = g.next(), slices = 0; while (!r.done) { slices++; r = g.next(); }
    expect(slices).toBeGreaterThan(0);
    expect(r.value).toEqual(whole);
    expect(b.hop).toEqual(a.hop);
  });
  it('is bounded by a count of tries, not by time', () => {
    const m = line(V(-10, 2, 0), V(-10, 0, -5), V(10, 2, 0), V(10, 0, -5));
    expect(clearPath(m, () => 1, { maxTries: 7 }).tries).toBe(7);
  });
});
