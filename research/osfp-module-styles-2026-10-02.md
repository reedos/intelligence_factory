# OSFP / QSFP-DD module style audit — 2026-10-02

Purpose: decide what is "standard" styling for The Intelligence Factory's two module models —
the **Pluggable optics** module (800G/1.6T twin-port 2×DR4 OSFP) and the **Coherent optics**
module (800ZR OSFP) — against how real vendors actually build these parts.

Method: web search + fetch for product pages, datasheets and photos; images were downloaded
with curl into `scratchpad/osfp-audit/photos/` and viewed with the Read tool. Every row below
that cites a photo was viewed directly; rows marked "text only" were not — I read a spec page,
datasheet text, or search snippet but did not find/view a photo for that specific claim.

The OSFP MSA pull-tab color code (Table 3-3, OSFP Module Specification Rev 5.1, §3.8, read via
pdftotext from the official PDF) is the normative reference used throughout:

| Product type | Example PMD | Color | Pantone |
|---|---|---|---|
| OSFP copper cables | CR8 | Black | N/A |
| OSFP AOC cables | AOC | Grey | 422U |
| OSFP 850nm solutions | SR8, SR4.2 | Beige | 475U |
| OSFP 1310nm, up to 500m | **DR4** | **Yellow** | 107U |
| OSFP 1310nm, up to 2km | FR4, FR8 | Green | 354C |
| OSFP 1310nm, up to 10km | LR8 | Blue | 300U |
| OSFP 1310nm, up to 40km | ER8 | Red | 1797U |
| OSFP 1550nm, up to 80km | **ZR8** | **White** | N/A |

Our two models are a DR4 part (yellow by spec) and a ZR part (white by spec) — both already
land on the two rows I found the most consistent real-world photographic confirmation for.

## Per-maker table

