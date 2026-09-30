import { clock } from './clock';

/**
 * Token bucket en memoria. Suficiente para un único nodo; en despliegue multi-nodo
 * se sustituye por Redis (misma interfaz).
 */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; last: number }>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {}

  take(key: string, cost = 1): boolean {
    const now = clock.now();
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: this.capacity, last: now };
      this.buckets.set(key, b);
    }
    const elapsed = Math.max(0, now - b.last) / 1000;
    b.tokens = Math.min(this.capacity, b.tokens + elapsed * this.refillPerSec);
    b.last = now;
    if (b.tokens < cost) return false;
    b.tokens -= cost;
    if (this.buckets.size > 50_000) this.gc(now);
    return true;
  }

  private gc(now: number) {
    for (const [k, b] of this.buckets) {
      if (now - b.last > 10 * 60_000) this.buckets.delete(k);
    }
  }
}
