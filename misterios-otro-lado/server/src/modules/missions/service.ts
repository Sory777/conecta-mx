import { randomInt } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Db } from '../../db/database';
import { json } from '../../db/database';
import type { Bus } from '../../lib/bus';
import { clock } from '../../lib/clock';
import { badRequest, notFound } from '../../lib/errors';
import type { Logger } from '../../lib/logger';
import { newId } from '../../lib/ids';
import { normalizeAnswer } from '../../lib/sanitize';
import { INTERACT, isNightTime, SOCIAL, worldTimeOfDay } from '../../../../shared/constants';
import type {
  ClueView,
  DialogueLine,
  EntityView,
  MissionsPayload,
  MissionView,
  NpcView,
  PuzzlePrompt,
  RewardSummary,
  Vec3,
} from '../../../../shared/protocol';
import { regionOf } from '../../../../shared/world';
import type { AnalyticsService } from '../analytics/service';
import type { AntiFraudService } from '../antifraud/service';
import type { EconomyConfigService } from '../economy/config';
import type { Economy } from '../economy/ledger';
import type { ItemCatalog } from '../inventory/catalog';
import type { InventoryService } from '../inventory/service';
import type { RewardsService } from '../rewards/service';
import type { SeasonService } from '../seasons/service';
import { type Action, type Condition, type EpisodeDef, EpisodeSchema, referencedItems } from './schema';

export type MissionStatus = 'locked' | 'available' | 'active' | 'completed';

interface ProgressRow {
  exists: boolean;
  status: 'active' | 'completed' | null;
  stageId: string | null;
  flags: Set<string>;
  completions: number;
  dirty: boolean;
}

export interface PlayerPos {
  x: number;
  z: number;
}

export interface CoopPeer {
  userId: string;
  name: string;
  x: number;
  z: number;
}

export interface CompletedInfo {
  missionId: string;
  title: string;
  first: boolean;
  rewards: RewardSummary;
}

export interface InteractOutcome {
  ok: boolean;
  missionId: string | null;
  messages: string[];
  dialogue: DialogueLine[];
  puzzle: PuzzlePrompt | null;
  discovered: { clues: string[]; items: string[] };
  teleport: { p: Vec3; rotY: number } | null;
  completed: CompletedInfo[];
  /** Otros jugadores cuyo progreso cambió (cooperación) */
  affectedUsers: { userId: string; completed: CompletedInfo | null }[];
}

interface Target {
  missionId: string;
  kind: 'entity' | 'npc';
  id: string;
  p: Vec3;
  radius: number;
}

const NPC_RADIUS = 2.8;

function emptyOutcome(missionId: string | null): InteractOutcome {
  return {
    ok: true,
    missionId,
    messages: [],
    dialogue: [],
    puzzle: null,
    discovered: { clues: [], items: [] },
    teleport: null,
    completed: [],
    affectedUsers: [],
  };
}

/**
 * Motor de misterios dirigido por datos.
 * El cliente sólo dice "quiero interactuar con X" o "mi respuesta es Y": el servidor comprueba
 * distancia, región, etapa, condiciones y aplica acciones/recompensas de forma atómica.
 */
export class MissionService {
  private defs = new Map<string, EpisodeDef>();
  private enabled = new Set<string>();
  private targets = new Map<string, Target>();
  private puzzles = new Map<string, { missionId: string; puzzle: EpisodeDef['puzzles'][number] }>();

  constructor(
    private readonly db: Db,
    private readonly bus: Bus,
    private readonly log: Logger,
    private readonly catalog: ItemCatalog,
    private readonly inventory: InventoryService,
    private readonly economy: Economy,
    private readonly ecoCfg: EconomyConfigService,
    private readonly rewards: RewardsService,
    private readonly seasons: SeasonService,
    private readonly analytics: AnalyticsService,
    private readonly antifraud: AntiFraudService,
  ) {}

  // ------------------------------------------------------------------ carga de contenido

