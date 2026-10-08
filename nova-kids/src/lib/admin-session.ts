// Sesión del panel /admin: cookie firmada con HMAC-SHA256 (Web Crypto),
// válida tanto en middleware (Edge) como en rutas Node.

export const ADMIN_COOKIE = "nk_admin";
export const SESSION_HOURS = 12;

const enc = new TextEncoder();

function secret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  return s ? `nova-kids:${s}` : null;
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

async function hmac(value: string, key: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(value));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const key = secret();
  if (!key) throw new Error("ADMIN_PASSWORD no está configurada.");
  const expires = Date.now() + SESSION_HOURS * 3_600_000;
  return `${expires}.${await hmac(String(expires), key)}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  const key = secret();
  if (!key || !token) return false;
  const [expires, sig] = token.split(".");
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  return safeEqual(sig, await hmac(expires, key));
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  // Compara hashes para no filtrar la longitud de la contraseña.
  const k = "nova-kids-password";
  return safeEqual(await hmac(input, k), await hmac(expected, k));
}
