import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, notFound } from '../lib/errors';
import { CLIENT_EVENT_WHITELIST } from '../modules/analytics/service';
import { REPORT_REASONS } from '../modules/social/service';
import type { Services } from '../services';
import type { Gateway } from '../modules/multiplayer/gateway';
import { GAME_NAME, PROTOCOL_VERSION } from '../../../shared/constants';
import { parse, requireUser } from './helpers';

const deviceId = z.string().min(8).max(128);
const idemKey = z.string().min(8).max(64);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export function registerPlayerRoutes(app: FastifyInstance, s: Services, gateway: () => Gateway | null) {
  const ua = (h: unknown) => String(h ?? '').slice(0, 200);

  app.get('/api/health', async () => ({ ok: true, name: GAME_NAME, protocol: PROTOCOL_VERSION, online: gateway()?.onlineCount() ?? 0 }));

  app.get('/api/config/public', async () => {
    const eco = s.ecoCfg.get();
    return {
      sandbox: s.config.SANDBOX_MODE,
      paymentsSandbox: s.config.PAYMENT_PROVIDER === 'sandbox',
      adsSandbox: s.config.AD_PROVIDER === 'sandbox',
      marketplaceEnabled: eco.marketplace.enabled,
      rewardPointsEnabled: eco.rewardPoints.enabled,
      realRedemptions: s.rewards.realRedemptionsActive(),
      mailSandbox: s.config.MAIL_PROVIDER === 'console',
      protocol: PROTOCOL_VERSION,
    };
  });

  // --------------------------------------------------------------- auth
  app.post('/api/auth/register', { config: { authRate: true } }, async (req) => {
    const b = parse(
      z.object({
        email: z.string().max(254),
        username: z.string().max(20),
        password: z.string().max(128),
        referralCode: z.string().max(16).nullish(),
        deviceId,
        acceptTerms: z.literal(true, { message: 'Debes aceptar los términos.' }),
        ageConfirmed: z.literal(true, { message: 'Debes confirmar tu edad.' }),
      }),
      req.body,
    );
    return s.auth.register(b, req.ip, ua(req.headers['user-agent']));
  });

  app.post('/api/auth/login', { config: { authRate: true } }, async (req) => {
    const b = parse(z.object({ login: z.string().min(1).max(254), password: z.string().min(1).max(128), deviceId }), req.body);
    return s.auth.login(b, req.ip, ua(req.headers['user-agent']));
  });

  app.post('/api/auth/logout', async (req) => {
    const u = requireUser(req);
    s.auth.logout(u.sessionId);
    return { ok: true };
  });

  app.post('/api/auth/forgot', { config: { authRate: true } }, async (req) => {
    const b = parse(z.object({ email: z.string().max(254) }), req.body);
    s.auth.forgotPassword(b.email, req.ip);
    return { ok: true, message: 'Si el correo existe, enviamos un enlace para restablecer la contraseña.', sandboxMail: s.config.MAIL_PROVIDER === 'console' };
  });

  app.post('/api/auth/reset', { config: { authRate: true } }, async (req) => {
    const b = parse(z.object({ token: z.string().min(10).max(200), password: z.string().max(128) }), req.body);
    await s.auth.resetPassword(b.token, b.password);
    return { ok: true };
  });

  app.post('/api/auth/verify', async (req) => {
    const b = parse(z.object({ token: z.string().min(10).max(200) }), req.body);
    s.auth.verifyEmail(b.token);
    return { ok: true };
  });

  // --------------------------------------------------------------- cuenta / personaje
  app.get('/api/me', async (req) => {
    const u = requireUser(req);
    return s.accounts.profile(u.id);
  });

  app.post('/api/characters', async (req) => {
    const u = requireUser(req);
    const b = parse(
      z.object({ name: z.string().max(40), appearance: z.object({ skin: color, hair: color, coat: color, pants: color }) }),
      req.body,
    );
    const c = s.accounts.createCharacter(u.id, b.name, b.appearance);
    s.analytics.track('character_created', u.id, {});
    return { id: c.id, name: c.name };
  });

  app.post('/api/characters/equip', async (req) => {
    const u = requireUser(req);
    const b = parse(z.object({ slot: z.enum(['hat', 'outfit', 'lantern']), itemId: z.string().max(48).nullable() }), req.body);
    return { appearance: s.accounts.equip(u.id, b.slot, b.itemId) };
  });

  app.get('/api/inventory', async (req) => {
    const u = requireUser(req);
    return { items: s.inventory.list(u.id) };
  });

  app.get('/api/wallet', async (req) => {
    const u = requireUser(req);
    return { wallet: s.economy.balances(u.id), history: s.economy.history(u.id, 50) };
  });

  // --------------------------------------------------------------- misiones
  app.get('/api/missions', async (req) => {
    const u = requireUser(req);
    return s.missions.payload(u.id);
  });

  app.post('/api/missions/:id/restart', async (req) => {
    const u = requireUser(req);
    s.missions.restart(u.id, String((req.params as { id: string }).id));
    return { ok: true };
  });

  // --------------------------------------------------------------- tienda / temporada
  app.get('/api/store', async (req) => {
    const u = requireUser(req);
    return s.store.catalogFor(u.id);
  });

  app.post('/api/store/buy', async (req) => {
    const u = requireUser(req);
    const b = parse(z.object({ sku: z.string().max(40), idempotencyKey: idemKey }), req.body);
    return s.store.buy(u.id, b.sku, b.idempotencyKey);
  });

  app.post('/api/store/gems', async (req) => {
    const u = requireUser(req);
    const b = parse(z.object({ sku: z.string().max(40), receipt: z.string().max(4000).optional() }), req.body);
    return s.store.buyGems(u.id, b.sku, b.receipt);
  });

  app.get('/api/season', async (req) => {
    const u = requireUser(req);
    return s.seasons.view(u.id);
  });

  app.post('/api/season/claim', async (req) => {
    const u = requireUser(req);
    const b = parse(z.object({ tier: z.number().int().min(1).max(200), track: z.enum(['free', 'premium']) }), req.body);
    return s.seasons.claim(u.id, b.tier, b.track);
  });

  app.post('/api/season/premium', async (req) => {
    const u = requireUser(req);
    return s.seasons.buyPremium(u.id);
  });

  app.get('/api/events', async () => ({ events: s.seasons.activeEvents() }));

  // --------------------------------------------------------------- anuncios
  app.get('/api/ads', async (req) => {
    const u = requireUser(req);
    return { placements: s.ads.placements(u.id), sandbox: s.config.AD_PROVIDER === 'sandbox' };
  });

  app.post('/api/ads/start', async (req) => {
    const u = requireUser(req);
    const b = parse(z.object({ placementId: z.string().max(40) }), req.body);
    const devices = [...s.antifraud.devicesOf(u.id)];
    return s.ads.start(u.id, b.placementId, req.ip, devices[0] ?? null);
  });

  app.post('/api/ads/complete', async (req) => {
    const u = requireUser(req);
    const b = parse(z.object({ token: z.string().min(10).max(100) }), req.body);
    return s.ads.complete(u.id, b.token);
  });

  // --------------------------------------------------------------- recompensas
  app.get('/api/rewards', async (req) => {
    const u = requireUser(req);
    return s.rewards.summary(u.id);
  });

  app.post('/api/rewards/redeem', async (req) => {
    const u = requireUser(req);
    const b = parse(z.object({ points: z.number().int().positive(), rewardType: z.string().max(40), idempotencyKey: idemKey }), req.body);
    return s.rewards.redeem(u.id, b.points, b.rewardType, `redeem:${u.id}:${b.idempotencyKey}`);
  });

  // --------------------------------------------------------------- social
  app.get('/api/social/friends', async (req) => {
    const u = requireUser(req);
    return { friends: s.social.friends(u.id) };
  });

  app.post('/api/social/friends', async (req) => {
    const u = requireUser(req);
    const b = parse(z.object({ username: z.string().min(3).max(20).optional(), userId: z.string().max(64).optional() }), req.body);
    return s.social.requestFriend(u.id, b.username ?? null, b.userId ?? null);
  });

  app.post('/api/social/friends/:id/accept', async (req) => {
    const u = requireUser(req);
    s.social.acceptFriend(u.id, String((req.params as { id: string }).id));
    return { ok: true };
  });

  app.delete('/api/social/friends/:id', async (req) => {
    const u = requireUser(req);
    s.social.removeFriend(u.id, String((req.params as { id: string }).id));
    return { ok: true };
  });

  app.get('/api/social/blocks', async (req) => {
    const u = requireUser(req);
    return { blocks: s.social.blocks(u.id) };
  });

  app.post('/api/social/blocks', async (req) => {
    const u = requireUser(req);
    const b = parse(z.object({ userId: z.string().max(64).optional(), username: z.string().max(20).optional() }), req.body);
    const targetId = b.userId ?? (b.username ? s.social.findUser(b.username)?.id : undefined);
    if (!targetId) throw notFound('Jugador no encontrado.');
    s.social.block(u.id, targetId);
    return { ok: true };
  });

  app.delete('/api/social/blocks/:id', async (req) => {
    const u = requireUser(req);
    s.social.unblock(u.id, String((req.params as { id: string }).id));
    return { ok: true };
  });

  app.post('/api/social/reports', async (req) => {
    const u = requireUser(req);
    const b = parse(
      z.object({ targetUserId: z.string().max(64), reason: z.enum(REPORT_REASONS), details: z.string().max(500).nullish() }),
      req.body,
    );
    return s.social.report(u.id, b.targetUserId, b.reason, b.details ?? null, { via: 'client' });
  });

  app.get('/api/referrals', async (req) => {
    const u = requireUser(req);
    return s.referrals.summary(u.id);
  });

  // --------------------------------------------------------------- marketplace
  app.get('/api/marketplace', async (req) => {
    const u = requireUser(req);
    const enabled = s.ecoCfg.get().marketplace.enabled;
    return { enabled, commissionPct: s.ecoCfg.get().marketplace.commissionPct, listings: enabled ? s.marketplace.listings(u.id) : [], history: s.marketplace.history(u.id) };
  });

  app.post('/api/marketplace/listings', async (req) => {
    const u = requireUser(req);
    const b = parse(z.object({ instanceId: z.string().max(64), price: z.number().int() }), req.body);
    return s.marketplace.create(u.id, b.instanceId, b.price);
  });

  app.post('/api/marketplace/listings/:id/buy', async (req) => {
    const u = requireUser(req);
    return s.marketplace.buy(u.id, String((req.params as { id: string }).id));
  });

  app.post('/api/marketplace/listings/:id/cancel', async (req) => {
    const u = requireUser(req);
    return s.marketplace.cancel(u.id, String((req.params as { id: string }).id));
  });

  // --------------------------------------------------------------- patrocinios / analíticas
  app.get('/api/sponsors', async () => ({ campaigns: s.sponsors.active() }));

  app.post('/api/analytics', async (req) => {
    const u = requireUser(req);
    const b = parse(z.object({ type: z.string().max(40), props: z.record(z.string(), z.unknown()).default({}) }), req.body);
    if (!CLIENT_EVENT_WHITELIST.has(b.type)) throw badRequest('invalid_event', 'Evento no permitido.');
    const props = JSON.stringify(b.props).length > 1000 ? {} : b.props;
    if (b.type === 'sponsor_impression' && typeof props.campaignId === 'string') s.sponsors.impression(props.campaignId);
    s.analytics.track(`client:${b.type}`, u.id, props);
    return { ok: true };
  });
}
