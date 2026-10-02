# Design review: rack, data hall, campus, scale across (10/01/2026)

Reed (10/01/2026): "Please make sure for all of our designs they make sense from an engineering design perspective
based on best practices for layout, place and route, etc." This review covers scene 3 (the NVL72 and DGX H100 racks,
except the compute-tray, board and DGX server internals other agents own), scene 2 (power room and data hall), scene 1
(campus) and scene 0 (scale across), in the power, data and heat layers, in the default scenario and in the
Colossus 2 preset (`?site=colossus2&stage=0&accel=gb300&power=ac415&cooling=liquid&mw=1461`).

Where a published drawing or text fixes an arrangement, it wins and is cited below. Where nothing published fixes it,
the drawing follows the rule and the layout is labeled "as drawn". Before/after screenshots are in the session
scratchpad (`design-rhs/before`, `design-rhs/after`, same file names).

## Findings and fixes

| Level | Element | Violation | Rule | Fix | Evidence |
|---|---|---|---|---|---|
| Hall | Facility-water drops to every CDU | Supply and return drops came down at the CDU centerline, straight through the yellow fiber runway over the row (and 0.25 m beside the busway): water pipe through a data pathway. | Separate power and data pathways; no service through another's pathway (BICSI/TIA-942, rule 5) | Drops land on the front of each CDU (`HALL_PLAN.facilityFront` 0.42 m), clear of runway and busway; flanged take-offs, valves, markers and heat flows follow. | `hall-cdu-drops`, `hall-pod-plan`; test "no facility-water drop passes through a fiber runway or a busway" |
| Hall | Row busway | Busway sat over the front half of each rack (cold-aisle side), while the rack level draws its tap-offs over the rear, and NVL72 power shelves and bus bar are fed at the rear. | Power at the rear (rule 5); NVIDIA: the rear "provides access to the cable management system, the inlets and outlets to the liquid cooling manifolds and the manifolds themselves, the cable cartridges, and the power bus bar" | Busway moves to 0.25 m behind each row's centerline (rear quarter, over the rack footprint, beside the contained hot aisle); taps, drops, leaf/spine feeds and voltage stencils move with it. | `hall-row-section`, `hall-pod-plan`; NVIDIA DGX GB200 user guide, Hardware |
| Hall | Rack loop (secondary) over the rack tops | Supply and return ran 0.1 m apart at 0.30/0.40 m behind center, with paired drops at each rack's centerline; with the busway at the rear the power drop would have touched the supply collar. | Water below and apart from power; liquid branches as published (manifolds at the rear) | Supply header 0.42 m and return 0.52 m behind center (rear edge of the rack tops, 1 m under the busway); each rack takes supply on one side and return on the other (±0.2 m), where its rear manifolds rise; CDU ports follow. | `hall-row-section`; test "every rack-loop drop lands at the rear of its own rack" |
| Hall | CDU card and level intro | Text said the coolant units stand "at the row end"; the drawing has one in-row CDU per eight racks (four per row). | Text matches drawing; NVIDIA SuperPOD GB200: "Scalable Units (SUs) of 8 DGX GB200 systems" | Cards and intros say "in each row, one per eight racks". | `src/data.js` |
| Hall | Leaf/spine switch jumpers | Bottom-row jumpers turned down from the port with 6–7 mm radius; edge ports beside the manager lane dipped under the chassis and hair-pinned back up. | Fiber bend radius ≥ minimum (rule 5); G.657.A2 "7.5 mm minimum bend radius" | Jumpers stand off 70 mm before turning, drop at least 45 mm, and edge ports go straight to their manager lane; every hall route ≥ 7.5 mm. | `hall-leaf-jumpers`; test "fiber routes keep a gentle bend radius" |
| Rack (NVL72) | Manifold supply/return | Hoses left the manifold feet through the floor, but the hall is a slab with no void and its rack loop is overhead: the two levels disagreed. | Liquid loops as published, manifolds vertical (rule 4); consistency between levels | Top-fed, as drawn: ball valve, ferrule and hose at each manifold head rise behind the trays to roof grommets and dripless couplings; drain valves move to the feet; rack and heat flows and the TCS markers reverse (supply falls, return rises); manifold heat card updated. GLBs rebuilt (gb200, gb300, rubin). | `rack-top-rear`, `rack-rear-heat`, `rack-manifold-part` |
| Campus | MV feeders to hall A | Hall A's duct bank left the yard, dipped 88 m south to the spine road, ran east, then doubled back 50 m north to the hall: 1.38× the straight distance. | Short MV feeders, substation at the line entry (rule 5) | Hall A's feeders run straight east at the unit-substation line (z −112): 1.10×. Hall B keeps the spine-road route (which also carries the battery tie and the expansion feed). Card: "by the shortest practical route". | `campus-feeder-plan`; test "MV feeders run the shortest practical orthogonal route" |
| Campus | Line-terminal huts | Both long-haul routes doubled back: route A ran 65 m west from its vault to hut A and back east; route B zig-zagged vault → hut → back east. | Short, direct, no doubling back (rule 2 applied to duct routes) | Each hut stands on its route between vault and hall. | `campus-fiberA-plan`, `campus-fiberB-plan`; test "each route straight through its hut" |
| Campus | Chilled water to hall B | In chilled-water scenarios (incl. Colossus 2) only hall A had a supply/return pair from the plant; hall B had none. | Cooling plant beside, and connected to, the halls it serves (rule 5) | Hall B gets its own pair from the plant's west wall, along a service corridor west of hall A, on sleepers at 2.2 m, crossing the spine road on a 6.5 m pipe bridge; supply inside, return outside so they never cross. Each pair carries its own hall's heat (hall A's pair re-tagged from both halls' to one hall's watts). | `campus-chilled-plan`, `campus-pipebridge`, `c2-campus-plan-heat`; test "every detailed hall has its own chilled-water pair" |
| Across | Line terminals at this campus | Both DWDM routes left through one terminal and one vault, contradicting the campus level's two diverse entrances. | Diverse entrances, separate (VA OIT after TIA-942: "at least 66 ft (20 m) apart"; "Develop diverse building entrance routes") | A second terminal on the north side; the northernmost route uses it, the other the east one. The west side stays the grid's. Card notes it. | `across-terminals`; test "two separate terminals" |

## Reviewed and kept (meets the rules or the published arrangement)

- Rack: NVLink spine as four vertical cartridges at the rear spanning the compute and switch trays; bus bar at the rear
  centerline; manifolds vertical either side at the rear; power shelves top and bottom; management switches at the top;
  compute-tray NICs on the front with fiber managers at the front edges (NVIDIA: front OSFP NICs; rear bus bar,
  cartridges, manifolds). DGX H100: supplies, PDUs and cords at the rear, scale-out cages at the rear.
- Hall: hot-aisle containment between rack backs (rears face each other); EoR leaf racks, spine row and ODF frames as
  HDA/MDA with a floor sleeve to the cross-hall duct bank (TIA-942 structure); fiber runway 0.8 m over the busway
  (BICSI: "30 cm (1 ft.) from conduit and cables used for electrical power distribution"); unit substation outside
  the electrical room, close-coupled by bus duct.
- Campus: substation at the line entry; two fiber vaults on opposite sides of the halls; unit substations along the
  road-facing side of each hall.

## Open items (not fixed here)

| Level | Element | Issue | Recommendation |
|---|---|---|---|
| Rack, hall | A and B feeds | Both taps come off one busway; 2N practice runs two busways (A and B). Card labels "A + B" as an assumption. | Second busway per row and per rack scene (touches the flow agent's feed flows and the H100 rack GLB). |
| Rack (NVL72) | Shelf feed cables | Top-shelf cords run diagonally through open rack interior; the bottom-shelf cord at x 0.10 m runs through the volume of every tray (trays end at z −0.435 m; the cord is at −0.30…−0.375). | Owned by the flow agent's feed flows; see below. |
| Rack | Rack runway orientation | `RACK_RUNWAY` runs front-to-back across the row and the trunks continue 1 m behind the rack over the hot aisle; the hall runway runs along the row over the centerline. | Rotate along x over the centerline; trunks turn into it (rack-optics.js, flow agent's riser). |
| Rack | Manifold vs rear corner post | Manifolds (and now hoses' lower bend) clip the rear corner posts by about 15 mm (pre-existing). | Narrow the manifold or inset it; needs a GLB rebuild. |
| Hall (H100) | Rear fiber risers | Rear-port DGX H100 racks rise at 0.70 m behind center, through the hot-aisle roof. | Brush-seal penetrations or rise inside the rack footprint. |
| Campus (warm water) | Trim cooling towers | Towers receive makeup water and emit vapor but no pipe connects them to the halls. | Connect a condenser pair to the halls, or draw adiabatic trim on the roof coolers instead. |
| Campus (Colossus 2) | Expansion halls | One chiller plant and one conceptual MV trunk serve ~40 halls 1–2 km away. Already labeled conceptual. | Per-block plants and substations beside the expansion halls. |
| Rack | Power shelf count | A search summary of the DGX GB200 guide reports eight shelves per rack; the page I opened does not state it and the model draws six. | Check against the guide's power section. |

## Flow agent's rack flows (vis/flow-paths, now on main 7daac93) — issues for the lead

Reviewed as merged. These flows are the flow agent's; I did not edit them.

1. Feed flows carry `audit: { through: true }` "inside the feed cable", which hides a real geometry fault: the
   bottom-shelf cable (x 0.10, z −0.30 → −0.375) runs through all the tray volumes (trays end at z −0.435), and the
   top-shelf cords run diagonally from the roof to the shelf rear. Route both down the rear cable space (z < −0.44,
   e.g. x ±0.065 between bus bar and cartridges), dressed vertically, entering each shelf at its rear inlet; then drop
   the `through` flag. (Needs a rack GLB rebuild: the cords are baked.)
2. Tray-to-cartridge stubs still all start at x 0 (the bus bar line) and fan out across behind the tray to the four
   cartridges. Rule 2 wants each link straight back from its own rear connector, one connector in front of each
   cartridge (x = cartridge x).
3. The opened switch tray's NVLink flows end at z ZB + 0.16 at x ±0.06–0.07 ("schematic tether"), short of any
   cartridge, so the switch tray's NVLink never reaches the spine. Extend them to the cartridge faces like the stubs.
4. Fiber riser rails at x ±0.2685–0.28: inside the 600 mm width, at the corner-post line. Acceptable as drawn.
5. The riser's trunks end in `RACK_RUNWAY`, which runs across the row (see open items).

## Flow checker (tools/flows.mjs, DEFER_NONE=1, scenes 0–3, 19 scenarios)

Applied the hall, campus and across hunks of the flow agent's `flow-fixes-other-owners.patch`, merged with this
layout (busway, drop-cable, guide-ring and patch-termination materials named for the audit; UPS route behind the
line-up; cables on the runway rungs at 4.41 m; SHELTER and MAP_HUT pass-throughs declared; line detours around plant
symbols). Then fixed the three remaining findings: far-campus terminals now stand on the side their route arrives from
(the route used to cross the far MAP_TERMINAL), and long-haul fiber B and the expansion data feed run at z −232, clear
of the chiller plant on small campuses (the route crossed the plant at (50, −240) at 10 MW).

| Level | Flows | Inside | Defective routes |
|---|---|---|---|
| Across | 433 | 0 | 0 |
| Campus | 1,234 | 0 | 0 |
| Hall | 9,196 | 0 | 0 |
| Rack | 1,705 | 66 | 32, all H100 (owned by the DGX H100 agent) |

## Sources opened

- NVIDIA DGX GB200 user guide, Hardware: https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html
- NVIDIA DGX SuperPOD GB200 reference architecture, components:
  https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-gb200/latest/dgx-superpod-components.html
- BICSI separation (TDMM, as summarized): https://www.cabling-design.com/resources/documents/emi/bicsi.shtml
- VA OIT Infrastructure Standard for Telecommunications Spaces (TIA-942 based), p. 43:
  https://www.cfm.va.gov/cfm/til/telecom/OIT-ISTS-v5.pdf
- G.657.A1/A2 bend radius: https://fibconet.com/g-657-a1-vs-g-657-a2/
- Leviathan Systems GB200/GB300 NVL72 deployment notes (no placement detail):
  https://www.leviathansystems.co/articles/gb200-nvl72-deployment-deep-dive

Not opened (timed out or blocked), not cited: HPE GB200/GB300 NVL72 QuickSpecs, Supermicro GB200 NVL72 datasheet.

## Tests

`src/scenes/design-rules-rack-hall-site.test.ts` checks: busway over each rack's rear and over its footprint; ≥ 0.3 m between the
power and data pathways; rack loop below the busway at the rack rears, supply and return apart; no facility drop
through a runway or busway; rack-loop drops on their own header at their own rack's rear; every hall fiber route
≥ 7.5 mm bend radius; MV feeders never double back and stay < 1.45× straight distance; fiber vaults ≥ 20 m apart on
opposite sides with routes straight through their huts; a chilled-water pair per hall that never crosses itself and
clears roads by ≥ 5 m; NVL72 spine, bus bar and manifolds at the rear and mirror-symmetric, hoses through the roof;
two separate terminals at this campus; the same plan rules in the Colossus 2 preset.

## Follow-up (design/rack-followup, 10/01–10/02/2026)

| # | Level | Element | Was | Fix | Evidence / screenshots (`rf-before`, `rf-after`) |
|---|---|---|---|---|---|
| 1 | Rack (NVL72) | Shelf feed cords | Bottom-shelf cable ran through every tray volume; top cords ran diagonally; flows declared "inside the cable" | A and B cords drop to the roof, are dressed to brush grommets over the rear cable space and run down it at x ±0.065 m (between bus bar and cartridges, behind the trays), with a whip into each shelf's rear inlet; only the roof-grommet pass is declared | `rf-rack-rear-top`, `rf-rack-rear-power`; test "feed cords never cross a tray" |
| 2 | Rack | Tray-to-cartridge NVLink stubs | All started at x 0 and fanned out | Each runs straight back from its own connector into the cartridge behind it | `rf-rack-nvlink`; test "each NVLink stub runs straight back" |
| 3 | Rack | Opened switch tray's NVLink | Ended 0.6 m short of any cartridge | Out of the tray's rear connector, back through its own empty slot and connector into the cartridge (GB inner pair; Rubin front ASICs to the outer pair) | `rf-rack-switchtray` |
| 4 | Rack | Manifolds vs corner posts and rear rails | Clipped both by about 15 mm | Manifolds 3.5 mm in front of the posts; rear EIA rails just outboard of the 440 mm trays at the tray rears; hoses straight up | `rf-rack-corner`; test "manifold clear of the corner post, rear rail and cartridges" |
| 5 | Hall, rack | A and B feeds | Both taps on one busway | 2N: A busway over each rack's rear quarter, B over its front quarter, each with its own riser, main and cross bus from the power room; one tap and drop from each per rack; cards updated (`dual-feed-redundancy` notes that NVIDIA states only N+N shelves) | `rf-hall-row-section`, `rf-hall-pod-plan`, `rf-rack-top-busways` |
| 6 | Rack | Rack fiber runway | Ran front-to-back across the row | `ROW_RUNWAY` along the row over the centerline, as in the hall; trunks rise at the front managers, cross over the B busway's hanger rods and run along it. DGX H100 keeps `RACK_RUNWAY` until its rebuild lands | `rf-rack-runway` |
| 7 | Hall (H100) | Rear-port risers | Rose through the hot-aisle roof | Leads turn back through the rear door, rise in the rack's rear cable manager and leave through a roof grommet | `rf-hall-h100-risers`; test "never through the hot-aisle roof" |
| 8 | Campus (warm water) | Trim towers | Makeup water only, no pipe to any hall | Pair from the tower row straight into hall A's north wall; hall B's pair takes the corridor and pipe bridge; each carries half the towers' heat | `rf-campus-warm-towers`; test "trim towers are piped to every detailed hall" |
| 9 | Rack | Power-shelf count | 6 drawn | 8, per NVIDIA's DGX GB200 user guide, Hardware: "The power shelf uses six air-cooled 5.5kW PSUs in eight power shelves that provide N+N redundancy"; GB300 per the NVL72 reference architecture ("8 power shelves of 33 kW"); Rubin assumed the same. Position (four under, four over the compute block) is as drawn; ServeTheHome gives the rest of the order top down (switches, 10 compute, 9 switch, 8 compute) | `rf-rack-front` |

The elevation now lives in `src/scenes/nvl72-layout.js` (rows: shelves 0–3, compute 4–11, switch 12–20, compute
21–30, shelves 31–34, management 35–36; pulled trays 25 and 16).

Flow checker (DEFER_NONE=1, scenes 0–3): across, campus and hall 0 findings; rack 0 except the 32 H100 routes
(owned by the H100 agent).

Sources opened for the follow-up: https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html (shelf count),
https://www.servethehome.com/this-is-the-nvidia-dgx-gb200-nvl72/ (tray order).
