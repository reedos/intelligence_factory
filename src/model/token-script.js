// One generation cycle: a short prompt, a reasoning trace that works out something true about the current
// scenario (with arithmetic that matches the site's own numbers), then an answer. Pure functions of the model
// M and the reader's tokens-panel settings (calc, from tokens.js) so chip.js's 3D stream and tokens-ui.js's 2D
// console can both sample the same cycle and always agree on which words are out.
// Pacing: prefill (the whole prompt at once), then decode at STREAM_TPS tokens/s per stream, reasoning then
// answer, then a short pause before the next cycle. `tick()` is the one bit of shared, mutable state: whichever
// of chip.js or tokens-ui.js calls it first in a frame sets the shared clock, so both read the same elapsed time.
import { tokenFigures, calc } from './tokens.js';

export const STREAM_TPS = 60;      // this stream's decode rate, illustrative — matches src/app/journeys.js request()
export const REPLY_TOKENS = 500;   // a typical reply length — matches tokenFigures()'s own baked-in reply length

const n0 = v => Math.round(v).toLocaleString('en-US');
const big = v => v >= 1e9 ? `${+(v / 1e9).toFixed(1)} billion` : v >= 1e6 ? `${+(v / 1e6).toFixed(1)} million` : n0(v);
const mw = v => v >= 1000 ? `${+(v / 1000).toFixed(2)} GW` : v >= 10 ? `${Math.round(v).toLocaleString('en-US')} MW` : `${v.toFixed(1)} MW`;
const j2 = v => v < 1 ? v.toFixed(3) : v.toFixed(2);

// ---------- text → realistic subword tokens ----------
// A word longer than six letters and ending in a common suffix splits into stem + suffix, e.g. " cooling" ->
// [" cool", "ing"], " datacenter" -> [" datacent", "er"]. Everything else (numbers, punctuation, short words)
// stays whole. Every character of the input is emitted exactly once, so the tokens always concatenate back to it.
const SUFFIXES = ['tion', 'ment', 'ing', 'ers', 'er', 'ed', 'ly', 'est', 'able', 'ity', 'ive', 'ous'];
function splitWord(tok) {
  const m = /^( ?)([A-Za-z]+)$/.exec(tok);
  if (!m) return [tok];
  const [, sp, word] = m;
  if (word.length < 7) return [tok];
  const lower = word.toLowerCase();
  for (const suf of SUFFIXES) {
    if (lower.endsWith(suf) && word.length - suf.length >= 3) return [sp + word.slice(0, word.length - suf.length), word.slice(word.length - suf.length)];
  }
  return [tok];
}
export function tokenize(text) {
  const out = [];
  const isWord = c => /[A-Za-z]/.test(c), isDigit = c => /[0-9]/.test(c);
  const glued = (s, i) => isWord(s[i]) || isDigit(s[i]) || ((s[i] === '.' || s[i] === ',') && isDigit(s[i - 1]) && isDigit(s[i + 1])) || (s[i] === "'" && isWord(s[i - 1]) && isWord(s[i + 1]));
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === ' ' && i + 1 < text.length && (isWord(text[i + 1]) || isDigit(text[i + 1]))) {
      let k = i + 1; while (k < text.length && glued(text, k)) k++;
      out.push(text.slice(i, k)); i = k;
    } else if (isWord(c) || isDigit(c)) {
      let k = i; while (k < text.length && glued(text, k)) k++;
      out.push(text.slice(i, k)); i = k;
    } else { out.push(c); i++; }               // a lone space, or punctuation, gets its own token
  }
  return out.flatMap(splitWord);
}

// ---------- the cycle's arithmetic and text ----------
// Recomputed the same way tokens.js does, so `rate` and `jOps` land exactly on tokenFigures()'s own rate and
// (j − jTrain): token-script.test.ts checks that.
export function figuresFor(M, c = calc) {
  const t = tokenFigures(M, c);
  const tps = c.tpsTouched ? c.tokPerGpu : M.tokPerGpuRef;
  const rate = M.gpus * tps * c.util;
  const jOps = M.meterMW * 1e6 / rate;
  return { t, tps, rate, jOps };
}

