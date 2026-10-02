// The NVL72 rack elevation (GB200, GB300, Rubin), bottom up, one entry per rack unit. Units are meters, in rack.js's
// frame. Shared by rack.js, rack-optics.js, rack-mgmt-plan.js, compute-framing.js and the hall's rack faces; the
// Blender scripts (build-compute.py, compute-hero-detail.py, rack-inspection-detail.py) repeat the row numbers.
//
// Eight 33 kW power shelves: NVIDIA's DGX GB200 user guide, Hardware: "The power shelf uses six air-cooled 5.5kW
// PSUs in eight power shelves that provide N+N redundancy". ServeTheHome's DGX GB200 NVL72 tour gives the order of
// the rest, top down: switches, ten compute trays, nine NVLink switch trays, eight compute trays. Where the shelves
// sit is not published; they are drawn as drawn, four under the compute block and four over it, so the bus bar is fed
// from both ends.
export const U = 0.04445, BASE = 0.1;
export const SHELVES_BOTTOM = 4, SHELVES_TOP = 4;
export const LAYOUT = [
  ...Array(SHELVES_BOTTOM).fill('ps'), ...Array(8).fill('compute'), ...Array(9).fill('switch'),
  ...Array(10).fill('compute'), ...Array(SHELVES_TOP).fill('ps'), 'mgmt', 'mgmt',
];
export const trayY = i => BASE + 0.02 + i * U + U / 2;
const first = kind => LAYOUT.indexOf(kind), last = kind => LAYOUT.lastIndexOf(kind);
export const ROWS = {
  lowerCompute: first('compute'),                          // 4
  firstSwitch: first('switch'),                             // 12
  upperCompute: first('switch') + 9,                        // 21
  lastCompute: last('compute'),                             // 30
  topShelfFirst: last('compute') + 1,                       // 31
  topShelf: last('ps'),                                     // 34
  mgmt: first('mgmt'),                                      // 35
};
// the trays pulled out for inspection: the fifth of the upper compute block, the fifth NVLink switch tray
export const PULLED = ROWS.upperCompute + 4, SWITCH_PULLED = ROWS.firstSwitch + 4;
