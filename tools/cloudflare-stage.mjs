// Stage dist/ for Cloudflare Workers static assets, mounted at reedos.dev/<mount>/ (cloudflare.yml).
// Writes cf-stage/wrangler.json, cf-stage/public/<mount>/** (the build) and cf-stage/public/_headers.
// The Worker has no script: every request is a static-asset request, which Cloudflare serves without a Worker
// invocation. Usage: node tools/cloudflare-stage.mjs <mount> [html_handling]
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';

const mount = process.argv[2] || 'intelligence_factory';
const htmlHandling = process.argv[3] || 'none';
if (!/^[a-z0-9_-]+$/i.test(mount)) throw new Error(`bad mount: ${mount}`);
if (!existsSync('dist/index.html')) throw new Error('run npm run build first');

rmSync('cf-stage', { recursive: true, force: true });
mkdirSync(`cf-stage/public/${mount}`, { recursive: true });
cpSync('dist', `cf-stage/public/${mount}`, { recursive: true });

// Vite's assets/ are content-hashed, so they can be cached for a year; models carry ?v= keys, so a day is safe;
// pages revalidate so a deploy shows up at once.
writeFileSync('cf-stage/public/_headers', [
  `/${mount}/assets/*`, '  Cache-Control: public, max-age=31536000, immutable', '',
  `/${mount}/models/*`, '  Cache-Control: public, max-age=86400', '',
  `/${mount}/*.html`, '  Cache-Control: public, max-age=0, must-revalidate', '',
  `/${mount}/`, '  Cache-Control: public, max-age=0, must-revalidate', '',
].join('\n'));

// html_handling 'none' serves /page.html as is (the URLs the canonicals, sitemap and shared links use), so add back
// what it drops: the mount's root serves index.html, and the extensionless forms GitHub Pages also answers redirect
// to the .html page (query kept).
const pages = readdirSync('dist').filter(f => f.endsWith('.html') && f !== 'index.html').map(f => f.slice(0, -5));
writeFileSync('cf-stage/public/_redirects', [
  `/${mount}/ /${mount}/index.html 200`,
  ...pages.map(pg => `/${mount}/${pg} /${mount}/${pg}.html 301`),
].join(String.fromCharCode(10)) + String.fromCharCode(10));

writeFileSync('cf-stage/wrangler.json', JSON.stringify({
  name: mount === 'intelligence_factory' ? 'intelligence-factory' : `if-${mount}`.replace(/_/g, '-').toLowerCase(),
  compatibility_date: '2026-09-01',
  workers_dev: false,
  assets: { directory: './public', html_handling: htmlHandling, not_found_handling: 'none' },
  routes: [{ pattern: `reedos.dev/${mount}/*`, zone_name: 'reedos.dev' }],
}, null, 2));
console.log(`staged dist/ at /${mount}/ (html_handling ${htmlHandling})`);
