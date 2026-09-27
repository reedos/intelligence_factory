// Shared state: the scenario, the model computed from it, the content built from the model, and a pinned
// scenario to compare against. Views subscribe and redraw when it changes.
import { compute, DEFAULT_SCENARIO } from '../model/engine.ts';
import { content } from '../data.js';

const listeners = new Map();
export const store = {
  scenario: { ...DEFAULT_SCENARIO },
  M: null, C: null,
  pinned: null,          // a model to compare against, or null
  ui: { scene: -1, selected: null, mode: 'power' },
};

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event).delete(fn);
}
export function emit(event, detail) { (listeners.get(event) || []).forEach(fn => fn(detail)); }

export function setScenario(patch) {
  const M = compute({ ...store.scenario, ...patch });
  store.scenario = { ...M.scenario };         // the engine falls back on options an accelerator cannot take
  store.M = M; store.C = content(M);
  emit('scenario', M);
}
export function pin(on_ = true) {
  store.pinned = on_ ? store.M : null;
  emit('pin', store.pinned);
}

setScenario({});
