import { describe, expect, it, vi } from 'vitest';
import { createPartCycle } from './part-cycle.js';

function setup(initial: string | null = null) {
  let selection = initial, available = ['first', 'door', 'last'], ready = true;
  const changed = vi.fn(), chosen: string[] = [];
  const cycle = createPartCycle({ parts: () => available, selected: () => selection,
    select: (id: string) => { expect(cycle.selecting).toBe(true); selection = id; chosen.push(id); },
    ready: () => ready, changed });
  return { cycle, chosen, changed, setReady: (v: boolean) => ready = v, setParts: (v: string[]) => available = v };
}
describe('within-level part cycling', () => {
  it('starts at the first part from overview, visits doors without entering them, and wraps in list order', () => {
    const { cycle, chosen } = setup(); cycle.start();
    for (let i = 0; i < 3; i++) cycle.tick(8);
    expect(chosen).toEqual(['first', 'door', 'last', 'first']);
    expect(cycle.selecting).toBe(false);
  });
  it('resumes at the current selection and waits a full dwell after movement or hidden-tab holds', () => {
    const { cycle, chosen, setReady } = setup('door'); cycle.start();
    setReady(false); cycle.tick(40); expect(chosen).toEqual([]);
    setReady(true); cycle.tick(7.9); expect(chosen).toEqual([]);
    cycle.tick(.11); expect(chosen).toEqual(['last']);
  });
  it('stops immediately and restarting grants a fresh reading interval', () => {
    const { cycle, chosen } = setup('first'); cycle.start(); cycle.tick(7);
    cycle.stop(); cycle.tick(100); expect(chosen).toEqual([]);
    cycle.start(); cycle.tick(1); expect(chosen).toEqual([]);
    cycle.tick(7); expect(chosen).toEqual(['door']);
  });
  it('does not run with fewer than two parts and stops if the list becomes empty', () => {
    const { cycle, setParts } = setup(); setParts(['only']); cycle.start(); expect(cycle.playing).toBe(false);
    setParts(['a', 'b']); cycle.start(); expect(cycle.playing).toBe(true);
    setParts([]); cycle.tick(8); expect(cycle.playing).toBe(false);
  });
});