  validate(raw: unknown): EpisodeDef {
    const parsed = EpisodeSchema.safeParse(raw);
    if (!parsed.success) {
      throw badRequest('invalid_episode', 'Episodio inválido', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
    }
    const ep = parsed.data;
    for (const itemId of referencedItems(ep)) {
      if (!this.catalog.get(itemId)) throw badRequest('invalid_episode', `Objeto desconocido en el episodio: ${itemId}`);
    }
    for (const pre of ep.prerequisites) {
      if (pre === ep.id) throw badRequest('invalid_episode', 'Un episodio no puede requerirse a sí mismo.');
    }
    // Ids de entidades/NPC únicos entre episodios (evita colisiones en el mundo compartido)
    for (const id of [...ep.entities.map((e) => e.id), ...ep.npcs.map((n) => n.id)]) {
      const t = this.targets.get(id);
      if (t && t.missionId !== ep.id) throw badRequest('invalid_episode', `El id ${id} ya lo usa el episodio ${t.missionId}`);
    }
    for (const p of ep.puzzles) {
      const other = this.puzzles.get(p.id);
      if (other && other.missionId !== ep.id) throw badRequest('invalid_episode', `El acertijo ${p.id} ya existe en ${other.missionId}`);
    }
    for (const c of ep.clues) {
      const owner = this.db.get<{ mission_id: string }>('SELECT mission_id FROM clues WHERE id = ?', c.id);
      if (owner && owner.mission_id !== ep.id) throw badRequest('invalid_episode', `La pista ${c.id} ya existe en ${owner.mission_id}`);
    }
    return ep;
  }

  loadFromDir(dir: string) {
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
    } catch {
      this.log.warn('no episodes dir', { dir });
    }
    this.reload();
    for (const f of files) {
      const raw = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
      const ep = this.validate(raw);
      const row = this.db.get<{ version: number }>('SELECT version FROM missions WHERE id = ?', ep.id);
      if (!row || row.version < ep.version) {
        this.store(ep, 'file');
        this.log.info('episode loaded', { id: ep.id, version: ep.version });
      }
      this.reload();
    }
  }

  private store(ep: EpisodeDef, source: 'file' | 'admin') {
    const now = clock.now();
    this.db.tx(() => {
      this.db.run(
        `INSERT INTO missions(id, title, version, sort_order, enabled, season_id, content, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title, version = excluded.version, sort_order = excluded.sort_order,
         season_id = excluded.season_id, content = excluded.content, source = excluded.source, updated_at = excluded.updated_at`,
        ep.id,
        ep.title,
        ep.version,
        ep.order,
        ep.enabled ? 1 : 0,
        ep.seasonId,
        json.str(ep),
        source,
        now,
        now,
      );
      for (const c of ep.clues) {
        this.db.run(
          `INSERT INTO clues(id, mission_id, title, text, shareable) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET title = excluded.title, text = excluded.text, shareable = excluded.shareable`,
          c.id,
          ep.id,
          c.title,
          c.text,
          c.shareable ? 1 : 0,
        );
      }
    });
  }

  /** Alta/actualización desde el panel de administración. */
  upsertFromAdmin(raw: unknown): EpisodeDef {
    const ep = this.validate(raw);
    const row = this.db.get<{ version: number }>('SELECT version FROM missions WHERE id = ?', ep.id);
    if (row && ep.version <= row.version) ep.version = row.version + 1;
    this.store(ep, 'admin');
    this.reload();
    this.bus.emit('world.refresh', {});
    return ep;
  }

  setEnabled(id: string, enabled: boolean) {
    const r = this.db.run('UPDATE missions SET enabled = ?, updated_at = ? WHERE id = ?', enabled ? 1 : 0, clock.now(), id);
    if (!r.changes) throw notFound('Misión no encontrada');
    this.reload();
    this.bus.emit('world.refresh', {});
  }

  reload() {
    this.defs.clear();
    this.enabled.clear();
    this.targets.clear();
    this.puzzles.clear();
    const rows = this.db.all<{ id: string; content: string; enabled: number }>('SELECT id, content, enabled FROM missions ORDER BY sort_order, id');
    for (const r of rows) {
      const parsed = EpisodeSchema.safeParse(JSON.parse(r.content));
      if (!parsed.success) {
        this.log.error('stored episode invalid', { id: r.id });
        continue;
      }
      const ep = parsed.data;
      this.defs.set(ep.id, ep);
      if (!r.enabled) continue;
      this.enabled.add(ep.id);
      for (const e of ep.entities) this.targets.set(e.id, { missionId: ep.id, kind: 'entity', id: e.id, p: e.p, radius: e.radius });
      for (const n of ep.npcs) this.targets.set(n.id, { missionId: ep.id, kind: 'npc', id: n.id, p: n.p, radius: NPC_RADIUS });
      for (const p of ep.puzzles) this.puzzles.set(p.id, { missionId: ep.id, puzzle: p });
    }
  }

