import crypto from 'node:crypto';
import { q, one, tx } from '../db.js';
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

export async function storeMarkup(slug) {
  const row = await one('SELECT markup FROM tiendas.store_settings WHERE store_slug = $1', [slug]);
  return row?.markup ?? getStore(slug).markup;
}

export async function isStoreActive(slug) {
  const row = await one('SELECT active FROM tiendas.store_settings WHERE store_slug = $1', [slug]);
  return row ? !!row.active : true;
}

export async function activeStoreSlugs() {
  const off = new Set((await q('SELECT store_slug FROM tiendas.store_settings WHERE active = 0')).map((r) => r.store_slug));
  return STORES.map((s) => s.slug).filter((slug) => !off.has(slug));
}

export async function updateStoreSettings(slug, { markup, active }) {
  await q(`INSERT INTO tiendas.store_settings (store_slug, markup, active) VALUES ($1, $2, $3)
    ON CONFLICT (store_slug) DO UPDATE SET markup = excluded.markup, active = excluded.active`, [slug, markup, active ? 1 : 0]);
  await repriceStore(slug);
}

// Precios de una tienda: solo SUS productos (ninguna tienda repite los de otra).
// Los 4 más populares de la tienda salen como destacados.
export async function repriceStore(slug) {
  const markup = await storeMarkup(slug);
  const products = await q(`SELECT id, cost_cents, shipping_cents FROM tiendas.products
    WHERE active = 1 AND hidden = 0 AND store_slug = $1 ORDER BY popularity DESC, id`, [slug]);
  const ids = [], prices = [], featured = [];
  products.forEach((p, i) => {
    ids.push(p.id);
    prices.push(prettyPriceCents(((p.cost_cents + p.shipping_cents) / 100) * (1 + markup)));
    featured.push(i < 4 ? 1 : 0);
  });
  await tx(async (t) => {
    await t('DELETE FROM tiendas.store_products WHERE store_slug = $1', [slug]);
    if (ids.length) {
      await t(`INSERT INTO tiendas.store_products (store_slug, product_id, price_cents, featured)
        SELECT $1, * FROM unnest($2::int[], $3::int[], $4::int[])`, [slug, ids, prices, featured]);
    }
  });
}

// Búsquedas de nicho de todas las tiendas, intercaladas por ronda para que ninguna
// tienda acapare los productos más populares cuando dos nichos se parecen.
export function nicheSearches(stores = STORES) {
  const perStore = stores.map((s) => s.categories.flatMap((category) =>
    (s.niche?.[category] || []).flatMap(([query, label, icon]) => {
      const base = { store: s.slug, category, icon, colors: s.onlyColors || null };
      if (!s.audiences) return [{ ...base, query, label, audience: null }];
      return Object.entries(s.audiences).map(([key, a]) => ({
        ...base, query: `${a.en} ${query}`, label: `${label} para ${a.name.toLowerCase()}`, audience: key,
      }));
    })));
  const rounds = Math.max(0, ...perStore.map((l) => l.length));
  const out = [];
  for (let i = 0; i < rounds; i++) for (const list of perStore) if (list[i]) out.push(list[i]);
  return out;
}

// ---------------------------------------------------------------------------
// Sincronización por partes: cada paso procesa búsquedas hasta agotar su tiempo y guarda
// el avance en la base, así funciona en servidores con límite de tiempo por petición (Vercel).

export async function syncStatus() {
  return one('SELECT * FROM tiendas.sync_state WHERE id = 1');
}

export async function startSync(supplierName = env.supplier) {
  getSupplier(supplierName); // valida el nombre
  const run = crypto.randomBytes(6).toString('hex');
  await q(`INSERT INTO tiendas.sync_state (id, run, supplier, cursor, total, imported, started_at, finished_at, last_error)
    VALUES (1, $1, $2, 0, $3, 0, now(), NULL, NULL)
    ON CONFLICT (id) DO UPDATE SET run = excluded.run, supplier = excluded.supplier, cursor = 0, total = excluded.total,
      imported = 0, started_at = now(), finished_at = NULL, last_error = NULL`, [run, supplierName, nicheSearches().length]);
  return syncStatus();
}

const toCents = (usd) => Math.round(usd * env.usdToMxn * 100);

async function upsertProduct(supplierName, run, p) {
  await q(`INSERT INTO tiendas.products
      (supplier, supplier_product_id, supplier_variant_id, title, description, category, image_url, icon, cost_cents, shipping_cents,
       store_slug, popularity, search_term, audience, sync_run, active, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 1, now())
    ON CONFLICT (supplier, supplier_variant_id) DO UPDATE SET
      title = excluded.title, description = excluded.description, category = excluded.category,
      image_url = excluded.image_url, icon = excluded.icon, cost_cents = excluded.cost_cents,
      shipping_cents = excluded.shipping_cents, store_slug = excluded.store_slug, popularity = excluded.popularity,
      search_term = excluded.search_term, audience = excluded.audience, sync_run = excluded.sync_run,
      active = 1, updated_at = now()`,
  [supplierName, p.supplierProductId, p.supplierVariantId, p.title, p.description || '', p.category, p.imageUrl, p.icon,
    toCents(p.costUsd), toCents(p.shippingUsd || 0), p.store, p.popularity || 0, p.searchTerm || null, p.audience || null, run]);
}

