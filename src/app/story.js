// Story mode: the panel beside the 3D view becomes a column of beats, grid to token. Scrolling a beat to the middle
// of the column drives the stage to it. On narrow screens the view sticks to the top and the page scrolls the beats.
// Every number comes from the current scenario, so the story retells itself when a setting changes.
import { store, on } from './store.js';
import { show, reduced } from './stage.js';
import { tokenFigures } from './sections.js';

const $ = id => document.getElementById(id);
const at = (scene, part, mode = 'power') => ({ scene, mode, part });
const n0 = v => Math.round(v).toLocaleString('en-US');
const mw = v => v >= 1000 ? `${+(v / 1000).toFixed(2)} GW` : v >= 10 ? `${n0(v)} MW` : `${v.toFixed(1)} MW`;
const big = v => v >= 1e9 ? `${+(v / 1e9).toFixed(1)} billion` : v >= 1e6 ? `${+(v / 1e6).toFixed(1)} million` : n0(v);
const pct = (a, b) => `${Math.round(a / b * 100)}%`;

export function beats(M = store.M) {
  const A = M.accel, L = M.layout, nvl = A.gpusPerRack === 72, dc = M.power.id === 'dc800', air = M.cooling.id === 'air';
  const loss = p => M.ledger.filter(r => r.label.startsWith(p)).reduce((a, r) => a + r.mw, 0);
  const t = tokenFigures(M), meter = mw(M.meterMW);
  const lineA = M.staircase[0].current.replace(' per phase', '');
  const coreA = M.staircase[M.staircase.length - 1].current;
  const net = M.NET.switchMW + M.NET.opticsMW;
  const dci = M.bandwidth[M.bandwidth.length - 1];
  return [
    { link: at(0, 'home'), k: 'Scale across', title: `${meter}, one grid customer`,
      text: `This campus draws ${meter} at its meter, about as much as ${n0(M.meterMW * 1000 / 1.2)} American homes. The grid lost about 5% delivering it. Every number below follows from that one choice and the three others in the scenario bar.` },
    { link: at(1, 'line'), k: 'Grid & campus', title: '345,000 volts',
      text: `The power arrives at 345 kV so the current stays small: ${lineA} per phase for the whole campus. At the rack, the same power would need tens of thousands of amps.` },
    { link: at(1, 'mpt'), k: 'Grid & campus', title: 'The first step down',
      text: `The campus has ${L.transformers} main transformers to take it down to 34.5 kV. They are 99.6% efficient, and still turn ${mw(loss('Main power'))} into heat.` },
    { link: at(1, 'bess'), k: 'Grid & campus', title: 'Standing by',
      text: `${n0(L.gensets)} diesel generators and ${n0(L.bessMWh)} MWh of batteries wait for the grid to fail. The batteries also soak up training load swings, which can move a campus tens of megawatts in under a second.` },
    dc
      ? { link: at(2, 'sst'), k: 'Power room', title: 'Straight to 800 V DC',
        text: `Solid-state transformers turn 34.5 kV AC into 800 V DC in one step, losing ${mw(loss('Solid-state'))}. No UPS, no rack rectifiers: batteries sit right on the DC bus.` }
      : { link: at(2, 'ups'), k: 'Power room', title: 'Clean power, at a price',
        text: `UPS modules turn AC into DC and back again so the racks never see a flicker. That double conversion costs ${mw(loss('UPS'))}, more than any other step before the rack.` },
    { link: at(2, 'racks'), k: 'Data hall', title: `${n0(M.racks)} racks`,
      text: `The IT load, ${mw(M.IT_MW)}, lands on ${n0(M.racks)} ${nvl ? A.rackName : 'DGX H100'} racks of about ${Math.round(M.rack.kw)} kW each, in ${M.halls} ${M.halls > 1 ? 'halls' : 'hall'}. That is ${n0(M.gpus)} GPUs.` },
    nvl
      ? { link: at(3, 'shelves'), k: 'The rack', title: dc ? '800 V down to 50' : 'AC becomes DC',
        text: `${dc ? 'DC-DC shelves' : 'Power shelves'} make about 50 V for a copper busbar down the back of the rack, carrying ${M.staircase.find(s => s.v === 50)?.current ?? ''}. That is why it is a bar, not a cable.` }
      : { link: at(3, 'psus'), k: 'The rack', title: 'Every server its own supplies',
        text: `Power strips hand 240 V to each server, and six supplies inside each one make 54 V. Air cools it all: the reference design allows only four servers, about ${Math.round(M.rack.kw)} kW, per rack.` },
    { link: at(4, 'vrm'), k: nvl ? 'Compute tray' : 'The server', title: 'The last volt',
      text: `Voltage regulators ring each GPU and make the final step to about 0.8 V: ${coreA} into one chip. They lose ${mw(loss('Voltage regulators'))} across the campus doing it.` },
    { link: at(5, 'dies'), k: 'GPU package', title: `${pct(M.gpuSiliconMW, M.meterMW)} reaches the silicon`,
      text: `Of ${meter} at the meter, ${mw(M.gpuSiliconMW)} ends up in the GPU dies themselves. The rest went to conversion, cooling, memory, CPUs and the network. Both shares end up as heat.` },
    { link: at(5, 'hbm', 'data'), k: 'Data · GPU package', title: 'Memory sets the pace',
      text: `${A.hbm.type} feeds each GPU at ${A.hbm.tbs} TB/s. Writing a reply means reading the model's weights for every token, so serving speed follows memory bandwidth more than raw math.` },
    nvl
      ? { link: at(3, 'nvswitch', 'data'), k: 'Data · the rack', title: '72 GPUs, one machine',
        text: `${A.nvlink.gen} ties all 72 GPUs together through switch trays in the middle of the rack, ${A.nvlink.tbs} TB/s per GPU, in copper. The chattiest work, splitting each layer, stays here.` }
      : { link: at(4, 'nvswitch', 'data'), k: 'Data · the server', title: 'Eight GPUs, one machine',
        text: 'NVLink ties eight GPUs together on one board through four NVSwitch chips, 900 GB/s each. The domain ends at the server; everything else is network.' },
    { link: at(2, 'spine', 'data'), k: 'Data · the hall', title: `${n0(M.NET.switches)} switches`,
      text: `Every GPU gets its own optical port into a ${M.NET.tiers}-tier fabric. Switches and optics outside the racks draw ${mw(net)}, and there are about ${big(M.NET.fibers)} strands of fiber.` },
    { link: at(0, 'route', 'data'), k: 'Data · scale across', title: 'Light is slow',
      text: `Campuses hundreds of kilometers apart can train one model, but light in glass needs ${dci.latency.replace('one way', 'each way')} to cross 1,000 km. Training across sites syncs rarely, so the slow links carry the least.` },
    { link: at(1, air || M.cooling.id === 'liquid' ? 'towers' : 'drycoolers', 'heat'), k: 'Heat', title: 'All of it comes back out',
      text: `Every one of those ${meter} leaves as heat. ${M.cooling.id === 'warm' ? 'Warm water climbs to dry coolers on the roofs' : 'Chillers and cooling towers carry it away'}; cooling alone takes ${mw(M.coolMW)}. With the conversion losses, this design runs at PUE ${M.pue.toFixed(2)} and uses about ${big(M.meterMW * 24 * M.wue)} m³ of water a day.` },
    { link: at(5, 'tokens'), k: 'Tokens', title: `${big(t.rate)} tokens a second`,
      text: `At the utilization set below, the campus writes about ${big(t.rate)} tokens a second, ${big(3.6e6 / t.j)} per kilowatt-hour including its share of training. Change the scenario and the story retells itself.` },
  ];
}

