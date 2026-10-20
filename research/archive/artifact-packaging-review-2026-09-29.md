# Artifact packaging and integration gate — 9/29/26

P1 repaired: `tools/artifact.mjs` copied only the entry script, omitting Vite dynamic chunks, GLBs and other relative runtime dependencies. The application now defaults to authored models and loads scenes lazily, so this omission would break the artifact variant even when the normal website build worked.

The packager now copies the complete `dist` URL tree, then replaces only `index.html` with the intended host fragment and inlined stylesheet. Linked pages, scripts, models, textures and metadata retain their relative paths. `tools/artifact-verify.mjs` compares every runtime file with its build source and rejects missing or changed dependencies. No publication/deployment was performed.

Validation: `node --test tools/artifact.test.mjs` passed. Its fixture contains a dynamically imported detail script, a GLB, a linked visualizer page and metadata. It verifies successful packaging, deliberately removes the GLB and confirms verification fails. Running `node tools/artifact.mjs` against the existing `dist` succeeded with 74 verified runtime files and 37 asset files. This packages the existing build; root must rerun after the final website build to include subsequent source changes.

Additional integration review: 634 tests passed across data, evidence, journeys and actual optics hardware on 9/29/26 at 1:14 AM, plus TypeScript. New coherent Power/Heat cards use existing documented DSP/laser/package definitions and representative layout qualifications; no new component wattage is fabricated. Each layer visits cdsp/itla/cdm/icr in a named campus-line-terminal side comparison and returns to level 0. It explicitly says power/heat remain local rather than flowing between campuses. Empty layers no longer show “Play 1 to 0”.

Inspection camera state now synchronizes the view selector on scene entry, overview reset, named views and part selection. Overview reset also notifies cover controls; forced thermal covers remain disabled/shown. Scope qualification is plain text, with a compact always-visible statement and optional detailed boundaries, rather than injecting source text as HTML.

Main integration remains uncommitted: `public/models`, new runtime helpers/styles, Blender source/export files and validation helpers must be included together. The Vite relative base and lazy model-loading setup support a normal website build; no claim of deployment or full browser performance acceptance is made here.
