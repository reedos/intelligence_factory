import { describe, it, expect } from 'vitest';
import { compute, ACCELERATORS } from './engine';
import { tokenFigures, calc } from './tokens.js';
import { tokenize, buildCycle, sampleAt, figuresFor } from './token-script.js';

const run = (accel: string, meterMW = 100) => compute({ meterMW, accel, power: 'ac415', cooling: 'warm' } as any);

describe('tokenize', () => {
  it('concatenates back to the exact text, for plain and messy sentences', () => {
    const cases = [
      'The heron lifts off the water, wings catching the last light.',
      'How many tokens a second does this campus write?',
      'This campus runs 1,234 GPUs at 60% utilization, each writing about 2,000 tokens a second.',
      '100 MW divided by that rate is about 0.87 joules a token, plus 0.02 joules of training amortized in: 0.89 joules all in.',
      "It's about 8.7 billion tokens a second here.",
    ];
    for (const text of cases) expect(tokenize(text).join('')).toBe(text);
  });
  it('splits a long, suffixed word into stem and suffix', () => {
    expect(tokenize(' cooling')).toEqual([' cool', 'ing']);
    expect(tokenize(' utilization')).toEqual([' utiliza', 'tion']);
  });
  it('leaves short words and numbers whole', () => {
    expect(tokenize(' the')).toEqual([' the']);
    expect(tokenize(' 2,000')).toEqual([' 2,000']);
  });
});

describe('figuresFor / buildCycle arithmetic', () => {
  for (const accel of Object.keys(ACCELERATORS)) for (const meterMW of [10, 100, 1000]) {
    it(`${accel} @ ${meterMW} MW: rate and energy match tokenFigures()`, () => {
      const M = run(accel, meterMW);
      const t = tokenFigures(M);
      const { rate, jOps } = figuresFor(M);
      expect(rate).toBeCloseTo(t.rate, 6);
      expect(jOps + t.jTrain).toBeCloseTo(t.j, 6);
    });
    it(`${accel} @ ${meterMW} MW: the reasoning trace states those same numbers`, () => {
      const M = run(accel, meterMW);
      const t = tokenFigures(M);
      const { rate } = figuresFor(M);
      const cycle = buildCycle(M);
      const j2 = (v: number) => v < 1 ? v.toFixed(3) : v.toFixed(2);
      expect(cycle.reasoningText).toContain(j2(t.j));
      expect(cycle.jPerToken).toBeCloseTo(t.j, 9);
      expect(cycle.campusTps).toBeCloseTo(rate, 6);
    });
    it(`${accel} @ ${meterMW} MW: prompt, reasoning and answer tokens concatenate back to their text`, () => {
      const cycle = buildCycle(run(accel, meterMW));
      expect(cycle.prompt.join('')).toBe(cycle.promptText);
      expect(cycle.reasoning.join('')).toBe(cycle.reasoningText);
      expect(cycle.answer.join('')).toBe(cycle.answerText);
    });
  }
});

describe('sampleAt', () => {
  const M = run('gb200', 100);
  const cycle = buildCycle(M);
  it('bursts the prompt in during prefill, then holds it through the rest of the cycle', () => {
    const early = sampleAt(cycle, cycle.timings.prefillS * 0.5);
    expect(early.phase).toBe('prefill');
    expect(early.promptOut).toBeGreaterThan(0);
    expect(early.promptOut).toBeLessThanOrEqual(cycle.prompt.length);
    const later = sampleAt(cycle, cycle.timings.totalS - 0.01);
    expect(later.promptOut).toBe(cycle.prompt.length);
  });
  it('reveals reasoning tokens one at a time before any answer token appears', () => {
    const mid = sampleAt(cycle, cycle.timings.prefillS + cycle.timings.reasoningS * 0.5);
    expect(mid.phase).toBe('reasoning');
    expect(mid.reasoningOut).toBeGreaterThan(0);
    expect(mid.reasoningOut).toBeLessThan(cycle.reasoning.length);
    expect(mid.answerOut).toBe(0);
  });
  it('fills the context fraction to 1 and empties it again on the next cycle', () => {
    const end = sampleAt(cycle, cycle.timings.totalS - 0.01);
    expect(end.contextFrac).toBeCloseTo(1, 5);
    const restart = sampleAt(cycle, cycle.timings.totalS + 0.01);
    expect(restart.phase).toBe('prefill');
    expect(restart.contextFrac).toBeLessThan(0.2);
  });
  it('never runs the campus-wide rate backwards as the reader raises utilization', () => {
    calc.tpsTouched = false;
    const lowU = buildCycle(M, { ...calc, util: 0.3 });
    const highU = buildCycle(M, { ...calc, util: 0.9 });
    expect(highU.campusTps).toBeGreaterThan(lowU.campusTps);
  });
});
