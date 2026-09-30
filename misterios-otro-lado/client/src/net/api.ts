// Cliente REST. El token de sesión es opaco; el servidor sólo guarda su hash.
// NUNCA hay secretos ni claves privadas en el cliente.

const TOKEN_KEY = 'mol.token';
const DEVICE_KEY = 'mol.device';

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* modo privado */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const session = {
  get token() {
    return safeGet(TOKEN_KEY);
  },
  set token(v: string | null) {
    safeSet(TOKEN_KEY, v);
  },
  /** Identificador de instalación (señal antifraude, no es un secreto ni una prueba). */
  get deviceId(): string {
    let id = safeGet(DEVICE_KEY);
    if (!id) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      id = 'd-' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      safeSet(DEVICE_KEY, id);
    }
    return id;
  },
};

export async function api<T = any>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  const t = session.token;
  if (t) headers.authorization = `Bearer ${t}`;
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'network', 'No se pudo conectar con el servidor.');
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* sin cuerpo */
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? `Error ${res.status}`);
  }
  return data as T;
}

export function idem(): string {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