export function buildCycle(M, c = calc) {
  const { t, tps, rate, jOps } = figuresFor(M, c);
  const promptText = 'How many tokens a second does this campus write?';
  const reasoningText = `This campus runs ${n0(M.gpus)} GPUs at ${Math.round(c.util * 100)}% utilization, each writing about `
    + `${n0(tps)} tokens a second. ${n0(M.gpus)} times ${n0(tps)} times ${c.util.toFixed(2)} is about ${big(rate)} tokens `
    + `a second, campus-wide. ${mw(M.meterMW)} divided by that rate is about ${j2(jOps)} joules a token, plus ${j2(t.jTrain)} `
    + `joules of training amortized in: ${j2(t.j)} joules all in.`;
  const answerText = `About ${big(rate)} tokens a second here, at roughly ${j2(t.j)} joules each.`;
  const prompt = tokenize(promptText), reasoning = tokenize(reasoningText), answer = tokenize(answerText);
  const prefillS = 0.4, pauseS = 1.4;                              // the burst, then the gap before the next cycle
  const reasoningS = reasoning.length / STREAM_TPS, answerS = answer.length / STREAM_TPS;
  return {
    promptText, reasoningText, answerText, prompt, reasoning, answer,
    timings: { prefillS, reasoningS, answerS, pauseS, totalS: prefillS + reasoningS + answerS + pauseS },
    jPerToken: t.j, campusTps: rate, whReplyRef: t.whReply,
    contextMax: prompt.length + reasoning.length + answer.length,
  };
}

// ---------- where the cycle is, given elapsed seconds since it started ----------
export function sampleAt(cycle, elapsedSec) {
  const { prefillS, reasoningS, answerS, totalS } = cycle.timings;
  const e = ((elapsedSec % totalS) + totalS) % totalS;
  let phase, promptOut, reasoningOut, answerOut;
  if (e < prefillS) {
    phase = 'prefill'; promptOut = Math.max(1, Math.ceil(cycle.prompt.length * (e / prefillS))); reasoningOut = 0; answerOut = 0;
  } else if (e < prefillS + reasoningS) {
    phase = 'reasoning'; promptOut = cycle.prompt.length;
    reasoningOut = Math.min(cycle.reasoning.length, Math.floor((e - prefillS) * STREAM_TPS) + 1); answerOut = 0;
  } else if (e < prefillS + reasoningS + answerS) {
    phase = 'answer'; promptOut = cycle.prompt.length; reasoningOut = cycle.reasoning.length;
    answerOut = Math.min(cycle.answer.length, Math.floor((e - prefillS - reasoningS) * STREAM_TPS) + 1);
  } else {
    phase = 'pause'; promptOut = cycle.prompt.length; reasoningOut = cycle.reasoning.length; answerOut = cycle.answer.length;
  }
  const contextTokens = promptOut + reasoningOut + answerOut, tokensGenerated = reasoningOut + answerOut;
  return {
    phase, promptOut, reasoningOut, answerOut, contextTokens,
    contextFrac: Math.min(1, contextTokens / cycle.contextMax),
    tokensGenerated, streamTps: phase === 'reasoning' || phase === 'answer' ? STREAM_TPS : 0,
    jSoFar: tokensGenerated * cycle.jPerToken, campusTps: cycle.campusTps, progress: e / totalS, elapsed: e,
  };
}

// ---------- the shared runtime clock ----------
// A module-level singleton: chip.js and tokens-ui.js both call tick() with the same cycle length (both derive
// it from the same store.M), so whichever runs first in a frame sets the anchor and the other reads it back.
const CLOCK = { start: null };
export function tick(cycleLen, now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000) {
  if (CLOCK.start === null) CLOCK.start = now;
  let e = now - CLOCK.start;
  if (e >= cycleLen || e < 0) { CLOCK.start = now - (((e % cycleLen) + cycleLen) % cycleLen); e = now - CLOCK.start; }
  return e;
}