// ---------- UI ----------
const panel = document.querySelector('.panel-scroll'), stageEl = document.querySelector('.stage');
const box = document.createElement('div');
box.className = 'story'; box.id = 'story'; box.hidden = true;
panel.appendChild(box);
let active = -1, seq = 0, observer = null, list = [];
const narrow = matchMedia('(max-width: 1100px)');

function render() {
  list = beats();
  box.innerHTML = `<div class="story-head"><span class="eyebrow">The story · ${list.length} steps</span><button type="button" class="btn" id="story-exit">Exit story</button></div>`
    + list.map((b, i) => `<article class="beat" data-i="${i}"><span class="k">${String(i + 1).padStart(2, '0')} · ${b.k}</span><h3>${b.title}</h3><p>${b.text}</p></article>`).join('')
    + '<div class="beat-end"><button type="button" class="btn" id="story-done">Explore on your own</button></div>';
  $('story-exit').addEventListener('click', exit);
  $('story-done').addEventListener('click', exit);
  observe();
  if (active >= 0) mark(active);
}
function mark(i) { box.querySelectorAll('.beat').forEach(b => b.classList.toggle('on', +b.dataset.i === i)); }
async function activate(i) {
  if (i === active) return;
  active = i; mark(i);
  const my = ++seq;
  await show(list[i].link, { scroll: false, still: () => my === seq });
}
function observe() {
  observer?.disconnect();
  observer = new IntersectionObserver(entries => {
    const hit = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (hit) activate(+hit.target.dataset.i);
  }, { root: narrow.matches ? null : panel, rootMargin: narrow.matches ? '-60% 0px -25% 0px' : '-40% 0px -40% 0px', threshold: 0 });
  box.querySelectorAll('.beat').forEach(b => observer.observe(b));
}
function step(d) {
  const i = Math.max(0, Math.min(list.length - 1, (active < 0 ? -1 : active) + d));
  box.querySelector(`.beat[data-i="${i}"]`)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: narrow.matches ? 'start' : 'center' });
}

export function enter() {
  if (!box.hidden) return;
  document.body.classList.add('story');
  box.hidden = false; active = -1;
  render();
  stageEl.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  panel.scrollTop = 0;
  activate(0);
  $('story-btn')?.setAttribute('aria-pressed', 'true');
}
export function exit() {
  if (box.hidden) return;
  observer?.disconnect(); seq++;
  document.body.classList.remove('story');
  box.hidden = true; active = -1;
  $('story-btn')?.setAttribute('aria-pressed', 'false');
  panel.scrollTop = 0;
}
export const inStory = () => !box.hidden;

$('story-btn')?.addEventListener('click', () => (inStory() ? exit() : enter()));
addEventListener('keydown', e => {
  if (e.target.matches?.('input, textarea, select')) return;
  if (e.key === 's' || e.key === 'S') { inStory() ? exit() : enter(); return; }
  if (!inStory()) return;
  if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)) { step(1); e.preventDefault(); e.stopImmediatePropagation(); }
  else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { step(-1); e.preventDefault(); e.stopImmediatePropagation(); }
  else if (e.key === 'Escape') exit();
}, true);
narrow.addEventListener('change', () => { if (inStory()) observe(); });
on('scenario', () => { if (inStory()) render(); });
on('tokens', () => { if (inStory()) render(); });
if (location.hash === '#story') setTimeout(enter, 0);
$('story-start')?.addEventListener('click', e => { e.preventDefault(); enter(); });
