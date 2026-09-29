import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { verifyArtifact } from './artifact-verify.mjs';

test('artifact retains lazy chunks, models and linked pages; verification detects missing GLBs', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'ifx-artifact-smoke-'));
  const files = {
    'index.html': '<title>Test</title><link rel="stylesheet" crossorigin href="./assets/site.css"><script type="module" crossorigin src="./assets/main.js"></script><body><a href="visualizer.html">View</a></body>',
    'assets/site.css': 'body{color:white}',
    'assets/main.js': 'import("./detail.js")',
    'assets/detail.js': 'fetch("./models/example.glb")',
    'models/example.glb': Buffer.from([0x67,0x6c,0x54,0x46,2,0,0,0]),
    'visualizer.html': '<script type="module" src="./assets/detail.js"></script>',
    'build-identity.json': '{"test":true}',
  };
  try {
    for (const [name, body] of Object.entries(files)) {
      const path = join(workspace, 'dist', name); mkdirSync(dirname(path), {recursive:true}); writeFileSync(path, body);
    }
    execFileSync(process.execPath, [fileURLToPath(new URL('./artifact.mjs',import.meta.url))], {cwd:workspace});
    const output = join(workspace, 'dist-artifact');
    assert.match(readFileSync(join(output,'index.html'),'utf8'), /window.IFX_ARTIFACT = true/);
    assert.equal(verifyArtifact(join(workspace,'dist'),output),6);
    rmSync(join(output,'models/example.glb'));
    assert.throws(()=>verifyArtifact(join(workspace,'dist'),output),/runtime dependency missing: models/);
  } finally {
    // mkdtemp returns a verified absolute temporary directory owned by this test.
    assert.ok(workspace.startsWith(join(tmpdir(),'ifx-artifact-smoke-')));
    rmSync(workspace,{recursive:true,force:true});
  }
});
