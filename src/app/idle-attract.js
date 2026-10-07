// User activity cancels the current orbit and starts a fresh idle interval.
export function createIdleAttract({ enter, leave, delay = 20 }) {
  let elapsed = 0, active = false;
  const reset = () => {
    elapsed = 0;
    if (active) { active = false; leave(); }
  };
  return {
    reset,
    tick(dt, eligible) {
      if (!eligible) { reset(); return; }
      elapsed += Math.min(Math.max(dt, 0), 0.1);
      if (!active && elapsed >= delay) { active = true; enter(); }
    },
  };
}
