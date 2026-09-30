import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Db } from '../../db/database';
import { json } from '../../db/database';
import { clock } from '../../lib/clock';
import { badRequest, notFound } from '../../lib/errors';
import type { Economy } from '../economy/ledger';
import type { ItemCatalog } from '../inventory/catalog';

const RewardSchema = z.object({
  coins: z.number().int().min(0).max(100_000).optional(),
  items: z.array(z.object({ itemId: z.string(), qty: z.number().int().min(1).max(100) })).optional(),
});
export type TierReward = z.infer<typeof RewardSchema>;

export const EventSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{3,40}$/),
  name: z.string().min(1).max(80),
  description: z.string().max(400),
  type: z.enum(['multiplier', 'world', 'sponsored', 'community']),
  startsAt: z.string(),
  endsAt: z.string(),
  config: z
    .object({
      coinMult: z.number().min(0).max(5).optional(),
      xpMult: z.number().min(0).max(5).optional(),
      seasonXpMult: z.number().min(0).max(5).optional(),
      forceWeather: z.enum(['clear', 'fog', 'rain', 'storm']).optional(),
    })
    .default({}),
  enabled: z.boolean().optional(),
});

export const SeasonSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{2,40}$/),
  name: z.string().min(1).max(80),
  description: z.string().max(500),
  startsAt: z.string(),
  endsAt: z.string(),
  premiumPriceGems: z.number().int().min(1).max(100_000),
  tiers: z
    .array(z.object({ tier: z.number().int().min(1).max(200), xp: z.number().int().min(0), free: RewardSchema, premium: RewardSchema }))
    .min(1),
  events: z.array(EventSchema).default([]),
});
export type SeasonDef = z.infer<typeof SeasonSchema>;

function ts(s: string): number {
  const n = Date.parse(s);
  if (Number.isNaN(n)) throw badRequest('invalid_date', `Fecha inválida: ${s}`);
  return n;
}

export interface Multipliers {
  coinMult: number;
  xpMult: number;
  seasonXpMult: number;
  forceWeather: 'clear' | 'fog' | 'rain' | 'storm' | null;
}

export class SeasonService {
  constructor(
    private readonly db: Db,
    private readonly economy: Economy,
    private readonly catalog: ItemCatalog,
  ) {}

