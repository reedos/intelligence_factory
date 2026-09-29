export const overlapsRect = (a, b, gap = 0) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;

export function pinLabelBox(x, y, width, canvasWidth, canvasHeight, reserved, selected = false) {
  const height = 18, clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const candidates = [[x + 18, y - 9], [x - 29 - width, y - 9]];
  if (selected) {
    candidates.push([x - width / 2, y + 18], [x - width / 2, y - 36]);
    for (const r of reserved) candidates.push([x - width / 2, r.bottom + 6], [x - width / 2, r.top - height - 6], [r.left - width - 6, y - 9], [r.right + 6, y - 9]);
  }
  for (let [left, top] of candidates) {
    if (selected) { left = clamp(left, 6, canvasWidth - width - 6); top = clamp(top, 6, canvasHeight - height - 6); }
    const box = { left, top, right: left + width, bottom: top + height };
    if (box.left < 6 || box.right > canvasWidth - 6 || box.top < 6 || box.bottom > canvasHeight - 6) continue;
    if (!reserved.some(r => overlapsRect(box, r, 4))) return box;
  }
  return null;
}
