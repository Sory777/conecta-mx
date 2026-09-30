import { z } from 'zod';
import type { AppConfig } from '../../config/env';
import type { Db } from '../../db/database';
import { json } from '../../db/database';
import type { Bus } from '../../lib/bus';
import { clock, DAY_MS, startOfUtcDay } from '../../lib/clock';
import { badRequest, forbidden, notFound, tooMany } from '../../lib/errors';
import { newId, randomToken } from '../../lib/ids';
import type { Logger } from '../../lib/logger';
import type { AnalyticsService } from '../analytics/service';
import type { EconomyConfigService } from '../economy/config';
import type { Economy } from '../economy/ledger';
import type { ItemCatalog } from '../inventory/catalog';

export const OfferSchema = z.object({
  sku: z.string().regex(/^[a-z0-9_]{2,40}$/),
  kind: z.enum(['gems', 'vip', 'bundle', 'tip']),
  label: z.string().min(1).max(60),
  description: z.string().max(300).default(''),
  gems: z.number().int().min(0).max(1_000_000).default(0),
  vipDays: z.number().int().min(0).max(365).default(0),
  items: z.array(z.object({ itemId: z.string(), qty: z.number().int().min(1).max(100) })).default([]),
  priceCents: z.number().int().min(1).max(100_000),
  priceStars: z.number().int().min(1).max(100_000),
  oncePerUser: z.boolean().default(false),
  active: z.boolean().default(true),
  sort: z.number().int().default(0),
});
export type Offer = z.infer<typeof OfferSchema>;

interface OfferRow {
  sku: string;
  kind: Offer['kind'];
  label: string;
  description: string;
  gems: number;
  vip_days: number;
  items: string;
  price_cents: number;
  price_stars: number;
  once_per_user: number;
  active: number;
  sort: number;
}

/** API mínima de Telegram que necesita este servicio (la aporta TelegramService). */
export interface StarsApi {
  readonly starsEnabled: boolean;
  telegramIdOf(userId: string): string | null;
  createStarsInvoice(p: { title: string; description: string; payload: string; stars: number }): Promise<string>;
  refundStars(telegramUserId: string, chargeId: string): Promise<void>;
}

/**
 * Ofertas con dinero real: gemas, VIP, paquetes y propinas.
 * Canales de cobro:
 *  - Telegram Stars (moneda oficial de Telegram para bienes digitales en bots y Mini Apps).
 *  - Sandbox (desarrollo: sin cobro, marcado como sandbox).
 * La entrega SIEMPRE ocurre en el servidor tras la confirmación del proveedor y es idempotente.
 */
export class OffersService {
  stars: StarsApi | null = null;

  constructor(
    private readonly db: Db,
    private readonly config: AppConfig,
    private readonly bus: Bus,
    private readonly log: Logger,
    private readonly economy: Economy,
    private readonly ecoCfg: EconomyConfigService,
    private readonly catalog: ItemCatalog,
    private readonly analytics: AnalyticsService,
  ) {}

  upsert(o: Offer) {
    for (const it of o.items) this.catalog.require(it.itemId);
    if (o.kind === 'vip' && o.vipDays <= 0) throw badRequest('invalid_offer', 'Una oferta VIP necesita vipDays > 0.');
    this.db.run(
      `INSERT INTO offers(sku, kind, label, description, gems, vip_days, items, price_cents, price_stars, once_per_user, active, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(sku) DO UPDATE SET kind = excluded.kind, label = excluded.label, description = excluded.description, gems = excluded.gems,
       vip_days = excluded.vip_days, items = excluded.items, price_cents = excluded.price_cents, price_stars = excluded.price_stars,
       once_per_user = excluded.once_per_user, active = excluded.active, sort = excluded.sort`,
      o.sku,
      o.kind,
      o.label,
      o.description,
      o.gems,
      o.vipDays,
      json.str(o.items),
      o.priceCents,
      o.priceStars,
      o.oncePerUser ? 1 : 0,
      o.active ? 1 : 0,
      o.sort,
    );
  }

  loadDefaults(offers: Offer[]) {
    for (const o of offers) if (!this.db.get('SELECT 1 FROM offers WHERE sku = ?', o.sku)) this.upsert(o);
  }