  list() {
    return this.db.all<{ id: string; title: string; version: number; enabled: number; season_id: string | null; source: string; updated_at: number }>(
      'SELECT id, title, version, enabled, season_id, source, updated_at FROM missions ORDER BY sort_order, id',
    );
  }

  getDef(id: string): EpisodeDef | undefined {
    return this.defs.get(id);
  }

  // ------------------------------------------------------------------ estado

  private loadRow(userId: string, missionId: string): ProgressRow {
    const r = this.db.get<{ status: 'active' | 'completed'; stage_id: string | null; flags: string; completions: number }>(
      'SELECT status, stage_id, flags, completions FROM mission_progress WHERE user_id = ? AND mission_id = ?',
      userId,
      missionId,
    );
    if (!r) return { exists: false, status: null, stageId: null, flags: new Set(), completions: 0, dirty: false };
    return { exists: true, status: r.status, stageId: r.stage_id, flags: new Set(json.parse<string[]>(r.flags, [])), completions: r.completions, dirty: false };
  }

  private saveRow(userId: string, missionId: string, row: ProgressRow) {
    if (!row.dirty || !row.status) return;
    const now = clock.now();
    this.db.run(
      `INSERT INTO mission_progress(user_id, mission_id, status, stage_id, flags, started_at, updated_at, completed_at, completions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, mission_id) DO UPDATE SET status = excluded.status, stage_id = excluded.stage_id, flags = excluded.flags,
       updated_at = excluded.updated_at, completed_at = COALESCE(excluded.completed_at, mission_progress.completed_at), completions = excluded.completions`,
      userId,
      missionId,
      row.status,
      row.stageId,
      json.str([...row.flags]),
      now,
      now,
      row.status === 'completed' ? now : null,
      row.completions,
    );
    row.exists = true;
    row.dirty = false;
  }

  private statusOf(userId: string, ep: EpisodeDef, row: ProgressRow): { status: MissionStatus; lockedReason?: string } {
    if (row.status) return { status: row.status };
    if (ep.seasonId && !this.seasons.isActive(ep.seasonId)) return { status: 'locked', lockedReason: 'Disponible sólo durante su temporada.' };
    const now = clock.now();
    if (ep.availability.startsAt && Date.parse(ep.availability.startsAt) > now) return { status: 'locked', lockedReason: 'Todavía no está disponible.' };
    if (ep.availability.endsAt && Date.parse(ep.availability.endsAt) < now) return { status: 'locked', lockedReason: 'Este misterio ya no está disponible.' };
    for (const pre of ep.prerequisites) {
      const done = this.db.get<{ completions: number }>('SELECT completions FROM mission_progress WHERE user_id = ? AND mission_id = ?', userId, pre);
      if (!done || done.completions < 1) {
        const t = this.defs.get(pre)?.title ?? pre;
        return { status: 'locked', lockedReason: `Primero resuelve «${t}».` };
      }
    }
    return { status: 'available' };
  }

  private makeEval(userId: string, status: MissionStatus, row: ProgressRow, cache: { items?: Set<string>; clues?: Set<string> }) {
    const items = () => (cache.items ??= this.inventory.ownedItemIds(userId));
    const clues = () =>
      (cache.clues ??= new Set(this.db.all<{ clue_id: string }>('SELECT clue_id FROM player_clues WHERE user_id = ?', userId).map((r) => r.clue_id)));
    const night = isNightTime(worldTimeOfDay(clock.now()));
    return (c: Condition): boolean => {
      if ('stage' in c) return status === 'active' && row.stageId === c.stage;
      if ('stageIn' in c) return status === 'active' && !!row.stageId && c.stageIn.includes(row.stageId);
      if ('hasItem' in c) return items().has(c.hasItem);
      if ('notHasItem' in c) return !items().has(c.notHasItem);
      if ('hasClue' in c) return clues().has(c.hasClue);
      if ('notHasClue' in c) return !clues().has(c.notHasClue);
      if ('flag' in c) return row.flags.has(c.flag);
      if ('notFlag' in c) return !row.flags.has(c.notFlag);
      if ('night' in c) return night === c.night;
      if ('status' in c) return status === c.status;
      return false;
    };
  }

