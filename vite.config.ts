import { defineConfig } from 'vitest/config';

// Relative base so the same build runs at reedos.github.io/intelligence_factory/ and as a claude.ai artifact.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  // agent worktrees live under .claude/; their edits must not reload this server's page
  server: { watch: { ignored: ['**/.claude/**', '**/shots/**', '**/dist*/**'] } },
  test: { include: ['src/**/*.test.ts'] },
});
