# Generation hardware research — 9/29/26

Read-only public-source review. Requirements sent to rack/tray and model owners.

- H100 DGX: 8U, eight GPUs, two Xeon CPUs, four NVSwitch ASICs, air cooling; eight compute CX7 interfaces through four twin-port OSFP cages plus two dual-port CX7 storage cards. https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html
- GB200/GB300: eighteen four-GPU/two-Grace compute trays, nine two-ASIC NVLink switch trays; liquid-cooled compute with fan-cooled peripherals. https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html
- GB300 explicitly has seventy-two CX8 and eighteen BF3 per rack: four NICs and one DPU/tray. This resolves the generic hardware guide's stale two-DPU table against its generation-specific drawings. https://www.nvidia.com/en-us/data-center/dgx-gb300/
- Rubin: eighteen compute trays and nine switch trays; eight CX9 and one BF4 per compute tray, PCB midplane and modular front/rear bays. Compute and switch trays are fanless, hose-free and cable-free internally; rack copper spine remains. Four NVLink switch ASICs/tray. https://developer.nvidia.com/blog/?p=113993
- Rubin illustrated compute layout, internal manifolds/quick disconnects, memory and functional blocks: https://developer.nvidia.com/blog/?p=111036
- Current NVLink table: Hopper/Blackwell/Rubin maximum eighteen/eighteen/thirty-six links per GPU. Rubin now lists 3 TB/s/GPU and 216 TB/s/rack; old blogs and linked PDF still list 3.6/260. Prefer current product table with explicit source-date qualification. Logical links do not prove physical conductor counts or pin mapping. https://www.nvidia.com/en-us/data-center/nvlink/
- GB200 product: 372 GB HBM3E per two-GPU superchip, 13.4 TB/rack. https://www.nvidia.com/en-us/data-center/gb200-nvl72/
- MIG table: GB200 186 GB/GPU, GB300 279 GB/GPU, different from HGX B200/B300 180/270 GB. Do not mix nominal physical memory with software/MIG capacities. https://www.nvidia.com/en-us/technologies/multi-instance-gpu/
- Rubin: 288 GB HBM4/GPU; up to 1.5 TB LPDDR5X/Vera CPU. https://www.nvidia.com/en-us/data-center/vera-rubin-nvl72/
- Rubin CPX is a different GDDR7 context processor; do not use it as an NVL72 teardown. https://nvidianews.nvidia.com/news/nvidia-unveils-rubin-cpx-a-new-class-of-gpu-designed-for-massive-context-inference
- Rubin Ultra/Kyber are separate roadmap configurations; March architecture article distinguishes these from ordinary Rubin NVL72. https://developer.nvidia.com/blog/?p=113993

Geometry decisions: H100 and Rubin require distinct models. GB200/GB300 may share outer family resemblance but must show their generation-specific networking and qualified memory. No exact internal PCB placement inferred from performance figures.

## Compute tray: NIC to front optical cages (09/30/2026)

- SemiAnalysis, "GB200 Hardware Architecture and Component Supply Chain & BOM" (07/17/2024), https://newsletter.semianalysis.com/p/gb200-hardware-architecture-and-component
  - "the ConnectX-7/8 ICs now sit directly on top of the Bianca board using a mezzanine board via Mirror Mezz connectors."
  - "The electrical lanes are routed to the OSFP cages at the front of the chassis with DensiLink connectors from the mezzanine board."
  - "This is similar to how Nvidia used DensiLink on their gold plated DGX H100 chassis to route from the ConnectX-7 to the OSFP cages."
- Lenovo Press, "Lenovo NVIDIA GB300 NVL72 Rack Scale AI Product Guide" (LP2357), https://lenovopress.lenovo.com/lp2357.pdf
  - "One PCIe Gen5 x16 Slot (BlueField-3 DPU) Two PCIe Gen5 x16 Slot (OSFP Boards)"
  - "Two Gen 5 x16 connections (32 lanes total) provide the bandwidth needed for an 800 GbE connection using the ConnectX-8 8180 network adapter (2x 2port ConnectX-8 adapters)."
  - Up to 8 E1.S bays per compute tray, 4 populated in the reference architecture; parts list includes "GB300 PCIe Riser Cable".
- Drawn as representative (assumption `tray-nic-cage-cabling`): the cable path, one flat twinax assembly per port, connector heads, clips, standoffs, and the GB200 / H100 cage boards.
