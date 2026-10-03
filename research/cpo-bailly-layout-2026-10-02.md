# Bailly package layout: what's confirmed, what's inferred (10/02/2026)

Purpose: ground the "2. Package traces" fix (vis/mzm-layout) — the tile arrangement and the
copper-trace geometry from the Tomahawk 5 switch die's SerDes edge to the eight 6.4T optical
engine tiles. This doc only adds to what `src/evidence.js`'s `cpo-bailly-layout` entry already
says; it doesn't replace it.

## Confirmed, from Broadcom's own material

- **Eight 6.4 Tb/s optical engines, 51.2 Tb/s total, with the Tomahawk 5 switch ASIC.** Broadcom's
  own Hot Chips 2024 slide (screenshotted below) states it plainly: "8 Silicon Photonic Engines @
  6.4T (64ch)", "51.2T CPO links, no electrical links", "Optical Power: 5.5W/800G".
  [Broadcom, Hot Chips 2024, "Tomahawk 5 – Bailly 51.2T CPO" (slide 10)](https://hc2024.hotchips.org/assets/program/conference/day1/61_HC2024.Broadcom.ManishMehta.v2-NO-VIDEO.pdf)
- **"Eight silicon photonics based 6.4-Tbps optical engines" co-packaged with Tomahawk 5**, delivered
  commercially. [Broadcom investor release, 03/14/2024, "Broadcom Delivers Industry's First 51.2-Tbps Co-Packaged Optics Ethernet Switch Platform"](https://investors.broadcom.com/news-releases/news-release-details/broadcom-delivers-industrys-first-512-tbps-co-packaged-optics)
- **Edge-mounted engines, short organic-substrate links to the switch die** (no literal CPO photo
  of the uncovered die, but Broadcom's own description): "high-density edge-mounted optical
  engines directly interface with the core die through short, chip-to-chip connections through the
  organic substrate." [APNIC blog, 05/07/2025, "Co-Packaged Optics — a deep dive" (citing Broadcom)](https://blog.apnic.net/2025/05/07/co-packaged-optics-a-deep-dive/)
- **The sealed package photo** (lid on, gold frame, the Tomahawk 5 die visible through a window)
  does not show the engines — they sit under the lid, inside the organic substrate build-up, not
  on an exposed top layer a package photo would reveal. [ServeTheHome, "Broadcom Tomahawk 5 based 51.2T Bailly Co-Packaged Optics Switch Shown"](https://www.servethehome.com/broadcom-tomahawk-5-based-51-2t-bailly-co-packaged-optics-switch-shown-cpo/)
- **30% power savings, FR4, 2023 OFC demonstration**; **4RU air-cooled reference system** with
  front-panel MPO/MDC connector arrays, visible in the chassis render on the same Hot Chips slide.

## What I could not confirm from a photo this session

I downloaded and visually inspected (Read tool, not text-only WebFetch) the two package photos
public coverage uses most: ServeTheHome's angled lid-on shot and Broadcom's own Hot Chips chip
photo. Neither resolves the per-side engine count or exact orientation — the lid conceals the
engines in both. No tool available to me this session could render the Hot Chips PDF's other
slides as images (no `pdftoppm`/poppler on PATH) or inspect a de-lidded Bailly die photo; I didn't
find one in public reporting (Broadcom doesn't appear to have published a bare-die shot of Bailly
specifically, unlike some TH6-Davisson coverage).

## Inferred, and the basis for it

**Two engines per side, squared to the die's four edges**, each engine's electrical (SerDes) edge
facing the ASIC edge it connects to, is *not* confirmed from a Bailly photo. It is inferred from:

1. Broadcom's **Tomahawk 6 "Davisson" CPO slide**, as captured by ServeTheHome, which *does* show
   engines arranged in rows flanking the switch die's four edges (Davisson carries 16 engines at
   102.4T; `evidence.js`'s existing `cpo-bailly-layout` entry already cites this slide as the
   proportions/arrangement source, scaled down to Bailly's eight). This is the same source the
   existing evidence entry already names — this review doesn't add a new photo, it fixes the
   geometry so it actually matches what that entry already claims ("eight engines as radial tiles,
   two per side ... with the electronics at the switch-chip end").
2. Standard CPO floorplanning practice described across vendor and analyst material: engines sit
   as close to the switch die's own SerDes edge as the substrate allows, oriented so the
   electrical (driver/TIA) side faces the die and the fiber/connector side faces the package edge
   — minimizing electrical trace length, which is CPO's whole premise (electrical signal
   conditioning "less needed with the engines on the switch chip's substrate," per the Broadcom
   quote already in the level's own "Package traces" caption).
3. Symmetry: eight engines around a roughly square switch die divides evenly as two per side on
   four sides, which is also what the chassis render's two MPO/MDC connector banks per side
   (visible in the Hot Chips slide's system photo) are consistent with.

**This review's actual bug was not the per-side count or orientation** (the code already placed
tiles two-per-side, squared, via `baillyLayout()` in `side-geometry.js`) **but the trace math**:
`asicTap()` pins every tap to the ASIC's corner margin (`TAP_MAX`/`tMax` normalization), which is
correct for the micro-ring package's eighteen asymmetric engine offsets but wrong for the Bailly
package's two-per-side symmetric tiles — it forced both of a side's taps to the same corner-hugging
offset regardless of where the tile actually sat, which in turn forced `engineBusWidth` to squeeze
the ASIC-end width down to a sliver (`cornerRoom` as low as 0.15 cm against a desired half-width of
0.457 cm, a scale of about 0.33), producing the fan-wider-than-the-tile, diagonal-from-the-corner
bus visible in the "2. Package traces" close-up before this fix. See `baillyAsicTap` in
`src/scenes/side-geometry.js` and the design notes at `BAILLY.t`.

## Design decision (not vendor-sourced): tile offset

`BAILLY.t` (how far each tile's center sits from its side's own centerline) moved from 1.0 cm to
0.65 cm so that `baillyAsicTap`'s straight, un-renormalized tap position has enough room under the
ASIC's own half-edge (`ASIC_HALF` = 1.2 cm) to carry each tile's full electrical-edge width (about
0.457 cm half-width) without compression — `engineBusWidth('mzm', ...)` now returns `scale === 1`
for every tile, so the bus is a single straight, perpendicular, constant-width ribbon from the
ASIC edge to the landing cells, with a visible gap (about 0.3 cm) between the two tiles on a side.
This is a drawing choice, not a measured package dimension; the whole package is explicitly
representative (`cpo-bailly-layout` evidence entry, "Size and layout representative" caption on
the level itself).

## Sources

- [Broadcom, Hot Chips 2024, "An AI Compute ASIC with Optical Attach to Enable Next..." (PDF, slide 10: "Tomahawk 5 – Bailly 51.2T CPO")](https://hc2024.hotchips.org/assets/program/conference/day1/61_HC2024.Broadcom.ManishMehta.v2-NO-VIDEO.pdf)
- [Broadcom investor relations, 03/14/2024, "Broadcom Delivers Industry's First 51.2-Tbps Co-Packaged Optics Ethernet Switch Platform for Scalable AI Systems"](https://investors.broadcom.com/news-releases/news-release-details/broadcom-delivers-industrys-first-512-tbps-co-packaged-optics)
- [ServeTheHome, "Broadcom Tomahawk 5 based 51.2T Bailly Co-Packaged Optics Switch Shown"](https://www.servethehome.com/broadcom-tomahawk-5-based-51-2t-bailly-co-packaged-optics-switch-shown-cpo/)
- [ServeTheHome, "Broadcom Now Sampling 51.2T Co-Packaged Optics Switch"](https://www.servethehome.com/broadcom-now-sampling-51-2t-co-packaged-optics-switch/)
- [APNIC blog, 05/07/2025, "Co-Packaged Optics — a deep dive"](https://blog.apnic.net/2025/05/07/co-packaged-optics-a-deep-dive/)
- [Broadcom, "How to scale the optical interconnect using co-packaged optics (CPO)" (Near Margalit)](https://www.broadcom.com/company/news/articles/ai-infrastructure/how-to-scale-the-optical-interconnect-using-co-packaged-optics-cpo)