  private targetPos(ep: EpisodeDef, id: string): Vec3 | null {
    return ep.entities.find((e) => e.id === id)?.p ?? ep.npcs.find((n) => n.id === id)?.p ?? null;
  }

  // ------------------------------------------------------------------ vista para el cliente

  payload(userId: string): MissionsPayload {
    const missions: MissionView[] = [];
    const entities: EntityView[] = [];
    const npcs: NpcView[] = [];
    const eco = this.ecoCfg.get();
    const mult = this.seasons.multipliers();
    const cache: { items?: Set<string>; clues?: Set<string> } = {};

    for (const id of this.enabled) {
      const ep = this.defs.get(id)!;
      const row = this.loadRow(userId, id);
      const { status, lockedReason } = this.statusOf(userId, ep, row);
      const ev = this.makeEval(userId, status, row, cache);
      const stageIdx = row.stageId ? ep.stages.findIndex((s) => s.id === row.stageId) : -1;
      const stage = stageIdx >= 0 ? ep.stages[stageIdx] : null;
      let objective = '';
      let hint = '';
      let marker: Vec3 | null = null;
      if (status === 'available') {
        objective = ep.start.objective;
        hint = ep.start.hint;
        marker = this.targetPos(ep, ep.start.target);
      } else if (status === 'active' && stage) {
        objective = stage.objective;
        hint = stage.hint;
        marker = typeof stage.marker === 'string' ? this.targetPos(ep, stage.marker) : stage.marker;
      } else if (status === 'completed') {
        objective = 'Misterio resuelto.';
        hint = ep.repeatable ? 'Puedes volver a investigarlo desde el diario (recompensa reducida).' : '';
      } else {
        objective = lockedReason ?? 'Bloqueado';
      }
      const first = row.completions === 0;
      missions.push({
        id: ep.id,
        title: ep.title,
        synopsis: ep.synopsis,
        status,
        lockedReason,
        stageId: row.stageId,
        stageIndex: Math.max(0, stageIdx),
        stageCount: ep.stages.length,
        objective,
        hint,
        marker,
        locationLabel: ep.location.label,
        rewardsPreview: {
          coins: Math.round(ep.rewards.coins * eco.missions.coinMultiplier * mult.coinMult * (first ? 1 : eco.missions.repeatCoinFactor)),
          rp: first ? Math.round(ep.rewards.rp * eco.missions.rpMultiplier) : 0,
          xp: Math.round(ep.rewards.xp * eco.missions.xpMultiplier * mult.xpMult * (first ? 1 : 0.25)),
          items: first ? ep.rewards.items.map((i) => this.catalog.get(i.itemId)?.name ?? i.itemId) : [],
        },
        seasonId: ep.seasonId,
      });
      const canHighlight = status === 'active' || status === 'available';
      for (const e of ep.entities) {
        entities.push({
          id: e.id,
          kind: e.kind,
          label: e.label,
          model: e.model,
          p: e.p,
          radius: e.radius,
          rotY: e.rotY,
          visible: e.visibleWhen.every(ev),
          blocking: e.blockingWhen ? e.blockingWhen.every(ev) : false,
          blockSize: e.blockSize,
          highlight: canHighlight && e.highlightWhen.length > 0 && e.highlightWhen.every(ev),
        });
      }
      for (const n of ep.npcs) npcs.push({ id: n.id, name: n.name, p: n.p, rotY: n.rotY, appearance: n.appearance });
    }

    const clues: ClueView[] = this.db
      .all<{ id: string; mission_id: string; title: string; text: string; shareable: number; source: 'found' | 'shared'; shared_by_name: string | null }>(
        `SELECT c.id, c.mission_id, c.title, c.text, c.shareable, pc.source, u.username AS shared_by_name
         FROM player_clues pc JOIN clues c ON c.id = pc.clue_id LEFT JOIN users u ON u.id = pc.shared_by
         WHERE pc.user_id = ? ORDER BY pc.acquired_at`,
        userId,
      )
      .map((c) => ({ id: c.id, missionId: c.mission_id, title: c.title, text: c.text, shareable: !!c.shareable, source: c.source, sharedBy: c.shared_by_name }));

    const tracked = this.db.get<{ tracked_mission_id: string | null }>('SELECT tracked_mission_id FROM characters WHERE user_id = ?', userId)?.tracked_mission_id;
    let trackedId = tracked && missions.find((m) => m.id === tracked && (m.status === 'active' || m.status === 'available')) ? tracked : null;
    trackedId ??= missions.find((m) => m.status === 'active')?.id ?? missions.find((m) => m.status === 'available')?.id ?? null;
    return { missions, trackedId, entities, npcs, clues };
  }

