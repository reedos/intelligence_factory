// Stage dist/ for Cloudflare Workers static assets, mounted at reedos.dev/<mount>/ (cloudflare.yml).
// Writes cf-stage/wrangler.json, cf-stage/public/<mount>/** (the build) and cf-stage/public/_headers.
// The Worker has no script: every request is a static-asset request, which Cloudflare serves without a Worker
// invocation. Usage: node tools/cloudflare-stage.mjs <mount> [html_handling]
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';

const mount = process.argv[2] || 'intelligence_factory';
const htmlHandling = process.argv[3] || 'auto-trailing-slash';
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

writeFileSync('cf-stage/wrangler.json', JSON.stringify({
  name: mount === 'intelligence_factory' ? 'intelligence-factory' : `if-${mount}`.replace(/_/g, '-').toLowerCase(),
  compatibility_date: '2026-09-01',
  workers_dev: false,
  assets: { directory: './public', html_handling: htmlHandling, not_found_handling: 'none' },
  routes: [{ pattern: `reedos.dev/${mount}/*`, zone_name: 'reedos.dev' }],
}, null, 2));
console.log(`staged dist/ at /${mount}/ (html_handling ${htmlHandling})`);