| Maker | Product seen | Form factor | Fins | Shell | Pull tab | Label | Connectors | Photo viewed? |
|---|---|---|---|---|---|---|---|---|
| **NVIDIA (Mellanox LinkX)** | MMS4X00-NM (800G 2×DR4, finned) | OSFP closed finned-top, twin-port | Lengthwise, full length except last ~15% near the pull-tab end (where the label sits); tightly spaced, countable ~20+ | Bare/brushed aluminum-grey finned housing, black lower shell | Yellow, open rectangular loop, rigid plastic, extends well past the shell, molded at the fiber end | White/printed label on the flat area right behind the pull tab, top face | 2× MPO-12/APC (twin DR4) | Yes — NVIDIA's own mechanical CAD drawing (networking-docs.nvidia.com), plus a ConnectX-7 NIC bracket with the same finned profile and an NVIDIA-branded 800G→2×400G splitter DAC showing the same finned, black-tabbed cable-head shape (DAC = black per Table 3-3) |
| **Marvell — COLORZ III 800ZR (OSFP)** | MV-Q4KX1-TC | OSFP flat-top (RHS style, no fins) | None | Bare brushed-silver metal, visible screws, plain rectangular block | White, rigid plastic, open bail/hook shape (wider "goalpost" than a simple loop) with a small secondary latch tab, extends well past the shell | White label on the top flat face: "Class 1 Laser Product", Marvell logo, "COLORZ III 800ZR-DWFP", part number, serial, "Made in [redacted]" | Not visible in this frame (side view) | Yes (ServeTheHome lab photo) |
| **Marvell — generic/Teralynx-paired 400G LR4 optic** | unbranded in frame, used with a Marvell Teralynx 10 switch | OSFP closed finned-top, single-port | Lengthwise, dense, ~80-90% of length | Bare metal, silver | **Blue**, open loop, rigid plastic, extends past shell | Not visible (top obscured by switch cage) | Not visible | Yes (ServeTheHome) — confirms the Table 3-3 blue=LR8/10km code on a real part |
| **Lumentum** | "800G 2×DR4 OSFP Transceiver Module" | OSFP flat-top, no visible fins in product shot | None visible | Brushed silver/grey metal, dark plastic nose piece | **Yellow**, open rectangular loop, rigid plastic, roughly half the module's own length | Not shown in the render (product-page hero shot, no label side visible) | 2× MPO implied by DR4 designation, not visible in this frame | Yes (lumentum.com product render) |
| **Coherent Corp (II-VI/Finisar)** | FTCE4517E1PxM (DR-class OSFP) | OSFP flat-top, front ~40% finned, rear flat | Lengthwise, front-loaded, ~8 fins | Bare metal, silver | Yellow, open loop with molded "800G" text cast into the tab | Not the dominant feature in this product photo; a small vent/LED area is visible instead | Single MPO connector visible at the fiber end (this appears to be a single-port DR/DR+ variant, not the twin 2×DR4) | Yes (coherent.com product photo) |
| **Accelink** | RTXM600-2B1, "800Gbps-500m-DR8-SM-OSFP" | OSFP flat-top, front ~35% finned | Lengthwise, front-loaded, 7-8 fins | Bare metal, silver | Yellow, open rectangular loop | White label on the top flat face: brand, part number, "800Gbps-500m-DR8-SM-OSFP", serial, laser-safety line | Single MPO visible (DR8, single-port 8-channel variant); a second Accelink render of a different DR8 part shows a flat, unfinned shell with a yellow tab molded "800G" | Yes (accelink.com product renders, 2 images) |
| **Innolight** | T-DP8CNT-N00 / T-DP4CNT-N00 (QSFP-DD), T-GP4CNT/T-GP4CNM (QSFP112) | QSFP-DD / QSFP112 flat-top, no fins (none of Innolight's own product-page renders show an OSFP finned part) | None on the parts photographed | Bare brushed-silver metal, black latch/nose piece | Green (QSFP-DD DR8+ shown), purple (a QSFP-DD CWDM/other-reach variant), green and yellow (two QSFP112 parts) — all open rectangular loops, rigid plastic, roughly 1.3-1.5× the shell's own length | Large white rectangular label covering most of the top face: Innolight logo, part number, S/N, barcode, "XXXG BASE ... CLASS 1 LASER PRODUCT", "Made in China" | 1× or 2× MPO per part, gold edge-connector visible at the host end | Yes (innolight.com product gallery, 4 images) — note: these are QSFP-DD/QSFP112 parts, not OSFP; I could not find a real photo of Innolight's own 800G OSFP line, only the solutions page text |
| **Cisco** | OSFP-800G-DR8 | OSFP closed finned-top (per datasheet text) | Not verified by photo | Not verified by photo | **Orange**, per datasheet text (cisco.com) — this does not match the Yellow that Table 3-3 assigns to DR4/DR8-500m-class parts; flagging as reported, not photo-confirmed, and as a possible outlier or a case where Cisco's own color convention differs from the MSA table | Not verified | Dual MPO-12/APC (per datasheet) | **No** — text only (datasheet prose, no image URL extracted; fs.com's Cisco-compatible product photo could not be fetched, see below) |
| **Eoptolink** | 800G OSFP 2×DR4 / LPO OSFP | OSFP, per their own product-line pages | Not verified by photo | Not verified by photo | Not verified by photo | Not verified by photo | 2× MPO-12 (per spec text) | **No** — DirectIndustry and eoptolink.com pages did not yield a loadable photo in this session; text/spec only |
| **Arista** | OSFP-800G-2XDR4, OSFP-800G-2FR4, OSFP-800G-2VSR4 | OSFP finned-top (FS.com's Arista-compatible SR4/SR8 listing is explicitly titled "OSFP Closed Finned Top") | Not verified by photo | Not verified by photo | Not verified by photo | Not verified by photo | Dual MPO-12/APC or dual LC depending on reach (per Arista's transceiver guide PDF) | **No** — text only; fs.com page would not load (see "Sites that refused a fetch" below) |
| **Broadcom** | 800G OSFP (BCM87812/BCM85812-based) | OSFP, SR8/SR4 and others, per generic/compatible listings | Not verified by photo | Not verified by photo | Not verified by photo | Not verified by photo | Dual MPO-12/APC (SR variants) | **No** — Broadcom sells the DSP/PHY silicon, not its own branded OSFP module as a retail part; what shows up are third-party modules built around Broadcom chips. Text only. |
| **Source Photonics / HG Genuine (Huagong)** | not found | — | — | — | — | — | — | **No** — no usable product photo found in this session |
| **Accelink 800G OSFP ZR (DCO)** | OSFP ZR DCO page exists (accelink.com) | OSFP, coherent | Not verified by photo | Not verified by photo | Not verified by photo (should be White per Table 3-3 if they follow it) | Not verified by photo | Not verified | **No** — found the product page link only, did not fetch an image for this specific coherent part |
| **FS.com (third-party coder, cross-check)** | NVIDIA/Mellanox-compatible MMS4X00-NM listing, Cisco OSFP-800G-DR8-compatible listing, Arista OSFP-800G-2VSR4-compatible listing | Listed as "OSFP Closed Finned Top" across all three | — | — | — | — | — | **No** — fs.com returned 0 bytes to every fetch attempt (direct curl and WebFetch) in this session, almost certainly bot-blocking; only the page titles/snippets from search were usable, and those just corroborate "closed finned top" as the common description for switch-side DR4/DR8/SR4 parts |