  private row(sku: string) {
    return this.db.get<OfferRow>('SELECT * FROM offers WHERE sku = ?', sku);
  }

  private bought(userId: string, sku: string) {
    return !!this.db.get("SELECT 1 FROM purchases WHERE user_id = ? AND sku = ? AND status = 'completed'", userId, sku);
  }

  vipUntil(userId: string): number | null {
    const u = this.db.get<{ vip_until: number | null }>('SELECT vip_until FROM users WHERE id = ?', userId);
    return u?.vip_until && u.vip_until > clock.now() ? u.vip_until : null;
  }

  isVip(userId: string) {
    return this.vipUntil(userId) !== null;
  }

  list(userId: string, env: 'telegram' | 'web') {
    const rows = this.db.all<OfferRow>('SELECT * FROM offers WHERE active = 1 ORDER BY sort, price_cents');
    const eco = this.ecoCfg.get();
    return {
      offers: rows.map((r) => ({
        sku: r.sku,
        kind: r.kind,
        label: r.label,
        description: r.description,
        gems: r.gems,
        vipDays: r.vip_days,
        items: json.parse<{ itemId: string; qty: number }[]>(r.items, []).map((i) => ({ ...i, name: this.catalog.get(i.itemId)?.name ?? i.itemId })),
        priceCents: r.price_cents,
        priceStars: r.price_stars,
        oncePerUser: !!r.once_per_user,
        owned: !!r.once_per_user && this.bought(userId, r.sku),
      })),
      channels: {
        stars: env === 'telegram' && !!this.stars?.starsEnabled,
        sandbox: this.config.PAYMENT_PROVIDER === 'sandbox',
      },
      vipUntil: this.vipUntil(userId),
      vipPerks: eco.vip,
    };
  }

  /** Entrega idempotente de una oferta pagada. */
  fulfill(p: { userId: string; sku: string; provider: string; providerRef: string; amountCents: number; amountStars: number; currency: string; sandbox: boolean }) {
    const offer = this.row(p.sku);
    if (!offer) throw notFound('Oferta no encontrada.');
    return this.db.tx(() => {
      const existing = this.db.get<{ id: string }>('SELECT id FROM purchases WHERE provider = ? AND provider_ref = ?', p.provider, p.providerRef);
      if (existing) return { duplicate: true, purchaseId: existing.id };
      const items = json.parse<{ itemId: string; qty: number }[]>(offer.items, []);
      const tx = this.economy.apply({
        userId: p.userId,
        type: 'iap',
        idempotencyKey: `offer:${p.provider}:${p.providerRef}`,
        details: { sku: p.sku, sandbox: p.sandbox, amountCents: p.amountCents, amountStars: p.amountStars },
        currency: offer.gems > 0 ? [{ code: 'gems', delta: offer.gems, reason: p.sandbox ? 'iap_sandbox' : 'iap' }] : [],
        grantItems: items,
        source: `offer:${p.sku}`,
      });
      if (offer.vip_days > 0) {
        const base = Math.max(clock.now(), this.vipUntil(p.userId) ?? 0);
        this.db.run('UPDATE users SET vip_until = ? WHERE id = ?', base + offer.vip_days * DAY_MS, p.userId);
      }
      const purchaseId = newId();
      this.db.run(
        'INSERT INTO purchases(id, user_id, sku, provider, provider_ref, amount_cents, currency, status, sandbox, transaction_id, created_at, amount_stars) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        purchaseId,
        p.userId,
        p.sku,
        p.provider,
        p.providerRef,
        p.amountCents,
        p.currency,
        'completed',
        p.sandbox ? 1 : 0,
        tx.txId,
        clock.now(),
        p.amountStars,
      );
      this.analytics.track('iap', p.userId, { sku: p.sku, provider: p.provider, amountCents: p.amountCents, stars: p.amountStars, sandbox: p.sandbox });
      this.db.onCommit(() => {
        this.bus.emit('notice', { userId: p.userId, level: 'success', text: `¡Gracias por tu compra! ${offer.label}${p.sandbox ? ' (sandbox)' : ''}` });
        this.bus.emit('wallet.changed', { userId: p.userId });
      });
      return { duplicate: false, purchaseId };
    });
  }

