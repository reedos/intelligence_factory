# CPO landscape, status as of 10/01/2026

Who ships co-packaged optics (CPO), where it sits in a data center, and where it is heading, plus the
driver/TIA partition question for the CPO level's electronic-chip card. Everything below marked
**opened** was read in full in this pass (Playwright with real Chrome, desktop user agent, unless
noted); quotes are exact. Anything **not opened** is listed at the end and is not cited on the site.

Accessed 10/01/2026 for every source below.

## Summary

- **Shipping CPO today is switches.** NVIDIA (Spectrum-X Ethernet Photonics, Quantum-X InfiniBand
  Photonics) and Broadcom (TH5-Bailly 51.2T, TH6-Davisson 102.4T) put optical engines around a switch
  chip in a standalone network switch: the scale-out pattern the data hall draws as its one CPO switch.
- NVIDIA says Spectrum-X Ethernet Photonics is "now in production" (05/31/2026); TrendForce reports it
  shipping "to select partners" and Bailly in "limited shipments" (07/27/2026). Quantum-X Photonics
  Q3450-LD reached Lambda as engineering samples (06/01/2026).
- Broadcom announced TH6-Davisson on 10/08/2025 as "now shipping" while also "currently sampling ... to
  its early access customers". Meta's lab test of Bailly: one million flap-free 400G port-device hours
  (Broadcom, 10/01/2025, citing an ECOC 2025 talk).
- **Scale-up CPO (optics on the GPU/XPU package) is concepts, reference designs and early products:**
  Marvell's CPO compute-tray concept and reference CPO switch (11/03/2025), Ayar Labs TeraPHY reference
  designs with Alchip and GUC, Lightmatter Passage L200 (announced for 2026), Celestial AI (bought by
  Marvell 02/02/2026), Nubis (bought by Ciena 10/07/2025). The OCI MSA (03/12/2026; AMD, Broadcom,
  Meta, Microsoft, NVIDIA, OpenAI) is writing an open optical scale-up specification.
- **Not CPO:** Google's Apollo optical circuit switches steer light between ordinary transceivers with
  MEMS mirrors; they are not optics on a chip package. Cisco's 02/10/2026 G300 launch ships pluggable
  1.6T OSFP and LPO, no CPO product.
- **Driver/TIA partition:** no source opened says what is inside NVIDIA's or Broadcom's electronic die.
  Designs differ: Marvell's 2021 light engine flip-chips a *separate* driver chip and TIA chip onto the
  photonics chip; Ranovus Odin and Ayar Labs TeraPHY put electronics and photonics on one monolithic
  die. So "driver and TIA on one EIC" stays **Assumed** for the drawn NVIDIA-style engine.
