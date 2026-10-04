// The Quantum-X Photonics Q3450 switch as a whole, counted once: four switch packages of 18 optical engines, two 800G
// ports (two MPO connectors) per engine, 18 removable external light sources and four UDQ4 liquid connections
// (lambda-q3450-unboxing; nvidia-cpo-industry-collaboration-blog). The hall draws the switch's front panel from these
// (hall.js cpoFace), the CPO level draws one package of enginesPerPackage engines (side-geometry.js engineLayout), and the
// CPO cards in data.js quote them, so the three cannot disagree. cpo-switch.test.ts checks the three against each other.
export const CPO_SWITCH = { packages: 4, enginesPerPackage: 18, portsPerEngine: 2, els: 18, udq4: 4, mpoCols: 18 };
CPO_SWITCH.mpo = CPO_SWITCH.packages * CPO_SWITCH.enginesPerPackage * CPO_SWITCH.portsPerEngine;   // 144
CPO_SWITCH.mpoRows = CPO_SWITCH.mpo / CPO_SWITCH.mpoCols;                                          // 8
