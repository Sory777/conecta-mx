import { PROTOCOL_VERSION } from '../../../shared/constants';
import type { ClientMsg, ServerMsg } from '../../../shared/protocol';
import { session } from './api';

type Handler = (m: ServerMsg) => void;

/** Conexión en tiempo real con reconexión automática (backoff exponencial). */
export class GameSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private retry = 0;
  private closedByUser = false;
  private fatal = false;
  onStatus: (s: 'connecting' | 'online' | 'offline' | 'fatal', info?: string) => void = () => {};

  connect() {
    this.closedByUser = false;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    this.onStatus('connecting');
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: 'hello', token: session.token ?? '', deviceId: session.deviceId, v: PROTOCOL_VERSION } satisfies ClientMsg));
    };
    ws.onmessage = (ev) => {
      let m: ServerMsg;
      try {
        m = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (m.t === 'welcome') {
        this.retry = 0;
        this.onStatus('online');
      }
      if (m.t === 'error' && ['auth', 'version', 'no_character'].includes(m.code)) this.fatal = true;
      if (m.t === 'kicked') this.fatal = true;
      for (const h of this.handlers) h(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.closedByUser) return;
      if (this.fatal) return this.onStatus('fatal');
      this.onStatus('offline');
      const delay = Math.min(15000, 800 * 2 ** this.retry++);
      setTimeout(() => !this.closedByUser && this.connect(), delay);
    };
  }

  on(h: Handler) {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  send(m: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  get online() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close() {
    this.closedByUser = true;
    this.ws?.close();
  }
}
