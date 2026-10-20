# Campus circulation repair — 9/29/26

Scope: representative site circulation in the local Blender preview. This is concept geography, not a surveyed road layout or a traffic-engineering capacity claim. Equipment quantities, utility routes and facility load calculations are unchanged.

## Findings and fixes

1. **P0, main crossroad:** two independent centerline patterns occupied the same spine and continued through its entry intersection; full-length curb strips crossed the entry. Replaced overlapping road slabs with a rectangle union partitioned into disjoint tiles. A single dash pattern now stops before perpendicular carriageways, and curbs follow only the outer pavement boundary. Acceptance: no asphalt tile overlaps another, no dash crosses a perpendicular road, and no curb seals the main junction or parking mouth. Tests pass.

2. **P1, disconnected service approaches:** the substation access stopped short of the spine; the battery service strip was disconnected; the south entrance ended just outside its gate; the parking lot had an unbroken edge curb. The staffed entrance now connects to a visible public road. Substation and battery approaches connect through a service loop, parking has an open entry, and loading spurs meet the real platform edges. Yard/dock mouths are deliberately open transitions to existing yard paving, not extra roads through equipment. Asphalt ends exactly at those boundaries, including the backup-battery boundary at x=277.5 before its transformer row begins at x=281. Acceptance: every road belongs to the entrance-connected component and every remaining endpoint is a named yard/dock/parking/offsite destination. Tests pass.

3. **P1, expanded-campus access:** additional halls lacked roads. Added a connected street grid around the existing authored hall envelopes, reached from the main spine; the perimeter fence expands around that grid. Streets remain in the gaps between buildings, and the public road moves farther south for larger scenarios so it cannot cut through an expanded hall. Acceptance: every modeled expanded hall has adjacent service access; no road overlaps its 264 x 98 m conservative architectural envelope. Current, future and larger stress layouts pass.

4. **P1, vehicle paths:** old traffic performed short U-turns and two directed routes occupied oncoming lanes. Routes now use consistent right-hand travel and rounded junction turns. A full-body sweep caught a truck clipping the battery junction; the service loop was widened from 12 to 14 m and left-turn approach length enlarged. A stronger interior/edge sampling pass then found a concave-curb gap that corner-only checks missed. Unioned 26 m junction aprons now provide the required swept-body clearance, and paint stops before those aprons. Catalog truck geometry points toward -X, while the mover expects +X; its owned instance geometry is rotated so it travels cab-first. Acceptance: every straight route has the correct right-hand offset, and oriented 11.6 x 2.9 m truck / 4.8 x 2.2 m car envelopes stay on pavement along the actual runtime piecewise-linear interpolation, sampling a 5 x 3 body grid at each sampled pose. Tests pass. This checks body clearance; it is not an articulated-trailer dynamics simulation.

5. **P1, streetlight obstruction after turn widening:** the independent reviewer found eight main-spine poles inside the new aprons and an entrance pole tangent to an apron edge. Both streetlight loops now use the same road-plan placement guard, allowing pole radius plus 0.5 m clearance. Conflicting poles and their fixture heads are omitted together; parking-area lighting remains. Acceptance: all surviving street poles have the required actual-plan clearance, and the nine identified positions are absent. Actual-scene regression passes.

## Main-branch synchronization

The operations-center mast/dish/beacon, security and ops power hotspots, border-router annex and border data hotspot from main 9d6ce44 are integrated. The mast sits on the authored 19.4 m office roof rather than inside its taller canopy. Existing fiber landing coordinates remain unchanged. Ops hotspot height is intentionally different from the shorter native comparison office; other original utility/hotspot equality checks still pass.

## Construction and evidence

New pavement, curbs, paint geometry, mast and annex use existing Blender-authored construction modules via SiteBuilder. There is no additional GLB download or unconverted physical primitive in the Blender scene. Scenario hall counts and placement remain model-derived. No physical asset was regenerated, and no build/commit/push/deployment was performed by this agent.

Files: src/scenes/campus-road-plan.js (pure topology, union, markings, traffic); src/scenes/campus-roads.js (authored construction assembly); src/scenes/campus.js (integration, perimeter, tree clearance and synced landmarks); src/scenes/campus-roads.test.ts and campus-blender.test.ts (regressions).

Validation: 20 tests across road topology, actual Blender GLBs and architecture pass; TypeScript passes. Tests include default, shortened one-hall, Colossus 2, future expansion and a larger grid. Native/Blender power/data/heat route equality is retained. Independent reviewer compute_design flagged the lane convention defect, which was corrected before final acceptance. Root reports the default and Colossus 2 live junctions and expanded streets read continuously at 1440 x 1000; final traffic/live acceptance remains root-owned.


Final fence clearance recheck: the westernmost junction apron is asymmetric at its north edge (z=-62) to remain clear of the closed substation fence at z=-65. The required turning space lies on its south side. Explicit road/fence intersection tests now cover the closed south fence portions and east fence; the legitimate 12 m gate opening remains open. Twenty tests and TypeScript pass after this correction.
