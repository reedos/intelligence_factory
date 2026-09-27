import { defineConfig } from 'vitest/config';

// Relative base so the same build runs at reedos.github.io/intelligence_factory/ and as a claude.ai artifact.
export default defineConfig({
  base: './',
  // one site, several pages: the visualizer and the pages beside it share the bar, the styles and the model
  build: { target: 'es2022', chunkSizeWarningLimit: 1500, rollupOptions: { input: { main: 'index.html', evidence: 'evidence.html' } } },
  // agent worktrees live under .claude/; their edits must not reload this server's page
  server: { watch: { ignored: ['**/.claude/**', '**/shots/**', '**/dist*/**'] } },
  test: { include: ['src/**/*.test.ts'] },
});
