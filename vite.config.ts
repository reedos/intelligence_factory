import { defineConfig } from 'vitest/config';
import { buildIdentityPlugin } from './tools/build-identity.mjs';

// Relative base so the same build runs at reedos.github.io/intelligence_factory/ and as a claude.ai artifact.
export default defineConfig({
  base: './',
  plugins: [buildIdentityPlugin()],
  // its own dependency cache: agent worktrees link node_modules to this checkout, and a shared node_modules/.vite
  // lets their dev servers invalidate this one's optimized deps ("504 Outdated Optimize Dep")
  cacheDir: '.vite',
  // one site, several pages: the visualizer and the pages beside it share the bar, the styles and the model
  build: { target: 'es2022', chunkSizeWarningLimit: 1500, rollupOptions: { input: { main: 'index.html', visualizer: 'visualizer.html', evidence: 'evidence.html', method: 'method.html', glossary: 'glossary.html' } } },
  // agent worktrees live under .claude/; their edits must not reload this server's page
  server: { watch: { ignored: ['**/.claude/**', '**/shots/**', '**/dist*/**'] } },
  test: { include: ['src/**/*.test.ts'], testTimeout: 30000 },   // scene builds run 5+ s on the CI runners
});
