# IF-2 claim audit — 10/07/2026

Status: **partial; blocked from full primary-source recertification**. Do not treat this branch as a certificate that every visible claim is correct.

## Inventory and scope

`astra-if2/claim-inventory.json` records each observed claim variant, its key, displayed text, evidence and audit status. The generator covers 104 base scenarios, both module sides, evidence-chip rows, part prose, scene introductions, staircases, bandwidth rows, guided narratives, Method sections, calculation/assumption registries, and static paragraphs/headings/list items on the story, Evidence and Method pages. The Evidence page reuses the same claim registry. This is a finite scenario inventory, not an exhaustive enumeration of every continuously adjustable input or site stage.

Regenerate with:

```
node --import ./tools/astra-if2-resolve.mjs tools/astra-if2-inventory.mjs
python -X utf8 tools/astra-if2-status.py
```

The status script applies only the explicitly reviewed calculation families and assumption disclosures. It does not infer truth from HTTP success, matching quotes or metadata. `confirmed` means the stated model arithmetic was checked; it does not validate an assumed engineering input. `footnoted` means the UI explicitly identifies an assumption. Unreviewed entries remain `needs Reed`, including accessible sources not yet semantically recertified. The broad audit remains unfinished.

## Findings fixed

| Claim | Finding and change | Verification |
|---|---|---|
| N+1 main transformer bank | MVA was treated as MW. Include the existing 0.95 power-factor assumption before rounding capacity. At 150 MW, three 75 MVA units leave only 142.5 MW after one outage; the corrected bank needs four. | Capacity remaining after one outage, plus minimality checks across eight thresholds. |
| FP8 decode time and compute/memory comparison | An absent FP8 peak fell back to FP4. Require matching arithmetic precision. NVIDIA's current Rubin table now supplies dense FP8/FP6 17.5 PFLOPS and dense NVFP4 35 PFLOPS; use 17.5 for the FP8 example. | Failing-first precision check; unknown peak stays unavailable; FP4 case and matching FP8 case checked separately. |
| Per-circuit transmission current | The displayed current splits demand over two circuits; the Method formula omitted that divisor. | Description now matches the explicitly stated two-circuit model. |
| Diesel volume evidence | The million-liter inventory row opened a truck-count formula. | Point to the fuel-volume calculation; 150 MW for 48 h at 0.26 L/kWh gives 1.872 million L. |
| Grace CPU memory | A CPU row opened a GPU HBM formula dividing by 72. | Separate CPU-memory calculation: rounded 17 TB divided by 36 CPUs, shown as approximately 470 GB. This quotient is not a correction to the hardware's nominal 480 GB description elsewhere. |
| H100 package current prose | A fixed 'over a thousand amps' sentence also appeared for H100, whose modeled core current rounds to 800 A. | Use scenario-derived core current and distinguish the compute dies from package HBM. |
| HBM power-share row | A fixed 8–15% label disagreed with Rubin's assumed 16%. | Display the actual per-accelerator assumption; test displayed percentage against the model. |
| Cross-hall fibers | Method said GPU count where the implementation uses physical endpoints, including two per Rubin GPU. | Formula explanation corrected; inverse count/strand check includes both NICs. |
| Method overview | Said sites never affect hardware, and GPU silicon is simply the ledger remainder. Both had become false. | Describe reported fleets and plant overrides, physical GPU-silicon sum, and separate unallocated budget. Update HBM range and stale four-test-file wording. |

## Primary evidence opened

- [NVIDIA Rubin specifications](https://www.nvidia.com/en-us/data-center/vera-rubin-nvl72/): per-GPU table and dense/sparse footnotes support 17.5 PFLOPS FP8, 35 PFLOPS dense FP4, 19.2 TB/s HBM and 3 TB/s NVLink. Rechecked 10/07/2026.
- [Meta Llama 3.1 model card](https://github.com/meta-llama/llama-models/blob/main/models/llama3_1/MODEL_CARD.md): model-family sizes include 70B. This is an approximate parameter count, not a byte-perfect checkpoint size.
- [NVIDIA's FP8 model card](https://huggingface.co/nvidia/Llama-3.1-70B-Instruct-FP8): weights and activations of linear operators are quantized. The site's 70 GB traffic model remains a simplified weights-only floor, excluding KV cache and other work.
- [Eaton 9395XR](https://www.eaton.com/us/en-us/catalog/backup-power-ups-surge-it-power-distribution/eaton-9395xr-ups.html): current page says greater than 97% double-conversion efficiency and up to 99% ESS. The model's 96.5% remains an explicit design assumption, not this product's measured value.
- [HPE GB200 QuickSpecs](https://www.hpe.com/us/en/collaterals/collateral.a50009224enw.html) and [Broadcom Davisson release](https://investors.broadcom.com/news-releases/news-release-details/broadcom-announces-tomahawkr-6-davisson-industrys-first-1024) were retrievable via the second reading path after initial timeouts; retrieval alone does not confirm every claim citing them.

## Independent tests and limits

`src/model/claim-audit.test.ts` reconstructs the IT budget by numerical bisection, walks power backward through the rack, checks minimum equipment capacity, reconciles an hour of reply energy/water/carbon with campus totals, checks bandwidth direction and units, propagates heat-display rounding, checks physical network endpoints and modules, and verifies the changed visible quantities. Relative error is used for continuous quantities; integer capacity requirements use inequalities and minimality. Existing engine, fleet, plant, clock, lane-math and media tests remain in place.

These tests do **not** yet constitute an independent per-figure oracle for every calculation registry entry, every site stage or every displayed rounding path. The inventory keeps those unverified claims explicit. The structural claim gate reports 0 metadata problems across 185,214 instances; that is not semantic source validation.

## Needs Reed

Full recertification is blocked by source access: the first sweep retrieved 340 of 385 references with HTTP 200, received 11 HTTP 403 denials, skipped 12 further references on denied hosts, and recorded 22 other transport/status failures. `astra-if2/source-access.json` retains the exact per-reference result. No denied action was retried. Public sources need to be made available through an authorized route before the remaining claims can be certified; this branch does not weaken evidence categories to hide gaps.

The remaining semantic audit and independent test coverage are incomplete. Preserve their unverified status when reviewing or applying these fixes. No navigation or evidence-category change is proposed.

## Verification

Final suite: 64 files / 1,745 tests passed. Typecheck and production build passed. All six HTML pages passed overflow/page-error checks at 360 and 1440 px; screenshots were inspected. The visualizer harness initially selected before scene loading finished; corrected readiness produced three consecutive passing runs. This is disclosed as a timing-sensitive harness, not evidence of a missing Tokens feature. Port 49748 was used.

The required full-tree identifier scan found identifiers already present in four historical research notes. Those values were replaced with neutral placeholders in this branch. The final hostname/IP scan passes; original values were never printed.