  loadFromDir(dir: string) {
    let files: string[] = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    } catch {
      return;
    }
    for (const f of files) {
      const def = SeasonSchema.parse(JSON.parse(readFileSync(path.join(dir, f), 'utf8')));
      // No sobrescribir temporadas modificadas desde el panel: sólo se crean si no existen.
      if (!this.db.get('SELECT 1 FROM seasons WHERE id = ?', def.id)) this.upsert(def);
    }
  }

  upsert(def: SeasonDef) {
    const s = ts(def.startsAt);
    const e = ts(def.endsAt);
    if (e <= s) throw badRequest('invalid_dates', 'La fecha de fin debe ser posterior al inicio.');
    for (const t of def.tiers) {
      for (const r of [t.free, t.premium]) for (const it of r.items ?? []) this.catalog.require(it.itemId);
    }
    this.db.tx(() => {
      this.db.run(
        `INSERT INTO seasons(id, name, description, starts_at, ends_at, premium_price_gems, enabled) VALUES (?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, starts_at = excluded.starts_at,
         ends_at = excluded.ends_at, premium_price_gems = excluded.premium_price_gems`,
        def.id,
        def.name,
        def.description,
        s,
        e,
        def.premiumPriceGems,
      );
      this.db.run('DELETE FROM season_tiers WHERE season_id = ?', def.id);
      for (const t of def.tiers) {
        this.db.run(
          'INSERT INTO season_tiers(season_id, tier, xp_required, free_reward, premium_reward) VALUES (?, ?, ?, ?, ?)',
          def.id,
          t.tier,
          t.xp,
          json.str(t.free),
          json.str(t.premium),
        );
      }
      for (const ev of def.events) this.upsertEvent(ev, def.id);
    });
  }

  upsertEvent(ev: z.infer<typeof EventSchema>, seasonId: string | null) {
    const s = ts(ev.startsAt);
    const e = ts(ev.endsAt);
    if (e <= s) throw badRequest('invalid_dates', 'La fecha de fin debe ser posterior al inicio.');
    this.db.run(
      `INSERT INTO events(id, season_id, name, description, type, starts_at, ends_at, config, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET season_id = excluded.season_id, name = excluded.name, description = excluded.description,
       type = excluded.type, starts_at = excluded.starts_at, ends_at = excluded.ends_at, config = excluded.config, enabled = excluded.enabled`,
      ev.id,
      seasonId,
      ev.name,
      ev.description,
      ev.type,
      s,
      e,
      json.str(ev.config ?? {}),
      ev.enabled === false ? 0 : 1,
    );
  }

  current() {
    const now = clock.now();
    return this.db.get<{ id: string; name: string; description: string; starts_at: number; ends_at: number; premium_price_gems: number }>(
      'SELECT id, name, description, starts_at, ends_at, premium_price_gems FROM seasons WHERE enabled = 1 AND starts_at <= ? AND ends_at > ? ORDER BY starts_at DESC LIMIT 1',
      now,
      now,
    );
  }

  isActive(seasonId: string): boolean {
    const now = clock.now();
    return !!this.db.get('SELECT 1 FROM seasons WHERE id = ? AND enabled = 1 AND starts_at <= ? AND ends_at > ?', seasonId, now, now);
  }

  activeEvents() {
    const now = clock.now();
    return this.db
      .all<{ id: string; name: string; description: string; type: string; starts_at: number; ends_at: number; config: string; season_id: string | null }>(
        'SELECT id, name, description, type, starts_at, ends_at, config, season_id FROM events WHERE enabled = 1 AND starts_at <= ? AND ends_at > ? ORDER BY starts_at',
        now,
        now,
      )
      .map((e) => ({ ...e, config: json.parse<Record<string, unknown>>(e.config, {}) }));
  }

  multipliers(): Multipliers {
    const m: Multipliers = { coinMult: 1, xpMult: 1, seasonXpMult: 1, forceWeather: null };
    for (const e of this.activeEvents()) {
      const c = e.config as Partial<Multipliers>;
      if (c.coinMult) m.coinMult *= c.coinMult;
      if (c.xpMult) m.xpMult *= c.xpMult;
      if (c.seasonXpMult) m.seasonXpMult *= c.seasonXpMult;
      if (c.forceWeather) m.forceWeather = c.forceWeather;
    }
    // Tope de seguridad: los eventos no pueden multiplicar más de x3.
    m.coinMult = Math.min(m.coinMult, 3);
    m.xpMult = Math.min(m.xpMult, 3);
    m.seasonXpMult = Math.min(m.seasonXpMult, 3);
    return m;
  }

  private progressRow(userId: string, seasonId: string) {
    return this.db.get<{ xp: number; premium: number; claimed: string }>(
      'SELECT xp, premium, claimed FROM season_progress WHERE user_id = ? AND season_id = ?',
      userId,
      seasonId,
    );
  }

  addXp(userId: string, amount: number): number {
    const season = this.current();
    if (!season || amount <= 0) return 0;
    const xp = Math.round(amount * this.multipliers().seasonXpMult);
    this.db.run(
      `INSERT INTO season_progress(user_id, season_id, xp, premium, claimed, updated_at) VALUES (?, ?, ?, 0, '[]', ?)
       ON CONFLICT(user_id, season_id) DO UPDATE SET xp = xp + excluded.xp, updated_at = excluded.updated_at`,
      userId,
      season.id,
      xp,
      clock.now(),
    );
    return xp;
  }

  view(userId: string) {
    const season = this.current();
    if (!season) return { season: null, events: this.activeEvents() };
    const p = this.progressRow(userId, season.id);
    const claimed = new Set(json.parse<string[]>(p?.claimed, []));
    const xp = p?.xp ?? 0;
    const tiers = this.db
      .all<{ tier: number; xp_required: number; free_reward: string; premium_reward: string }>(
        'SELECT tier, xp_required, free_reward, premium_reward FROM season_tiers WHERE season_id = ? ORDER BY tier',
        season.id,
      )
      .map((t) => ({
        tier: t.tier,
        xpRequired: t.xp_required,
        unlocked: xp >= t.xp_required,
        free: this.describe(json.parse<TierReward>(t.free_reward, {})),
        premium: this.describe(json.parse<TierReward>(t.premium_reward, {})),
        freeClaimed: claimed.has(`free:${t.tier}`),
        premiumClaimed: claimed.has(`premium:${t.tier}`),
      }));
    return {
      season: {
        id: season.id,
        name: season.name,
        description: season.description,
        startsAt: season.starts_at,
        endsAt: season.ends_at,
        premiumPriceGems: season.premium_price_gems,
      },
      xp,
      premium: !!p?.premium,
      tiers,
      events: this.activeEvents(),
    };
  }

  private describe(r: TierReward) {
    const parts: string[] = [];
    if (r.coins) parts.push(`${r.coins} monedas`);
    for (const it of r.items ?? []) {
      const d = this.catalog.get(it.itemId);
      parts.push(`${it.qty > 1 ? it.qty + '× ' : ''}${d?.name ?? it.itemId}`);
    }
    return { label: parts.join(' + ') || '—', rarity: r.items?.[0] ? this.catalog.get(r.items[0].itemId)?.rarity ?? null : null };
  }

  claim(userId: string, tier: number, track: 'free' | 'premium') {
    const season = this.current();
    if (!season) throw badRequest('no_season', 'No hay temporada activa.');
    return this.db.tx(() => {
      const t = this.db.get<{ xp_required: number; free_reward: string; premium_reward: string }>(
        'SELECT xp_required, free_reward, premium_reward FROM season_tiers WHERE season_id = ? AND tier = ?',
        season.id,
        tier,
      );
      if (!t) throw notFound('Nivel no encontrado');
      const p = this.progressRow(userId, season.id);
      if ((p?.xp ?? 0) < t.xp_required) throw badRequest('locked', 'Aún no alcanzas ese nivel.');
      if (track === 'premium' && !p?.premium) throw badRequest('premium_required', 'Necesitas el pase premium.');
      const claimed = json.parse<string[]>(p?.claimed, []);
      const key = `${track}:${tier}`;
      if (claimed.includes(key)) throw badRequest('already_claimed', 'Ya reclamaste esta recompensa.');
      const reward = json.parse<TierReward>(track === 'free' ? t.free_reward : t.premium_reward, {});
      this.economy.apply({
        userId,
        type: 'season_claim',
        idempotencyKey: `season:${season.id}:${userId}:${key}`,
        details: { seasonId: season.id, tier, track },
        currency: reward.coins ? [{ code: 'coins', delta: reward.coins, reason: 'season_reward' }] : [],
        grantItems: reward.items ?? [],
        source: 'season_pass',
      });
      claimed.push(key);
      this.db.run(
        `INSERT INTO season_progress(user_id, season_id, xp, premium, claimed, updated_at) VALUES (?, ?, 0, 0, ?, ?)
         ON CONFLICT(user_id, season_id) DO UPDATE SET claimed = excluded.claimed, updated_at = excluded.updated_at`,
        userId,
        season.id,
        json.str(claimed),
        clock.now(),
      );
      return { ok: true };
    });
  }

  buyPremium(userId: string) {
    const season = this.current();
    if (!season) throw badRequest('no_season', 'No hay temporada activa.');
    return this.db.tx(() => {
      const p = this.progressRow(userId, season.id);
      if (p?.premium) throw badRequest('already_premium', 'Ya tienes el pase premium.');
      this.economy.apply({
        userId,
        type: 'purchase',
        idempotencyKey: `season_premium:${season.id}:${userId}`,
        details: { sku: `season_pass:${season.id}` },
        currency: [{ code: 'gems', delta: -season.premium_price_gems, reason: 'season_pass' }],
      });
      this.db.run(
        `INSERT INTO season_progress(user_id, season_id, xp, premium, claimed, updated_at) VALUES (?, ?, 0, 1, '[]', ?)
         ON CONFLICT(user_id, season_id) DO UPDATE SET premium = 1, updated_at = excluded.updated_at`,
        userId,
        season.id,
        clock.now(),
      );
      return { ok: true };
    });
  }
}