- **Correction to the earlier scratch note (cpo-eic-partition.md):** the sentence "The driver and
  transimpedance amplifier are electrical circuitry contained in the 'EIC' ... N7" is NOT in Broadcom's
  TH6-Davisson release (checked against the full release text via the Investing News Network copy, and
  by the lead against Broadcom's own PDF). It came from search-engine summaries and is not cited. The
  same note misread Marvell's 2021 blog: driver and TIA there are two chips, not one die.

## Switches shipping (scale-out)

### NVIDIA

1. **NVIDIA Vera Rubin Ramps Into Full Production to Power Agentic AI Factories Worldwide** — NVIDIA
   press release, 05/31/2026,
   https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Vera-Rubin-Ramps-Into-Full-Production-to-Power-Agentic-AI-Factories-Worldwide/default.aspx
   — primary, marketing. Opened.
   - "Vera Rubin introduces NVIDIA Spectrum-X Ethernet Photonics — now in production — combining co-packaged optics with Spectrum-X switching to enable million-GPU AI factories."
   - "the Vera Rubin platform introduces NVIDIA Spectrum-X™ Ethernet Photonics, the world’s first co-packaged-optics (CPO)-based switches with 200Gb/s SerDes — now in production."
   - "with CoreWeave, Lambda and Oracle Cloud Infrastructure among the first ecosystem partners and adopters."
2. **Silicon Photonics Networking for Agentic AI** — NVIDIA product page, undated,
   https://www.nvidia.com/en-us/networking/products/silicon-photonics/ — primary, marketing. Opened.
   - "The NVIDIA Quantum-X800 InfiniBand platform includes CPO-based switches, including the Q3450-LD with 144 ports of 800 gigabits-per-second (Gb/s) InfiniBand."
   - Spectrum-X: "With up to 409.6 terabits-per-second (Tb/s) bandwidth ... Available in the second half of 2026"
   - "Design simplicity and power efficiency drives CoreWeave, Lambda, Meta, Microsoft, and Oracle Cloud Infrastructure as first adopters."
3. **NVIDIA and Broadcom Begin Volume Ramp of CPO Switches ...** — TrendForce press center, 07/27/2026,
   https://www.trendforce.com/presscenter/news/20260727-13151.html — secondary (analyst). Opened.
   - "NVIDIA has begun shipping its next-generation Spectrum-X CPO switch to select partners. Meanwhile, Broadcom is continuing limited shipments of its 51.2T Bailly CPO switch, marking the official transition of co-packaged optics (CPO) into the mass production phase."
   - "Broadcom's 51.2T Bailly CPO switch has entered volume manufacturing with support from Delta Electronics and Micas Networks. Compared with conventional pluggable optical transceivers, the solution reduces power consumption by up to 70% and has already completed deployment validation with hyperscale operators such as Meta."
   - "Others, like Google, are moving to develop optical components in-house"
4. **NVIDIA Spectrum-X Ethernet Photonics Enters Full Production ...** — StorageReview, 08/15/2026
   (already in sources.js as `storagereview-nvidia-cpo-production`) — secondary. Re-opened.
   - "NVIDIA has moved Spectrum-X Ethernet Photonics, its co-packaged optics (CPO) Ethernet switch platform, into full production."
   - "Cloud providers, including CoreWeave, Lambda, Oracle Cloud Infrastructure, Microsoft Azure, IBM Cloud, and Nebius, are among the early adopters integrating the CPO fabric."
5. **Unbox one of NVIDIA's first co-packaged optics samples with Lambda** — Lambda, 06/01/2026
   (already `lambda-q3450-unboxing`) — secondary, marketing. Re-opened.
   - "Lambda is taking an early look at co-packaged optics, starting with the NVIDIA Quantum-X InfiniBand Photonics Q3450-LD switch."
   - "Engineering samples are a chance to work through rack design, cooling, power delivery, fiber routing, and the installation process with the vendor while the product is still becoming real."

### Broadcom

6. **Broadcom Announces Tomahawk 6 – Davisson, the Industry's First 102.4-Tbps Ethernet Switch with
   Co-Packaged Optics** — Broadcom press release, 10/08/2025,
   https://investors.broadcom.com/news-releases/news-release-details/broadcom-announces-tomahawkr-6-davisson-industrys-first-1024
   — primary, marketing. Broadcom's own pages render header-only to automation; text read in full from
   the Investing News Network syndicated copy
   (https://investingnews.com/broadcom-announces-tomahawk-r-6-davisson-the-industry-s-first-102-4-tbps-ethernet-switch-with-co-packaged-optics/)
   and checked by the lead against the PDF Reed downloaded.
   - "now shipping Tomahawk® 6 Davisson (TH6-Davisson), the company's third-generation Co-Packaged Optics (CPO) Ethernet switch"
   - "16 x 6.4 Tbps Davisson DR Optical Engines"; "200 Gbps per link bandwidth"; "Field-Replaceable ELSFP Laser Modules"
   - "heterogeneously integrating TSMC Compact Universal Photonic Engine (TSMC COUPE™) technology-based optical engines with advanced substrate-level multi-chip packaging"
   - "doubles the line rate and overall bandwidth of Broadcom's second-generation TH5-Bailly CPO solution"
   - fourth generation "will double per-channel bandwidth to 400 Gbps"
   - "Broadcom is currently sampling the TH6-Davisson BCM78919 device to its early access customers and partners."
   - Supporting quote, Micas Networks: "its most recent CPO engine, Bailly, has undergone millions of hours of testing and demonstrated exceptional reliability."
   - Supporting quotes also from Celestica, Corning, HPE, Nexthop AI, TSMC.
   - Text NOT present: "EIC", "PIC", "driver", "TIA", "transimpedance", "N7".
7. **Broadcom Showcases Industry-Leading Quality and Reliability of Co-Packaged Optics** — Broadcom
   press release, 10/01/2025,
   https://investors.broadcom.com/news-releases/news-release-details/broadcom-showcases-industry-leading-quality-and-reliability-co
   — primary, marketing. Opened (this investors page did render).
   - "highlighting one million cumulative 400G equivalent port device hours of flap-free CPO operation at Meta"
   - "Compared to pluggable module solutions, the data highlights that CPO reduces optics power by 65 percent and also demonstrates higher link reliability."
   - "The absence of link flaps in Meta’s high-temperature lab characterization environment"
   - Footnote: ECOC 2025, "Co-Packaged Optics Technology Evaluation for Hyperscale Data Center Fabric Switches" by Siamak Amiralizadeh, 09/30/2025 (the ECOC talk itself not opened).
8. Micas Networks 51.2T CPO release — already `micasnetworks-51-2t-release`; not re-opened this pass.
9. ServeTheHome TH6-Davisson — already `broadcom-davisson-servethehome`; re-opened:
   "The new TH6-Davisson switch is a 102.4Tbps part that has sixteen of Broadcom’s 6.4Tbps Davisson DR optical engines."
10. StorageReview TH6-Davisson (10/2025),
    https://www.storagereview.com/news/broadcom-ships-tomahawk-6-davisson-cpo-ethernet-switch-doubling-bandwidth-to-102-4-tb-s-for-ai-fabrics
    — secondary. Opened: "Broadcom is currently sampling the TH6-Davisson BCM78919 to early access customers and partners, with general availability to follow." Not cited on the site (the release says it).

### Cisco

11. **Cisco Announces New Silicon One G300 ...** — Cisco newsroom, 02/10/2026,
    https://newsroom.cisco.com/c/r/newsroom/en/us/a/y2026/m02/cisco-announces-new-silicon-one-g300.html
    — primary, marketing. Opened. The optics it launches are "1.6T OSFP (Octal Small Form-factor
    Pluggable) Optics" and "800G Linear Pluggable Optics (LPO)"; no co-packaged optics product.
12. **Co-Packaged Optics and an Open Ecosystem** — Cisco blog, Rakesh Chopra, 01/11/2021,
    https://blogs.cisco.com/sp/co-packaged-optics-and-an-open-ecosystem — primary. Opened.
    "I believe that the 51.2 Tbps switch silicon generation is the correct time to introduce CPO."
    Cisco CPO status in fall 2026: no shipping Cisco CPO product found. Not put on the site.

## Scale-up direction (optics on the XPU package)

13. **Co-packaged Optics: Powering the Next Wave of AI Data Center Innovation** — Marvell blog, Chris
    McCormick, 11/03/2025,
    https://www.marvell.com/blogs/co-packaged-optics-for-next-wave-ai-data-centers.html — primary,
    marketing. Opened (WebFetch 403s; Chrome works).
    - "The image below shows a conceptualized AI compute tray with CPO developed with products from SENKO Advanced Components and Marvell. The design contains room for four XPUs and up to 102.4 Tbps of bandwidth delivered through 1024 optical fibers, all in a 1U tray. The density and reach enabled by CPO opens the door to scale-up domains far beyond what is possible with copper alone.."
    - Note the same post then says "The actual number is 1,152 fibers." (1,024 data fibers plus laser fibers, as in its switch paragraph); the site quotes 1,024 as the data-fiber figure.
    - "Each XPU is connected to four Marvell 6.4T light engines for opto-electric conversions."
    - "Marvell, SENKO, Jabil, and Mikros Technologies also recently unveiled a reference design of a data center CPO switch."
    - "The ethernet switch ASIC—the large semiconductor in the center of the image—is surrounded by 16 light engine tiles and 1,152 fibers (128 laser fibers and 1,024 data fibers). The light engines are driven by 16 laser modules, which are connected to the faceplate for better serviceability."
    - "Cold-plate liquid cooling from Mikros Technologies features a low-profile design that maintains a system height of 1OU"; "In contrast, conventional air cooling would require a chassis that is two to three times thicker."
    - "While analyst firms such as LightCounting predict that optical modules will continue to constitute the majority of optical links inside data centers through the decade,1 CPO will likely become a meaningful segment."
14. **Optical Scale-up Consortium Established to Create an Open Specification for AI Infrastructure Led
    by Founding Members AMD, Broadcom, Meta, Microsoft, NVIDIA and OpenAI** — Broadcom news release,
    03/12/2026,
    https://www.broadcom.com/company/news/product-releases/optical-scale-up-consortium-established-to-create-an-open-specification-for-ai-infrastructure
    — primary. Opened.
    - "The Optical Compute Interconnect (OCI) Multi-Source Agreement (MSA) group today announced its formation, led by founding members AMD, Broadcom, Meta, Microsoft, NVIDIA and OpenAI."
    - "OCI will enable migration from copper-based to optical-based scale-up architectures, alleviating copper interconnect bottlenecks."
    - "Interoperable Form Factors: Support for pluggable, on-board, and co-packaged optics (CPO)."
    - Microsoft (Saurabh Dighe): "Scale up focused optical technologies, protocols, and switch architectures are foundational to building scalable, multi rack, high performance AI compute domains."
    - Meta (Dan Rabinovitsj): "We encourage adoption of this OCI protocol to decouple the need for larger scale-up domains from the limitations of electrical backplanes in high performance AI clusters."
15. **GUC and Ayar Labs Partner to Advance Co-Packaged Optics for Hyperscalers** — Ayar Labs, 11/16/2025,
    https://ayarlabs.com/news/guc-and-ayar-labs-partner-to-advance-co-packaged-optics-for-hyperscalers/
    — primary, marketing. Opened.
    - "The new XPU multi-chip package (MCP) design replaces traditional electrical interconnects with Ayar Labs’ optical engines attached directly to the MCP organic substrate. This architecture enables more than 100 Tbps full-duplex optical interface from the XPU package, more than an order of magnitude improvement over current XPUs."
16. **Ayar Labs and Alchip to Scale AI Infrastructure with Co-Packaged Optics** — Ayar Labs, 09/07/2025,
    https://ayarlabs.com/news/ayar-labs-and-alchip-to-scale-ai-infrastructure-with-co-packaged-optics/
    — primary, marketing. Opened. "implementing Ayar Labs’ optical I/O technology into Alchip’s high-performance ASICs"
17. **Ayar Labs raises $500M to mass-produce CPO chiplets** — The Register, 03/03/2026,
    https://www.theregister.com/2026/03/03/ayar_labs_500m/ — secondary. Opened.
    - "One of these reference designs was developed in collaboration with Alchip and uses eight of Ayar's next-gen TeraPHY chiplets. Combined, the company claims it can support more than 200 Tbps of aggregate bandwidth per package."
    - "In February, IP giant Marvell Technology completed its roughly $3.25 billion acquisition of Celestial AI."
18. **Ayar Labs Demonstrates Optical Interconnect on GLOBALFOUNDRIES’ Photonics Manufacturing Process**
    — Ayar Labs release via HPCwire, 12/02/2020,
    https://www.hpcwire.com/off-the-wire/ayar-labs-demonstrates-optical-interconnect-on-globalfoundries-photonics-manufacturing-process/
    — primary text (company release) on a secondary host. Opened.
    - "Ayar Labs has successfully demonstrated its patented monolithic electronic/photonic solution on GLOBALFOUNDRIES (GF) next generation photonics solution based on its 45nm platform."
19. **Lightmatter Announces Passage L200, the Fastest Co-Packaged Optics for AI** — Lightmatter,
    03/31/2025,
    https://lightmatter.co/press-release/lightmatter-announces-passage-l200-the-fastest-co-packaged-optics-for-ai/
    — primary, marketing. Opened.
    - "The L200 3D CPO family includes both 32 Tbps and 64 Tbps versions, representing a 5 to 10x improvement over existing solutions."
    - "Alphawave Semi’s advanced-node electrical integrated circuit (EIC) is 3D integrated on the Passage PIC using standard chip-on-wafer (CoW) techniques."
    - "Available in 2026, Lightmatter’s L200 and L200X 3D CPO chips are designed to accelerate time to market and performance of next generation XPUs and switches"
    - Shipping status in fall 2026 not found.
20. **Marvell Completes Acquisition of Celestial AI** — Marvell press release, 02/02/2026, SEC exhibit
    https://www.sec.gov/Archives/edgar/data/1835632/000119312526032861/d45933dex991.htm — primary. Opened.
    - "today announced that it has completed its previously announced acquisition of Celestial AI, a pioneer in optical interconnect technology for scale-up connectivity."
    - "Marvell expects initial revenue contributions from Celestial AI to begin in the second half of fiscal 2028"
21. **Ciena to acquire Nubis** — Ciena press release, 09/22/2025, SEC exhibit
    https://www.sec.gov/Archives/edgar/data/936395/000162828025042266/a250922pressrelease.htm — primary. Opened.
    - "Co-Packaged Optics (CPO) / Near Packaged Optics (NPO): Nubis’ compact, high-density optical modules ... Supporting up to 6.4 Tb/s full-duplex bandwidth"
    - Completion on 10/07/2025 seen only in search results (not opened). Not put on the site.

## Not CPO: Google OCS

22. **The evolution of Google’s Jupiter data center network** — Google Cloud blog,
    https://cloud.google.com/blog/topics/systems/the-evolution-of-googles-jupiter-data-center-network
    — primary. Opened (date not captured in page text; published 08/2022 per the SIGCOMM paper it
    accompanies, not verified here).
    - "An optical circuit switch (depicted below) maps an optical fiber input port to an output port dynamically"
    - "The light is generated through electro-optical conversion at WDM transceivers already required to transmit data reliably and efficiently across data center buildings."
    OCS steers light between transceivers; it does not move optics onto a chip package. Not CPO.

## Driver/TIA partition (for the `cpo-circuit-partition` assumption)

23. **Highly Integrated Silicon Photonics Light Engines in High-Speed Data Transport** — Marvell blog,
    Radha Nagarajan, 08/16/2021,
    https://www.marvell.com/blogs/highly-integrated-silicon-photonics-light-engines-in-high-speed-data-transport.html
    — primary. Opened.
    - "a light engine consisting of a silicon photonics substrate with the optical components, 2.5D heterogeneously integrated with InP DFB lasers, and modulator driver and transimpedance amplifier (TIA) made using SiGe technology."
    - "Here the TIA, driver and the DFB (shown in the red dashed box) are separate from the silicon photonics chip, and wire bonded to it. This is the basic architecture of the Marvell COLORZ® module."
    - "The TIA and driver were placed, using a high-accuracy flip chip bonder, on the re-designed silicon photonics chip"
    - Reading: the driver and the TIA are two separate SiGe chips here. This contradicts the earlier
      scratch note's "driver+TIA together on one SiGe die".
24. **Ranovus Collaborates with Jabil for Mass Production of ODIN® Optical Engine** — Ranovus, 03/31/2025,
    https://ranovus.com/ranovus-collaborates-with-jabil/ — primary, marketing. Opened.
    - "Featuring monolithic integration of silicon photonics, RF drivers, transimpedance amplifiers (TIA), and control logic"
    - "integrates all key analog components of an optical engine—lasers, modulators, photodetectors, drivers, transimpedance amplifiers, and control loops—into a compact monolithic Electro-Photonic Integrated Circuit (EPIC)."
25. TSMC research page, **Heterogeneous Integration of a Compact Universal Photonic Engine for Silicon
    Photonics Applications in HPC**, https://research.tsmc.com/page/on-chip-interconnect/14.html —
    primary. Opened (renders in Chrome; WebFetch 403s). Abstract only: "COUPE has the EIC-PIC
    integration with the electrical interface designed to minimize the EIC-PIC coupling loss." It does
    not name the EIC's circuits. Not added to the site (the existing TSMC symposium PDF already carries
    the stack claim).
