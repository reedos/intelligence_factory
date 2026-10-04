// A level's intro opens with a sentence that says what the level is. On a phone whose side sheet is down, that
// sentence (the hook) is all the peek has room for, above Read more; the rest folds away until the sheet opens.
// splitIntro keeps every character: hook + rest === text, so the intro reads the same everywhere else.
const ABBREVIATION = /(?:^|[\s(])(?:e\.g|i\.e|vs|etc|approx|No|Nos|Fig|Dr|St|Inc|Ltd|Co|U\.S|U\.K|a\.m|p\.m)$/i;
const SHORT = 40;   // a first sentence under SHORT ("Start at the grid.") takes the next one too; the peek's two-line clamp ellipsizes it

export function splitIntro(text) {
  const s = String(text ?? '');
  const ends = [];
  const end = /[.!?]["”’')\]]*(\s+)(?=["“‘'(\[]?[A-Z0-9])/g;
  for (let m; (m = end.exec(s));) {
    const stop = m.index + m[0].length - m[1].length;   // just past the sentence's closing mark and quotes
    const head = s.slice(0, stop);
    if (head.endsWith('.') && ABBREVIATION.test(head.slice(0, -1))) continue;
    if (head.trim().length < 12) continue;               // "No. 4" and the like are not a sentence
    ends.push(stop);
  }
  let stop = ends[0];
  if (stop === undefined) return { hook: s, rest: '' };
  for (let k = 1; stop < SHORT && ends[k] !== undefined; k++) stop = ends[k];
  return { hook: s.slice(0, stop), rest: s.slice(stop) };
}

// the intro element holds the hook and the rest as two spans, so a stylesheet can show the hook alone
export function renderIntro(el, text) {
  const { hook, rest } = splitIntro(text);
  const part = (cls, t) => { const span = document.createElement('span'); span.className = cls; span.textContent = t; return span; };
  el.replaceChildren(part('intro-hook', hook), ...(rest ? [part('intro-rest', rest)] : []));
}
