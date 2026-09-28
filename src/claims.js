// Every figure the site shows beside a basis chip, for one scenario, each with a key the chip carries. The popovers,
// the Evidence page and the tests all walk the same list, so they cannot disagree about what is claimed.
//   card:<layer>:<sceneId>:<partId>:<row>   a row on a 3D card        ledger:<i>     a ledger row
//   bom:<group>-<row>                       an inventory row          links:<id>     a rung of the links ladder
//   clock:<simId>:<i>                       a note under a clock      site:<id>:<i>  a fact about a real campus
import { makeSim, SIMS } from './model/clock.ts';
import { SITES } from './model/sites.ts';
import { MEDIA_LADDER } from './diagrams/links-media.js';
import { evOf } from './evidence.js';

const LAYERS = [['power', 'PARTS'], ['data', 'PARTS_DATA'], ['heat', 'PARTS_HEAT']];

export function allClaims(M, C) {
  const out = [];
  C.SCENES.forEach((sc, level) => {
    for (const [mode, key] of LAYERS) for (const p of C[key][sc.id] || []) (p.specs || []).forEach((row, i) =>
      out.push({ key: `card:${mode}:${sc.id}:${p.id}:${i}`, group: 'card', level, mode, scene: sc, part: p, label: row[0], value: row[1], basis: row[2], ev: evOf(row) }));
  });
  M.ledger.forEach((r, i) => out.push({ key: `ledger:${i}`, group: 'ledger', label: r.label, value: `${r.mw.toFixed(1)} MW`, basis: r.basis, ev: evOf(r), row: r }));
  C.BOM.forEach((g, gi) => g.rows.forEach((row, ri) =>
    out.push({ key: `bom:${gi}-${ri}`, group: 'bom', title: g.group, label: row[0], value: row[1], basis: row[2], ev: evOf(row) })));
  MEDIA_LADDER.forEach(r => out.push({ key: `links:${r.id}`, group: 'links', label: r.name || r.title || r.id, value: r.power || r.reach || '', basis: r.basis, ev: evOf(r) }));
  for (const { id } of SIMS) makeSim(M, id).notes.forEach((n, i) =>
    out.push({ key: `clock:${id}:${i}`, group: 'clock', sim: id, label: n.text, value: '', basis: n.basis, ev: evOf(n) }));
  for (const [id, s] of Object.entries(SITES)) s.facts.forEach((row, i) =>
    out.push({ key: `site:${id}:${i}`, group: 'site', site: s, label: row[0], value: row[1], basis: row[2], ev: evOf(row) }));
  return out;
}

export const claimByKey = (M, C, key) => allClaims(M, C).find(c => c.key === key) || null;