**Sites that refused a fetch:** fs.com (every page, 0 bytes back); the DirectIndustry Eoptolink
page loaded but was a stub with no image links; several `networking-docs.nvidia.com` and
`osfpmsa.org` fetches via the summarizing WebFetch tool returned raw PDF bytes instead of
rendered text, so those were re-pulled with curl + pdftotext instead (this is how Table 3-3
above was obtained).

## What is standard

### Switch-side 800G/1.6T DR4 OSFP (our "Pluggable optics" model)

Consensus is strong on four points, weaker on a fifth:

1. **Fins, lengthwise, when the host needs the airflow.** Every genuinely switch/NIC-side part I
   could photo-confirm (NVIDIA MMS4X00, Coherent Corp's DR part, Accelink's DR8) has lengthwise
   fins running from the host-connector end toward the fiber end, stopping short of the label/
   pull-tab area. Coverage varies 35%-90% of the body length across makers — there is no single
   agreed-on fin percentage, but "fins toward the back, flat/labeled area toward the front near
   the fiber end" is consistent everywhere I saw it. The flat, unfinned "RHS" style (Marvell
   COLORZ, Lumentum's DR4 render) is the other half of the picture — plenty of real DR4/ZR OSFP
   parts ship with no fins at all, relying on the cage/heatsink instead of an integrated one.
   Both are "standard"; which one a given SKU uses depends on whether that specific switch
   port's cage supplies its own heat sink.
2. **Bare/brushed silver aluminum shell**, not painted or anodized black, is what I saw on every
   maker's DR4-class part (NVIDIA, Marvell, Lumentum, Coherent Corp, Accelink, Innolight on the
   adjacent QSFP-DD line). I did not find a single black-anodized 800G OSFP DR4 shell.
3. **Open rectangular-loop (or wide bail/hook) rigid-plastic pull tab**, colored per OSFP MSA
   Table 3-3, extending well beyond the shell (roughly half to one full module-length past the
   housing). Every tab I viewed — yellow (NVIDIA, Lumentum, Coherent Corp, Accelink, Innolight
   QSFP112), blue (the Marvell/Teralynx LR4 part), white (Marvell COLORZ ZR) — followed the
   table. This is the single most consistent feature across makers.
4. **A white rectangular label on the top face, at or near the fiber/pull-tab end**, carrying
   maker logo, part number, serial number, a one-line spec/reach string, and a laser-safety
   line. Seen clearly on Innolight, Accelink, Marvell COLORZ, and is exactly where the OSFP MSA
   itself recommends it (per the part placement our own model's "pull tab and label" panel
   already cites: "top face at the fiber end, about 15 × 20 mm").
5. **Weaker consensus: single vs. twin-port.** Most of what I could photo-confirm (Coherent
   Corp, Accelink) were single-port 8-lane DR8 parts with one MPO, not twin 2×DR4 with two MPOs.
   NVIDIA's MMS4X00-NM and Arista's 2xDR4 SKU are twin-port by spec, matching our model, but I
   only had NVIDIA's photo to confirm the twin-MPO fiber end directly.

