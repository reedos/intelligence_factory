// Turn the Vite build into a claude.ai artifact page: the host wraps the page in its own doctype, head and body,
// so this writes the body content with the title, fonts and stylesheet at the top. The stylesheet is inlined
// (the host only admits Google Fonts stylesheets); the script stays a published file beside the page.
// Usage: npm run artifact   → dist-artifact/index.html + dist-artifact/assets/*.js
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync } from 'fs';

const html = readFileSync('dist/index.html', 'utf8');
const pick = re => (html.match(re) || [])[0] || '';
const title = pick(/<title>[\s\S]*?<\/title>/);
const desc = pick(/<meta name="description"[^>]*>/);
const fonts = [...html.matchAll(/<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts\.[^>]*>/g)].map(m => m[0]).join('\n');
const cssHref = (html.match(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/) || [])[1];
const jsSrc = (html.match(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/) || [])[1];
const body = (html.match(/<body>([\s\S]*)<\/body>/) || [])[1];
if (!cssHref || !jsSrc || !body || !title) throw new Error('unexpected dist/index.html shape');

const css = readFileSync(`dist/${cssHref}`, 'utf8');
rmSync('dist-artifact', { recursive: true, force: true });
mkdirSync('dist-artifact/assets', { recursive: true });
copyFileSync(`dist/${jsSrc}`, `dist-artifact/${jsSrc}`);
const page = [
  title, desc, fonts,
  `<style>\n${css}\n</style>`,
  '<script>window.IFX_ARTIFACT = true;</script>',   // no query strings reach an artifact, so share links stay off here
  body.trim(),
  `<script type="module" src="./${jsSrc}"></script>`,
].join('\n');
writeFileSync('dist-artifact/index.html', page);
const files = readdirSync('dist-artifact/assets');
console.log(`dist-artifact/index.html (${Math.round(page.length / 1024)} KB) + assets: ${files.join(', ')}`);
