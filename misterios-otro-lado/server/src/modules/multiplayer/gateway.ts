import type { IncomingMessage, Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type { Db } from '../../db/database';
import type { Bus } from '../../lib/bus';
import { clock } from '../../lib/clock';
import { newId } from '../../lib/ids';
import type { Logger } from '../../lib/logger';
import { RateLimiter } from '../../lib/rateLimit';
import { cleanText, filterProfanity } from '../../lib/sanitize';
import { DAY_LENGTH_SEC, MOVE, NET, PROTOCOL_VERSION, SOCIAL, worldTimeOfDay } from '../../../../shared/constants';
import type { AnimState, Appearance, ChatLine, ClientMsg, PartyView, PublicPlayer, ServerMsg, Vec3, WorldState } from '../../../../shared/protocol';
import { heightAt, regionOf, type Region, SPAWN } from '../../../../shared/world';
import type { AccountService } from '../accounts/service';
import type { AnalyticsService } from '../analytics/service';
import type { AntiFraudService } from '../antifraud/service';
import type { AuthService } from '../auth/service';
import type { Economy } from '../economy/ledger';
import type { CoopPeer, InteractOutcome, MissionService } from '../missions/service';
import type { ReferralService } from '../referrals/service';
import type { SeasonService } from '../seasons/service';
import type { SocialService } from '../social/service';
import { PartyManager } from './party';

interface Conn {
  ws: WebSocket;
  userId: string;
  charId: string;
  name: string;
  username: string;
  appearance: Appearance;
  x: number;
  y: number;
  z: number;
  rot: number;
  anim: AnimState;
  region: Region;
  lastMoveAt: number;
  /** Presupuesto de distancia (m) que se recarga con el tiempo: impide "muchos pasos pequeños". */
  moveBudget: number;
  teleportUntil: number;
  violations: number[];
  lastSpeedFlagAt: number;
  shardId: string;
  ip: string;
  deviceId: string;
  playSessionId: string;
  msgLimiter: RateLimiter;
  alive: boolean;
}

interface Shard {
  id: string;
  players: Map<string, Conn>;
  chat: ChatLine[];
}

const MAX_BUDGET = MOVE.serverMaxSpeed * 1.2 + 1;
const ANIMS: AnimState[] = ['idle', 'walk', 'run'];
const WEATHERS: WorldState['weather'][] = ['clear', 'fog', 'fog', 'rain', 'clear', 'storm', 'fog'];

export interface GatewayDeps {
  db: Db;
  bus: Bus;
  log: Logger;
  auth: AuthService;
  accounts: AccountService;
  missions: MissionService;
  social: SocialService;
  economy: Economy;
  antifraud: AntiFraudService;
  analytics: AnalyticsService;
  referrals: ReferralService;
  seasons: SeasonService;
}

/**
 * Servidor de juego en tiempo real (autoritativo para interacciones, economía y posiciones).
 * - Movimiento: el cliente predice; el servidor valida velocidad, región y límites y corrige.
 * - Interacciones/acertijos: sólo con la posición que el servidor conoce.
 * - Shards de hasta NET.maxPlayersPerShard jugadores; los grupos se reúnen en el mismo shard.
 */
export class Gateway {
  private wss: WebSocketServer;
  private shards = new Map<string, Shard>();
  private conns = new Map<string, Conn>();
  readonly parties = new PartyManager();
  private chatLimiter = new RateLimiter(5, 0.5);
  private actionLimiter = new RateLimiter(8, 4);
  private timers: NodeJS.Timeout[] = [];
  private weather: WorldState['weather'] = 'fog';
  private nextWeatherAt = 0;
  private pendingMissionPush = new Set<string>();

  constructor(private readonly d: GatewayDeps) {
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req));
    d.social.isOnline = (uid) => this.conns.has(uid);
    this.wireBus();
  }

  attach(server: Server) {
    server.on('upgrade', (req, socket, head) => {
      if (!req.url?.startsWith('/ws')) return socket.destroy();
      this.wss.handleUpgrade(req, socket, head, (ws) => this.wss.emit('connection', ws, req));
    });
    this.timers.push(setInterval(() => this.tick(), 1000 / NET.snapshotRate));
    this.timers.push(setInterval(() => this.saveAll(), 15_000));
    this.timers.push(setInterval(() => this.heartbeat(), 20_000));
    this.timers.push(setInterval(() => this.worldTick(), 10_000));
    this.worldTick();
  }

  stop() {
    for (const t of this.timers) clearInterval(t);
    for (const c of [...this.conns.values()]) {
      this.disconnect(c);
      c.ws.close(1001, 'server_shutdown');
    }
    this.wss.close();
  }

  onlineCount() {
    return this.conns.size;
  }

  stats() {
    return { online: this.conns.size, shards: [...this.shards.values()].map((s) => ({ id: s.id, players: s.players.size })), weather: this.weather };
  }

  // ------------------------------------------------------------------ ciclo de vida de conexión

  private onConnection(ws: WebSocket, req: IncomingMessage) {
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.socket.remoteAddress || '0.0.0.0';
    let conn: Conn | null = null;
    const helloTimer = setTimeout(() => ws.close(4001, 'hello_timeout'), 8000);
    const limiter = new RateLimiter(60, 30);

    ws.on('message', (data) => {
      if (!limiter.take('m')) {
        if (conn) this.d.antifraud.flag(conn.userId, 'ws_flood', 1, {}, ip);
        return;
      }
      let msg: ClientMsg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object' || typeof (msg as { t?: unknown }).t !== 'string') return;
      if (!conn) {
        if (msg.t !== 'hello') return;
        clearTimeout(helloTimer);
        conn = this.hello(ws, msg, ip);
        return;
      }
      try {
        this.handle(conn, msg);
      } catch (e) {
        this.d.log.error('ws handler error', { err: String(e), t: msg.t });
        this.send(conn, { t: 'error', code: 'internal', message: 'Error procesando la acción.' });
      }
    });
    ws.on('pong', () => {
      if (conn) conn.alive = true;
    });
    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (conn && this.conns.get(conn.userId) === conn) this.disconnect(conn);
    });
    ws.on('error', () => undefined);
  }

  private hello(ws: WebSocket, msg: Extract<ClientMsg, { t: 'hello' }>, ip: string): Conn | null {
    if (msg.v !== PROTOCOL_VERSION) {
      ws.send(JSON.stringify({ t: 'error', code: 'version', message: 'Versión del cliente desactualizada. Recarga la página.' }));
      ws.close(4002, 'version');
      return null;
    }
    const user = this.d.auth.authenticate(typeof msg.token === 'string' ? msg.token : null);
    if (!user) {
      ws.send(JSON.stringify({ t: 'error', code: 'auth', message: 'Sesión inválida. Inicia sesión de nuevo.' }));
      ws.close(4003, 'auth');
      return null;
    }
    const ch = this.d.accounts.character(user.id);
    if (!ch) {
      ws.send(JSON.stringify({ t: 'error', code: 'no_character', message: 'Crea un personaje primero.' }));
      ws.close(4004, 'no_character');
      return null;
    }
    const prev = this.conns.get(user.id);
    if (prev) {
      this.send(prev, { t: 'kicked', reason: 'Se inició sesión desde otra ventana o dispositivo.' });
      prev.ws.close(4005, 'replaced');
      this.disconnect(prev);
    }
    const deviceId = this.d.antifraud.registerDevice(user.id, String(msg.deviceId ?? '').slice(0, 128), ip);
    let region = regionOf(ch.pos_x, ch.pos_z);
    let x = ch.pos_x;
    let z = ch.pos_z;
    if (!region) {
      x = SPAWN.x;
      z = SPAWN.z;
      region = 'outdoor';
    }
    const now = clock.now();
    const conn: Conn = {
      ws,
      userId: user.id,
      charId: ch.id,
      name: ch.name,
      username: user.username,
      appearance: this.d.accounts.appearanceOf(ch),
      x,
      y: heightAt(x, z),
      z,
      rot: ch.rot_y,
      anim: 'idle',
      region,
      lastMoveAt: now,
      moveBudget: MAX_BUDGET,
      teleportUntil: 0,
      violations: [],
      lastSpeedFlagAt: 0,
      shardId: '',
      ip,
      deviceId,
      playSessionId: this.d.analytics.startSession(user.id),
      msgLimiter: new RateLimiter(10, 5),
      alive: true,
    };
    this.conns.set(user.id, conn);
    this.parties.setOnline(user.id, true);
    const party = this.parties.partyOf(user.id);
    const partyShard = party?.members.map((m) => this.conns.get(m)).find((c) => c && c !== conn && c.shardId)?.shardId;
    this.joinShard(conn, partyShard ?? this.pickShard());
    if (party) this.pushParty(party.id);
    this.d.log.info('player connected', { userId: user.id, shard: conn.shardId, online: this.conns.size });
    return conn;
  }

  private disconnect(conn: Conn) {
    this.conns.delete(conn.userId);
    this.d.accounts.savePosition(conn.userId, conn.x, conn.y, conn.z, conn.rot);
    this.d.analytics.endSession(conn.playSessionId);
    const shard = this.shards.get(conn.shardId);
    if (shard) {
      shard.players.delete(conn.userId);
      this.broadcast(shard, { t: 'player_leave', id: conn.charId });
      if (shard.players.size === 0 && this.shards.size > 1) this.shards.delete(shard.id);
    }
    this.parties.setOnline(conn.userId, false);
    const p = this.parties.partyOf(conn.userId);
    if (p) this.pushParty(p.id);
    try {
      this.d.referrals.tryQualify(conn.userId);
    } catch (e) {
      this.d.log.warn('referral check failed', { err: String(e) });
    }
  }

  private pickShard(): string {
    let best: Shard | null = null;
    for (const s of this.shards.values()) {
      if (s.players.size < NET.maxPlayersPerShard && (!best || s.players.size > best.players.size)) best = s;
    }
    if (best) return best.id;
    const id = `sb-${this.shards.size + 1}-${newId().slice(0, 4)}`;
    this.shards.set(id, { id, players: new Map(), chat: [] });
    return id;
  }

  private joinShard(conn: Conn, shardId: string) {
    const old = this.shards.get(conn.shardId);
    if (old) {
      old.players.delete(conn.userId);
      this.broadcast(old, { t: 'player_leave', id: conn.charId });
    }
    let shard = this.shards.get(shardId);
    if (!shard) {
      shard = { id: shardId, players: new Map(), chat: [] };
      this.shards.set(shardId, shard);
    }
    conn.shardId = shard.id;
    shard.players.set(conn.userId, conn);
    this.broadcast(shard, { t: 'player_join', player: this.publicOf(conn) }, conn.userId);
    this.sendWelcome(conn);
  }

  private sendWelcome(conn: Conn) {
    const shard = this.shards.get(conn.shardId)!;
    const blocked = this.d.social.blockedBy(conn.userId);
    this.send(conn, {
      t: 'welcome',
      you: this.publicOf(conn),
      world: this.worldState(shard.id),
      players: [...shard.players.values()].filter((c) => c !== conn).map((c) => this.publicOf(c)),
      missions: this.d.missions.payload(conn.userId),
      wallet: this.d.economy.balances(conn.userId),
      party: this.partyView(conn.userId),
      chat: shard.chat.filter((l) => !l.fromUserId || !blocked.has(l.fromUserId)).slice(-20),
    });
  }

  private publicOf(c: Conn): PublicPlayer {
    return {
      id: c.charId,
      userId: c.userId,
      name: c.name,
      appearance: c.appearance,
      p: [c.x, c.y, c.z],
      r: c.rot,
      a: c.anim,
      partyId: this.parties.partyOf(c.userId)?.id ?? null,
    };
  }

  private worldState(shardId: string): WorldState {
    const now = clock.now();
    return { timeOfDay: worldTimeOfDay(now), serverTime: now, dayLengthSec: DAY_LENGTH_SEC, weather: this.weather, shardId };
  }

  // ------------------------------------------------------------------ mensajes

  private handle(conn: Conn, msg: ClientMsg) {
    switch (msg.t) {
      case 'move':
        return this.onMove(conn, msg);
      case 'ping':
        return this.send(conn, { t: 'pong', ts: Number(msg.ts) || 0, serverTime: clock.now() });
      case 'interact':
        if (!this.actionLimiter.take(conn.userId)) return;
        if (typeof msg.entityId !== 'string' || msg.entityId.length > 64) return;
        return this.onInteract(conn, msg.entityId);
      case 'solve':
        if (!this.actionLimiter.take(conn.userId)) return;
        if (typeof msg.puzzleId !== 'string' || typeof msg.answer !== 'string') return;
        return this.onSolve(conn, msg.puzzleId.slice(0, 64), msg.answer.slice(0, 40));
      case 'track':
        if (typeof msg.missionId !== 'string') return;
        try {
          this.d.missions.track(conn.userId, msg.missionId);
          this.queueMissions(conn.userId);
        } catch {
          /* ignorar */
        }
        return;
      case 'chat':
        return this.onChat(conn, msg.channel, msg.text);
      case 'share_clue':
        return this.onShareClue(conn, String(msg.clueId ?? '').slice(0, 64));
      case 'party_invite':
        return this.onPartyInvite(conn, String(msg.username ?? '').slice(0, 20));
      case 'party_respond':
        return this.onPartyRespond(conn, String(msg.inviteId ?? ''), !!msg.accept);
      case 'party_leave':
        return this.onPartyLeave(conn);
      case 'party_kick':
        return this.onPartyKick(conn, String(msg.userId ?? ''));
      default:
        return;
    }
  }

  private onMove(conn: Conn, msg: Extract<ClientMsg, { t: 'move' }>) {
    const p = msg.p;
    if (!Array.isArray(p) || p.length !== 3 || !p.every((v) => typeof v === 'number' && Number.isFinite(v))) return;
    const [x, , z] = p;
    const now = clock.now();
    const dist = Math.hypot(x - conn.x, z - conn.z);
    if (now < conn.teleportUntil && dist > 3) return; // paquetes viejos en vuelo tras un teletransporte
    const reg = regionOf(x, z);
    const dt = Math.max(0, (now - conn.lastMoveAt) / 1000);
    conn.moveBudget = Math.min(MAX_BUDGET, conn.moveBudget + MOVE.serverMaxSpeed * dt);
    conn.lastMoveAt = now;
    if (reg !== conn.region || dist > conn.moveBudget + 0.3) {
      this.violation(conn, reg !== conn.region ? 'region' : 'speed', dist, dt);
      this.send(conn, { t: 'correct', p: [conn.x, conn.y, conn.z] });
      return;
    }
    conn.moveBudget = Math.max(0, conn.moveBudget - dist);
    conn.x = x;
    conn.z = z;
    conn.y = heightAt(x, z);
    if (typeof msg.r === 'number' && Number.isFinite(msg.r)) conn.rot = msg.r;
    conn.anim = ANIMS.includes(msg.a) ? msg.a : 'idle';
  }

  private violation(conn: Conn, kind: string, dist: number, dt: number) {
    const now = clock.now();
    conn.violations = conn.violations.filter((t) => now - t < 60_000);
    conn.violations.push(now);
    if (conn.violations.length >= 8 && now - conn.lastSpeedFlagAt > 60_000) {
      conn.lastSpeedFlagAt = now;
      this.d.antifraud.flag(conn.userId, kind === 'region' ? 'region_hack' : 'speed_hack', 5, { dist: Math.round(dist * 10) / 10, dt, count: conn.violations.length }, conn.ip, conn.deviceId);
    }
  }

  private coopPeers(conn: Conn): CoopPeer[] {
    const party = this.parties.partyOf(conn.userId);
    if (!party) return [];
    const out: CoopPeer[] = [];
    for (const m of party.members) {
      const c = this.conns.get(m);
      if (c && c !== conn && c.shardId === conn.shardId) out.push({ userId: c.userId, name: c.name, x: c.x, z: c.z });
    }
    return out;
  }

  private onInteract(conn: Conn, entityId: string) {
    const out = this.d.missions.interact(conn.userId, { x: conn.x, z: conn.z }, entityId, this.coopPeers(conn));
    this.send(conn, {
      t: 'interact_result',
      entityId,
      ok: out.ok,
      messages: out.messages,
      dialogue: out.dialogue.length ? out.dialogue : undefined,
      puzzle: out.puzzle ?? undefined,
      discovered: out.discovered.clues.length || out.discovered.items.length ? out.discovered : undefined,
    });
    this.applyOutcome(conn, out);
  }

  private onSolve(conn: Conn, puzzleId: string, answer: string) {
    const r = this.d.missions.solve(conn.userId, { x: conn.x, z: conn.z }, puzzleId, answer, this.coopPeers(conn));
    this.send(conn, { t: 'solve_result', puzzleId, ok: r.ok, message: r.message });
    if (r.outcome) {
      if (r.outcome.messages.length || r.outcome.discovered.clues.length) {
        this.send(conn, {
          t: 'interact_result',
          entityId: puzzleId,
          ok: true,
          messages: r.outcome.messages,
          discovered: r.outcome.discovered,
        });
      }
      this.applyOutcome(conn, r.outcome);
    }
  }

  private applyOutcome(conn: Conn, out: InteractOutcome) {
    if (out.teleport) this.teleport(conn, out.teleport.p, out.teleport.rotY);
    for (const c of out.completed) this.send(conn, { t: 'mission_complete', missionId: c.missionId, title: c.title, rewards: c.rewards });
    for (const a of out.affectedUsers) {
      const peer = this.conns.get(a.userId);
      if (!peer) continue;
      this.send(peer, { t: 'notice', level: 'info', text: `${conn.name} avanzó la investigación del grupo.` });
      if (a.completed) this.send(peer, { t: 'mission_complete', missionId: a.completed.missionId, title: a.completed.title, rewards: a.completed.rewards });
    }
  }

  teleport(conn: Conn, p: Vec3, rotY: number) {
    const region = regionOf(p[0], p[2]);
    if (!region) return;
    conn.x = p[0];
    conn.z = p[2];
    conn.y = heightAt(p[0], p[2]);
    conn.rot = rotY;
    conn.region = region;
    conn.teleportUntil = clock.now() + 1500;
    conn.lastMoveAt = clock.now();
    conn.moveBudget = MAX_BUDGET;
    this.send(conn, { t: 'teleport', p: [conn.x, conn.y, conn.z], r: rotY });
  }

  private onChat(conn: Conn, channel: unknown, textRaw: unknown) {
    if (typeof textRaw !== 'string' || (channel !== 'world' && channel !== 'party')) return;
    if (!this.chatLimiter.take(conn.userId)) {
      return this.send(conn, { t: 'notice', level: 'warn', text: 'Estás enviando mensajes muy rápido.' });
    }
    const text = filterProfanity(cleanText(textRaw, SOCIAL.chatMaxLen));
    if (!text) return;
    const line: ChatLine = { id: newId(), channel, fromUserId: conn.userId, from: conn.name, text, ts: clock.now() };
    this.d.db.run('INSERT INTO chat_messages(id, channel, sender_id, text, created_at) VALUES (?, ?, ?, ?, ?)', line.id, channel === 'world' ? `world:${conn.shardId}` : `party`, conn.userId, text, line.ts);
    const blocked = this.d.social.blockedBy(conn.userId);
    if (channel === 'world') {
      const shard = this.shards.get(conn.shardId)!;
      shard.chat.push(line);
      if (shard.chat.length > 50) shard.chat.shift();
      for (const c of shard.players.values()) if (!blocked.has(c.userId)) this.send(c, { t: 'chat', line });
    } else {
      const party = this.parties.partyOf(conn.userId);
      if (!party) return this.send(conn, { t: 'notice', level: 'warn', text: 'No estás en un grupo.' });
      for (const m of party.members) {
        const c = this.conns.get(m);
        if (c && !blocked.has(m)) this.send(c, { t: 'chat', line });
      }
    }
  }

  private onShareClue(conn: Conn, clueId: string) {
    const party = this.parties.partyOf(conn.userId);
    if (!party) return this.send(conn, { t: 'notice', level: 'warn', text: 'Necesitas un grupo para compartir pistas.' });
    try {
      const received = this.d.missions.shareClue(conn.userId, clueId, party.members);
      for (const uid of received) {
        const c = this.conns.get(uid);
        if (c) this.send(c, { t: 'notice', level: 'success', text: `${conn.name} compartió una pista contigo. Revisa tu diario.` });
      }
      this.send(conn, {
        t: 'notice',
        level: received.length ? 'success' : 'info',
        text: received.length ? `Pista compartida con ${received.length} compañero(s).` : 'Tu grupo ya tenía esa pista.',
      });
    } catch (e) {
      this.send(conn, { t: 'notice', level: 'error', text: (e as Error).message });
    }
  }

  private onPartyInvite(conn: Conn, username: string) {
    const target = this.d.social.findUser(username);
    const tc = target ? this.conns.get(target.id) : undefined;
    if (!target || !tc) return this.send(conn, { t: 'notice', level: 'warn', text: 'Ese jugador no está en línea.' });
    if (target.id === conn.userId) return;
    if (this.d.social.isBlockedEither(conn.userId, target.id)) {
      return this.send(conn, { t: 'notice', level: 'warn', text: 'No puedes invitar a este jugador.' });
    }
    if (!this.conns.get(conn.userId)!.msgLimiter.take('invite')) return;
    try {
      const inv = this.parties.invite(conn.userId, conn.name, target.id);
      this.send(tc, { t: 'party_invite', inviteId: inv.id, from: conn.name, fromUserId: conn.userId });
      this.send(conn, { t: 'notice', level: 'info', text: `Invitación enviada a ${tc.name}.` });
    } catch (e) {
      this.send(conn, { t: 'notice', level: 'warn', text: (e as Error).message });
    }
  }

  private onPartyRespond(conn: Conn, inviteId: string, accept: boolean) {
    if (!accept) {
      const inv = this.parties.decline(inviteId, conn.userId);
      const from = inv ? this.conns.get(inv.fromId) : undefined;
      if (from) this.send(from, { t: 'notice', level: 'info', text: `${conn.name} rechazó la invitación.` });
      return;
    }
    const names = new Map<string, string>();
    for (const c of this.conns.values()) names.set(c.userId, c.name);
    try {
      const { party, left } = this.parties.accept(inviteId, conn.userId, names);
      if (left) this.pushParty(left.id, left);
      this.pushParty(party.id);
      // Reunir al grupo en el mismo shard
      const leader = this.conns.get(party.leaderId);
      if (leader && leader.shardId !== conn.shardId) this.joinShard(conn, leader.shardId);
      this.broadcastPlayerUpdate(conn);
      for (const m of party.members) {
        const c = this.conns.get(m);
        if (c) this.broadcastPlayerUpdate(c);
      }
      this.d.analytics.track('party_joined', conn.userId, { size: party.members.length });
    } catch (e) {
      this.send(conn, { t: 'notice', level: 'warn', text: (e as Error).message });
    }
  }

  private onPartyLeave(conn: Conn) {
    const p = this.parties.leave(conn.userId);
    this.send(conn, { t: 'party', party: null });
    if (p) this.pushParty(p.id, p);
    this.broadcastPlayerUpdate(conn);
  }

  private onPartyKick(conn: Conn, userId: string) {
    const p = this.parties.partyOf(conn.userId);
    if (!p || p.leaderId !== conn.userId || !p.members.includes(userId) || userId === conn.userId) return;
    this.parties.leave(userId);
    const kicked = this.conns.get(userId);
    if (kicked) {
      this.send(kicked, { t: 'party', party: null });
      this.send(kicked, { t: 'notice', level: 'info', text: 'Has salido del grupo.' });
      this.broadcastPlayerUpdate(kicked);
    }
    this.pushParty(p.id, p);
  }

  private partyView(userId: string, explicit?: { id: string; leaderId: string; members: string[]; names: Map<string, string> }): PartyView | null {
    const p = explicit ?? this.parties.partyOf(userId);
    if (!p || p.members.length === 0) return null;
    return {
      id: p.id,
      leaderId: p.leaderId,
      members: p.members.map((m) => ({ userId: m, name: p.names.get(m) ?? this.conns.get(m)?.name ?? '?', online: this.conns.has(m) })),
    };
  }

  private pushParty(partyId: string, explicit?: Parameters<Gateway['partyView']>[1]) {
    const p = explicit ?? [...this.conns.values()].map((c) => this.parties.partyOf(c.userId)).find((x) => x?.id === partyId);
    if (!p) return;
    const view = this.partyView('', p);
    for (const m of p.members) {
      const c = this.conns.get(m);
      if (c) this.send(c, { t: 'party', party: view });
    }
  }

  // ------------------------------------------------------------------ bucles

  private tick() {
    const now = clock.now();
    for (const shard of this.shards.values()) {
      const list = [...shard.players.values()];
      for (const rc of list) {
        const nearby = list.filter(
          (c) => c !== rc && c.region === rc.region && Math.hypot(c.x - rc.x, c.z - rc.z) <= NET.interestRadius,
        );
        if (!nearby.length) continue;
        this.send(rc, { t: 'snapshot', ts: now, players: nearby.map((c) => ({ id: c.charId, p: [c.x, c.y, c.z] as Vec3, r: c.rot, a: c.anim })) });
      }
    }
  }

  private worldTick() {
    const now = clock.now();
    const forced = this.d.seasons.multipliers().forceWeather;
    let changed = false;
    if (forced && this.weather !== forced) {
      this.weather = forced;
      changed = true;
    } else if (!forced && now >= this.nextWeatherAt) {
      const next = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
      changed = next !== this.weather;
      this.weather = next;
      this.nextWeatherAt = now + (5 + Math.random() * 5) * 60_000;
    }
    for (const shard of this.shards.values()) {
      if (changed || now % 30_000 < 10_000) this.broadcast(shard, { t: 'world', world: this.worldState(shard.id) });
    }
    for (const p of this.parties.sweep()) this.pushParty(p.id, p);
  }

  private saveAll() {
    for (const c of this.conns.values()) this.d.accounts.savePosition(c.userId, c.x, c.y, c.z, c.rot);
  }

  private heartbeat() {
    for (const c of this.conns.values()) {
      if (!c.alive) {
        c.ws.terminate();
        continue;
      }
      c.alive = false;
      try {
        c.ws.ping();
      } catch {
        /* ignorar */
      }
    }
  }

  // ------------------------------------------------------------------ bus

  private wireBus() {
    const b = this.d.bus;
    b.on('wallet.changed', ({ userId }) => {
      const c = this.conns.get(userId);
      if (c) this.send(c, { t: 'wallet', wallet: this.d.economy.balances(userId) });
    });
    b.on('inventory.changed', ({ userId }) => {
      const c = this.conns.get(userId);
      if (c) this.send(c, { t: 'inventory_changed' });
    });
    b.on('missions.changed', ({ userId }) => this.queueMissions(userId));
    b.on('appearance.changed', ({ userId }) => {
      const c = this.conns.get(userId);
      const ch = this.d.accounts.character(userId);
      if (c && ch) {
        c.appearance = this.d.accounts.appearanceOf(ch);
        this.broadcastPlayerUpdate(c);
      }
    });
    b.on('notice', ({ userId, level, text }) => {
      const c = this.conns.get(userId);
      if (c) this.send(c, { t: 'notice', level, text });
    });
    b.on('user.status', ({ userId, status, reason }) => {
      const c = this.conns.get(userId);
      if (c && status !== 'active') {
        this.send(c, { t: 'kicked', reason: `Tu cuenta fue ${status === 'banned' ? 'bloqueada' : 'suspendida'}${reason ? ': ' + reason : ''}.` });
        c.ws.close(4006, 'status');
      }
    });
    b.on('world.refresh', () => {
      for (const c of this.conns.values()) this.queueMissions(c.userId);
    });
  }

  private queueMissions(userId: string) {
    if (this.pendingMissionPush.has(userId)) return;
    this.pendingMissionPush.add(userId);
    setImmediate(() => {
      this.pendingMissionPush.delete(userId);
      const c = this.conns.get(userId);
      if (c) this.send(c, { t: 'missions', missions: this.d.missions.payload(userId) });
    });
  }

  private broadcastPlayerUpdate(conn: Conn) {
    const shard = this.shards.get(conn.shardId);
    if (shard) this.broadcast(shard, { t: 'player_update', player: this.publicOf(conn) });
  }

  private broadcast(shard: Shard, msg: ServerMsg, exceptUserId?: string) {
    const data = JSON.stringify(msg);
    for (const c of shard.players.values()) {
      if (c.userId !== exceptUserId && c.ws.readyState === WebSocket.OPEN) c.ws.send(data);
    }
  }

  private send(conn: Conn, msg: ServerMsg) {
    if (conn.ws.readyState === WebSocket.OPEN) conn.ws.send(JSON.stringify(msg));
  }

  /** Para el panel admin: expulsar a un jugador conectado. */
  kick(userId: string, reason: string) {
    const c = this.conns.get(userId);
    if (!c) return false;
    this.send(c, { t: 'kicked', reason });
    c.ws.close(4007, 'kicked');
    return true;
  }
}
