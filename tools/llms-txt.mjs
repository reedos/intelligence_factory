// llms.txt (and llms-full.txt) in the llmstxt.org format: a plain-text guide for AI tools, generated at build time
// from the same data modules every page reads, in the house style used on reedos.dev/gradient_ascent/llms.txt
// (# title, an intro, then ## sections of "- [text](url): description" links).
export const PUB_STATEMENT = 'Personal educational project based on cited public sources. Not an official publication of my employer or the companies discussed. Models are schematic; estimates and assumptions are identified.';
const BASE = 'https://reedos.dev/intelligence_factory/';

export function buildLlmsTxt(M) {
  const scenario = `${Math.round(M.meterMW)} MW at the meter, ${M.accel.rackName} racks, 415 V AC to the rack, warm-water cooling`;
  return `# The Intelligence Factory

> A scenario model of an AI data center campus, in 3D: power, data and heat traced from a 2,000 km grid down to a GPU die at 0.8 V. Every figure on every page carries a label for what kind of statement it is, and either a cited source, the calculation that produced it, or the reasoning behind the assumption. The story page walks the whole campus in order; the visualizer is the same model explored freely at six scales plus four side views inside the links.

> ${PUB_STATEMENT}

## Evidence labels
Every figure on this site carries one of five labels. Spec: the maker or a standards body publishes this exact figure. Vendor: a vendor's own comparison or performance claim, attributed to it, not checked independently here. Reported: a named third party (a government agency, a researcher, an analyst, the trade press) states it. Calc.: this site's model calculates it from the scenario and its cited inputs. Assumed: the model chooses a value where no single published figure applies. The Evidence page lists every claim with its label and what backs it; the Method page explains every calculation and assumption by name.

## Pages
- [The story](${BASE}): The full campus, top to bottom, in reading order: power from the grid to the rack, the data fabric, heat and water, and tokens, each section narrated with its own figures and labels.
- [Visualizer](${BASE}visualizer.html): The same model explored freely in 3D, at six scales from a 2,000 km grid to a 10 cm GPU package, plus four side views inside the optical and copper links. Adjustable: campus size, accelerator generation, power design and cooling design.
- [Evidence](${BASE}evidence.html): Every figure the site shows, one claim at a time, with its label, what backs it, and a bibliography of every source cited, grouped by publisher. Fixed to one reference scenario: ${scenario}.
- [Method](${BASE}method.html): How the model turns four choices (campus size, accelerator, power design, cooling design) into every hardware figure on the site, section by section, plus the full registers of calculations and assumptions the Calc. and Assumed labels point to.
- [Glossary](${BASE}glossary.html): Every term the site uses, from transmission line to token, defined in plain words, each linked to the part of the 3D view it describes and the sources behind any figure it states.
- [Parts index](${BASE}parts.html): A plain-text walk through every level and every part card the visualizer renders, with its figures and their sources, for the reference scenario above — the same content as the visualizer's own <noscript> fallback, as a page on its own.
- [llms-full.txt](${BASE}llms-full.txt): The claims, method sections and glossary terms above, expanded to their full text, in one file.
`;
}

const stripTags = html => String(html).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

export function buildLlmsFullTxt({ M, SECTIONS, TERMS, claims, SOURCES }) {
  const scenario = `${Math.round(M.meterMW)} MW at the meter, ${M.accel.rackName} racks, 415 V AC to the rack, warm-water cooling`;
  const methodText = SECTIONS.map(s => `## ${s.title}\n${stripTags(s.html)}`).join('\n\n');
  const glossaryText = [...TERMS].sort((a, b) => a.term.localeCompare(b.term)).map(t => `- ${t.term}: ${t.def}`).join('\n');
  const claimsText = claims.filter(c => c.ev).map(c => {
    const refs = (c.ev.refs || []).map(([id, at]) => `${SOURCES[id]?.title || id}${at ? ` (${at})` : ''}`).join('; ');
    return `- [${c.basis}] ${c.label}: ${c.value}${refs ? ` — ${refs}` : ''}`;
  }).join('\n');
  return `# The Intelligence Factory — full text

> ${PUB_STATEMENT}

Reference scenario for the Evidence claims below: ${scenario}.

## Method, in full
${methodText}

## Every traced claim, reference scenario
${claimsText}

## Glossary, in full
${glossaryText}
`;
}
