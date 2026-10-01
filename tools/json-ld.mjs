// schema.org JSON-LD for the <head> of each page, generated at build time so dateModified always reflects the
// actual build rather than being hand-maintained. No fields beyond what the task asked for: no logo/image (none
// exists in the repo) and no ratings.
const AUTHOR = { '@type': 'Person', name: 'Reed Osaki', url: 'https://reedos.dev/' };
const SITE_URL = 'https://reedos.dev/intelligence_factory/';
const SITE_NAME = 'The Intelligence Factory';

const PAGES = {
  'index.html': { headline: 'The Intelligence Factory', description: 'Zoom from a 2,000 km grid into one AI campus and down to a GPU die at 0.8 V: power, data and heat at six scales, every figure labeled by where it comes from.', path: '' },
  'evidence.html': { headline: 'Evidence · The Intelligence Factory', description: 'Every number on The Intelligence Factory, with where it comes from: the published specs, industry figures and estimates behind the model of an AI campus.', path: 'evidence.html' },
  'method.html': { headline: 'Method · The Intelligence Factory', description: 'How The Intelligence Factory makes its numbers: the scenario model, the power chain and PUE, the network, heat and water, the clocks, tokens, the real campuses, and how the site is tested.', path: 'method.html' },
  'glossary.html': { headline: 'Glossary · The Intelligence Factory', description: 'The words you meet in an AI campus, from the transmission line to the token, each in plain terms with a link to the part in 3D.', path: 'glossary.html' },
};

export function articleJsonLd(page, builtAt) {
  const p = PAGES[page];
  if (!p) return null;
  const url = SITE_URL + p.path;
  return {
    '@context': 'https://schema.org', '@type': 'TechArticle',
    headline: p.headline, description: p.description,
    author: AUTHOR, publisher: AUTHOR,
    inLanguage: 'en-US', url, dateModified: builtAt,
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org', '@type': 'WebSite',
    name: SITE_NAME, url: SITE_URL, inLanguage: 'en-US',
    author: AUTHOR, publisher: AUTHOR,
    description: PAGES['index.html'].description,
  };
}

export const jsonLdScript = obj => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