async function finishSync(state) {
  if (state.imported === 0) {
    // Nada llegó del proveedor (llave inválida, sin conexión…): se conserva el catálogo actual.
    await q("UPDATE tiendas.sync_state SET finished_at = now(), last_error = COALESCE(last_error, 'El proveedor no devolvió productos') WHERE id = 1");
    return;
  }
  // Lo que el proveedor ya no ofrece se desactiva (no se borra: hay pedidos que lo referencian).
  await q('UPDATE tiendas.products SET active = 0 WHERE supplier = $1 AND sync_run IS DISTINCT FROM $2', [state.supplier, state.run]);
  // Productos de otro proveedor (p. ej. el demo al pasar a CJ) dejan de venderse.
  await q('UPDATE tiendas.products SET active = 0 WHERE supplier <> $1', [state.supplier]);
  for (const s of STORES) await repriceStore(s.slug);
  await q('UPDATE tiendas.sync_state SET finished_at = now() WHERE id = 1');
}

// Avanza la sincronización en curso durante ~budgetMs. Devuelve el estado.
export async function syncStep({ budgetMs = 45_000 } = {}) {
  const deadline = Date.now() + budgetMs;
  let state = await syncStatus();
  if (!state?.run || state.finished_at) return state;
  const supplier = getSupplier(state.supplier);
  const searches = nicheSearches();
  while (state.cursor < searches.length && Date.now() < deadline) {
    const search = searches[state.cursor];
    const claimed = (await q('SELECT supplier_product_id FROM tiendas.products WHERE sync_run = $1', [state.run]))
      .map((r) => r.supplier_product_id);
    let items = [];
    let error = null;
    try {
      items = await supplier.fetchCatalog({ searches: [search], exclude: claimed });
    } catch (err) {
      error = `${search.query}: ${err.message}`.slice(0, 500);
      console.error('[sync]', error);
    }
    for (const p of items) await upsertProduct(supplier.name, state.run, p);
    state = await one(`UPDATE tiendas.sync_state SET cursor = cursor + 1, imported = imported + $1,
      last_error = COALESCE($2, last_error) WHERE id = 1 RETURNING *`, [items.length, error]);
  }
  if (state.cursor >= searches.length && !state.finished_at) {
    await finishSync(state);
    state = await syncStatus();
  }
  return state;
}

// Sincronización completa de una sola vez (scripts, servidor local y pruebas).
export async function syncCatalog(supplierName = env.supplier) {
  await startSync(supplierName);
  let state;
  do state = await syncStep({ budgetMs: 10 * 60_000 }); while (!state.finished_at);
  if (!state.imported) throw new Error(state.last_error || 'El proveedor no devolvió productos; se conserva el catálogo actual');
  return { supplier: state.supplier, imported: state.imported };
}

export async function setProductHidden(id, hidden) {
  const p = await one('UPDATE tiendas.products SET hidden = $1 WHERE id = $2 RETURNING store_slug', [hidden ? 1 : 0, id]);
  if (p?.store_slug) await repriceStore(p.store_slug);
}

export async function setProductTitle(id, title) {
  const t = String(title || '').trim().slice(0, 200);
  await q('UPDATE tiendas.products SET title_custom = $1 WHERE id = $2', [t || null, id]);
}

export async function listStoreProducts(slug, { category, audience, q: search, featured, limit = 60 } = {}) {
  const where = ['sp.store_slug = $1', 'p.active = 1'];
  const args = [slug];
  const arg = (v) => { args.push(v); return `$${args.length}`; };
  if (category) where.push(`p.category = ${arg(category)}`);
  if (audience) where.push(`p.audience = ${arg(audience)}`);
  if (search) { const a = arg(`%${search}%`); where.push(`(COALESCE(p.title_custom, p.title) ILIKE ${a} OR p.search_term ILIKE ${a})`); }
  if (featured != null) where.push(`sp.featured = ${featured ? 1 : 0}`);
  return q(`SELECT p.id, COALESCE(p.title_custom, p.title) title, p.description, p.category, p.image_url, p.icon,
      sp.price_cents, sp.featured
    FROM tiendas.store_products sp JOIN tiendas.products p ON p.id = sp.product_id
    WHERE ${where.join(' AND ')} ORDER BY sp.featured DESC, p.popularity DESC, p.id LIMIT ${arg(limit)}`, args);
}

export async function getStoreProduct(slug, id) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return one(`SELECT p.id, COALESCE(p.title_custom, p.title) title, p.description, p.category, p.image_url, p.icon,
      p.supplier, p.supplier_variant_id, p.cost_cents, p.shipping_cents, sp.price_cents
    FROM tiendas.store_products sp JOIN tiendas.products p ON p.id = sp.product_id
    WHERE sp.store_slug = $1 AND p.id = $2 AND p.active = 1`, [slug, id]);
}

export async function catalogIsEmpty() {
  return (await one('SELECT COUNT(*)::int n FROM tiendas.products')).n === 0;
}
