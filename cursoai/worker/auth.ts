import type { Env } from './env';
import { isProduction } from './env';
import { HttpError, unauthorized } from './http';
import { newId, nowIso, randomToken, sha256Hex, toHex } from './util';
import type { UserDTO } from '../shared/types';

const PBKDF2_ITERATIONS = 100_000; // Cloudflare Workers' WebCrypto maximum
const SESSION_DAYS = 30;
export const SESSION_COOKIE = 'cai_session';

export async function hashPassword(password: string, saltHex?: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return `pbkdf2$${iterations}$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, expected] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iter || !salt || !expected) return false;
  const candidate = await hashPassword(password, salt, Number(iter));
  return timingSafeEqual(candidate.split('$')[3], expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'premium';
  password_hash: string;
}

export const toUserDTO = (u: Pick<UserRow, 'id' | 'email' | 'name' | 'plan'>): UserDTO => ({
  id: u.id,
  email: u.email,
  name: u.name,
  plan: u.plan,
});

export async function createUser(env: Env, email: string, password: string, name: string): Promise<UserRow> {
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) throw new HttpError(409, 'email_taken', 'Ya existe una cuenta con ese correo.');
  const id = newId('u_');
  const password_hash = await hashPassword(password);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').bind(id, email, password_hash, name),
    env.DB.prepare('INSERT INTO user_profiles (user_id) VALUES (?)').bind(id),
    env.DB.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').bind(id),
  ]);
  return { id, email, name, plan: 'free', password_hash };
}

export async function authenticate(env: Env, email: string, password: string): Promise<UserRow> {
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  // Always run a hash so response time does not reveal whether the email exists.
  const ok = user
    ? await verifyPassword(password, user.password_hash)
    : (await hashPassword(password), false);
  if (!user || !ok) throw new HttpError(401, 'invalid_credentials', 'Correo o contraseña incorrectos.');
  return user;
}

export async function createSession(env: Env, userId: string): Promise<{ token: string; expires: Date }> {
  const token = randomToken(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256Hex(token), userId, expires.toISOString())
    .run();
  // Opportunistic cleanup of this user's expired sessions.
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').bind(userId, nowIso()).run();
  return { token, expires };
}

export async function destroySession(env: Env, req: Request): Promise<void> {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(token)).run();
}

export async function currentUser(env: Env, req: Request): Promise<UserRow | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?`,
  )
    .bind(await sha256Hex(token), nowIso())
    .first<UserRow>();
  return row ?? null;
}

export async function requireUser(env: Env, req: Request): Promise<UserRow> {
  const user = await currentUser(env, req);
  if (!user) throw unauthorized();
  return user;
}

export function sessionCookie(env: Env, token: string, expires: Date): string {
  const secure = isProduction(env) ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${secure}`;
}

export function clearedCookie(env: Env): string {
  const secure = isProduction(env) ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}
