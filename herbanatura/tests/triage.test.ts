import { describe, expect, it } from 'vitest';
import { triage } from '@/lib/safety/triage';

describe('safety triage', () => {
  it.each([
    ['Tengo un dolor intenso de pecho', 'chest_pain'],
    ['no puedo respirar bien', 'breathing'],
    ['mi abuela se desmayó', 'consciousness'],
    ['está teniendo una convulsión', 'seizure'],
    ['tengo un sangrado abundante', 'bleeding'],
    ['se me cierra la garganta después de tomar un té', 'anaphylaxis'],
    ['de repente no puedo hablar y tengo la cara caída', 'stroke'],
    ['comí un hongo del campo y vomito', 'poisoning'],
    ['I have chest pain', 'chest_pain'],
    ['quiero morir', 'self_harm'],
  ])('%s → %s', (text, kind) => {
    const t = triage(text);
    expect(t.emergency).toContain(kind);
    expect(t.withholdRemedies).toBe(true);
  });

  it('detects intent to treat cancer naturally and to stop treatment', () => {
    expect(triage('Quiero tratar mi cáncer con plantas').cancerTreatmentIntent).toBe(true);
    expect(triage('¿Puedo dejar la quimio y tomar cúrcuma?').stopTreatmentIntent).toBe(true);
    expect(triage('natural cure for cancer').cancerTreatmentIntent).toBe(true);
  });

  it('does not flag ordinary questions', () => {
    const t = triage('¿Qué compuestos tiene el brócoli?');
    expect(t.emergency).toHaveLength(0);
    expect(t.cancerTreatmentIntent).toBe(false);
  });
});
