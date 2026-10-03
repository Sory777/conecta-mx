import 'server-only';

/**
 * Sliding-window rate limiter. In-memory implementation: correct for a single
 * instance and good enough as a first line of defence on serverless. For
 * multi-instance production, back `RateLimitStore` with Upstash/Redis or use
 * the platform's rate limiting (Cloudflare/Vercel firewall) — same interface.
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number, now: number): Promise<number>;
}

class MemoryStore implements RateLimitStore {
  private hits = new Map<string, number[]>();
  async hit(key: string, windowMs: number, now: number) {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 50_000) this.hits.clear(); // memory guard
    return list.length;
  }
}

const store: RateLimitStore = new MemoryStore();

export const LIMITS = {
  search: { max: 60, windowMs: 60_000 },
  ai: { max: 8, windowMs: 60_000 },
  identify: { max: 5, windowMs: 60_000 },
  research: { max: 30, windowMs: 60_000 },
  account: { max: 5, windowMs: 60_000 },
} as const;

export function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? fwd ?? 'unknown';
}

/** Returns a 429 Response when the limit is exceeded, otherwise null. */
export async function rateLimit(req: Request, bucket: keyof typeof LIMITS): Promise<Response | null> {
  const { max, windowMs } = LIMITS[bucket];
  const count = await store.hit(`${bucket}:${clientKey(req)}`, windowMs, Date.now());
  if (count <= max) return null;
  return Response.json(
    { error: 'rate_limited', message: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(windowMs / 1000)) } },
  );
}
