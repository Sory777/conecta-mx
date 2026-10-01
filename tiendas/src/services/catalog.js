import crypto from 'node:crypto';
import { db, tx } from '../db.js';
import { env } from '../config/env.js';
import { STORES, getStore } from '../config/stores.js';
import { getSupplier } from '../suppliers/index.js';

const hash = (s) => crypto.createHash('sha1').update(s).digest().readUInt32BE(0);

// Precio "psicológico" en pesos: 237.4 -> 239, 1012 -> 1019.
export function prettyPriceCents(mxn) {
  return (Math.ceil((mxn + 1) / 10) * 10 - 1) * 100;
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

// Asigna productos y precios a una tienda. Cada tienda recibe ~80 % del catálogo
// y destacados distintos, para que no se vean idénticas.
export function repriceStore(slug) {
  const markup = storeMarkup(slug);
  const products = db.prepare('SELECT id, cost_cents, shipping_cents FROM products WHERE active = 1').all();
  tx(() => {
    db.prepare('DELETE FROM store_products WHERE store_slug = ?').run(slug);
    const ins = db.prepare('INSERT INTO store_products (store_slug, product_id, price_cents, featured) VALUES (?, ?, ?, ?)');
    for (const p of products) {
      const h = hash(`${slug}:${p.id}`);
      if (h % 10 >= 8) continue;
      const landed = (p.cost_cents + p.shipping_cents) / 100;
      ins.run(slug, p.id, prettyPriceCents(landed * (1 + markup)), h % 7 === 0 ? 1 : 0);
    }
  });
}

export async function syncCatalog(supplierName = env.supplier) {
  const supplier = getSupplier(supplierName);
  const feed = await supplier.fetchCatalog();
  const toCents = (usd) => Math.round(usd * env.usdToMxn * 100);
  const seen = [];
  tx(() => {
    const up = db.prepare(`INSERT INTO products
      (supplier, supplier_product_id, supplier_variant_id, title, description, category, image_url, icon, cost_cents, shipping_cents, active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
      ON CONFLICT(supplier, supplier_variant_id) DO UPDATE SET
        title = excluded.title, description = excluded.description, category = excluded.category,
        image_url = excluded.image_url, icon = excluded.icon, cost_cents = excluded.cost_cents,
        shipping_cents = excluded.shipping_cents, active = 1, updated_at = excluded.updated_at`);
    for (const p of feed) {
      up.run(supplier.name, p.supplierProductId, p.supplierVariantId, p.title, p.description || '', p.category,
        p.imageUrl, p.icon, toCents(p.costUsd), toCents(p.shippingUsd || 0));
      seen.push(p.supplierVariantId);
    }
    // Lo que el proveedor ya no ofrece se desactiva (no se borra: hay pedidos que lo referencian).
    const all = db.prepare('SELECT id, supplier_variant_id FROM products WHERE supplier = ?').all(supplier.name);
    const keep = new Set(seen);
    const off = db.prepare('UPDATE products SET active = 0 WHERE id = ?');
    for (const r of all) if (!keep.has(r.supplier_variant_id)) off.run(r.id);
  });
  for (const s of STORES) repriceStore(s.slug);
  return { supplier: supplier.name, imported: feed.length };
}

export function listStoreProducts(slug, { category, q, featured, limit = 60 } = {}) {
  const where = ['sp.store_slug = ?', 'p.active = 1'];
  const args = [slug];
  if (category) { where.push('p.category = ?'); args.push(category); }
  if (q) { where.push('p.title LIKE ?'); args.push(`%${q}%`); }
  if (featured) where.push('sp.featured = 1');
  args.push(limit);
  return db.prepare(`SELECT p.id, p.title, p.description, p.category, p.image_url, p.icon, sp.price_cents, sp.featured
    FROM store_products sp JOIN products p ON p.id = sp.product_id
    WHERE ${where.join(' AND ')} ORDER BY sp.featured DESC, p.id LIMIT ?`).all(...args);
}

export function getStoreProduct(slug, id) {
  return db.prepare(`SELECT p.*, sp.price_cents FROM store_products sp JOIN products p ON p.id = sp.product_id
    WHERE sp.store_slug = ? AND p.id = ? AND p.active = 1`).get(slug, id) || null;
}

export function catalogIsEmpty() {
  return db.prepare('SELECT COUNT(*) n FROM products').get().n === 0;
}
