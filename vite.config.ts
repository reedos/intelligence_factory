import { defineConfig } from 'vitest/config';

// Relative base so the same build runs at reedos.github.io/intelligence_factory/ and as a claude.ai artifact.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { include: ['src/**/*.test.ts'] },
});
