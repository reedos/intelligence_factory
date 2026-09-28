// Pure scenario-in-URL helper, shared by the topbar's link handling (site.js) and, if a future page needs
// it, anything else that has to turn a plain page link into one that keeps the reader's campus. Kept free of
// document/location so it can be checked directly, without a DOM.
export const SCENARIO_KEYS = ['mw', 'accel', 'power', 'cooling', 'site'];

// Copies whichever scenario keys are present in `search` onto `href`, preserving href's own path and hash and
// overwriting only those keys if href already carries a (now stale) scenario of its own. Returns href
// unchanged when `search` carries no scenario at all, rather than inventing one for a link that never had it.
export function withScenario(search, href) {
  const here = new URLSearchParams(search), carry = SCENARIO_KEYS.filter(k => here.has(k));
  if (!carry.length) return href;
  const hashAt = href.indexOf('#');
  const path = hashAt === -1 ? href : href.slice(0, hashAt), hash = hashAt === -1 ? '' : href.slice(hashAt);
  const [base, existingQuery] = path.split('?');
  const q = new URLSearchParams(existingQuery || '');
  for (const k of carry) q.set(k, here.get(k));
  return `${base}?${q}${hash}`;
}