**Notable outliers:** Cisco's reported orange pull tab for OSFP-800G-DR8 (text only, not photo-
confirmed) would be a real outlier against the yellow standard if accurate — worth re-checking
against a photo before treating it as confirmed. Innolight's own OSFP-branded line could not be
photo-confirmed at all in this session; what I have for Innolight is their adjacent QSFP-DD/
QSFP112 house style, which is internally consistent (same label format, same tab construction)
but is a different form factor, not OSFP.

### 800ZR coherent OSFP (our "Coherent optics" model)

Thinner evidence base (one real photo-confirmed part, Marvell COLORZ III), but it lines up
cleanly with the MSA table and with general industry description:

- **Flat-top, no fins** on the one part I viewed directly (Marvell COLORZ III). This tracks with
  coherent modules generally running hotter but at lower per-port port-count density on
  line-side router ports, which more often use flat-top cages with host-side heat sinking than
  the finned closed-top style common on switch-side gray optics — though I did not get enough
  coherent-part photos to call this a strong pattern, only a plausible one from a single sample.
- **White pull tab**, exactly matching Table 3-3's ZR8/1550nm/80km row. Confirmed on the one
  part I photographed.
- **Bare silver metal shell**, same as the DR4 parts above.
- Pull tab shape differs from the simple loop seen on DR4 parts: Marvell's is a wider bail/hook
  with a secondary latch nub, not a plain rectangular loop. Whether that is a COLORZ-specific
  design choice or a broader coherent-module convention is unconfirmed — single sample.
- Label placement and content (top face, near fiber end, laser-class + part number + serial)
  matches the DR4 pattern.

## How our models compare

