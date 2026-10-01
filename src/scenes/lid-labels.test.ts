import { describe, expect, it } from 'vitest';
import { ACCELERATORS } from '../model/engine';
import { switchLabel, nicLabel, labelLines, moduleLabel, moduleTier, COHERENT_LABEL, COPPER_LABELS } from './lid-labels.js';
import { GPU_NAME, CPU_NAME } from './package-marks.js';

// The printed lid labels follow the scenario's hardware tier (H100/GB200 400G per GPU, GB300 800G, Vera Rubin 1.6T).
describe('lid labels', () => {
  const table = {
    h100: { switch: 'OSFP 800G 2xDR4', nic: 'OSFP 800G 2xDR4' },
    gb200: { switch: 'OSFP 800G 2xDR4', nic: 'OSFP 400G DR4' },
    gb300: { switch: 'OSFP 1.6T 2xDR4', nic: 'OSFP 800G DR4' },
    rubin: { switch: 'OSFP 1.6T', nic: 'OSFP 1.6T' },
  };
  it('match the table for every accelerator', () => {
    expect(Object.keys(table).sort()).toEqual(Object.keys(ACCELERATORS).sort());
    for (const [id, want] of Object.entries(table)) {
      const accel = (ACCELERATORS as any)[id];
      expect(switchLabel(accel), `${id} switch`).toBe(want.switch);
      expect(nicLabel(accel), `${id} nic`).toBe(want.nic);
      expect(nicLabel(id), `${id} nic by id`).toBe(want.nic);
    }
  });
  it('name the side levels', () => {
    // the module level opens the switch-side module, so it prints the hall's switch label (plus LPO in its LPO view)
    const tiers = { h100: ['800g', '100G', '400G'], gb200: ['800g', '100G', '400G'], gb300: ['1.6t', '200G', '800G'], rubin: ['rubin', '200G', '800G'] };
    for (const [id, [key, lane, port]] of Object.entries(tiers)) {
      const accel = (ACCELERATORS as any)[id];
      expect(moduleLabel(accel), id).toBe(switchLabel(accel));
      expect(moduleLabel(accel, true), id).toBe(`${switchLabel(accel)} LPO`);
      expect(moduleTier(accel), id).toMatchObject({ key, lane, port, label: switchLabel(accel) });
    }
    expect(moduleTier(ACCELERATORS.rubin as any).published).toBe(false);
    expect(moduleTier(ACCELERATORS.gb200 as any).part).toBe('MMS4X00');
    expect(moduleTier(ACCELERATORS.gb300 as any).part).toBe('MMS4A00');
    expect(COHERENT_LABEL).toBe('800ZR');
    expect(COPPER_LABELS).toEqual({ dac: 'DAC', acc: 'ACC', aec: 'AEC' });
  });
  it('print the form factor on its own line', () => {
    expect(labelLines('OSFP 800G 2xDR4')).toEqual(['OSFP', '800G 2xDR4']);
    expect(labelLines('800ZR')).toEqual(['800ZR']);
  });
  it('mark each GPU and CPU package with its device name', () => {
    expect(GPU_NAME).toEqual({ h100: 'H100', gb200: 'B200', gb300: 'B300', rubin: 'Rubin' });
    expect(CPU_NAME.rubin).toBe('VERA'); expect(CPU_NAME.gb300).toBe('GRACE');
  });
});
