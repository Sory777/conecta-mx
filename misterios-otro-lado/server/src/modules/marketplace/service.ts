import type { Db } from '../../db/database';
import { clock, DAY_MS } from '../../lib/clock';
import { badRequest, forbidden, notFound, tooMany } from '../../lib/errors';
import { newId } from '../../lib/ids';
import type { AnalyticsService } from '../analytics/service';
import type { AntiFraudService } from '../antifraud/service';
import type { EconomyConfigService } from '../economy/config';
import type { Economy } from '../economy/ledger';
import type { ItemCatalog } from '../inventory/catalog';
import type { SocialService } from '../social/service';

/**
 * Marketplace entre jugadores — SÓLO con moneda virtual (monedas). Desactivado por defecto.
 * El dinero real entre jugadores NO está soportado: requiere cumplimiento legal, fiscal,
 * de pagos y KYC (ver ROADMAP / SECURITY).
 * - Custodia (escrow): el objeto listado queda bloqueado y no puede usarse ni duplicarse.
 * - Comisión de plataforma (sumidero de monedas).
 * - Límites, historial, cancelación, bloqueo entre usuarios, moderación (admin puede retirar).
 */
export class MarketplaceService {
  constructor(
    private readonly db: Db,
    private readonly ecoCfg: EconomyConfigService,
    private readonly economy: Economy,
    private readonly catalog: ItemCatalog,
    private readonly antifraud: AntiFraudService,
    private readonly social: SocialService,
    private readonly analytics: AnalyticsService,
  ) {}

  private guard(userId: string) {
    const cfg = this.ecoCfg.get().marketplace;
    if (!cfg.enabled) throw forbidden('El mercado entre jugadores aún no está disponible.');
    const u = this.db.get<{ created_at: number; status: string }>('SELECT created_at, status FROM users WHERE id = ?', userId)!;
    if (u.status !== 'active') throw forbidden('Cuenta no activa.');
    if (clock.now() - u.created_at < cfg.minAccountAgeDays * DAY_MS) throw forbidden(`Tu cuenta necesita ${cfg.minAccountAgeDays} días de antigüedad para comerciar.`);
    if (this.antifraud.userRisk(userId).hold) throw forbidden('Tu cuenta está en revisión.');
    return cfg;
  }

  listings(viewerId: string) {
    const blocked = this.social.blockedBy(viewerId);
    return this.db
      .all<{ id: string; seller_id: string; seller: string; item_id: string; price: number; created_at: number }>(
        `SELECT l.id, l.seller_id, u.username AS seller, l.item_id, l.price, l.created_at FROM marketplace_listings l JOIN users u ON u.id = l.seller_id
         WHERE l.status = 'active' ORDER BY l.created_at DESC LIMIT 100`,
      )
      .filter((l) => !blocked.has(l.seller_id))
      .map((l) => {
        const d = this.catalog.get(l.item_id);
        return { ...l, itemName: d?.name ?? l.item_id, rarity: d?.rarity ?? 'common', mine: l.seller_id === viewerId };
      });
  }

  create(userId: string, instanceId: string, price: number) {
    const cfg = this.guard(userId);
    if (!Number.isInteger(price) || price < cfg.minPrice || price > cfg.maxPrice) throw badRequest('invalid_price', `Precio entre ${cfg.minPrice} y ${cfg.maxPrice} monedas.`);
    return this.db.tx(() => {
      const active = this.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM marketplace_listings WHERE seller_id = ? AND status = 'active'", userId)!.n;
      if (active >= cfg.maxActiveListings) throw tooMany('Tienes demasiadas publicaciones activas.');
      const inst = this.db.get<{ id: string; item_id: string; quantity: number; state: string }>(
        'SELECT id, item_id, quantity, state FROM inventory_items WHERE id = ? AND user_id = ?',
        instanceId,
        userId,
      );
      if (!inst || inst.state !== 'owned' || inst.quantity < 1) throw notFound('Objeto no disponible.');
      const def = this.catalog.require(inst.item_id);
      if (!def.tradeable) throw badRequest('not_tradeable', 'Este objeto no se puede comerciar.');
      const eq = this.db.get<{ appearance: string }>('SELECT appearance FROM characters WHERE user_id = ?', userId);
      if (eq && eq.appearance.includes(`"${def.id}"`) && !def.stackable) throw badRequest('equipped', 'Desequipa el objeto antes de venderlo.');
      const now = clock.now();
      let escrowId = inst.id;
      if (inst.quantity > 1) {
        // Separar una unidad en su propia instancia en custodia
        this.db.run('UPDATE inventory_items SET quantity = quantity - 1, updated_at = ? WHERE id = ?', now, inst.id);
        escrowId = newId();
        this.db.run(
          "INSERT INTO inventory_items(id, user_id, item_id, quantity, state, source, acquired_at, updated_at) VALUES (?, ?, ?, 1, 'escrow', 'marketplace_split', ?, ?)",
          escrowId,
          userId,
          inst.item_id,
          now,
          now,
        );
      } else {
        this.db.run("UPDATE inventory_items SET state = 'escrow', updated_at = ? WHERE id = ?", now, inst.id);
      }
      const id = newId();
      this.db.run(
        "INSERT INTO marketplace_listings(id, seller_id, inventory_item_id, item_id, price, currency, status, created_at) VALUES (?, ?, ?, ?, ?, 'coins', 'active', ?)",
        id,
        userId,
        escrowId,
        inst.item_id,
        price,
        now,
      );
      return { id };
    });
  }

