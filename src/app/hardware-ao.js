import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { withHardwareDepth } from './hardware-depth.js';

// GTAO overrides materials to render normals. A LineSegments2 is a Mesh whose
// real shape comes from its shader: the normal override renders the underlying
// billboard as an opaque rectangle. Captions and transparent inspection/flow
// layers likewise must not become physical occluders. The preceding color pass
// still renders them normally; visibility is restored even if AO rendering fails.
export class HardwareGTAOPass extends GTAOPass {
  render(...args) {
    return withHardwareDepth(this.scene, () => super.render(...args));
  }
}
