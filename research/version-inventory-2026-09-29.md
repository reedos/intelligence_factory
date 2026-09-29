# Independent version and coherent-qualification inventory — 9/29/2026

Read-only inspection covered this project's registered Git worktrees and local branch refs. No unrelated projects or session history were read. No other worktree was modified. Generated distributions, research reports, dependency directories and build artifacts are excluded from the source-change inventory.

## Version findings

- `main` and `optics/dive` both point to `9d6ce44867112d1ebc4de631f57a1a878d10995d`.
- All **28 local branch tips** are merged into `main`; `git branch --no-merged main` returns no branches.
- All **16 registered worktree HEADs** are ancestors of `main`.
- All **15 worktrees outside the active preview** have **zero dirty tracked or untracked source files**. The only non-preview status entries are research reports in main/optics and generated `dist-review` output in optics.
- The active preview remains detached at `e5301e108c56016fa8a7e863a50f5a0ed3a98653`, with uncommitted integration and Blender work. Its HEAD alone does not identify its current contents. Root owns the final build identity and final cross-file synchronization check.

| Worktree/branch | HEAD | Source status outside preview |
| --- | --- | --- |
| main | 9d6ce448 | Clean |
| preview, detached | e5301e10 | Active integration work |
| worktree-wf_cd531b26-f20-1 | 81bbcae1 | Clean |
| worktree-wf_cd531b26-f20-2 | fdabbf8b | Clean |
| worktree-wf_cd531b26-f20-3 | 1391a15d | Clean |
| worktree-wf_f3d4d527-e62-1 | f36e08b0 | Clean |
| worktree-wf_f3d4d527-e62-2 | 207a8510 | Clean |
| worktree-wf_f3d4d527-e62-3 | fc88dbe3 | Clean |
| worktree-wf_f3d4d527-e62-4 | 86aff7bb | Clean |
| worktree-wf_f3d4d527-e62-5 | 5edd51f8 | Clean |
| worktree-wf_f3d4d527-e62-6 | 39b5f385 | Clean |
| colossus2-energy | 4e2060f5 | Clean |
| colossus/fleet | 70a9af78 | Clean |
| optics/dive | 9d6ce448 | Clean |
| tour/player | 2c1e5dc9 | Clean |
| review/provenance | 0f75d87b | Clean |

This establishes that no additional source corrections are waiting in another registered worktree or unmerged local branch. It does not establish that every main change has already been adapted into the active preview, whose geometry integrations are still underway, nor does it inventory remote-only refs, stashes or unregistered directories.

## Independent coherent review

Accepted:

- `side-coherent.js` now explicitly describes one packaging option; the TX and RX labels say one common design. `side-links-blender.js` explicitly rejects universal package boundaries and retains dimensional/representative-layout qualifications.
- The complete flow-construction block in `side-coherent.js` is byte-identical to main: TX/RX, laser tap/local oscillator, electrical endpoints, power and heat routes have not changed in this qualification pass.
- [OIF HB-CDM §2, printed page 8](https://www.oiforum.com/wp-content/uploads/2019/01/OIF-HB-CDM-01.0.pdf) supports an integrated coherent driver and polarization-multiplexed quadrature modulator. This is a functional packaging definition, not evidence that the drawn representative package is a verified 800ZR part. The cited agreement targets up to 64 GBd.
- [OIF micro-ICR §2, printed page 9](https://www.oiforum.com/wp-content/uploads/2019/01/OIF-DPC-MRX-02.0.pdf) explicitly requires two hybrids, eight detectors in four differential sets, and four TIAs. It supports the minimum-component row without making that package boundary universal to all coherent implementations.
- [Lumentum's HB-CDM page](https://www.lumentum.com/en/products/high-bandwidth-coherent-driver-modulator) supports a four-channel driver with two nested modulators, and a single laser split between transmitter and local oscillator. Its named device is a 69 GBd product, so it supports these definitions, not a claim that it is the specific 800ZR hardware drawn.
- Preview's stronger primary OIF receiver evidence and Marvell ACC/AEC evidence survived the main merge. Copper heat cards/source mappings, comparison tour, local-heat disclaimer, and representative twin-port die partitioning also survived.

**P1, reported to root: over-specific alternate packaging language remains in the merged data/evidence.** The ICR card says shared-PIC modules carry TIAs as a separate chip; the CDM row and assumption place Nokia electronic chips beside its PIC. [Nokia's CSTAR-800 description](https://www.nokia.com/optical-networks/cstar-silicon-photonics/) confirms a shared TX/RX PIC with drivers/TIAs integrated in a non-hermetic package, but does not establish a universal electronic die count or exact placement. Proposed fix: say that another design combines TX/RX photonics with integrated driver/TIA electronics in one optical subassembly; leave die placement implementation-dependent. Apply consistently to the card, assumption, wrapper scope and source comment. Acceptance: OIF package definitions remain clear, while the alternative does not claim a specific unsourced die layout.

Root was informed before final synchronization. Source review is separate from final browser appearance and performance acceptance.

### Resolution — 9/29/2026

The P1 above is resolved in the preview. CDM/ICR cards, the assumption, the inspection note and the scene comment no longer assert Nokia's electronic die count or placement. The Nokia comparison is marked vendor, with an explicit packaging-comparison baseline. A runtime regression checks the qualifications, labels and shared-laser split. The independent reviewer reran 231 relevant tests and TypeScript successfully. Root verified the qualification in the desktop view and expanded 390 px phone panel with no horizontal overflow.
