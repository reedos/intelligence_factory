import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

// Review provenance only: no local paths or machine identity enter the build.
export function buildIdentity() {
  const root = process.cwd();
  const git = (...args) => {
    try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim(); }
    catch { return null; }
  };
  const hash = createHash('sha256');
  let files = 0;
  function visit(path) {
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) { hash.update(relative(root, file).replaceAll('\\', '/')); hash.update('\0'); hash.update(readFileSync(file)); files++; }
    }
  }
  for (const folder of ['src', 'public/models']) if (existsSync(join(root, folder))) visit(join(root, folder));
  let sync = null;
  if (existsSync(join(root, 'research/version-sync.json'))) sync = JSON.parse(readFileSync(join(root, 'research/version-sync.json'), 'utf8'));
  const currentMain = git('rev-parse', 'main');
  // A reviewed branch can become main without making its contents stale. Detect
  // actual upstream commits missing from HEAD, not merely a changed branch name/tip.
  const includesMain = currentMain && git('merge-base', '--is-ancestor', currentMain, 'HEAD') !== null;
  return {
    builtAt: new Date().toISOString(), revision: git('rev-parse', 'HEAD'),
    contentId: hash.digest('hex').slice(0, 16), sourceAndAssetFiles: files,
    synchronizedMain: sync?.integratedMain || null, currentMain,
    upstreamReviewNeeded: !sync?.integratedMain || !includesMain,
  };
}

export function buildIdentityPlugin() {
  return { name: 'review-build-identity', apply: 'build', generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify(buildIdentity(), null, 2) + '\n' });
  } };
}
