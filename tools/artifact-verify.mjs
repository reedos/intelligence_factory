import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Compare the complete dependency tree, not merely the entry script: lazy
// scene imports and filenames assembled at runtime are otherwise easily missed.
export function verifyArtifact(source, destination) {
  let count = 0;
  function visit(relative = '') {
    for (const name of readdirSync(join(source, relative))) {
      const path = join(relative, name), original = join(source, path);
      if (statSync(original).isDirectory()) { visit(path); continue; }
      if (path === 'index.html') continue; // Intentionally rewritten host fragment.
      let copied;
      try { copied = readFileSync(join(destination, path)); }
      catch { throw new Error(`Artifact runtime dependency missing: ${path}`); }
      if (!copied.equals(readFileSync(original))) throw new Error(`Artifact runtime dependency changed: ${path}`);
      count++;
    }
  }
  visit();
  return count;
}
