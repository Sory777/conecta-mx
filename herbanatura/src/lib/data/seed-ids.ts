import { createHash } from 'node:crypto';

const NAMESPACE = '6f1c1d0e-3b2a-4c55-9a7e-0e6b5d2f9a10';

/** Deterministic UUIDv5 used to turn demo dataset ids into database ids. */
export function seedUuid(name: string): string {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(Buffer.concat([ns, Buffer.from(name, 'utf8')])).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = hash.subarray(0, 16).toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
