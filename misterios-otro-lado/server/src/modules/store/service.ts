import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { Db } from '../../db/database';
import { clock } from '../../lib/clock';
import { badRequest, notFound } from '../../lib/errors';
import { newId } from '../../lib/ids';
import type { Logger } from '../../lib/logger';
import type { AnalyticsService } from '../analytics/service';
import type { Economy } from '../economy/ledger';
import type { ItemCatalog } from '../inventory/catalog';
import type { InventoryService } from '../inventory/service';
import type { SeasonService } from '../seasons/service';
import { OfferSchema } from './offers';
import type { PaymentProvider } from './payments';

export const ProductSchema = z.object({
  sku: z.string().regex(/^[a-z0-9_]{2,40}$/),
  name: z.string().min(1).max(60),
  description: z.string().max(300),
  category: z.string().min(1).max(30),
  itemId: z.string().nullable().optional(),
  priceCurrency: z.enum(['coins', 'gems']),
  price: z.number().int().min(1).max(1_000_000),
  seasonId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

const StoreFile = z.object({
  products: z.array(ProductSchema),
  offers: z.array(OfferSchema).default([]),
});

/**
 * Tienda. Separación estricta:
 *  - Productos se pagan con monedas (se ganan jugando) o gemas (premium). NUNCA con puntos de recompensa.
 *  - Las gemas se compran con dinero real a través de un PaymentProvider (sandbox en el MVP).
 */
export class StoreService {
  /** Ofertas de pago leídas del archivo; las inserta OffersService. */
  offersToLoad: z.infer<typeof OfferSchema>[] = [];

  constructor(
    private readonly db: Db,
    private readonly log: Logger,
    private readonly catalog: ItemCatalog,
    private readonly inventory: InventoryService,
    private readonly economy: Economy,
    private readonly seasons: SeasonService,
    private readonly analytics: AnalyticsService,
    private readonly payments: PaymentProvider | null,
  ) {}

  loadFromFile(file: string) {
    let data: z.infer<typeof StoreFile>;
    try {
      data = StoreFile.parse(JSON.parse(readFileSync(file, 'utf8')));
    } catch (e) {
      this.log.warn('store file not loaded', { err: String(e) });
      return;
    }
    for (const p of data.products) if (!this.db.get('SELECT 1 FROM store_products WHERE sku = ?', p.sku)) this.upsertProduct(p);
    this.offersToLoad = data.offers;
  }

  upsertProduct(p: z.infer<typeof ProductSchema>) {
    if (p.itemId) this.catalog.require(p.itemId);
    this.db.run(
      `INSERT INTO store_products(id, sku, name, description, category, item_id, price_currency, price, season_id, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(sku) DO UPDATE SET name = excluded.name, description = excluded.description, category = excluded.category,
       item_id = excluded.item_id, price_currency = excluded.price_currency, price = excluded.price, season_id = excluded.season_id, active = excluded.active`,
      newId(),
      p.sku,
      p.name,
      p.description,
      p.category,
      p.itemId ?? null,
      p.priceCurrency,
      p.price,
      p.seasonId ?? null,
      p.active === false ? 0 : 1,
      clock.now(),
    );
  }

  catalogFor(userId: string) {
    const owned = this.inventory.ownedItemIds(userId);
    const products = this.db
      .all<{ sku: string; name: string; description: string; category: string; item_id: string | null; price_currency: string; price: number; season_id: string | null }>(
        'SELECT sku, name, description, category, item_id, price_currency, price, season_id FROM store_products WHERE active = 1 ORDER BY price_currency, price',
      )
      .filter((p) => !p.season_id || this.seasons.isActive(p.season_id))
      .map((p) => {
        const def = p.item_id ? this.catalog.get(p.item_id) : null;
        return {
          sku: p.sku,
          name: p.name,
          description: p.description,
          category: p.category,
          itemId: p.item_id,
          rarity: def?.rarity ?? 'common',
          priceCurrency: p.price_currency,
          price: p.price,
          limited: !!p.season_id,
          owned: !!(def && !def.stackable && owned.has(def.id)),
        };
      });
    const season = this.seasons.current();
    return {
      products,
      paymentsSandbox: this.payments?.sandbox ?? true,
      paymentsAvailable: !!this.payments,
      seasonPass: season ? { seasonId: season.id, name: season.name, priceGems: season.premium_price_gems } : null,
    };
  }

  buy(userId: string, sku: string, idempotencyKey: string) {
    // Reintento de una compra ya procesada (p. ej. red inestable): responder sin volver a cobrar.
    if (this.db.get('SELECT 1 FROM transactions WHERE idempotency_key = ?', `store:${userId}:${idempotencyKey}`)) {
      return { ok: true, duplicate: true, item: null };
    }
    const p = this.db.get<{ sku: string; item_id: string | null; price_currency: 'coins' | 'gems'; price: number; season_id: string | null; name: string }>(
      'SELECT sku, item_id, price_currency, price, season_id, name FROM store_products WHERE sku = ? AND active = 1',
      sku,
    );
    if (!p) throw notFound('Producto no disponible.');
    if (p.season_id && !this.seasons.isActive(p.season_id)) throw badRequest('expired', 'Este producto de temporada ya no está disponible.');
    const def = p.item_id ? this.catalog.require(p.item_id) : null;
    if (def && !def.stackable && this.inventory.owns(userId, def.id)) throw badRequest('already_owned', 'Ya tienes este objeto.');
    const tx = this.economy.apply({
      userId,
      type: 'purchase',
      idempotencyKey: `store:${userId}:${idempotencyKey}`,
      details: { sku, price: p.price, currency: p.price_currency },
      currency: [{ code: p.price_currency, delta: -p.price, reason: `store:${sku}` }],
      grantItems: def ? [{ itemId: def.id, qty: 1 }] : [],
      source: 'store',
    });
    if (!tx.duplicate) this.analytics.track('store_purchase', userId, { sku, price: p.price, currency: p.price_currency });
    return { ok: true, duplicate: tx.duplicate, item: def?.name ?? null };
  }


}