  private assertCanBuy(userId: string, offer: OfferRow) {
    if (!offer.active) throw notFound('Oferta no disponible.');
    if (offer.once_per_user && this.bought(userId, offer.sku)) throw badRequest('already_bought', 'Ya compraste esta oferta.');
  }

  /** Desarrollo: entrega sin cobro, marcado como sandbox. */
  buySandbox(userId: string, sku: string) {
    if (this.config.PAYMENT_PROVIDER !== 'sandbox') throw forbidden('Las compras sandbox están desactivadas.');
    const offer = this.row(sku);
    if (!offer) throw notFound('Oferta no disponible.');
    this.assertCanBuy(userId, offer);
    const today = this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM purchases WHERE user_id = ? AND sandbox = 1 AND created_at > ?', userId, clock.now() - DAY_MS)!.n;
    if (today >= 10) throw tooMany('Límite de compras sandbox por día alcanzado.');
    const r = this.fulfill({ userId, sku, provider: 'sandbox', providerRef: `sandbox_${randomToken(12)}`, amountCents: offer.price_cents, amountStars: 0, currency: 'USD', sandbox: true });
    return { ok: true, sandbox: true, ...r };
  }

  // ------------------------------------------------------------------ Telegram Stars

  async createStarsInvoice(userId: string, sku: string) {
    if (!this.stars?.starsEnabled) throw forbidden('Los pagos con Telegram Stars no están activos.');
    const offer = this.row(sku);
    if (!offer) throw notFound('Oferta no disponible.');
    this.assertCanBuy(userId, offer);
    if (!this.stars.telegramIdOf(userId)) throw forbidden('Abre el juego desde Telegram para pagar con Stars.');
    const pending = this.db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM payment_intents WHERE user_id = ? AND status = 'pending' AND created_at > ?",
      userId,
      clock.now() - 3600_000,
    )!.n;
    if (pending >= 20) throw tooMany('Demasiadas facturas pendientes. Inténtalo más tarde.');
    const id = newId();
    this.db.run(
      "INSERT INTO payment_intents(id, user_id, sku, provider, amount, currency, status, created_at) VALUES (?, ?, ?, 'telegram_stars', ?, 'XTR', 'pending', ?)",
      id,
      userId,
      sku,
      offer.price_stars,
      clock.now(),
    );
    const link = await this.stars.createStarsInvoice({
      title: offer.label.slice(0, 32),
      description: (offer.description || offer.label).slice(0, 255),
      payload: id,
      stars: offer.price_stars,
    });
    this.analytics.track('checkout_started', userId, { sku, provider: 'telegram_stars', stars: offer.price_stars });
    return { invoiceLink: link, intentId: id };
  }

  /** pre_checkout_query: Telegram pregunta si aceptamos el pago (responder en < 10 s). */
  validatePreCheckout(q: { fromTelegramId: string; payload: string; currency: string; totalAmount: number }): { ok: boolean; error?: string } {
    const intent = this.db.get<{ user_id: string; sku: string; amount: number; status: string }>(
      'SELECT user_id, sku, amount, status FROM payment_intents WHERE id = ?',
      q.payload,
    );
    if (!intent || intent.status !== 'pending') return { ok: false, error: 'La factura ya no es válida. Vuelve a intentarlo desde el juego.' };
    if (q.currency !== 'XTR' || q.totalAmount !== intent.amount) return { ok: false, error: 'El importe no coincide.' };
    const tg = this.stars?.telegramIdOf(intent.user_id);
    if (!tg || tg !== q.fromTelegramId) return { ok: false, error: 'Esta factura pertenece a otra cuenta.' };
    const offer = this.row(intent.sku);
    if (!offer?.active) return { ok: false, error: 'La oferta ya no está disponible.' };
    if (offer.once_per_user && this.bought(intent.user_id, intent.sku)) return { ok: false, error: 'Ya compraste esta oferta.' };
    return { ok: true };
  }

  /** successful_payment: entrega definitiva (idempotente por telegram_payment_charge_id). */
  onStarsPaid(p: { fromTelegramId: string; payload: string; currency: string; totalAmount: number; chargeId: string }) {
    const intent = this.db.get<{ id: string; user_id: string; sku: string; amount: number; status: string }>(
      'SELECT id, user_id, sku, amount, status FROM payment_intents WHERE id = ?',
      p.payload,
    );
    if (!intent) {
      this.log.error('stars payment without intent', { payload: p.payload, chargeId: p.chargeId });
      return null;
    }
    if (p.currency !== 'XTR' || p.totalAmount !== intent.amount) {
      this.log.error('stars payment amount mismatch', { payload: p.payload, total: p.totalAmount });
    }
    const usdCents = Math.round(p.totalAmount * this.ecoCfg.get().telegram.starUsdCents);
    const r = this.fulfill({
      userId: intent.user_id,
      sku: intent.sku,
      provider: 'telegram_stars',
      providerRef: p.chargeId,
      amountCents: usdCents,
      amountStars: p.totalAmount,
      currency: 'XTR',
      sandbox: false,
    });
    this.db.run("UPDATE payment_intents SET status = 'paid', provider_ref = ?, paid_at = ? WHERE id = ? AND status = 'pending'", p.chargeId, clock.now(), intent.id);
    return r;
  }

  intentStatus(userId: string, intentId: string) {
    return this.db.get<{ status: string }>('SELECT status FROM payment_intents WHERE id = ? AND user_id = ?', intentId, userId)?.status ?? null;
  }

  /** Reembolso de Stars (admin). Retira lo entregado si el jugador aún lo conserva. */
  async refund(purchaseId: string, actorId: string) {
    const p = this.db.get<{ id: string; user_id: string; sku: string; provider: string; provider_ref: string; status: string }>(
      'SELECT id, user_id, sku, provider, provider_ref, status FROM purchases WHERE id = ?',
      purchaseId,
    );
    if (!p) throw notFound('Compra no encontrada.');
    if (p.status !== 'completed') throw badRequest('invalid_state', 'La compra no está completada.');
    if (p.provider === 'telegram_stars') {
      const tg = this.stars?.telegramIdOf(p.user_id);
      if (!tg || !this.stars) throw badRequest('no_telegram', 'No hay cuenta de Telegram vinculada.');
      await this.stars.refundStars(tg, p.provider_ref);
    } else if (p.provider !== 'sandbox') throw badRequest('unsupported', 'Proveedor sin reembolso automático.');
    const offer = this.row(p.sku);
    this.db.tx(() => {
      const bal = this.economy.balances(p.user_id).gems;
      const take = Math.min(bal, offer?.gems ?? 0);
      if (take > 0) {
        this.economy.apply({ userId: p.user_id, type: 'refund', idempotencyKey: `refund:${p.id}`, details: { purchaseId: p.id, by: actorId }, currency: [{ code: 'gems', delta: -take, reason: 'refund' }] });
      }
      if (offer?.vip_days) this.db.run('UPDATE users SET vip_until = MAX(?, COALESCE(vip_until, 0) - ?) WHERE id = ?', clock.now(), offer.vip_days * DAY_MS, p.user_id);
      this.db.run("UPDATE purchases SET status = 'refunded' WHERE id = ?", p.id);
      this.db.run("UPDATE payment_intents SET status = 'refunded' WHERE provider_ref = ?", p.provider_ref);
    });
    return { ok: true };
  }

  // ------------------------------------------------------------------ VIP

  claimVipDaily(userId: string) {
    if (!this.isVip(userId)) throw forbidden('El cofre diario es un beneficio VIP.');
    const day = new Date(startOfUtcDay(clock.now())).toISOString().slice(0, 10);
    const gems = this.ecoCfg.get().vip.dailyGems;
    const tx = this.economy.apply({
      userId,
      type: 'vip_daily',
      idempotencyKey: `vip_daily:${userId}:${day}`,
      currency: gems > 0 ? [{ code: 'gems', delta: gems, reason: 'vip_daily' }] : [],
    });
    if (tx.duplicate) throw badRequest('already_claimed', 'Ya abriste el cofre VIP de hoy.');
    return { gems };
  }
}
