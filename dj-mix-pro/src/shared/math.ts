export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

/** Interpolación exponencial: útil para frecuencias (percepción logarítmica). */
export const expInterp = (from: number, to: number, t: number): number =>
  from * Math.pow(to / from, clamp(t, 0, 1));

export const dbToGain = (db: number): number => Math.pow(10, db / 20);

export const gainToDb = (gain: number): number =>
  gain <= 0 ? -Infinity : 20 * Math.log10(gain);
