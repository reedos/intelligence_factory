// The Intelligence Factory: the store holds the scenario and the model; the stage, the sections below it
// and the scenario bar each subscribe to it.
import { store, setScenario, pin } from './app/store.js';
import * as stage from './app/stage.js';
import './app/sections.js';
import './app/sources-ui.js';
import './app/story.js';
import './app/clock-ui.js';
import './app/share.js';
import './app/scenario.js';

stage.start();

// test hook
window.ifx = {
  store, setScenario, pin, state: store.ui, go: stage.go, select: stage.select, setMode: stage.setMode,
  camera: stage.camera, controls: stage.controls, composers: stage.composers, built: stage.built, settle: stage.settle,
};
