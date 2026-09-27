// The Intelligence Factory: the store holds the scenario and the model; the stage, the sections below it
// and the scenario bar each subscribe to it.
import { store, setScenario, pin } from './app/store.js';
import * as stage from './app/stage.js';
import './app/sections.js';
import './app/sources-ui.js';
import './app/story.js';
import './app/clock-ui.js';
import './app/share.js';
import './app/tokens-ui.js';
import './tokens.css';
import { THREE } from './kit.js';
import * as journeys from './app/journeys.js';
import { openClock, closeClock } from './app/clock-ui.js';
import { enter as enterStory, exit as exitStory } from './app/story.js';
import './app/scenario.js';
import './app/site.js';

stage.start();

// test hook
window.ifx = {
  store, setScenario, pin, state: store.ui, go: stage.go, select: stage.select, setMode: stage.setMode,
  camera: stage.camera, controls: stage.controls, composers: stage.composers, built: stage.built, settle: stage.settle,
  renderer: stage.getRenderer, renderScale: stage.renderScale, quality: stage.qualityInfo, forceTier: stage.forceTier, setTransitions: stage.setTransitions,
  show: stage.show, THREE, journeys, openClock, closeClock, enterStory, exitStory,
};
