// A common finishing language without making a night map, working hall, and
// product close-up share the same lighting. No shared MAT or flow material is
// touched; authored signal colors, light positions, shadows and geometry survive.
const PROFILES = Object.freeze({
  // Keep the geographic view's night environment and warm settlement lights.
  0: { look: { bloom: 0.72, threshold: 1.0, grain: 0.008, vignette: 0.2 } },
  // Raise midtone readability a little while keeping ceiling/light-strip bloom
  // below the point where neighboring rack rows merge into a bright surface.
  2: { look: { exposure: 0.98, bloom: 0.42, threshold: 1.25, grain: 0.008, vignette: 0.2 } },
  // Lift black cabinet faces enough to show their edges in the studio setup.
  3: { look: { envIntensity: 0.55, exposure: 1.05, bloom: 0.42, threshold: 1.5, grain: 0.006, vignette: 0.2 },
    lights: { hemisphere: 0.85, directional: [2.5, 1.25] } },
  // Both tray variants already protect fine components with a high bloom
  // threshold. Preserve their individual exposure, AO, and light settings.
  4: { look: { grain: 0.006, vignette: 0.18 } },
  // Studio reflections describe stacked package edges without adding geometry
  // or textures that might be mistaken for a recovered production floorplan.
  5: {
    look: { env: 'studio', envIntensity: 0.55, exposure: 1.0, bloom: 0.4, threshold: 1.7, grain: 0.006, vignette: 0.18 },
    lights: { hemisphere: 0.75, directional: [1.85, 1.05] },
  },
  7: {
    look: { env: 'studio', envIntensity: 0.62, exposure: 1.0, bloom: 0.42, threshold: 1.7, grain: 0.006, vignette: 0.18 },
    lights: { hemisphere: 0.8, directional: [2.0, 1.1] },
  },
  8: {
    look: { env: 'studio', envIntensity: 0.65, exposure: 1.0, bloom: 0.4, threshold: 1.7, grain: 0.006, vignette: 0.18 },
    lights: { hemisphere: 0.8, directional: [2.0, 1.1] },
  },
  9: {
    look: { env: 'studio', envIntensity: 0.6, exposure: 1.0, bloom: 0.36, threshold: 1.7, grain: 0.006, vignette: 0.18 },
    lights: { hemisphere: 0.8, directional: [1.9, 1.1] },
  },
});

/** Apply after build(), before stage assigns the environment and postprocessing. */
export function applyVisualDirection({ built, level, matched = false }) {
  const profile = PROFILES[level];
  // Campus and module have their own direction. A matched comparison gets the
  // exact authored/default treatment on every level, including its film grain.
  if (matched || !profile || built.scene.userData.linkArtDirection || built.scene.userData.computeArtDirection) return;
  built.look = { ...built.look, ...profile.look };
  if (profile.lights) {
    const hemisphere = built.scene.children.find(object => object.isHemisphereLight);
    if (hemisphere) hemisphere.intensity = profile.lights.hemisphere;
    const directional = built.scene.children.filter(object => object.isDirectionalLight);
    profile.lights.directional.forEach((intensity, index) => {
      if (directional[index]) directional[index].intensity = intensity;
    });
  }
  built.scene.userData.visualDirection = { version: 1, level, scope: 'lighting and postprocessing only' };
}
