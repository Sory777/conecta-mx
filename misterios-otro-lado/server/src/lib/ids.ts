import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';

export const newId = () => randomUUID();

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export function hmac(secret: string, s: string): string {
  return createHmac('sha256', secret).update(s).digest('hex');
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function referralCode(): string {
  const b = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[b[i] % CODE_ALPHABET.length];
  return out;
}
