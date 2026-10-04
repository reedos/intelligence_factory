import { describe, expect, it } from 'vitest';
import { placeCaption } from './scene-captions.js';

describe('in-scene caption placement', () => {
  it('stays put where nothing is in the way', () => {
    const box = placeCaption(300, 200, 120, 20, [], 800, 600)!;
    expect(box.left).toBe(240); expect(box.top).toBe(190);
  });
  it('steps down off a pin label that sits on it', () => {
    const taken = { left: 200, right: 400, top: 185, bottom: 215 };
    const box = placeCaption(300, 200, 120, 20, [taken], 800, 600)!;
    expect(box.top).toBeGreaterThanOrEqual(215);
  });
  it('keeps the box inside the view', () => {
    const box = placeCaption(10, 595, 120, 20, [], 800, 600)!;
    expect(box.left).toBeGreaterThanOrEqual(8); expect(box.bottom).toBeLessThanOrEqual(592);
  });
  it('gives up (null) when every place is taken', () => {
    expect(placeCaption(300, 200, 120, 20, [{ left: 0, right: 800, top: 0, bottom: 600 }], 800, 600)).toBeNull();
  });
});
