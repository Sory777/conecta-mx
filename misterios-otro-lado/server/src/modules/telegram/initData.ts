import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface VerifiedInitData {
  user: TelegramUser;
  authDate: number;
  startParam: string | null;
  queryId: string | null;
}

/**
 * Valida el `initData` de una Telegram Mini App según la documentación oficial:
 *   secret = HMAC_SHA256(key="WebAppData", msg=bot_token)
 *   hash   = hex(HMAC_SHA256(key=secret, msg=data_check_string))
 * donde data_check_string son todos los campos excepto `hash`, ordenados, "clave=valor" unidos por "\n".
 * Nunca se confía en el usuario enviado por el cliente sin esta verificación.
 */
export function verifyInitData(initData: string, botToken: string, maxAgeSec: number, nowMs = Date.now()): VerifiedInitData | null {
  if (!initData || initData.length > 4096) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/.test(hash)) return null;
  const pairs: string[] = [];
  for (const [k, v] of params) if (k !== 'hash') pairs.push(`${k}=${v}`);
  pairs.sort();
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(pairs.join('\n')).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || nowMs / 1000 - authDate > maxAgeSec) return null;
  let user: TelegramUser;
  try {
    user = JSON.parse(params.get('user') ?? '');
  } catch {
    return null;
  }
  if (!user || typeof user.id !== 'number') return null;
  return { user, authDate, startParam: params.get('start_param'), queryId: params.get('query_id') };
}

/** Sólo para pruebas: firma un initData como lo haría Telegram. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const pairs = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort();
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  const p = new URLSearchParams(fields);
  p.set('hash', hash);
  return p.toString();
}