  cancel(userId: string, listingId: string, byAdmin = false) {
    return this.db.tx(() => {
      const l = this.db.get<{ id: string; seller_id: string; inventory_item_id: string; status: string }>(
        'SELECT id, seller_id, inventory_item_id, status FROM marketplace_listings WHERE id = ?',
        listingId,
      );
      if (!l || (!byAdmin && l.seller_id !== userId)) throw notFound('Publicación no encontrada.');
      if (l.status !== 'active') throw badRequest('not_active', 'La publicación ya no está activa.');
      this.db.run("UPDATE inventory_items SET state = 'owned', updated_at = ? WHERE id = ?", clock.now(), l.inventory_item_id);
      this.db.run('UPDATE marketplace_listings SET status = ?, closed_at = ? WHERE id = ?', byAdmin ? 'removed' : 'cancelled', clock.now(), l.id);
      return { ok: true };
    });
  }

  buy(buyerId: string, listingId: string) {
    const cfg = this.guard(buyerId);
    return this.db.tx(() => {
      const l = this.db.get<{ id: string; seller_id: string; inventory_item_id: string; item_id: string; price: number; status: string }>(
        'SELECT id, seller_id, inventory_item_id, item_id, price, status FROM marketplace_listings WHERE id = ?',
        listingId,
      );
      if (!l || l.status !== 'active') throw notFound('La publicación ya no está disponible.');
      if (l.seller_id === buyerId) throw badRequest('own_listing', 'No puedes comprar tu propia publicación.');
      if (this.social.isBlockedEither(buyerId, l.seller_id)) throw forbidden('No puedes comerciar con este jugador.');
      const today = this.db.get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM marketplace_listings WHERE buyer_id = ? AND status = 'sold' AND closed_at > ?",
        buyerId,
        clock.now() - DAY_MS,
      )!.n;
      if (today >= cfg.dailyPurchaseLimit) throw tooMany('Alcanzaste el límite diario de compras en el mercado.');
      if (this.antifraud.sharesDevice(buyerId, l.seller_id)) {
        this.antifraud.flag(buyerId, 'trade_same_device', 10, { listingId, sellerId: l.seller_id });
        throw forbidden('Transacción bloqueada por seguridad.');
      }
      const commission = Math.floor((l.price * cfg.commissionPct) / 100);
      this.economy.apply({
        userId: buyerId,
        type: 'trade',
        idempotencyKey: `trade_buy:${l.id}`,
        details: { listingId: l.id, sellerId: l.seller_id, price: l.price },
        currency: [{ code: 'coins', delta: -l.price, reason: 'marketplace_buy' }],
      });
      this.economy.apply({
        userId: l.seller_id,
        type: 'trade',
        idempotencyKey: `trade_sell:${l.id}`,
        details: { listingId: l.id, buyerId, price: l.price, commission },
        currency: [{ code: 'coins', delta: l.price - commission, reason: 'marketplace_sale' }],
      });
      const now = clock.now();
      this.db.run("UPDATE inventory_items SET user_id = ?, state = 'owned', source = 'marketplace', updated_at = ? WHERE id = ?", buyerId, now, l.inventory_item_id);
      this.db.run(
        'INSERT INTO item_ledger(id, transaction_id, user_id, item_id, instance_id, delta, reason, created_at) VALUES (?, NULL, ?, ?, ?, -1, ?, ?), (?, NULL, ?, ?, ?, 1, ?, ?)',
        newId(), l.seller_id, l.item_id, l.inventory_item_id, 'marketplace_sale', now,
        newId(), buyerId, l.item_id, l.inventory_item_id, 'marketplace_buy', now,
      );
      this.db.run("UPDATE marketplace_listings SET status = 'sold', buyer_id = ?, commission = ?, closed_at = ? WHERE id = ?", buyerId, commission, now, l.id);
      this.analytics.track('trade', buyerId, { listingId: l.id, price: l.price, commission });
      return { ok: true };
    });
  }

  history(userId: string) {
    return this.db.all(
      `SELECT id, item_id, price, commission, status, created_at, closed_at, CASE WHEN seller_id = ? THEN 'venta' ELSE 'compra' END AS side
       FROM marketplace_listings WHERE seller_id = ? OR buyer_id = ? ORDER BY created_at DESC LIMIT 50`,
      userId,
      userId,
      userId,
    );
  }
}
