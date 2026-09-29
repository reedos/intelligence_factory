// The Intelligence Factory, the story page: the scenario, the chapters and their charts. The 3D visualizer is its
// own page (visualizer.html, src/visualizer.js); links here that show a part open it at that level, layer and part.
import { store, setScenario, pin } from './app/store.js';
import './app/sections.js';
import './app/sources-ui.js';
import './tokens.css';
import './app/scenario.js';
import './app/site.js';
import { on } from './app/store.js';
import { renderSection, opts, WHERE } from './app/clock-charts.js';
import { visualizerHref } from './app/links.js';

// the Four clocks: charts here, "Play in 3D" opens the visualizer with that clock running at its place
const playClock = id => {
  const w = WHERE[id];
  location.href = visualizerHref(`${w.scene}.${w.mode}.${w.part}`, `&clock=${id}&pt=${opts.peakTrough}&hot=${opts.hotMax}`);
};
on('scenario', () => renderSection(playClock));
renderSection(playClock);

// test hook
window.ifx = { store, setScenario, pin };
