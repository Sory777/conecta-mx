/** Formato DJ: m:ss.d (décimas), p. ej. 3:07.4 */
export function formatTime(seconds: number, withTenths = true): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const totalTenths = Math.floor(seconds * 10);
  const tenths = totalTenths % 10;
  const totalSec = Math.floor(totalTenths / 10);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const base = `${m}:${s.toString().padStart(2, '0')}`;
  return withTenths ? `${base}.${tenths}` : base;
}

/** Porcentaje de pitch con signo, p. ej. +2.35% */
export function formatPercent(fraction: number, digits = 2): string {
  const pct = fraction * 100;
  const sign = pct > 0.0005 ? '+' : pct < -0.0005 ? '−' : '±';
  return `${sign}${Math.abs(pct).toFixed(digits)}%`;
}
