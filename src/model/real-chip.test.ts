import { describe, it, expect } from 'vitest';
import { compute } from './engine';
import { SITES } from './sites';
import { content } from '../data.js';

describe('a campus running chips the model cannot draw', () => {
  it('Project Rainier says so on the rack, tray and chip levels, and only there', () => {
    const s = SITES.rainier;
    const C = content(compute({ ...s.scenario, site: 'rainier' })) as any;
    for (const S of C.SCENES) {
      const says = String(S.intro).includes('Trainium2');
      expect(says, S.id).toBe(['rack', 'tray', 'chip'].includes(S.id));
    }
  });
  it('a campus that runs what it draws gets no such line', () => {
    const C = content(compute({ ...SITES.abilene.scenario, site: 'abilene' })) as any;
    expect(C.SCENES.some((S: any) => String(S.intro).startsWith('Drawn: the closest'))).toBe(false);
  });
});
