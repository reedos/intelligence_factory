// Fit named inspection views to the drawing canvas, never the physical screen.
// minScale limits horizontal fitting when a short canvas becomes height-limited.
// `pull` scales the camera's distance on a portrait canvas only (aspect < 0.9): over 1 pulls back, under 1 closes in.
export function cameraPresetFor(c, width, height, pull = 1) {
  const aspect = width / Math.max(1, height);
  const preset = (width < 600 || aspect < .9) && c.portrait ? c.portrait
    : aspect < 1.5 && c.compact ? c.compact : c;
  const portraitPull = aspect < .9 ? pull : 1;
  if (!preset.fit && portraitPull === 1) return preset;
  const { aspect: referenceAspect = 1, fov: referenceFov = 35, minScale = .5 } = preset.fit || {};
  const fov = aspect < .9 ? 48 : 35;
  const scale = (preset.fit ? Math.tan(referenceFov * Math.PI / 360) / Math.tan(fov * Math.PI / 360)
    * Math.max(referenceAspect / aspect, minScale) : 1) * portraitPull;
  return { ...preset, pos: preset.pos.map((v, i) => preset.target[i] + (v - preset.target[i]) * scale) };
}
