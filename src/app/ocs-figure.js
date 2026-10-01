// A small count figure under the rack's "Copper and optical fabrics" card (data layer): the 48 optical circuit
// switches that join Google's 4,096-chip TPU v4 system, against the 568 InfiniBand switches Google's TPU v4 paper
// (ISCA 2023, section 7.3) estimates the same job would take. One square is one switch. Both numbers are rows 1 and 2
// of that card (src/data.js ocsRows), so the figure carries the same evidence chips and draws nothing new.
import { store, on } from './store.js';

const PITCH = 3.6, CELL = 2.9, ROWS = 8;
function grid(n, color, y) {
  const cols = Math.ceil(n / ROWS);
  let out = '';
  for (let i = 0; i < n; i++) {
    const c = Math.floor(i / ROWS), r = i % ROWS;
    out += `<rect x="${(c * PITCH).toFixed(1)}" y="${(y + r * PITCH).toFixed(1)}" width="${CELL}" height="${CELL}" rx=".5"/>`;
  }
  return { svg: `<g fill="${color}">${out}</g>`, w: cols * PITCH };
}

export function ocsFigureHTML() {
  const h = ROWS * PITCH;
  const a = grid(48, 'var(--eth)', 0), b = grid(568, 'var(--muted)', 0);
  const svg = (g, w, label) => `<svg viewBox="0 0 ${Math.max(w, 1).toFixed(1)} ${h.toFixed(1)}" width="${(w / 256 * 100).toFixed(1)}%" role="img" aria-label="${label}" preserveAspectRatio="xMinYMin meet">${g.svg}</svg>`;
  return `<figure class="ocs-fig" id="ocs-fig">
  <figcaption class="ocs-fig-t">Joining 4,096 TPU v4 chips</figcaption>
  <div class="ocs-fig-row"><span class="ocs-fig-n" style="color:var(--eth)">48</span><span class="ocs-fig-l">optical circuit switches, as built</span></div>
  ${svg(a, a.w, '48 squares, one per optical circuit switch')}
  <div class="ocs-fig-row"><span class="ocs-fig-n">568</span><span class="ocs-fig-l">InfiniBand switches, Google’s estimate for the same job</span></div>
  ${svg(b, b.w, '568 squares, one per InfiniBand switch')}
  <p class="ocs-fig-c">One square = one switch. Source: Google’s TPU v4 paper, ISCA 2023 (rows above).</p>
</figure>`;
}

const STYLE = `.ocs-fig{margin:14px 0 4px;padding:12px 0 0;border-top:1px solid var(--line)}
#card .ocs-fig-t{font:600 11px/1.2 var(--mono, 'IBM Plex Mono', monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 8px}
.ocs-fig-row{display:flex;align-items:baseline;gap:8px;margin:8px 0 5px}
.ocs-fig-n{flex:none;white-space:nowrap;font:600 15px/1 var(--mono, 'IBM Plex Mono', monospace);color:var(--ink);min-width:3ch}
#card .ocs-fig-l{font-size:12px;line-height:1.3;color:var(--muted)}
.ocs-fig svg{display:block;height:auto;max-width:100%}
#card .ocs-fig-c{margin:8px 0 0;font-size:11px;line-height:1.4;color:var(--muted)}`;

function place(d) {
  document.getElementById('ocs-fig')?.remove();
  const sc = store.C?.SCENES?.[d?.scene];
  if (!d || d.mode !== 'data' || d.id !== 'optical' || sc?.id !== 'rack') return;
  const specs = document.getElementById('card-s');
  if (!specs) return;
  if (!document.getElementById('ocs-fig-style')) {
    const st = document.createElement('style'); st.id = 'ocs-fig-style'; st.textContent = STYLE; document.head.appendChild(st);
  }
  specs.insertAdjacentHTML('afterend', ocsFigureHTML());
}
on('select', place);
