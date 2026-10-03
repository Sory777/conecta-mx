/**
 * Curvas de respuesta del mixer. Funciones puras (testeables) que convierten
 * la posición de un control (0..1 o -1..1) en parámetros de audio.
 */
import { clamp, dbToGain, expInterp } from '../../shared/math';

/** EQ: 0..1 con 0.5 = 0 dB. Arriba hasta +6 dB, abajo hasta -40 dB (≈ kill). */
export const EQ_MAX_BOOST_DB = 6;
export const EQ_MIN_CUT_DB = -40;

export function eqKnobToDb(v: number): number {
  v = clamp(v, 0, 1);
  if (v >= 0.5) return ((v - 0.5) / 0.5) * EQ_MAX_BOOST_DB;
  const t = (0.5 - v) / 0.5; // 0..1
  return EQ_MIN_CUT_DB * Math.pow(t, 1.5);
}

/** GAIN (trim): 0..1 con 0.5 = 0 dB, rango ±12 dB. */
export function trimKnobToDb(v: number): number {
  return (clamp(v, 0, 1) - 0.5) * 24;
}

/**
 * Filtro de un solo knob: -1..1. Centro = sin filtro.
 * Izquierda = pasa-bajos (LPF) que baja hasta 60 Hz.
 * Derecha = pasa-altos (HPF) que sube hasta 8 kHz.
 */
export const FILTER_DEADZONE = 0.03;
export interface FilterSetting {
  lowpassHz: number;
  highpassHz: number;
}

export function filterKnobToFreqs(v: number): FilterSetting {
  v = clamp(v, -1, 1);
  if (Math.abs(v) <= FILTER_DEADZONE) return { lowpassHz: 22000, highpassHz: 10 };
  const t = (Math.abs(v) - FILTER_DEADZONE) / (1 - FILTER_DEADZONE);
  if (v < 0) return { lowpassHz: expInterp(20000, 60, t), highpassHz: 10 };
  return { lowpassHz: 22000, highpassHz: expInterp(20, 8000, t) };
}

/** Fader de canal: curva casi logarítmica (v²·ʳ), 0 = silencio, 1 = 0 dB. */
export function channelFaderToGain(v: number): number {
  v = clamp(v, 0, 1);
  return Math.pow(v, 2.2);
}

/** Volumen master: 0..1 → -inf..+6 dB, con 0.8 ≈ 0 dB. */
export function masterKnobToGain(v: number): number {
  v = clamp(v, 0, 1);
  if (v === 0) return 0;
  const db = v <= 0.8 ? -60 * Math.pow(1 - v / 0.8, 1.6) : ((v - 0.8) / 0.2) * 6;
  return dbToGain(db);
}

export type CrossfaderCurve = 'smooth' | 'sharp';

/**
 * Crossfader -1 (A) .. +1 (B). Devuelve ganancias [A, B].
 *  - smooth: potencia constante (mezclas largas, sin hueco de volumen).
 *  - sharp: corte rápido para scratch; ambos a tope casi en todo el recorrido.
 */
export function crossfaderGains(x: number, curve: CrossfaderCurve): [number, number] {
  x = clamp(x, -1, 1);
  if (curve === 'smooth') {
    const t = (x + 1) / 2; // 0..1
    return [Math.cos((t * Math.PI) / 2), Math.sin((t * Math.PI) / 2)];
  }
  const cut = 0.08; // zona de corte en los extremos
  const a = x >= 1 - cut ? (1 - x) / cut : 1;
  const b = x <= -1 + cut ? (x + 1) / cut : 1;
  return [clamp(a, 0, 1), clamp(b, 0, 1)];
}