  track(userId: string, missionId: string) {
    if (!this.enabled.has(missionId)) throw notFound('Misterio no encontrado');
    this.db.run('UPDATE characters SET tracked_mission_id = ? WHERE user_id = ?', missionId, userId);
  }

  // ------------------------------------------------------------------ interacción

  interact(userId: string, pos: PlayerPos, targetId: string, peers: CoopPeer[] = []): InteractOutcome {
    const target = this.targets.get(targetId);
    if (!target) return { ...emptyOutcome(null), ok: false, messages: ['No hay nada ahí.'] };
    const check = this.checkProximity(userId, pos, target.p, target.radius, targetId);
    if (check) return { ...emptyOutcome(target.missionId), ok: false, messages: [check] };

    const ep = this.defs.get(target.missionId)!;
    return this.db.tx(() => {
      const out = emptyOutcome(ep.id);
      const row = this.loadRow(userId, ep.id);
      const { status, lockedReason } = this.statusOf(userId, ep, row);
      const ev = this.makeEval(userId, status, row, {});
      if (target.kind === 'entity') {
        const ent = ep.entities.find((e) => e.id === targetId)!;
        if (!ent.visibleWhen.every(ev)) return { ...out, ok: false, messages: ['No hay nada ahí.'] };
      }
      if (status === 'locked') {
        out.messages.push(lockedReason ?? 'Todavía no puedes investigar esto.');
        return out;
      }
      const rule = ep.interactions.find(
        (r) => r.target === targetId && (r.whenStatus === 'any' || r.whenStatus === status) && r.when.every(ev),
      );
      if (!rule) {
        const ent = ep.entities.find((e) => e.id === targetId);
        out.messages.push(ent?.idleText ?? 'No encuentras nada más aquí.');
        return out;
      }
      this.runActions(userId, ep, row, rule.do, out, null);
      this.saveRow(userId, ep.id, row);
      if (rule.coop) this.replicate(userId, ep, rule.do, peers, pos, out);
      this.afterChange(userId, out);
      return out;
    });
  }

  solve(userId: string, pos: PlayerPos, puzzleId: string, answer: string, peers: CoopPeer[] = []): { ok: boolean; message: string; outcome: InteractOutcome | null } {
    const found = this.puzzles.get(puzzleId);
    if (!found) return { ok: false, message: 'Acertijo desconocido.', outcome: null };
    const ep = this.defs.get(found.missionId)!;
    const pz = found.puzzle;
    const ent = ep.entities.find((e) => e.id === pz.entityId);
    const tp = ent?.p ?? this.targetPos(ep, pz.entityId)!;
    const check = this.checkProximity(userId, pos, tp, ent?.radius ?? NPC_RADIUS, pz.entityId);
    if (check) return { ok: false, message: check, outcome: null };

    return this.db.tx(() => {
      const row = this.loadRow(userId, ep.id);
      const { status } = this.statusOf(userId, ep, row);
      const ev = this.makeEval(userId, status, row, {});
      if (status !== 'active' || !pz.requires.every(ev)) return { ok: false, message: 'Ahora mismo no ocurre nada.', outcome: null };
      const now = clock.now();
      const recent = this.db.get<{ n: number }>(
        'SELECT COUNT(*) AS n FROM puzzle_attempts WHERE user_id = ? AND puzzle_id = ? AND created_at > ?',
        userId,
        pz.id,
        now - 60_000,
      )!.n;
      if (recent >= pz.maxAttemptsPerMinute) {
        return { ok: false, message: 'El mecanismo se ha trabado. Espera un minuto antes de volver a intentarlo.', outcome: null };
      }
      const clean = normalizeAnswer(answer.slice(0, 40));
      const correct = pz.answers.some((a) => normalizeAnswer(a) === clean);
      this.db.run(
        'INSERT INTO puzzle_attempts(id, user_id, puzzle_id, mission_id, correct, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        newId(),
        userId,
        pz.id,
        ep.id,
        correct ? 1 : 0,
        now,
      );
      if (!correct) {
        const lastHour = this.db.get<{ n: number }>(
          'SELECT COUNT(*) AS n FROM puzzle_attempts WHERE user_id = ? AND created_at > ? AND correct = 0',
          userId,
          now - 3_600_000,
        )!.n;
        if (lastHour === 60) this.antifraud.flag(userId, 'puzzle_bruteforce', 5, { puzzleId: pz.id });
        return { ok: false, message: 'No ocurre nada. No parece ser la respuesta correcta.', outcome: null };
      }
      const out = emptyOutcome(ep.id);
      this.runActions(userId, ep, row, pz.onSolve, out, null);
      this.saveRow(userId, ep.id, row);
      if (pz.coop) this.replicate(userId, ep, pz.onSolve, peers, pos, out);
      this.afterChange(userId, out);
      this.analytics.track('puzzle_solved', userId, { missionId: ep.id, puzzleId: pz.id });
      return { ok: true, message: '¡Correcto!', outcome: out };
    });
  }

