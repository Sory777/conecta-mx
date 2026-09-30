import WebSocket from 'ws';
import { buildServer, type GameServer } from '../src/app';
import { loadConfig } from '../src/config/env';
import { clock } from '../src/lib/clock';
import type { ServerMsg } from '../../shared/protocol';
import { PROTOCOL_VERSION } from '../../shared/constants';

export async function startTestServer(overrides: Record<string, string> = {}, beforeStart?: (s: GameServer) => void) {
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_PATH: ':memory:', PORT: '0', HOST: '127.0.0.1', LOG_LEVEL: 'silent', AUTH_RATE_PER_10MIN: '100000', ...overrides });
  const server = await buildServer(config);
  server.services.ecoCfg.update({ antifraud: { maxRegistrationsPerIpPerDay: 1000 } }, null);
  beforeStart?.(server);
  const addr = await server.start();
  const base = addr.replace('http://', '');
  return { server, base };
}

export async function api<T = any>(base: string, method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; data: T }> {
  const res = await fetch(`http://${base}${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: (await res.json()) as T };
}

let seq = 0;
const letters = (n: number) => n.toString(26).split('').map((ch) => String.fromCharCode(97 + parseInt(ch, 26))).join('');
export async function registerPlayer(base: string, name: string, opts: { deviceId?: string; referralCode?: string } = {}) {
  seq++;
  const username = `${name}${seq}`.slice(0, 20);
  const r = await api(base, 'POST', '/api/auth/register', {
    email: `${username}@test.dev`,
    username,
    password: 'clave-segura-1',
    deviceId: opts.deviceId ?? `device-${username}-xyz`,
    referralCode: opts.referralCode,
    acceptTerms: true,
    ageConfirmed: true,
  });
  if (r.status !== 200) throw new Error(`register failed ${JSON.stringify(r.data)}`);
  const token = r.data.token as string;
  const c = await api(base, 'POST', '/api/characters', { name: `Det ${name} ${letters(seq)}`.slice(0, 20), appearance: { skin: '#c69c7b', hair: '#222222', coat: '#445566', pants: '#222222' } }, token);
  if (c.status !== 200) throw new Error(`character failed ${JSON.stringify(c.data)}`);
  return { token, userId: r.data.userId as string, username, deviceId: opts.deviceId ?? `device-${username}-xyz` };
}

export class TestClient {
  ws!: WebSocket;
  msgs: ServerMsg[] = [];
  pos: [number, number, number] = [0, 0, 0];
  private waiters: { pred: (m: ServerMsg) => boolean; resolve: (m: ServerMsg) => void }[] = [];

  static async connect(base: string, token: string, deviceId: string): Promise<TestClient> {
    const c = new TestClient();
    c.ws = new WebSocket(`ws://${base}/ws`);
    c.ws.on('message', (d) => {
      const m = JSON.parse(d.toString()) as ServerMsg;
      if (m.t === 'welcome') c.pos = [...m.you.p];
      if (m.t === 'teleport') c.pos = [...m.p];
      c.msgs.push(m);
      for (const w of [...c.waiters]) {
        if (w.pred(m)) {
          c.waiters.splice(c.waiters.indexOf(w), 1);
          w.resolve(m);
        }
      }
    });
    await new Promise((r) => c.ws.once('open', r));
    c.send({ t: 'hello', token, deviceId, v: PROTOCOL_VERSION });
    await c.wait((m) => m.t === 'welcome');
    return c;
  }

  send(m: unknown) {
    this.ws.send(JSON.stringify(m));
  }

  wait<T extends ServerMsg['t']>(pred: ((m: ServerMsg) => boolean) | T, timeoutMs = 4000): Promise<any> {
    const p = typeof pred === 'string' ? (m: ServerMsg) => m.t === pred : pred;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout waiting for message')), timeoutMs);
      this.waiters.push({ pred: p, resolve: (m) => (clearTimeout(t), resolve(m)) });
    });
  }

  /** Barrera: garantiza que el servidor procesó todo lo anterior. */
  async sync() {
    const ts = Math.random();
    this.send({ t: 'ping', ts });
    await this.wait((m) => m.t === 'pong' && m.ts === ts);
  }

  /** Camina en línea recta a ~6 m/s avanzando el reloj del servidor. */
  async walkTo(x: number, z: number) {
    for (;;) {
      const dx = x - this.pos[0];
      const dz = z - this.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < 0.01) return;
      const step = Math.min(0.6, d);
      clock.advance(100);
      this.pos = [this.pos[0] + (dx / d) * step, 0, this.pos[2] + (dz / d) * step];
      this.send({ t: 'move', p: this.pos, r: 0, a: 'run', seq: 0 });
      await this.sync();
    }
  }

  async interact(entityId: string) {
    this.send({ t: 'interact', entityId });
    return this.wait((m) => m.t === 'interact_result' && m.entityId === entityId);
  }

  close() {
    this.ws.close();
  }
}

export async function stop(server: GameServer) {
  await server.stop();
  clock.reset();
}
