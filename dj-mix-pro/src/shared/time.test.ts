import { describe, expect, it } from 'vitest';
import { formatPercent, formatTime } from './time';

describe('formatTime', () => {
  it('formatea minutos, segundos y décimas', () => {
    expect(formatTime(0)).toBe('0:00.0');
    expect(formatTime(187.46)).toBe('3:07.4');
    expect(formatTime(59.99, false)).toBe('0:59');
  });
  it('tolera valores inválidos', () => {
    expect(formatTime(NaN)).toBe('0:00.0');
    expect(formatTime(-3)).toBe('0:00.0');
  });
});

describe('formatPercent', () => {
  it('muestra signo', () => {
    expect(formatPercent(0.0235)).toBe('+2.35%');
    expect(formatPercent(-0.08)).toBe('−8.00%');
    expect(formatPercent(0)).toBe('±0.00%');
  });
});