  private checkProximity(userId: string, pos: PlayerPos, tp: Vec3, radius: number, targetId: string): string | null {
    const regionPlayer = regionOf(pos.x, pos.z);
    const regionTarget = regionOf(tp[0], tp[2]);
    const dist = Math.hypot(pos.x - tp[0], pos.z - tp[2]);
    if (regionPlayer !== regionTarget || dist > radius + INTERACT.serverTolerance) {
      if (dist > 40) this.antifraud.flag(userId, 'interact_out_of_range', 1, { targetId, dist: Math.round(dist) });
      return 'Estás demasiado lejos.';
    }
    return null;
  }

  private runActions(userId: string, ep: EpisodeDef, row: ProgressRow, actions: Action[], out: InteractOutcome, sharedBy: string | null) {
    const runNo = row.completions;
    for (const a of actions) {
      if ('start' in a) {
        if (row.status) continue;
        row.status = 'active';
        row.stageId = ep.stages[0].id;
        row.flags = new Set();
        row.dirty = true;
        this.analytics.track('mission_started', userId, { missionId: ep.id });
      } else if ('dialogue' in a) {
        out.dialogue.push(...a.dialogue);
      } else if ('message' in a) {
        out.messages.push(a.message);
      } else if ('giveItem' in a) {
        const def = this.catalog.require(a.giveItem);
        if (def.category === 'quest' && !def.stackable && this.inventory.owns(userId, def.id)) continue;
        const tx = this.economy.apply({
          userId,
          type: 'reward',
          idempotencyKey: `mission_item:${ep.id}:${userId}:${runNo}:${a.giveItem}`,
          details: { missionId: ep.id },
          grantItems: [{ itemId: a.giveItem, qty: a.qty ?? 1 }],
          source: `mission:${ep.id}`,
        });
        if (!tx.duplicate) out.discovered.items.push(def.name);
      } else if ('takeItem' in a) {
        if (this.inventory.owns(userId, a.takeItem)) {
          this.economy.apply({
            userId,
            type: 'mission_use',
            idempotencyKey: `mission_take:${ep.id}:${userId}:${runNo}:${a.takeItem}`,
            details: { missionId: ep.id },
            revokeItems: [{ itemId: a.takeItem, qty: 1 }],
          });
        }
      } else if ('giveClue' in a) {
        const r = this.db.run(
          'INSERT OR IGNORE INTO player_clues(user_id, clue_id, source, shared_by, acquired_at) VALUES (?, ?, ?, ?, ?)',
          userId,
          a.giveClue,
          sharedBy ? 'shared' : 'found',
          sharedBy,
          clock.now(),
        );
        if (r.changes) {
          out.discovered.clues.push(ep.clues.find((c) => c.id === a.giveClue)?.title ?? a.giveClue);
          this.analytics.track('clue_found', userId, { missionId: ep.id, clueId: a.giveClue, shared: !!sharedBy });
        }
      } else if ('setFlag' in a) {
        row.flags.add(a.setFlag);
        row.dirty = true;
      } else if ('clearFlag' in a) {
        row.flags.delete(a.clearFlag);
        row.dirty = true;
      } else if ('setStage' in a) {
        if (row.status !== 'active') continue;
        row.stageId = a.setStage;
        row.dirty = true;
        this.analytics.track('mission_stage', userId, { missionId: ep.id, stageId: a.setStage });
      } else if ('teleport' in a) {
        out.teleport = { p: a.teleport, rotY: a.rotY ?? 0 };
      } else if ('openPuzzle' in a) {
        const pz = ep.puzzles.find((p) => p.id === a.openPuzzle)!;
        out.puzzle = { id: pz.id, missionId: ep.id, title: pz.title, prompt: pz.prompt, inputHint: pz.inputHint };
      } else if ('complete' in a) {
        if (row.status !== 'active') continue;
        const { rewards, first } = this.complete(userId, ep, row, sharedBy !== null);
        out.completed.push({ missionId: ep.id, title: ep.title, first, rewards });
      }
    }
  }

