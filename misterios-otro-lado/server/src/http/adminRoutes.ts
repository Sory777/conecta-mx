import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { json } from '../db/database';
import { clock } from '../lib/clock';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import type { Gateway } from '../modules/multiplayer/gateway';
import { EventSchema, SeasonSchema } from '../modules/seasons/service';
import { CampaignSchema } from '../modules/sponsors/service';
import { ProductSchema } from '../modules/store/service';
import type { Services } from '../services';
import { parse, requireRole } from './helpers';

/**
 * API del panel de administración.
 * - moderator: jugadores (ver/suspender), reportes, actividad sospechosa.
 * - admin: todo lo anterior + economía, contenido, tienda, temporadas, anuncios, patrocinios, canjes.
 * Toda acción que modifica datos queda en audit_log.
 */
export function registerAdminRoutes(app: FastifyInstance, s: Services, gateway: () => Gateway | null) {
  const audit = (req: FastifyRequest, actorId: string, action: string, targetType: string | null, targetId: string | null, details: unknown = {}) => {
    s.db.run(
      'INSERT INTO audit_log(id, actor_id, action, target_type, target_id, details, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      newId(),
      actorId,
      action,
      targetType,
      targetId,
      json.str(details),
      req.ip,
      clock.now(),
    );
  };
  const id = (req: FastifyRequest) => String((req.params as { id: string }).id);

  // ------------------------------------------------------------ estadísticas
  app.get('/api/admin/stats', async (req) => {
    requireRole(req, 'moderator');
    return { ...s.analytics.dashboard(), live: gateway()?.stats() ?? null, sandbox: s.config.SANDBOX_MODE };
  });

  // ------------------------------------------------------------ jugadores
  app.get('/api/admin/players', async (req) => {
    requireRole(req, 'moderator');
    const q = String((req.query as { q?: string }).q ?? '').trim().slice(0, 60);
    const like = `%${q.replace(/[%_]/g, '')}%`;
    return {
      players: s.db.all(
        `SELECT u.id, u.username, u.email, u.role, u.status, u.fraud_score, u.rewards_hold, u.level, u.created_at, u.last_login_at, c.name AS character
         FROM users u LEFT JOIN characters c ON c.user_id = u.id
         WHERE u.username LIKE ? OR u.email LIKE ? OR c.name LIKE ? OR u.id = ?
         ORDER BY u.created_at DESC LIMIT 100`,
        like,
        like,
        like,
        q,
      ),
    };
  });

  app.get('/api/admin/players/:id', async (req) => {
    requireRole(req, 'moderator');
    const uid = id(req);
    const user = s.db.get(
      'SELECT id, username, email, role, status, status_reason, email_verified, fraud_score, rewards_hold, xp, level, created_at, last_login_at, referral_code FROM users WHERE id = ?',
      uid,
    );
    if (!user) throw notFound();
    return {
      user,
      character: s.accounts.character(uid) ?? null,
      wallet: s.economy.balances(uid),
      inventory: s.inventory.list(uid),
      devices: s.db.all(
        `SELECT d.device_id, d.first_seen, d.last_seen, d.last_ip, (SELECT COUNT(DISTINCT user_id) FROM user_devices x WHERE x.device_id = d.device_id) AS accounts_on_device
         FROM user_devices d WHERE d.user_id = ?`,
        uid,
      ),
      ledger: s.economy.history(uid, 100),
      suspicious: s.db.all('SELECT * FROM suspicious_activity WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', uid),
      reportsAgainst: s.db.all('SELECT * FROM reports WHERE target_id = ? ORDER BY created_at DESC LIMIT 50', uid),
      missions: s.db.all('SELECT mission_id, status, stage_id, completions, updated_at FROM mission_progress WHERE user_id = ?', uid),
      referrals: s.db.all('SELECT * FROM referrals WHERE referrer_id = ? OR referee_id = ?', uid, uid),
      online: gateway() ? s.social.isOnline(uid) : false,
    };
  });

  app.post('/api/admin/players/:id/status', async (req) => {
    const actor = requireRole(req, 'moderator');
    const b = parse(z.object({ status: z.enum(['active', 'suspended', 'banned']), reason: z.string().max(300).nullish() }), req.body);
    if (b.status === 'banned' && actor.role !== 'admin') throw forbidden('Sólo un administrador puede bloquear cuentas.');
    const target = s.db.get<{ role: string }>('SELECT role FROM users WHERE id = ?', id(req));
    if (!target) throw notFound();
    if (target.role === 'admin' && actor.role !== 'admin') throw forbidden();
    s.auth.setStatus(id(req), b.status, b.reason ?? null);
    audit(req, actor.id, 'player_status', 'user', id(req), b);
    return { ok: true };
  });

  app.post('/api/admin/players/:id/kick', async (req) => {
    const actor = requireRole(req, 'moderator');
    const ok = gateway()?.kick(id(req), 'Un moderador te desconectó.') ?? false;
    audit(req, actor.id, 'player_kick', 'user', id(req));
    return { ok };
  });

  app.post('/api/admin/players/:id/fraud', async (req) => {
    const actor = requireRole(req, 'admin');
    const b = parse(z.object({ fraudScore: z.number().int().min(0).max(10000), rewardsHold: z.boolean() }), req.body);
    s.db.run('UPDATE users SET fraud_score = ?, rewards_hold = ? WHERE id = ?', b.fraudScore, b.rewardsHold ? 1 : 0, id(req));
    audit(req, actor.id, 'player_fraud', 'user', id(req), b);
    return { ok: true };
  });

  app.post('/api/admin/players/:id/role', async (req) => {
    const actor = requireRole(req, 'admin');
    const b = parse(z.object({ role: z.enum(['player', 'moderator', 'admin']) }), req.body);
    if (id(req) === actor.id) throw badRequest('self', 'No puedes cambiar tu propio rol.');
    s.db.run('UPDATE users SET role = ? WHERE id = ?', b.role, id(req));
    audit(req, actor.id, 'player_role', 'user', id(req), b);
    return { ok: true };
  });

  app.post('/api/admin/players/:id/verify-email', async (req) => {
    const actor = requireRole(req, 'admin');
    s.db.run('UPDATE users SET email_verified = 1 WHERE id = ?', id(req));
    audit(req, actor.id, 'player_verify_email', 'user', id(req));
    return { ok: true };
  });

  app.post('/api/admin/players/:id/adjust', async (req) => {
    const actor = requireRole(req, 'admin');
    const b = parse(
      z.object({ currency: z.enum(['coins', 'gems', 'rp']), delta: z.number().int().min(-1_000_000).max(1_000_000), reason: z.string().min(3).max(200) }),
      req.body,
    );
    if (b.delta === 0) throw badRequest('zero', 'El ajuste no puede ser 0.');
    const tx = s.economy.apply({
      userId: id(req),
      type: 'admin_adjust',
      idempotencyKey: `admin_adjust:${newId()}`,
      details: { by: actor.id, reason: b.reason },
      currency: [{ code: b.currency, delta: b.delta, reason: `admin:${b.reason}` }],
    });
    audit(req, actor.id, 'wallet_adjust', 'user', id(req), b);
    return { ok: true, txId: tx.txId };
  });

  // ------------------------------------------------------------ moderación
  app.get('/api/admin/reports', async (req) => {
    requireRole(req, 'moderator');
    const status = String((req.query as { status?: string }).status ?? 'open');
    return {
      reports: s.db.all(
        `SELECT r.*, a.username AS reporter, b.username AS target FROM reports r
         JOIN users a ON a.id = r.reporter_id JOIN users b ON b.id = r.target_id
         WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 200`,
        status,
      ),
    };
  });

  app.post('/api/admin/reports/:id/resolve', async (req) => {
    const actor = requireRole(req, 'moderator');
    const b = parse(z.object({ status: z.enum(['resolved', 'dismissed']), resolution: z.string().max(500) }), req.body);
    const r = s.db.run('UPDATE reports SET status = ?, resolution = ?, resolved_by = ?, resolved_at = ? WHERE id = ?', b.status, b.resolution, actor.id, clock.now(), id(req));
    if (!r.changes) throw notFound();
    audit(req, actor.id, 'report_resolve', 'report', id(req), b);
    return { ok: true };
  });

  app.get('/api/admin/suspicious', async (req) => {
    requireRole(req, 'moderator');
    const reviewed = (req.query as { reviewed?: string }).reviewed === '1' ? 1 : 0;
    return {
      items: s.db.all(
        `SELECT sa.*, u.username FROM suspicious_activity sa LEFT JOIN users u ON u.id = sa.user_id
         WHERE sa.reviewed = ? ORDER BY sa.created_at DESC LIMIT 300`,
        reviewed,
      ),
    };
  });

  app.post('/api/admin/suspicious/:id/review', async (req) => {
    const actor = requireRole(req, 'moderator');
    s.db.run('UPDATE suspicious_activity SET reviewed = 1, reviewed_by = ? WHERE id = ?', actor.id, id(req));
    return { ok: true };
  });

  // ------------------------------------------------------------ economía
  app.get('/api/admin/transactions', async (req) => {
    requireRole(req, 'admin');
    const q = req.query as { userId?: string; type?: string };
    return {
      transactions: s.db.all(
        `SELECT t.id, t.user_id, u.username, t.type, t.status, t.details, t.created_at,
           (SELECT GROUP_CONCAT(l.currency_code || ':' || l.delta, ' ') FROM ledger_entries l WHERE l.transaction_id = t.id) AS lines,
           (SELECT GROUP_CONCAT(i.item_id || ':' || i.delta, ' ') FROM item_ledger i WHERE i.transaction_id = t.id) AS items
         FROM transactions t JOIN users u ON u.id = t.user_id
         WHERE (? IS NULL OR t.user_id = ?) AND (? IS NULL OR t.type = ?)
         ORDER BY t.created_at DESC LIMIT 300`,
        q.userId ?? null,
        q.userId ?? null,
        q.type ?? null,
        q.type ?? null,
      ),
    };
  });

  app.get('/api/admin/redemptions', async (req) => {
    requireRole(req, 'admin');
    return {
      realActive: s.rewards.realRedemptionsActive(),
      redemptions: s.db.all(
        `SELECT r.*, u.username, u.fraud_score AS current_fraud_score, u.rewards_hold FROM reward_redemptions r JOIN users u ON u.id = r.user_id
         ORDER BY CASE r.status WHEN 'pending_review' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 200`,
      ),
    };
  });

  app.post('/api/admin/redemptions/:id/review', async (req) => {
    const actor = requireRole(req, 'admin');
    const b = parse(z.object({ decision: z.enum(['approve', 'reject', 'mark_paid']), notes: z.string().max(500).nullish() }), req.body);
    const r = s.rewards.review(id(req), b.decision, actor.id, b.notes ?? null);
    audit(req, actor.id, 'redemption_review', 'redemption', id(req), b);
    return r;
  });

  app.get('/api/admin/economy', async (req) => {
    requireRole(req, 'admin');
    return {
      config: s.ecoCfg.get(),
      env: { SANDBOX_MODE: s.config.SANDBOX_MODE, REAL_PAYOUTS_ALLOWED: s.config.REAL_PAYOUTS_ALLOWED, PAYMENT_PROVIDER: s.config.PAYMENT_PROVIDER, AD_PROVIDER: s.config.AD_PROVIDER },
    };
  });

  app.put('/api/admin/economy', async (req) => {
    const actor = requireRole(req, 'admin');
    const before = s.ecoCfg.get();
    const cfg = s.ecoCfg.update(req.body, actor.id);
    audit(req, actor.id, 'economy_update', 'economy', 'economy', { before, after: cfg });
    return { config: cfg };
  });

  // ------------------------------------------------------------ tienda
  app.get('/api/admin/products', async (req) => {
    requireRole(req, 'admin');
    return { products: s.db.all('SELECT * FROM store_products ORDER BY created_at DESC'), gemPacks: s.db.all('SELECT * FROM gem_packs'), items: s.catalog.all() };
  });

  app.post('/api/admin/products', async (req) => {
    const actor = requireRole(req, 'admin');
    const b = parse(ProductSchema, req.body);
    s.store.upsertProduct(b);
    audit(req, actor.id, 'product_upsert', 'product', b.sku, b);
    return { ok: true };
  });

  // ------------------------------------------------------------ contenido: misterios, temporadas, eventos
  app.get('/api/admin/missions', async (req) => {
    requireRole(req, 'admin');
    return { missions: s.missions.list() };
  });

  app.get('/api/admin/missions/:id', async (req) => {
    requireRole(req, 'admin');
    const def = s.missions.getDef(id(req));
    if (!def) throw notFound();
    return { episode: def };
  });

  app.post('/api/admin/missions', { bodyLimit: 512 * 1024 }, async (req) => {
    const actor = requireRole(req, 'admin');
    const ep = s.missions.upsertFromAdmin(req.body);
    audit(req, actor.id, 'mission_upsert', 'mission', ep.id, { version: ep.version });
    return { ok: true, id: ep.id, version: ep.version };
  });

  app.post('/api/admin/missions/:id/enabled', async (req) => {
    const actor = requireRole(req, 'admin');
    const b = parse(z.object({ enabled: z.boolean() }), req.body);
    s.missions.setEnabled(id(req), b.enabled);
    audit(req, actor.id, 'mission_enabled', 'mission', id(req), b);
    return { ok: true };
  });

  app.get('/api/admin/seasons', async (req) => {
    requireRole(req, 'admin');
    return {
      seasons: s.db.all('SELECT * FROM seasons ORDER BY starts_at DESC'),
      tiers: s.db.all('SELECT * FROM season_tiers ORDER BY season_id, tier'),
      events: s.db.all('SELECT * FROM events ORDER BY starts_at DESC'),
      current: s.seasons.current() ?? null,
    };
  });

  app.post('/api/admin/seasons', async (req) => {
    const actor = requireRole(req, 'admin');
    const b = parse(SeasonSchema, req.body);
    s.seasons.upsert(b);
    s.bus.emit('world.refresh', {});
    audit(req, actor.id, 'season_upsert', 'season', b.id, { name: b.name });
    return { ok: true };
  });

  app.post('/api/admin/events', async (req) => {
    const actor = requireRole(req, 'admin');
    const b = parse(EventSchema.extend({ seasonId: z.string().nullish() }), req.body);
    s.seasons.upsertEvent(b, b.seasonId ?? null);
    audit(req, actor.id, 'event_upsert', 'event', b.id, b);
    return { ok: true };
  });

  // ------------------------------------------------------------ publicidad y patrocinios
  app.get('/api/admin/ads', async (req) => {
    requireRole(req, 'admin');
    return {
      placements: s.db.all('SELECT * FROM ad_placements'),
      stats: s.db.all(
        `SELECT placement_id, status, COUNT(*) AS n FROM ad_views WHERE started_at > ? GROUP BY placement_id, status`,
        clock.now() - 7 * 86400_000,
      ),
    };
  });

  app.put('/api/admin/ads/:id', async (req) => {
    const actor = requireRole(req, 'admin');
    const b = parse(
      z.object({
        enabled: z.boolean(),
        reward_coins: z.number().int().min(0).max(10_000),
        reward_rp: z.number().int().min(0).max(1_000),
        daily_cap: z.number().int().min(0).max(100),
        cooldown_sec: z.number().int().min(0).max(86_400),
        min_watch_sec: z.number().int().min(1).max(120),
      }),
      req.body,
    );
    const r = s.db.run(
      'UPDATE ad_placements SET enabled = ?, reward_coins = ?, reward_rp = ?, daily_cap = ?, cooldown_sec = ?, min_watch_sec = ? WHERE id = ?',
      b.enabled ? 1 : 0,
      b.reward_coins,
      b.reward_rp,
      b.daily_cap,
      b.cooldown_sec,
      b.min_watch_sec,
      id(req),
    );
    if (!r.changes) throw notFound();
    audit(req, actor.id, 'ad_placement_update', 'ad_placement', id(req), b);
    return { ok: true };
  });

  app.get('/api/admin/sponsors', async (req) => {
    requireRole(req, 'admin');
    return { campaigns: s.sponsors.list() };
  });

  app.post('/api/admin/sponsors', async (req) => {
    const actor = requireRole(req, 'admin');
    const b = parse(CampaignSchema.extend({ id: z.string().max(64).optional() }), req.body);
    let r: { id: string };
    try {
      r = s.sponsors.upsert(b, b.id);
    } catch (e) {
      throw badRequest('invalid', (e as Error).message);
    }
    s.bus.emit('world.refresh', {});
    audit(req, actor.id, 'sponsor_upsert', 'sponsor', r.id, b);
    return r;
  });

  // ------------------------------------------------------------ marketplace y auditoría
  app.get('/api/admin/marketplace', async (req) => {
    requireRole(req, 'admin');
    return {
      listings: s.db.all(
        `SELECT l.*, u.username AS seller FROM marketplace_listings l JOIN users u ON u.id = l.seller_id ORDER BY l.created_at DESC LIMIT 200`,
      ),
    };
  });

  app.post('/api/admin/marketplace/:id/remove', async (req) => {
    const actor = requireRole(req, 'admin');
    s.marketplace.cancel(actor.id, id(req), true);
    audit(req, actor.id, 'listing_remove', 'listing', id(req));
    return { ok: true };
  });

  app.get('/api/admin/audit', async (req) => {
    requireRole(req, 'admin');
    return {
      entries: s.db.all(
        'SELECT a.*, u.username AS actor FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC LIMIT 300',
      ),
    };
  });
}
