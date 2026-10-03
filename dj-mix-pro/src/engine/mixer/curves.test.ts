import { describe, expect, it } from 'vitest';
import {
  channelFaderToGain,
  crossfaderGains,
  eqKnobToDb,
  filterKnobToFreqs,
  masterKnobToGain,
  trimKnobToDb,
} from './curves';

describe('EQ', () => {
  it('centro = 0 dB, extremos = +6 / -40 dB', () => {
    expect(eqKnobToDb(0.5)).toBe(0);
    expect(eqKnobToDb(1)).toBeCloseTo(6);
    expect(eqKnobToDb(0)).toBeCloseTo(-40);
  });
  it('es monótona', () => {
    let prev = -Infinity;
    for (let v = 0; v <= 1.0001; v += 0.05) {
      const db = eqKnobToDb(v);
      expect(db).toBeGreaterThanOrEqual(prev);
      prev = db;
    }
  });
});

describe('trim', () => {
  it('±12 dB', () => {
    expect(trimKnobToDb(0.5)).toBe(0);
    expect(trimKnobToDb(0)).toBe(-12);
    expect(trimKnobToDb(1)).toBe(12);
  });
});

describe('filtro', () => {
  it('centro sin filtrar', () => {
    expect(filterKnobToFreqs(0)).toEqual({ lowpassHz: 22000, highpassHz: 10 });
    expect(filterKnobToFreqs(0.02)).toEqual({ lowpassHz: 22000, highpassHz: 10 });
  });
  it('izquierda = LPF, derecha = HPF', () => {
    expect(filterKnobToFreqs(-1).lowpassHz).toBeCloseTo(60);
    expect(filterKnobToFreqs(1).highpassHz).toBeCloseTo(8000);
    expect(filterKnobToFreqs(-0.5).highpassHz).toBe(10);
    expect(filterKnobToFreqs(0.5).lowpassHz).toBe(22000);
  });
});

describe('faders', () => {
  it('canal 0..1', () => {
    expect(channelFaderToGain(0)).toBe(0);
    expect(channelFaderToGain(1)).toBe(1);
  });
  it('master: 0 = silencio, 0.8 = 0 dB, 1 = +6 dB', () => {
    expect(masterKnobToGain(0)).toBe(0);
    expect(masterKnobToGain(0.8)).toBeCloseTo(1);
    expect(masterKnobToGain(1)).toBeCloseTo(1.995, 2);
  });
});

describe('crossfader', () => {
  it('smooth: potencia constante', () => {
    for (const x of [-1, -0.5, 0, 0.3, 1]) {
      const [a, b] = crossfaderGains(x, 'smooth');
      expect(a * a + b * b).toBeCloseTo(1);
    }
    expect(crossfaderGains(-1, 'smooth')[1]).toBeCloseTo(0);
    expect(crossfaderGains(1, 'smooth')[0]).toBeCloseTo(0);
  });
  it('sharp: ambos a tope en el centro, corte en extremos', () => {
    expect(crossfaderGains(0, 'sharp')).toEqual([1, 1]);
    expect(crossfaderGains(-1, 'sharp')).toEqual([1, 0]);
    expect(crossfaderGains(1, 'sharp')).toEqual([0, 1]);
  });
});
