// Turn the Vite build into a claude.ai artifact page: the host wraps the page in its own doctype, head and body,
// so this writes the body content with the title, fonts and stylesheet at the top. The stylesheet is inlined
// (the host only admits Google Fonts stylesheets); the script stays a published file beside the page.
// Usage: npm run artifact   → dist-artifact/index.html + dist-artifact/assets/*.js
import { readFileSync, writeFileSync, rmSync, cpSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { verifyArtifact } from './artifact-verify.mjs';

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
const output = resolve('dist-artifact');
if (output !== resolve(process.cwd(), 'dist-artifact')) throw new Error('Unexpected artifact output path');
rmSync(output, { recursive: true, force: true });
// Preserve the complete relative URL tree: Vite's dynamically imported chunks,
// GLBs, textures, metadata and linked pages are runtime dependencies too.
cpSync(resolve('dist'), output, { recursive: true });
const page = [
  title, desc, fonts,
  `<style>\n${css}\n</style>`,
  '<script>window.IFX_ARTIFACT = true;</script>',   // no query strings reach an artifact, so share links stay off here
  body.trim(),
  `<script type="module" src="./${jsSrc}"></script>`,
].join('\n');
writeFileSync('dist-artifact/index.html', page);
const checked = verifyArtifact(resolve('dist'), output);
const files = readdirSync('dist-artifact/assets');
console.log(`dist-artifact/index.html (${Math.round(page.length / 1024)} KB); ${checked} runtime files verified, ${files.length} asset files`);