  /** Cooperación: replica el avance (no los objetos) a compañeros de grupo cercanos. */
  private replicate(actorId: string, ep: EpisodeDef, actions: Action[], peers: CoopPeer[], pos: PlayerPos, out: InteractOutcome) {
    const replicable = actions.filter((a) => 'giveClue' in a || 'setFlag' in a || 'setStage' in a || 'complete' in a);
    if (!replicable.length) return;
    for (const peer of peers) {
      if (peer.userId === actorId) continue;
      if (regionOf(peer.x, peer.z) !== regionOf(pos.x, pos.z) || Math.hypot(peer.x - pos.x, peer.z - pos.z) > SOCIAL.coopShareRadius) continue;
      if (this.antifraud.sharesDevice(actorId, peer.userId)) {
        this.antifraud.flag(actorId, 'coop_same_device', 2, { peer: peer.userId, missionId: ep.id });
        continue;
      }
      const row = this.loadRow(peer.userId, ep.id);
      if (row.status !== 'active') continue;
      const curIdx = ep.stages.findIndex((s) => s.id === row.stageId);
      const peerOut = emptyOutcome(ep.id);
      const filtered = replicable.filter((a) => !('setStage' in a) || ep.stages.findIndex((s) => s.id === a.setStage) > curIdx);
      this.runActions(peer.userId, ep, row, filtered, peerOut, actorId);
      this.saveRow(peer.userId, ep.id, row);
      out.affectedUsers.push({ userId: peer.userId, completed: peerOut.completed[0] ?? null });
      this.afterChange(peer.userId, peerOut);
    }
  }

  private afterChange(userId: string, out: InteractOutcome) {
    this.db.onCommit(() => this.bus.emit('missions.changed', { userId }));
    for (const c of out.completed) {
      this.db.onCommit(() => this.bus.emit('mission.completed', { userId, missionId: c.missionId, firstTime: c.first, rewards: c.rewards }));
    }
  }

  // ------------------------------------------------------------------ recompensas

  private rollDrop(table: string | null): string | null {
    if (!table) return null;
    const entries = this.ecoCfg.get().dropTables[table];
    if (!entries?.length) return null;
    const total = entries.reduce((s, e) => s + e.weight, 0);
    if (total <= 0) return null;
    // Aleatoriedad del SERVIDOR (crypto). Nunca del cliente.
    let r = randomInt(0, 1_000_000) / 1_000_000 * total;
    for (const e of entries) {
      r -= e.weight;
      if (r < 0) return this.catalog.get(e.itemId) ? e.itemId : null;
    }
    return null;
  }