26. Ayar Labs monolithic: item 18.
27. Daudlin et al., OFC 2021 (already cited): research prototype with drivers/TIAs on an EIC bonded to a PIC.

Conclusion for the site: keep "driver and TIA on one electronic die" as **Assumed** for the drawn
NVIDIA-style engine. NVIDIA and TSMC document one electronic die stacked on one photonic die per
engine; neither, nor Broadcom's TH6 release, says which circuits that die holds. Published designs
differ: separate driver and TIA chips (Marvell 2021), driver and TIA functions on one bonded EIC
(Daudlin 2021), everything on one monolithic die (Ranovus Odin, Ayar Labs TeraPHY).

## Not opened (not cited)

- Broadcom's own newsroom page 63626 and news.broadcom.com: header only in Chrome. Release text via
  the syndicated copy (item 6).
- ECOC 2025 Amiralizadeh talk (Meta's Bailly evaluation): only as Broadcom's footnote.
- IDTechEx "Packaging Technologies Behind NVIDIA's 3D-Stacked CPO", Broadcom Hot Chips 2024 PDF, PIC
  Magazine Bailly coverage: not opened this pass; the "all-CMOS EIC ... very low power TIA" Bailly
  wording remains unverified and is not cited.
- Intel OCI chiplet: not researched further this pass; not on the site.
- Ciena's completion of the Nubis deal (10/07/2025): search results only.
- NVIDIA's earlier "Quantum-X Photonics commercially available early 2026" statements: search results only.
- Lightmatter L200 shipping status in 2026: not found.
