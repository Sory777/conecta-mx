// Reloj inyectable: permite a las pruebas avanzar el tiempo sin esperar.
let offsetMs = 0;
let frozen: number | null = null;

export const clock = {
  now(): number {
    return frozen ?? Date.now() + offsetMs;
  },
  /** Sólo pruebas */
  advance(ms: number) {
    if (frozen !== null) frozen += ms;
    else offsetMs += ms;
  },
  /** Sólo pruebas */
  freeze(at: number | null) {
    frozen = at;
  },
  reset() {
    offsetMs = 0;
    frozen = null;
  },
};

export const DAY_MS = 24 * 3600 * 1000;

export function startOfUtcDay(ts: number): number {
  return Math.floor(ts / DAY_MS) * DAY_MS;
}

/** Inicio de la semana (lunes 00:00 UTC). */
export function startOfUtcWeek(ts: number): number {
  const day = startOfUtcDay(ts);
  const dow = (new Date(day).getUTCDay() + 6) % 7; // 0 = lunes
  return day - dow * DAY_MS;
}
