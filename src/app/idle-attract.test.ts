import { expect, it, vi } from 'vitest';
import { createIdleAttract } from './idle-attract.js';

it('starts again after activity and another full idle interval', () => {
  const enter = vi.fn(), leave = vi.fn();
  const idle = createIdleAttract({ enter, leave });
  const seconds = (n: number) => { for (let i = 0; i < n * 10; i++) idle.tick(0.1, true); };
  seconds(19); idle.reset(); seconds(19);
  expect(enter).not.toHaveBeenCalled();
  seconds(2); expect(enter).toHaveBeenCalledTimes(1);
  idle.reset(); expect(leave).toHaveBeenCalledTimes(1);
  seconds(21); expect(enter).toHaveBeenCalledTimes(2);
});

it('does not accumulate hidden, reduced-motion, other-scene or camera-transition time', () => {
  const enter = vi.fn(), leave = vi.fn();
  const idle = createIdleAttract({ enter, leave });
  for (let i = 0; i < 190; i++) idle.tick(0.1, true);
  idle.tick(100, false);
  for (let i = 0; i < 190; i++) idle.tick(0.1, true);
  expect(enter).not.toHaveBeenCalled();
  for (let i = 0; i < 20; i++) idle.tick(0.1, true);
  expect(enter).toHaveBeenCalledTimes(1);
  idle.tick(0.1, false); expect(leave).toHaveBeenCalledTimes(1);
});