  private complete(userId: string, ep: EpisodeDef, row: ProgressRow, viaCoop: boolean): { rewards: RewardSummary; first: boolean } {
    const eco = this.ecoCfg.get();
    const mult = this.seasons.multipliers();
    const first = row.completions === 0;
    row.status = 'completed';
    row.completions += 1;
    row.dirty = true;
    const runNo = row.completions;
    const notes: string[] = first ? [] : ['Repetición: recompensa reducida y sin puntos de recompensa.'];

    const coopBonus = viaCoop ? 1 + eco.missions.coopBonusPct / 100 : 1;
    const coins = Math.round(ep.rewards.coins * eco.missions.coinMultiplier * mult.coinMult * (first ? 1 : eco.missions.repeatCoinFactor) * coopBonus);
    const xp = Math.round(ep.rewards.xp * eco.missions.xpMultiplier * mult.xpMult * (first ? 1 : 0.25));
    const items = first ? [...ep.rewards.items] : [];
    const drop = first ? this.rollDrop(ep.rewards.dropTable) : null;
    if (drop) items.push({ itemId: drop, qty: 1 });

    this.economy.apply({
      userId,
      type: 'reward',
      idempotencyKey: `mission_reward:${ep.id}:${userId}:${runNo}`,
      details: { missionId: ep.id, run: runNo, coop: viaCoop },
      currency: coins > 0 ? [{ code: 'coins', delta: coins, reason: 'mission_complete' }] : [],
      grantItems: items,
      source: `mission:${ep.id}`,
    });

    let rp = 0;
    if (first) {
      const g = this.rewards.grant(userId, Math.round(ep.rewards.rp * eco.missions.rpMultiplier), 'mission_complete', `mission_rp:${ep.id}:${userId}`, {
        missionId: ep.id,
      });
      rp = g.granted;
      if (g.note) notes.push(g.note);
    }

    const u = this.db.get<{ xp: number }>('SELECT xp FROM users WHERE id = ?', userId)!;
    const newXp = u.xp + xp;
    this.db.run('UPDATE users SET xp = ?, level = ? WHERE id = ?', newXp, Math.floor(Math.sqrt(newXp / 100)) + 1, userId);
    const seasonXp = this.seasons.addXp(userId, first ? ep.rewards.seasonXp : Math.round(ep.rewards.seasonXp * 0.25));

    this.analytics.track('mission_completed', userId, { missionId: ep.id, first, coop: viaCoop, coins, rp, xp });
    if (viaCoop) notes.push(`Bonificación cooperativa +${eco.missions.coopBonusPct}% monedas`);
    const rewards: RewardSummary = {
      coins,
      rp,
      xp,
      seasonXp,
      items: items.map((i) => {
        const d = this.catalog.require(i.itemId);
        return { itemId: d.id, name: d.name, rarity: d.rarity };
      }),
      notes,
    };
    return { rewards, first };
  }

  restart(userId: string, missionId: string) {
    const ep = this.defs.get(missionId);
    if (!ep || !this.enabled.has(missionId)) throw notFound('Misterio no encontrado');
    if (!ep.repeatable) throw badRequest('not_repeatable', 'Este misterio no se puede repetir.');
    const row = this.loadRow(userId, missionId);
    if (row.status !== 'completed') throw badRequest('not_completed', 'Sólo puedes repetir misterios completados.');
    row.status = 'active';
    row.stageId = ep.stages[0].id;
    row.flags = new Set();
    row.dirty = true;
    this.saveRow(userId, missionId, row);
    this.analytics.track('mission_restarted', userId, { missionId });
    this.bus.emit('missions.changed', { userId });
  }

  // ------------------------------------------------------------------ pistas compartidas

  shareClue(userId: string, clueId: string, memberIds: string[]): string[] {
    const clue = this.db.get<{ id: string; shareable: number; title: string }>(
      'SELECT c.id, c.shareable, c.title FROM player_clues pc JOIN clues c ON c.id = pc.clue_id WHERE pc.user_id = ? AND pc.clue_id = ?',
      userId,
      clueId,
    );
    if (!clue) throw badRequest('clue_not_owned', 'No tienes esa pista.');
    if (!clue.shareable) throw badRequest('clue_not_shareable', 'Esta pista no se puede compartir.');
    const received: string[] = [];
    this.db.tx(() => {
      for (const m of memberIds) {
        if (m === userId) continue;
        const r = this.db.run(
          "INSERT OR IGNORE INTO player_clues(user_id, clue_id, source, shared_by, acquired_at) VALUES (?, ?, 'shared', ?, ?)",
          m,
          clueId,
          userId,
          clock.now(),
        );
        if (r.changes) {
          received.push(m);
          this.db.onCommit(() => this.bus.emit('missions.changed', { userId: m }));
        }
      }
    });
    this.analytics.track('clue_shared', userId, { clueId, recipients: received.length });
    return received;
  }
}
