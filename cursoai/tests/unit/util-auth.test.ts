import { describe, expect, it } from 'vitest';
import { hashPassword, readCookie, verifyPassword } from '../../worker/auth';
import { humanCode, stableStringify } from '../../worker/util';
import { summarizedUpTo } from '../../worker/services/tutor';
import { estimateCostMicroUsd } from '../../worker/ai/provider';

describe('passwords', () => {
  it('hashes with a random salt and verifies', async () => {
    const a = await hashPassword('secreto-123', undefined, 1000);
    const b = await hashPassword('secreto-123', undefined, 1000);
    expect(a).not.toBe(b);
    expect(a.startsWith('pbkdf2$1000$')).toBe(true);
    expect(await verifyPassword('secreto-123', a)).toBe(true);
    expect(await verifyPassword('otro', a)).toBe(false);
    expect(await verifyPassword('secreto-123', 'basura')).toBe(false);
  });
});

describe('utilities', () => {
  it('produces stable JSON regardless of key order', () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(stableStringify({ a: [2, { c: 2, d: 1 }], b: 1 }));
  });

  it('generates unambiguous human codes', () => {
    const code = humanCode(10);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
  });

  it('reads cookies', () => {
    const req = new Request('http://x', { headers: { Cookie: 'a=1; cai_session=abc; b=2' } });
    expect(readCookie(req, 'cai_session')).toBe('abc');
    expect(readCookie(req, 'none')).toBeNull();
  });

  it('bounds the tutor context window', () => {
    expect(summarizedUpTo(8)).toBe(0);
    expect(summarizedUpTo(20)).toBe(10);
    expect(summarizedUpTo(28)).toBe(10);
    expect(summarizedUpTo(30)).toBe(20);
  });

  it('estimates AI cost per model', () => {
    const usage = { input_tokens: 1_000_000, output_tokens: 0, cache_read_tokens: 0 };
    expect(estimateCostMicroUsd('claude-haiku-4-5', usage)).toBe(1_000_000);
    expect(estimateCostMicroUsd('claude-opus-5', usage)).toBe(5_000_000);
  });
});
