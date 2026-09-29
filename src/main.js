// The Intelligence Factory, the story page: the scenario, the chapters and their charts. The 3D visualizer is its
// own page (visualizer.html, src/visualizer.js); links here that show a part open it at that level, layer and part.
import { store, setScenario, pin } from './app/store.js';
import './app/sections.js';
import './app/sources-ui.js';
import './tokens.css';
import './app/scenario.js';
import './app/site.js';

// test hook
window.ifx = { store, setScenario, pin };
