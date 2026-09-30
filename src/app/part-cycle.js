// Lightweight playback of the current level's parts. No tours, clocks or drills.
export function createPartCycle({ parts, selected, select, ready, changed, dwell = 8 }) {
  let playing = false, elapsed = 0, selecting = false;
  const choose = id => {
    selecting = true;
    try { select(id); } finally { selecting = false; }
  };
  const stop = () => { playing = false; elapsed = 0; changed(); };
  const start = () => {
    const ids = parts();
    if (ids.length < 2) return;
    playing = true; elapsed = 0;
    if (!ids.includes(selected())) choose(ids[0]);
    changed();
  };
  return {
    get playing() { return playing; },
    get selecting() { return selecting; },
    start, stop,
    toggle() { if (playing) stop(); else start(); },
    tick(dt) {
      if (!playing || !ready()) return;
      elapsed += Math.max(0, dt);
      if (elapsed < dwell) return;
      elapsed = 0;
      const ids = parts();
      if (ids.length < 2) return stop();
      choose(ids[(ids.indexOf(selected()) + 1) % ids.length]);
    },
  };
}
