import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { Db } from '../../db/database';
import { clock, DAY_MS } from '../../lib/clock';
import { badRequest, forbidden, notFound, tooMany } from '../../lib/errors';
import { newId } from '../../lib/ids';
import type { Logger } from '../../lib/logger';
import type { AnalyticsService } from '../analytics/service';
import type { Economy } from '../economy/ledger';
import type { ItemCatalog } from '../inventory/catalog';
import type { InventoryService } from '../inventory/service';
import type { SeasonService } from '../seasons/service';
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
  gemPacks: z.array(z.object({ sku: z.string(), gems: z.number().int().positive(), priceCents: z.number().int().positive(), currency: z.string(), label: z.string() })),
});

/**
 * Tienda. Separación estricta:
 *  - Productos se pagan con monedas (se ganan jugando) o gemas (premium). NUNCA con puntos de recompensa.
 *  - Las gemas se compran con dinero real a través de un PaymentProvider (sandbox en el MVP).
 */
export class StoreService {
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
    for (const g of data.gemPacks) {
      this.db.run(
        'INSERT OR IGNORE INTO gem_packs(sku, label, gems, price_cents, currency, active) VALUES (?, ?, ?, ?, ?, 1)',
        g.sku,
        g.label,
        g.gems,
        g.priceCents,
        g.currency,
      );
    }
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
    const gemPacks = this.db.all('SELECT sku, label, gems, price_cents AS priceCents, currency FROM gem_packs WHERE active = 1 ORDER BY price_cents');
    const season = this.seasons.current();
    return {
      products,
      gemPacks,
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

  /** Compra de gemas con dinero real. En el MVP sólo existe el proveedor SANDBOX (no se cobra nada). */
  async buyGems(userId: string, sku: string, receipt?: string) {
    if (!this.payments) throw forbidden('No hay proveedor de pagos configurado.');
    const pack = this.db.get<{ sku: string; gems: number; price_cents: number; currency: string }>(
      'SELECT sku, gems, price_cents, currency FROM gem_packs WHERE sku = ? AND active = 1',
      sku,
    );
    if (!pack) throw notFound('Paquete no disponible.');
    if (this.payments.sandbox) {
      const today = this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM purchases WHERE user_id = ? AND sandbox = 1 AND created_at > ?', userId, clock.now() - DAY_MS)!.n;
      if (today >= 10) throw tooMany('Límite de compras sandbox por día alcanzado.');
    }
    const v = await this.payments.verify({ sku, priceCents: pack.price_cents, currency: pack.currency, receipt });
    if (!v.valid) throw badRequest('invalid_receipt', 'No se pudo verificar la compra.');
    return this.db.tx(() => {
      if (this.db.get('SELECT 1 FROM purchases WHERE provider = ? AND provider_ref = ?', this.payments!.id, v.providerRef)) {
        throw badRequest('duplicate_receipt', 'Esta compra ya fue procesada.');
      }
      const tx = this.economy.apply({
        userId,
        type: 'iap',
        idempotencyKey: `iap:${this.payments!.id}:${v.providerRef}`,
        details: { sku, sandbox: v.sandbox, amountCents: v.amountCents },
        currency: [{ code: 'gems', delta: pack.gems, reason: v.sandbox ? 'iap_sandbox' : 'iap' }],
      });
      this.db.run(
        'INSERT INTO purchases(id, user_id, sku, provider, provider_ref, amount_cents, currency, status, sandbox, transaction_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        newId(),
        userId,
        sku,
        this.payments!.id,
        v.providerRef,
        v.amountCents,
        v.currency,
        'completed',
        v.sandbox ? 1 : 0,
        tx.txId,
        clock.now(),
      );
      this.analytics.track('iap', userId, { sku, amountCents: v.amountCents, sandbox: v.sandbox });
      return { ok: true, gems: pack.gems, sandbox: v.sandbox };
    });
  }
}
