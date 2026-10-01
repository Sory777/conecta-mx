import { db, tx } from '../db.js';
import { env } from '../config/env.js';
import { STORES, getStore } from '../config/stores.js';
import { getSupplier } from '../suppliers/index.js';
import { estimateFeeCents } from '../payments/index.js';

// Precio "psicológico" en pesos: 237.4 -> 239, 1012 -> 1019.
export function prettyPriceCents(mxn) {
  return (Math.ceil((mxn + 1) / 10) * 10 - 1) * 100;
}

// Lo que te queda por pieza vendida: precio − costo del proveedor (producto + envío) − comisión de pago.
export function unitProfitCents(priceCents, landedCents) {
  return priceCents - landedCents - estimateFeeCents(priceCents);
}

export function storeMarkup(slug) {
  const row = db.prepare('SELECT markup FROM store_settings WHERE store_slug = ?').get(slug);
  return row?.markup ?? getStore(slug).markup;
}

export function isStoreActive(slug) {
  const row = db.prepare('SELECT active FROM store_settings WHERE store_slug = ?').get(slug);
  return row ? !!row.active : true;
}

export function updateStoreSettings(slug, { markup, active }) {
  db.prepare(`INSERT INTO store_settings (store_slug, markup, active) VALUES (?, ?, ?)
    ON CONFLICT(store_slug) DO UPDATE SET markup = excluded.markup, active = excluded.active`)
    .run(slug, markup, active ? 1 : 0);
  repriceStore(slug);
}

// Precios de una tienda: solo SUS productos (ninguna tienda repite los de otra).
// Los 4 más populares de la tienda salen como destacados.
export function repriceStore(slug) {
  const markup = storeMarkup(slug);
  const products = db.prepare(`SELECT id, cost_cents, shipping_cents FROM products
    WHERE active = 1 AND store_slug = ? ORDER BY popularity DESC, id`).all(slug);
  tx(() => {
    db.prepare('DELETE FROM store_products WHERE store_slug = ?').run(slug);
    const ins = db.prepare('INSERT INTO store_products (store_slug, product_id, price_cents, featured) VALUES (?, ?, ?, ?)');
    products.forEach((p, i) => {
      const landed = (p.cost_cents + p.shipping_cents) / 100;
      ins.run(slug, p.id, prettyPriceCents(landed * (1 + markup)), i < 4 ? 1 : 0);
    });
  });
}

// Búsquedas de nicho de todas las tiendas, intercaladas por ronda para que ninguna
// tienda acapare los productos más populares cuando dos nichos se parecen.
export function nicheSearches(stores = STORES) {
  const perStore = stores.map((s) => s.categories.flatMap((category) =>
    (s.niche?.[category] || []).map(([query, label, icon]) => ({ store: s.slug, category, query, label, icon }))));
  const rounds = Math.max(0, ...perStore.map((l) => l.length));
  const out = [];
  for (let i = 0; i < rounds; i++) for (const list of perStore) if (list[i]) out.push(list[i]);
  return out;
}

export async function syncCatalog(supplierName = env.supplier) {
  const supplier = getSupplier(supplierName);
  const feed = await supplier.fetchCatalog({ searches: nicheSearches() });
  if (!feed.length) throw new Error('El proveedor no devolvió productos; se conserva el catálogo actual');
  const toCents = (usd) => Math.round(usd * env.usdToMxn * 100);
  const seen = new Set();
  tx(() => {
    const up = db.prepare(`INSERT INTO products
      (supplier, supplier_product_id, supplier_variant_id, title, description, category, image_url, icon, cost_cents, shipping_cents,
       store_slug, popularity, search_term, active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
      ON CONFLICT(supplier, supplier_variant_id) DO UPDATE SET
        title = excluded.title, description = excluded.description, category = excluded.category,
        image_url = excluded.image_url, icon = excluded.icon, cost_cents = excluded.cost_cents,
        shipping_cents = excluded.shipping_cents, store_slug = excluded.store_slug, popularity = excluded.popularity,
        search_term = excluded.search_term, active = 1, updated_at = excluded.updated_at`);
    for (const p of feed) {
      if (seen.has(p.supplierVariantId)) continue; // un producto, una sola tienda
      seen.add(p.supplierVariantId);
      up.run(supplier.name, p.supplierProductId, p.supplierVariantId, p.title, p.description || '', p.category,
        p.imageUrl, p.icon, toCents(p.costUsd), toCents(p.shippingUsd || 0), p.store, p.popularity || 0, p.searchTerm || null);
    }
    // Lo que el proveedor ya no ofrece se desactiva (no se borra: hay pedidos que lo referencian).
    const all = db.prepare('SELECT id, supplier_variant_id FROM products WHERE supplier = ?').all(supplier.name);
    const off = db.prepare('UPDATE products SET active = 0 WHERE id = ?');
    for (const r of all) if (!seen.has(r.supplier_variant_id)) off.run(r.id);
    // Productos de otro proveedor (p. ej. el demo al pasar a CJ) dejan de venderse.
    db.prepare('UPDATE products SET active = 0 WHERE supplier != ?').run(supplier.name);
  });
  for (const s of STORES) repriceStore(s.slug);
  return { supplier: supplier.name, imported: seen.size };
}

export function setProductTitle(id, title) {
  const t = String(title || '').trim().slice(0, 200);
  db.prepare('UPDATE products SET title_custom = ? WHERE id = ?').run(t || null, id);
}

export function listStoreProducts(slug, { category, q, featured, limit = 60 } = {}) {
  const where = ['sp.store_slug = ?', 'p.active = 1'];
  const args = [slug];
  if (category) { where.push('p.category = ?'); args.push(category); }
  if (q) { where.push('(COALESCE(p.title_custom, p.title) LIKE ? OR p.search_term LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
  if (featured != null) where.push(`sp.featured = ${featured ? 1 : 0}`);
  args.push(limit);
  return db.prepare(`SELECT p.id, COALESCE(p.title_custom, p.title) title, p.description, p.category, p.image_url, p.icon,
      sp.price_cents, sp.featured
    FROM store_products sp JOIN products p ON p.id = sp.product_id
    WHERE ${where.join(' AND ')} ORDER BY sp.featured DESC, p.popularity DESC, p.id LIMIT ?`).all(...args);
}

export function getStoreProduct(slug, id) {
  return db.prepare(`SELECT p.id, COALESCE(p.title_custom, p.title) title, p.description, p.category, p.image_url, p.icon,
      p.supplier, p.supplier_variant_id, p.cost_cents, p.shipping_cents, sp.price_cents
    FROM store_products sp JOIN products p ON p.id = sp.product_id
    WHERE sp.store_slug = ? AND p.id = ? AND p.active = 1`).get(slug, id) || null;
}

export function catalogIsEmpty() {
  return db.prepare('SELECT COUNT(*) n FROM products').get().n === 0;
}
