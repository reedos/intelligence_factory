// The Parts index: a plain-text walk through every level and every part card the visualizer renders in 3D, for the
// site's one reference scenario. tools/prerender-plugin.mjs bakes the full list into parts.html at build time (and
// in dev, since this page's content never depends on a reader's filter); this script only wires up the shared
// top bar. There is nothing to hydrate: the markup the build wrote is the final markup.
import '../app/site.js';
