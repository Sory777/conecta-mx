// Minimal cookie-aware API client for integration tests.
export const BASE = process.env.API_URL ?? 'http://localhost:8787';

export class Client {
  cookie = '';
  // Each simulated user comes from its own IP so per-IP auth limits don't collide across tests.
  ip = `10.${rnd()}.${rnd()}.${rnd()}`;
  async req<T = any>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ status: number; data: T }> {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        'CF-Connecting-IP': this.ip,
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  }
  get<T = any>(p: string) {
    return this.req<T>('GET', p);
  }
  post<T = any>(p: string, b: unknown = {}) {
    return this.req<T>('POST', p, b);
  }
}

export async function newUser(name = 'Ana Prueba'): Promise<Client> {
  const c = new Client();
  const email = `t${Date.now()}${Math.random().toString(36).slice(2, 7)}@example.com`;
  const r = await c.post('/api/auth/register', { email, password: 'contraseña-segura-1', name });
  if (r.status !== 201) throw new Error(`register failed ${r.status} ${JSON.stringify(r.data)}`);
  return c;
}

function rnd() {
  return Math.floor(Math.random() * 250) + 1;
}