Our models are the 3D scenes in `C:\Users\reedo\AppData\Local\Temp\claude\c--Users-reedo-projects\1e92a34a-593e-43cc-a7d2-539990f0cbd4\scratchpad\traces-osfp-deliver\` (module-overview.png,
module-label-pulltab-closeup.png, coherent-overview.png, coherent-label-pulltab-closeup.png),
viewed directly.

### Pluggable optics module (800G 2×DR4 OSFP)

| Feature | Ours | Verdict | Fix |
|---|---|---|---|
| Form factor / fins | Closed finned-top, lengthwise fins running nearly the full 10.8 cm length, stopping just short of the labeled nose | **Matches standard** — this is the NVIDIA MMS4X00 pattern almost exactly (fins full-length-minus-label-area, closed finned top) | None needed |
| Shell finish | Bare/brushed silver-grey metal | **Matches standard** | None needed |
| Pull tab | Yellow, open rectangular loop, extends a module-length or so beyond the shell | **Matches standard** — yellow is exactly the Table 3-3 color for 1310nm/500m-class DR parts, and every DR4 part I viewed (NVIDIA, Lumentum, Coherent Corp, Accelink) used this same color and open-loop shape | None needed |
| Label | "OSFP 800G 2xDR4 / 1310nm · 500m" printed directly on the lid, large, on the top face near the pull-tab end | **Matches standard** placement; **acceptable variant** on styling — real labels are white sticker-style rectangles with logo + part number + serial + barcode + laser-safety boilerplate, not a bare printed call-out of the spec string. Ours reads more like a diagram annotation than a product label. | If a closer "real label" look matters for this view, add a white rectangle under the text sized roughly 15×20 mm (per the MSA's own recommended label area, which our coherent model's own annotation already cites) with a smaller part-number/serial line and a one-line laser-class string, rather than only the bold spec string |
| Connectors | Twin-port, 2×DR4 | **Matches standard** — matches NVIDIA MMS4X00/Arista's twin-port DR4 spec, though note most of what I could photo-confirm elsewhere (Coherent Corp, Accelink) were single-port DR8 parts, so this is matching the twin-port half of a real but less-photographed category | None needed |

### Coherent optics module (800ZR OSFP)

| Feature | Ours | Verdict | Fix |
|---|---|---|---|
| Form factor | Closed finned-top, fins running most of the body length | **Acceptable variant** — my one confirmed real 800ZR OSFP (Marvell COLORZ III) is flat-top with no fins at all, which would make a finned top an outlier rather than standard for coherent parts specifically. But the sample size here is one maker, one part, so I can't call finned "off" with confidence — it is at minimum a defensible design choice and matches the general closed-finned-top convention used across OSFP gray optics. | If matching Marvell's real part matters more than internal consistency with our own DR4 model, consider a flat-top variant for the coherent model specifically; otherwise leave as is and note the one-sample caveat |
| Shell | Bare silver metal | **Matches standard** | None needed |
| Pull tab color | White, open bail/U shape | **Matches standard** — white is exactly Table 3-3's code for 1550nm/ZR8-class parts, and it is what Marvell's real COLORZ III part uses | None needed |
| Pull tab shape | Wide open-U/bail, similar overall proportions to Marvell's hook-shaped tab | **Matches standard** — close enough to the one real sample I have (Marvell's is a bit more hook-like with a secondary latch nub, ours is a cleaner U) | None needed, minor stylistic difference only |
| Label | "OSFP 800ZR / C-BAND DWDM / DESIGN STUDY · REPRESENTATIVE" printed large on the lid | **Matches standard** placement (top face, at the fiber end); same "acceptable variant" note as the DR4 module — a real label would be a smaller white sticker with logo/part-number/serial/laser-class text rather than the large call-out string, though our model already flags itself as representative/design-study, which real parts obviously don't do | Same optional fix as above: shrink to a sticker-style label with a logo + part number row if a closer physical match is wanted |
| Connectors | Single fiber pair (coherent, one wavelength) | **Matches standard** — ZR/ZR+ coherent OSFPs are single-port by nature (duplex LC typically, consistent with "ONE FIBER PAIR" callout in our model) | None needed |

Overall: both of our models land solidly inside the real design space on fins, shell finish,
pull-tab color and shape, and label placement — the pull-tab color code in particular is not a
guess, it is the literal OSFP MSA Table 3-3 color for each product's reach class, which is a
good sign this was done carefully rather than picked arbitrarily. The one soft spot on both
models is that the "label" is currently a diagrammatic spec call-out rather than a sticker-style
product label; that is a reasonable storytelling choice for an explainer (it is more legible at
a glance than a dense real label would be) but is worth being deliberate about if the goal is
photographic realism rather than clarity-first diagramming.

## Sources

Spec:
- OSFP Module Specification Rev 5.1 (Sept 12, 2024), §3.8 / Table 3-3 — https://www.osfpmsa.org/assets/pdf/OSFP_Module_Specification_Rev5_1.pdf (fetched as PDF, read via pdftotext)

NVIDIA:
- https://docs.nvidia.com/networking/display/mms4x00-nm16-nvidia-ethernet-800gbps-osfp-twin-port-finned-transceiver-osfp-1xmpo16-1310nm-smf-up-to-500m.pdf
- https://networking-docs.nvidia.com/mms4x00nm800g500m — mechanical image viewed: https://networking-docs.nvidia.com/mms4x00nm800g500m/__attachments/a_1115a8b1bd001510d10c40de738a000304ef958abb6d7120e540da5de056aa10/image-2024-4-24_12-21-0.png
- ServeTheHome, "OSFP Finned and Flat Top: The 400G and 800G Experience" — https://www.servethehome.com/osfp-finned-and-flat-top-the-400g-and-800g-experience/ (image: ConnectX-7 400G OSFP bracket — https://www.servethehome.com/wp-content/uploads/2023/05/NVIDIA-ConnectX-7-400G-OSFP-Angle-2.jpg)
- ServeTheHome, NVIDIA 800G OSFP-to-2×400G splitter DAC — https://www.servethehome.com/this-is-the-massive-nvidia-800g-osfp-to-2x-400g-qsfp112-passive-splitter-dac-cable/ (image: https://www.servethehome.com/wp-content/uploads/2025/09/NVIDIA-800G-OSFP-to-2x-400G-QSFP112-Passive-Splitter-Cable-980-9I80Q-00N02A-3-800x450.jpg)

Marvell:
- ServeTheHome, "Going 800Gbps at up to 1000km with the Marvell COLORZ 800" — https://www.servethehome.com/going-800gbps-at-up-to-1000km-with-the-marvell-colorz-iii-800g-zr-osfp/ (image viewed: https://www.servethehome.com/wp-content/uploads/2025/02/Marvell-COLORZ-III-Module-in-Lab-2-800x533.jpg)
- ServeTheHome, Marvell Teralynx 10 400G OSFP LR4 optic — https://www.servethehome.com/mikrotik-crs520-4xs-16xq-rm-review-mikrotik-scales-up-100gbe-marvell-annapurna-arm/ [image source page was the Teralynx coverage; images: https://www.servethehome.com/wp-content/uploads/2024/07/Marvell-Teralynx-10-400G-OSFP-LR4-Optic-3-800x534.jpg, https://www.servethehome.com/wp-content/uploads/2024/07/Marvell-Teralynx-10-400G-OSFP-LR4-Optic-4-Heatsink-800x492.jpg]

Lumentum:
- https://www.lumentum.com/en/products/800g-2dr4-osfp-transceiver-module (image: https://media.lumentum.com/sites/default/files/2025-11/2.1.1.2.3.800G2XDR4OSFPTransceivers.png)

Coherent Corp (II-VI/Finisar):
- https://www.coherent.com/networking/transceivers/datacom/FTCE4517E1PXA (image: https://www.coherent.com/content/dam/coherent/site/en/products/networking/optical-transceivers/osfp/ftce4517e1pxm.jpg)

Accelink:
- https://www.accelink.com/en/lighting_your_dreams/1745716334399913986.html (images: https://www.accelink.com/en/upload/1/cms/content/20240112/1705046173773.png, https://www.accelink.com/en/upload/1/cms/content/20240112/1705046178368.png)
- https://www.ecocexhibition.com/exhibitor-news/accelink-announces-its-osfp-800zr-has-entered-ga-stage-in-25q3/ (text only, 800ZR coherent OSFP announcement, no image fetched)

Innolight:
- https://www.innolight.com/en/goods/solution/cid/18.html (images: https://www.innolight.com/uploads/goods15/1710826317676253.png, .../1710826409181528.png, .../1710826484990948.png, .../1710826606241619.png, .../1710826956962703.png, .../1710827146878305.png, .../1710827254544086.png, .../1710827345159460.png)

Cisco (text only, no photo):
- https://www.cisco.com/c/en/us/products/collateral/interfaces-modules/transceiver-modules/osfp-800g-transceiver-modules-ds.html

Eoptolink (text only, no photo):
- https://www.directindustry.com/prod/eoptolink-technology-incorporation/product-239451-2407598.html
- https://eoptolink.com/product-solutions/800g/800g-lpo-osfp

Arista (text only, no photo):
- https://www.arista.com/assets/data/pdf/Transceiver-Guide.pdf
- https://www.fs.com/products/251819.html (titled "OSFP Finned Top" — page would not load for image extraction)

Broadcom (text only, no photo of a Broadcom-branded module — Broadcom supplies silicon, not retail OSFP modules):
- https://www.broadcom.com/products/ethernet-connectivity/phy-and-poe/optical/bcm87812

FS.com cross-check (titles/snippets only — every direct fetch returned 0 bytes in this session):
- https://www.fs.com/products/229279.html (NVIDIA/Mellanox-compatible MMS4X00-NM, "OSFP Closed Finned Top")
- https://www.fs.com/products/304367.html (Cisco-compatible OSFP-800G-DR8, "OSFP Closed Finned Top")
- https://www.fs.com/products/251819.html (Arista-compatible OSFP-800G-2VSR4, "OSFP Finned Top")

Our models (viewed directly, not web sources):
- C:\Users\reedo\AppData\Local\Temp\claude\c--Users-reedo-projects\1e92a34a-593e-43cc-a7d2-539990f0cbd4\scratchpad\traces-osfp-deliver\module-overview.png
- C:\Users\reedo\AppData\Local\Temp\claude\c--Users-reedo-projects\1e92a34a-593e-43cc-a7d2-539990f0cbd4\scratchpad\traces-osfp-deliver\module-label-pulltab-closeup.png
- C:\Users\reedo\AppData\Local\Temp\claude\c--Users-reedo-projects\1e92a34a-593e-43cc-a7d2-539990f0cbd4\scratchpad\traces-osfp-deliver\coherent-overview.png
- C:\Users\reedo\AppData\Local\Temp\claude\c--Users-reedo-projects\1e92a34a-593e-43cc-a7d2-539990f0cbd4\scratchpad\traces-osfp-deliver\coherent-label-pulltab-closeup.png
