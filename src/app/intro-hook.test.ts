import { describe, expect, it } from 'vitest';
import { splitIntro } from './intro-hook.js';
import { compute, ACCELERATORS } from '../model/engine';
import { content } from '../data.js';

describe('the intro hook', () => {
  it('is the first sentence, and loses nothing', () => {
    const text = 'Every rack takes its power from the busway above it. Power plants feed 345 kV lines. More follows.';
    const { hook, rest } = splitIntro(text);
    expect(hook).toBe('Every rack takes its power from the busway above it.');
    expect(hook + rest).toBe(text);
  });
  it('does not stop at a decimal, an abbreviation or a bare number', () => {
    expect(splitIntro('A 2.3 m rack, e.g. the GB200 one, takes 415 V AC in. Then it converts.').hook).toBe('A 2.3 m rack, e.g. the GB200 one, takes 415 V AC in.');
    expect(splitIntro('Shown: a hall of 192 racks vs. a campus of 2.5 MW halls. Counts say what they cover.').hook).toBe('Shown: a hall of 192 racks vs. a campus of 2.5 MW halls.');
  });
  it('takes a second sentence when the first is only a few words', () => {
    expect(splitIntro('Start at the grid. Power plants feed 345 kV lines into campuses. More follows.').hook).toBe('Start at the grid. Power plants feed 345 kV lines into campuses.');
  });
  it('keeps a one-sentence intro whole, with an empty rest', () => {
    expect(splitIntro('One sentence only.')).toEqual({ hook: 'One sentence only.', rest: '' });
    expect(splitIntro('')).toEqual({ hook: '', rest: '' });
  });
  it('gives every level and layer of every accelerator a whole sentence a phone peek can show', () => {
    for (const accel of Object.keys(ACCELERATORS)) {
      const C = content(compute({ meterMW: 100, accel, power: 'dc800', cooling: 'liquid' } as any)) as any;
      for (const scene of C.SCENES) for (const text of [scene.intro, scene.dataIntro, scene.heatIntro]) {
        if (typeof text !== 'string') continue;
        const { hook, rest } = splitIntro(text);
        expect(hook + rest).toBe(text);
        expect(hook.trim().length, `${scene.id}: ${text.slice(0, 80)}`).toBeGreaterThan(12);
        expect(hook, `${scene.id} hook is not a whole sentence: ${hook}`).toMatch(/[.!?:]["”’')\]]*$/);
        expect(hook.length, `${scene.id} hook is too long: ${hook}`).toBeLessThan(400);
      }
    }
  });
});
