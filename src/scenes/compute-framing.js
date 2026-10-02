import { componentView } from '../app/housing-frame.js';

// Inspection regions are in each scene's own units (m, 10 cm, cm). Fit the
// subject to the available canvas instead of applying blanket phone pullbacks.
export function frameCompute(built, kind, accel) {
  const h100 = accel === 'h100';
  if (kind === 'rack') {
    built.camera = {...built.camera,pos:[2.8,2.4,3.7],target:[0,1.2,.28]};
  } else if (kind === 'tray') {
    built.camera = { ...built.camera, ...(h100 ? componentView([0, 1.5, -.2], [9.5, 4.4, 5.6], [4.9, 3.7, 9.6]) : componentView([0, .4, -.1], [7, 7, 9], [4.9, 1.3, 10.0])) };
  } else if (kind === 'chip') {
    built.camera = { ...built.camera, ...componentView([0, 2.5, 0], [9, 6, 11], [9.2, 5.0, 9.2]) };
    // The fit box stops just above the HBM tops (about 3.5 cm), so the exploded
    // stack fills the frame instead of leaving a band of empty space above it.
    built.cameraByMode.power = { ...componentView([0, 2.0, 0], [10, 3.4, 12], [9.2, 4.0, 9.2]) };
  }
  const rackSizes = {
    feed: [.55,.7,.45], shelves: [.55,.18,.30], busbar: [.18,1.15,.15],
    spine: [.48,1.15,.22], manifold: [.20,.55,.23], nvswitch: [.48,.12,.85],
    mgmt: [.52,.10,.22], pdu: [.50,1.2,.22], cabling: [.5,.65,.35],
    uplinks: [.48,.75,.40], front: [.6,1.4,.8], rearair: [.65,1.5,.85], psus: [.46,.16,.22],
  };
  const traySizes = {
    osfp: [1.4,.65,1.8], clip: [1.4,.6,.9], ibc: [1.6,.7,1.3],
    vrm: [1.1,.65,1.4], gpu: [1.65,1.35,1.65], gpuheat: [1.65,1.35,1.65],
    grace: [1.5,1.1,1.5], cpu: [1.6,1.3,1.7], lpddr: [.9,.4,1.0],
    coldplates: [1.6,1.3,1.7], nic: [1.3,.8,1.3], cx: [1.3,.8,1.3],
    nvconn: [1.5,.65,1.1], fans: h100 ? [4.4,3.4,.65] : [3.9,.65,.65],
    qd: [1,.7,1.0], c2c: [1.6,.65,2.0], dpu: [1.3,.8,1.3],
    psu: [2.4,1.2,1.5], nvswitch: [1.35,1.1,1.35], pcie: [2.1,.8,1.4], manifold: [1.0,1.3,2.0],
  };
  const chipSizes = {
    balls: [3.3,.6,3.3], interposer: [4.7,1.0,4.0], dies: [h100 ? 3.2 : 5.8,1.0,3.5],
    junction: [h100 ? 3.2 : 5.8,1.0,3.5], hbm: [2.1,1.8,2.1],
    flux: [3.2,1.4,3.1], tim: [7.5,1.0,7.5], hbi: [2.2,.7,2.1],
    nvphy: [2.6,1.1,2.5], cpo: [4.0,1.7,3.4],
  };
  // A shared hotspot may appear in several layers. Keep one canonical preset.
  const seen = new Set();
  for (const list of [built.hotspots, built.dataHotspots, built.heatHotspots]) for (const [id,h] of Object.entries(list || {})) {
    if (seen.has(h)) continue; seen.add(h);
    if (h.view.detailSize) continue;
    if (kind === 'rack' && id === 'optical') {
      h.pos = [.34,1.55,h100 ? -.63 : .60];
      h.view = componentView([.08,1.45,h100 ? -.15 : .22], [1,.6,h100 ? -1.4 : 1.4], [.85,1.3,1.1]);
      continue;
    }
    if (kind === 'chip' && id === 'tokens') {
      // Keep the pin beside the live rows, not printed on top of their words.
      // Include the package below so token inspection never crops its base.
      h.pos = [6.15,5.55,-1];
      h.view = componentView([.7,3.2,0], [6,5.3,11], [11.2,6.7,9.2]);
      continue;
    }
    if (kind === 'rack' && (id === 'compute' || id === 'servers' || id === 'tp')) {
      const yb = h100 ? .16+2*(8*.04445+.004) : .12+24*.04445;
      const z = h100 ? 1.045 : .965;
      h.pos = id === 'tp' && !h100 ? [-.11,yb+.06,z-.20] : [.13,yb+(h100 ? .15 : .06),z+.10];
      h.view = componentView([0,yb+(h100 ? .17 : .03),z], [.7,.9,1.1], [.5,h100 ? .37 : .13,.96]);
      continue;
    }
    if (kind === 'rack' && !h100 && id === 'nvswitch') {
      // Inspect below the extended compute tray instead of looking through it.
      const y=.12+15*.04445+.022225;
      h.view=componentView([0,y+.018,.665],[.45,.17,1.1],[.48,.09,.82]);
      continue;
    }
    if (kind === 'rack' && h100 && id === 'psus') {
      h.view = componentView([.03,1.0,.715], [.7,.6,.15], [.46,.18,.24]);
      continue;
    }
    if (kind === 'tray' && accel === 'rubin' && id === 'c2c') {
      h.view = componentView(h.pos, [0,.16,.55], [1.4,.35,1.4]);
      continue;
    }
    const size = (kind === 'rack' ? rackSizes : kind === 'tray' ? traySizes : chipSizes)[id];
    if (!size) continue;
    // Existing approach directions were selected for openings in the chassis.
    // Retain those directions, but center the component rather than empty space.
    let focus = [...h.view.target];
    if (kind === 'tray' && !['fans','psu'].includes(id)) focus = h.pos.map((v,i) => i === 1 ? v - .15 : v);
    if (kind === 'chip' && id === 'hbm') focus = [...h.pos];
    const offset = h.view.pos.map((v,i) => v - h.view.target[i]);
    h.view = componentView(focus, offset, size);
  }
}
