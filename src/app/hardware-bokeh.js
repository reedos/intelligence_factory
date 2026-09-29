import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { withHardwareDepth } from './hardware-depth.js';

// Bokeh's MeshDepthMaterial override has the same billboard/transparent-cover
// hazard as GTAO's normal override. Focus on hardware, not the proxy rectangles
// behind animated ribbons, captions, vapor, and inspection covers.
export class HardwareBokehPass extends BokehPass {
  render(...args) {
    return withHardwareDepth(this.scene, () => super.render(...args));
  }
}
