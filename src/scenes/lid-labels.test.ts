import { describe, expect, it } from 'vitest';
import { ACCELERATORS } from '../model/engine';
import { switchLabel, nicLabel, labelLines, MODULE_LABEL, COHERENT_LABEL, COPPER_LABELS } from './lid-labels.js';

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
    expect(MODULE_LABEL).toEqual({ dsp: 'OSFP 1.6T 2xDR4', lpo: 'OSFP 1.6T 2xDR4 LPO' });
    expect(COHERENT_LABEL).toBe('800ZR');
    expect(COPPER_LABELS).toEqual({ dac: 'DAC', acc: 'ACC', aec: 'AEC' });
  });
  it('print the form factor on its own line', () => {
    expect(labelLines('OSFP 800G 2xDR4')).toEqual(['OSFP', '800G 2xDR4']);
    expect(labelLines('800ZR')).toEqual(['800ZR']);
  });
});
