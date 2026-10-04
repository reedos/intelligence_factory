// What the data-hall level draws. It is one fixed, representative hall (no model count sizes it), the same in every
// scenario: six rows of racks in groups of eight with a coolant unit (or an in-row cooler) ahead of each group, three UPS
// line-ups, a switchgear line-up and two battery rows. hall.js builds from these numbers, and data.js says so on the
// level ("Shown: ...") and words every model-derived count on a hall card as the campus total or a per-hall share, never as
// "here", because the model's counts (racks, UPS modules, CDUs) are not what this level draws.
// hall-slice.test.ts checks the built scene against this record.
export const HALL_SLICE = {
  rows: 6, groups: 4, racksPerGroup: 8,
  upsLineups: 3, upsPerLineup: 3,
  switchgear: 14, batteryRows: 2, batteriesPerRow: 12,
};
HALL_SLICE.racks = HALL_SLICE.rows * HALL_SLICE.groups * HALL_SLICE.racksPerGroup;   // 192
HALL_SLICE.cdus = HALL_SLICE.rows * HALL_SLICE.groups;                                // 24, one per group of eight racks
HALL_SLICE.ups = HALL_SLICE.upsLineups * HALL_SLICE.upsPerLineup;                     // 9
HALL_SLICE.batteries = HALL_SLICE.batteryRows * HALL_SLICE.batteriesPerRow;           // 24
