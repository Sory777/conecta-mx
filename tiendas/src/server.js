import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import { env } from './config/env.js';
import { q, one } from './db.js';
import { STORES, CATEGORIES, getStore, storeForHost } from './config/stores.js';
import { themeCss, logoSvg, logoMark, productImage } from './views/brand.js';
import { html, raw, money } from './views/html.js';
import * as V from './views/store.js';
import * as A from './views/admin.js';
import {
  syncCatalog, startSync, syncStep, syncStatus, setProductTitle, setProductHidden, unitProfitCents, listStoreProducts, getStoreProduct,
  catalogIsEmpty, isStoreActive, activeStoreSlugs, storeMarkup, updateStoreSettings,
} from './services/catalog.js';
import {
  createOrder, priceCart, getOrder, getOrderByNumber, getOrderItems, getOrderEvents, setPaymentRef, markPaid,
  forwardToSupplier, refreshTracking, refreshAllTracking, retryFailedForwards, cancelOrder, ValidationError, PAID_STATUSES,
} from './services/orders.js';
import { getPayments } from './payments/index.js';
import { getSupplier } from './suppliers/index.js';

export const app = express();
// Detrás de un proxy (Render, Railway, Nginx…) define TRUST_PROXY=1 para leer IP y protocolo reales.
const tp = process.env.TRUST_PROXY ?? 'loopback';
app.set('trust proxy', /^\d+$/.test(tp) ? Number(tp) : tp === 'true' ? true : tp);
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(express.json({ limit: '50kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
// public/ se sirve tal cual (en Vercel lo sirve su CDN; aquí, Express). Los archivos viven en public/static/.
app.use(express.static(path.resolve(import.meta.dirname, '../public'), { maxAge: '1h' }));

const send = (res, view, status = 200) => res.status(status).type('html').send(String(view));
const sign = (s) => crypto.createHmac('sha256', env.sessionSecret).update(s).digest('hex');
const orderToken = (number) => sign(`order:${number}`).slice(0, 20);
const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

// ---------------------------------------------------------------------------
// Dominios propios: tienda1.com -> /s/tienda1 (sin prefijo visible en los enlaces)
app.use((req, res, next) => {
  const store = storeForHost(req.hostname);
  if (store && !req.url.startsWith('/static') && !req.url.startsWith('/admin')) {
    req.url = `/s/${store.slug}${req.url === '/' ? '/' : req.url}`;
    res.locals.customDomain = true;
  }
  next();
});

// Portada con las 10 tiendas
app.get('/', async (req, res) => {
  const active = new Set(await activeStoreSlugs());
  send(res, html`<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nuestras tiendas</title><link rel="stylesheet" href="/static/admin.css"></head><body><main class="wrap" style="padding:32px 16px">
<h1>Nuestras tiendas</h1><p class="muted">10 marcas, un mismo sistema.</p>
<div class="store-grid">${STORES.filter((s) => active.has(s.slug)).map((s) => html`<a class="panel" style="text-decoration:none;--p:${s.palette.primary};--b:${s.palette.bg};--t:${s.palette.text}" href="/s/${s.slug}/">
<div class="swatch">${raw(logoMark(s, 44))}<div><strong>${s.name}</strong><br><span class="small">${s.tagline}</span></div></div></a>`)}</div>
<p class="small"><a href="/admin">Panel de administración</a></p></main></body></html>`);
});

// ---------------------------------------------------------------------------
// Tiendas
const shop = express.Router({ mergeParams: true });
app.use('/s/:slug', (req, res, next) => {
  const store = getStore(req.params.slug);
  if (!store) return res.status(404).send('Tienda no encontrada');
  res.locals.store = store;
  res.locals.prefix = res.locals.customDomain ? '' : `/s/${store.slug}`;
  next();
}, shop);

const ctx = (res) => ({ store: res.locals.store, prefix: res.locals.prefix });
const origin = (req) => `${req.protocol}://${req.get('host')}`;

shop.get('/theme.css', (req, res) => res.type('css').set('Cache-Control', 'public, max-age=300').send(themeCss(res.locals.store)));
shop.get('/logo.svg', (req, res) => res.type('image/svg+xml').send(logoSvg(res.locals.store)));
shop.get('/logo-mark.svg', (req, res) => res.type('image/svg+xml').send(logoMark(res.locals.store, 64).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')));

shop.use(async (req, res, next) => {
  if (await isStoreActive(res.locals.store.slug)) return next();
  send(res, V.layout({ ...ctx(res), title: 'Cerrado', body: html`<section class="wrap section narrow"><h1>Volvemos pronto</h1><p>Estamos renovando la tienda.</p></section>` }), 503);
});

shop.get('/', async (req, res) => {
  const { store } = res.locals;
  const [featured, products] = await Promise.all([
    listStoreProducts(store.slug, { featured: true, limit: 4 }),
    listStoreProducts(store.slug, { featured: false, limit: 12 }),
  ]);
  send(res, V.homePage({ ...ctx(res), featured, products }));
});

// Filtro opcional por público: /c/playeras?para=dama
const audienceOf = (store, key) => (store.audiences?.[key] ? key : null);

shop.get('/c/:cat', async (req, res) => {
  const { store } = res.locals;
  const cat = CATEGORIES[req.params.cat];
  if (!cat || !store.categories.includes(req.params.cat)) return send(res, V.notFoundPage(ctx(res)), 404);
  const audience = audienceOf(store, req.query.para);
  send(res, V.listPage({
    ...ctx(res), title: cat.name, category: req.params.cat, audience,
    products: await listStoreProducts(store.slug, { category: req.params.cat, audience }),
  }));
});

shop.get('/para/:aud', async (req, res) => {
  const { store } = res.locals;
  const audience = audienceOf(store, req.params.aud);
  if (!audience) return send(res, V.notFoundPage(ctx(res)), 404);
  const category = store.categories.includes(req.query.c) ? req.query.c : null;
  send(res, V.listPage({
    ...ctx(res), title: store.audiences[audience].name, audience, category, byAudience: true,
    products: await listStoreProducts(store.slug, { audience, category, limit: 120 }),
  }));
});

shop.get('/buscar', async (req, res) => {
  const term = String(req.query.q || '').trim().slice(0, 80);
  send(res, V.listPage({ ...ctx(res), title: 'Búsqueda', q: term, products: term ? await listStoreProducts(res.locals.store.slug, { q: term }) : [] }));
});

shop.get('/p/:id', async (req, res) => {
  const product = await getStoreProduct(res.locals.store.slug, Number(req.params.id));
  if (!product) return send(res, V.notFoundPage(ctx(res)), 404);
  const related = (await listStoreProducts(res.locals.store.slug, { category: product.category, limit: 5 })).filter((p) => p.id !== product.id).slice(0, 4);
  send(res, V.productPage({ ...ctx(res), product, related }));
});

shop.get('/carrito', (req, res) => send(res, V.cartPage(ctx(res))));

shop.post('/api/cart', async (req, res) => {
  const { store, prefix } = res.locals;
  const { lines, total } = await priceCart(store.slug, req.body?.items);
  const I = (n) => raw(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${n}</svg>`);
  const linesHtml = lines.length
    ? lines.map(({ product: p, qty }) => html`<div class="line">
        <a class="line-media" href="${prefix}/p/${p.id}">${raw(productImage(store, p))}</a>
        <div><a class="line-title" href="${prefix}/p/${p.id}">${p.title}</a><div class="muted small">${money(p.price_cents)} c/u</div>
          <div class="line-actions qty">
            <button class="icon-btn" data-line-action="dec" data-id="${p.id}" aria-label="Menos">${I('<path d="M5 12h14"/>')}</button>
            <span>${qty}</span>
            <button class="icon-btn" data-line-action="inc" data-id="${p.id}" aria-label="Más">${I('<path d="M12 5v14M5 12h14"/>')}</button>
          </div></div>
        <div class="num"><strong>${money(p.price_cents * qty)}</strong><br>
          <button class="icon-btn" data-line-action="remove" data-id="${p.id}" aria-label="Quitar">${I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>')}</button></div>
      </div>`).join('')
    : String(html`<p>Tu carrito está vacío.</p><a class="btn" href="${prefix}/">Seguir comprando</a>`);
  const miniHtml = String(html`<ul class="mini-lines">${lines.map(({ product: p, qty }) => html`<li><span>${qty} × ${p.title}</span><span>${money(p.price_cents * qty)}</span></li>`)}</ul>`);
  res.json({
    items: lines.map((l) => ({ id: l.product.id, qty: l.qty })),
    count: lines.reduce((s, l) => s + l.qty, 0),
    totalFmt: money(total),
    linesHtml, miniHtml,
  });
});

shop.get('/checkout', (req, res) => send(res, V.checkoutPage({ ...ctx(res), demoPayments: env.payments === 'mock' })));

shop.post('/checkout', async (req, res) => {
  const { store, prefix } = res.locals;
  let cart;
  try { cart = JSON.parse(req.body.cart || '[]'); } catch { cart = []; }
  try {
    const order = await createOrder(store.slug, cart, req.body);
    const payments = getPayments();
    const base = `${origin(req)}${prefix}`;
    const { redirectUrl, ref } = await payments.createCheckout({
      order, store, items: await getOrderItems(order.id), returnUrl: `${base}/pedido/confirmar`, cancelUrl: `${base}/carrito`,
    });
    await setPaymentRef(order.id, payments.name, ref);
    res.redirect(303, redirectUrl);
  } catch (err) {
    if (!(err instanceof ValidationError)) console.error('[checkout]', err);
    send(res, V.checkoutPage({
      ...ctx(res), values: req.body, errors: err.errors || {}, demoPayments: env.payments === 'mock',
      message: err instanceof ValidationError ? err.message : 'No pudimos iniciar el pago. Intenta de nuevo en unos minutos.',
    }), 400);
  }
});

// Regreso del procesador de pagos: se verifica el pago con el procesador, se marca pagado y se envía al proveedor.
shop.get('/pedido/confirmar', async (req, res) => {
  const { store, prefix } = res.locals;
  const order = await getOrderByNumber(req.query.order);
  if (!order || order.store_slug !== store.slug) return send(res, V.notFoundPage(ctx(res)), 404);
  if (order.status === 'pending_payment') {
    try {
      const { paid, ref } = await getPayments(order.payment_provider || env.payments).confirm({ order, query: req.query });
      if (paid && await markPaid(order.id, ref)) await forwardToSupplier(order.id);
    } catch (err) {
      console.error('[confirmar pago]', err);
    }
  }
  res.redirect(303, `${prefix}/pedido/${encodeURIComponent(order.number)}?t=${orderToken(order.number)}&nuevo=1`);
});

shop.get('/pedido', (req, res) => send(res, V.trackPage(ctx(res))));
shop.post('/pedido', async (req, res) => {
  const { store, prefix } = res.locals;
  const order = await getOrderByNumber(String(req.body.number || '').trim().toUpperCase());
  const ok = order && order.store_slug === store.slug && order.email.toLowerCase() === String(req.body.email || '').trim().toLowerCase();
  if (!ok) return send(res, V.trackPage({ ...ctx(res), error: 'No encontramos un pedido con esos datos.' }), 404);
  res.redirect(303, `${prefix}/pedido/${encodeURIComponent(order.number)}?t=${orderToken(order.number)}`);
});

shop.get('/pedido/:number', async (req, res) => {
  const order = await getOrderByNumber(req.params.number);
  if (!order || order.store_slug !== res.locals.store.slug || !safeEqual(req.query.t || '', orderToken(order.number))) {
    return send(res, V.notFoundPage(ctx(res)), 404);
  }
  send(res, V.orderPage({ ...ctx(res), order, items: await getOrderItems(order.id), justPaid: req.query.nuevo && order.status !== 'pending_payment' }));
});

shop.get('/envios', (req, res) => send(res, V.infoPage({ ...ctx(res), kind: 'envios' })));
shop.get('/privacidad', (req, res) => send(res, V.infoPage({ ...ctx(res), kind: 'privacidad' })));
shop.use((req, res) => send(res, V.notFoundPage(ctx(res)), 404));

// ---------------------------------------------------------------------------
// Panel de administración
const admin = express.Router();
app.use('/admin', admin);

const SESSION_HOURS = 12;
const isAdmin = (req) => {
  const m = /(?:^|;\s*)admin=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return false;
  const [exp, sig] = decodeURIComponent(m[1]).split('.');
  return Number(exp) > Date.now() && sig && safeEqual(sig, sign(`admin:${exp}`));
};
const loginAttempts = new Map();

admin.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  // Defensa CSRF: los POST del panel deben venir de este mismo sitio.
  if (req.method === 'POST' && req.get('origin') && new URL(req.get('origin')).host !== req.get('host')) return res.status(403).send('Origen no permitido');
  next();
});

admin.get('/login', (req, res) => send(res, A.loginPage({ configured: !!env.adminPassword })));
admin.post('/login', (req, res) => {
  const ip = req.ip;
  const a = loginAttempts.get(ip) || { n: 0, until: 0 };
  if (a.until > Date.now()) return send(res, A.loginPage({ configured: true, error: 'Demasiados intentos. Espera 15 minutos.' }), 429);
  if (!env.adminPassword || !safeEqual(req.body.password || '', env.adminPassword)) {
    a.n += 1;
    if (a.n >= 5) Object.assign(a, { n: 0, until: Date.now() + 15 * 60_000 });
    loginAttempts.set(ip, a);
    return send(res, A.loginPage({ configured: !!env.adminPassword, error: 'Contraseña incorrecta' }), 401);
  }
  loginAttempts.delete(ip);
  const exp = Date.now() + SESSION_HOURS * 3600_000;
  res.cookie('admin', `${exp}.${sign(`admin:${exp}`)}`, { httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: SESSION_HOURS * 3600_000, path: '/admin' });
  res.redirect(303, '/admin');
});
admin.post('/logout', (req, res) => { res.clearCookie('admin', { path: '/admin' }); res.redirect(303, '/admin/login'); });

admin.use((req, res, next) => (isAdmin(req) ? next() : res.redirect(303, '/admin/login')));

const flashOf = (req) => (req.query.ok ? String(req.query.ok).slice(0, 200) : null);
const back = (res, to, msg) => res.redirect(303, `${to}${to.includes('?') ? '&' : '?'}ok=${encodeURIComponent(msg)}`);
const PAID_SQL = PAID_STATUSES.map((st) => `'${st}'`).join(',');

admin.get('/', async (req, res) => {
  const days = [7, 30, 90, 0].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const store = getStore(req.query.store)?.slug || '';
  const where = [`status IN (${PAID_SQL})`];
  const args = [];
  if (days) { args.push(days); where.push(`created_at >= now() - make_interval(days => $${args.length})`); }
  const scoped = store ? [...where, `store_slug = $${args.length + 1}`] : where;
  const scopedArgs = store ? [...args, store] : args;
  const [t, byStoreRows, recent, sync] = await Promise.all([
    one(`SELECT COUNT(*)::int orders, COALESCE(SUM(total_cents),0)::int8 revenue, COALESCE(SUM(supplier_cost_cents),0)::int8 cost,
      COALESCE(SUM(payment_fee_cents),0)::int8 fees, COALESCE(SUM(profit_cents),0)::int8 profit,
      COUNT(*) FILTER (WHERE status = 'supplier_error')::int issues
      FROM tiendas.orders WHERE ${scoped.join(' AND ')}`, scopedArgs),
    q(`SELECT store_slug slug, COUNT(*)::int orders, SUM(total_cents)::int8 revenue, SUM(profit_cents)::int8 profit
      FROM tiendas.orders WHERE ${where.join(' AND ')} GROUP BY store_slug`, args),
    q(`SELECT * FROM tiendas.orders ${store ? 'WHERE store_slug = $1' : ''} ORDER BY id DESC LIMIT 10`, store ? [store] : []),
    syncStatus(),
  ]);
  const byStore = new Map(byStoreRows.map((r) => [r.slug, r]));
  const perStore = STORES.filter((s) => !store || s.slug === store)
    .map((s) => byStore.get(s.slug) || { slug: s.slug, orders: 0, revenue: 0, profit: 0 })
    .sort((a, b) => b.profit - a.profit);
  send(res, A.dashboardPage({
    totals: t, perStore, recent, days, store, flash: flashOf(req),
    lastSync: sync?.finished_at ? `${sync.finished_at} (${sync.imported} productos)` : sync?.run ? 'en curso' : null,
    supplierLabel: getSupplier().label, paymentsLabel: env.payments === 'mock' ? 'Demo (sin cobro real)' : 'Stripe',
  }));
});

admin.get('/pedidos', async (req, res) => {
  const store = getStore(req.query.store)?.slug || '';
  const status = String(req.query.status || '');
  const where = []; const args = [];
  if (store) { args.push(store); where.push(`store_slug = $${args.length}`); }
  if (status) { args.push(status); where.push(`status = $${args.length}`); }
  const orders = await q(`SELECT * FROM tiendas.orders ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT 500`, args);
  send(res, A.ordersPage({ orders, store, status, flash: flashOf(req) }));
});

admin.get('/pedidos/:id', async (req, res) => {
  const order = await getOrder(Number(req.params.id) || 0);
  if (!order) return res.redirect(303, '/admin/pedidos');
  const [items, events] = await Promise.all([getOrderItems(order.id), getOrderEvents(order.id)]);
  send(res, A.orderDetailPage({ order, items, events, flash: flashOf(req) }));
});

admin.post('/pedidos/:id/forward', async (req, res) => {
  const o = await forwardToSupplier(Number(req.params.id) || 0);
  back(res, `/admin/pedidos/${Number(req.params.id) || 0}`, o?.status === 'supplier_error' ? 'El proveedor rechazó el pedido' : 'Pedido enviado al proveedor');
});
admin.post('/pedidos/:id/tracking', async (req, res) => {
  const id = Number(req.params.id) || 0;
  try { await refreshTracking(id); back(res, `/admin/pedidos/${id}`, 'Rastreo actualizado'); } catch (err) { back(res, `/admin/pedidos/${id}`, `Error: ${err.message}`); }
});
admin.post('/pedidos/:id/cancel', async (req, res) => {
  const id = Number(req.params.id) || 0;
  back(res, `/admin/pedidos/${id}`, await cancelOrder(id) ? 'Pedido cancelado' : 'No se puede cancelar en este estado');
});
admin.post('/retry', async (req, res) => back(res, '/admin/pedidos', `Reintentados: ${await retryFailedForwards()}`));
admin.post('/tracking', async (req, res) => back(res, '/admin', `Envíos revisados: ${await refreshAllTracking()}`));

// Sincronización: el botón inicia una nueva y abre una página que la avanza por partes.
admin.post('/sync', async (req, res) => {
  await startSync();
  res.redirect(303, '/admin/sync');
});
admin.get('/sync', async (req, res) => send(res, A.syncPage({ state: await syncStatus(), supplierLabel: getSupplier().label })));
admin.post('/sync/step', async (req, res) => {
  try {
    res.json(await syncStep({ budgetMs: env.syncStepMs }));
  } catch (err) {
    console.error('[sync]', err);
    res.status(500).json({ error: err.message });
  }
});

admin.get('/productos', async (req, res) => {
  const store = getStore(req.query.store)?.slug || '';
  const category = CATEGORIES[req.query.category] ? req.query.category : '';
  const where = []; const args = [];
  if (store) { args.push(store); where.push(`p.store_slug = $${args.length}`); }
  if (category) { args.push(category); where.push(`p.category = $${args.length}`); }
  const products = await q(`SELECT p.*, sp.price_cents FROM tiendas.products p
    LEFT JOIN tiendas.store_products sp ON sp.product_id = p.id AND sp.store_slug = p.store_slug
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.active DESC, p.store_slug, p.category, p.popularity DESC
    LIMIT 2000`, args);
  send(res, A.productsPage({ products, store, category, flash: flashOf(req) }));
});

admin.post('/productos/:id', async (req, res) => {
  const id = Number(req.params.id) || 0;
  if (req.body.hidden != null) await setProductHidden(id, req.body.hidden === '1');
  else await setProductTitle(id, req.body.title);
  // Volvemos a la misma lista filtrada (solo la ruta local, nunca a otro dominio).
  let to = '/admin/productos';
  try { const u = new URL(req.get('referer')); if (u.pathname === to) to += u.search; } catch {}
  res.redirect(303, to);
});

admin.get('/tiendas', async (req, res) => {
  const items = await q(`SELECT sp.store_slug, sp.price_cents, p.cost_cents + p.shipping_cents landed
    FROM tiendas.store_products sp JOIN tiendas.products p ON p.id = sp.product_id`);
  const stats = Map.groupBy(items, (r) => r.store_slug);
  const avg = (list, f) => (list?.length ? Math.round(list.reduce((a, r) => a + f(r), 0) / list.length) : 0);
  const base = origin(req);
  const rows = await Promise.all(STORES.map(async (s) => ({
    store: s, markup: await storeMarkup(s.slug), active: await isStoreActive(s.slug), products: stats.get(s.slug)?.length || 0,
    avgPrice: avg(stats.get(s.slug), (r) => r.price_cents),
    avgProfit: avg(stats.get(s.slug), (r) => unitProfitCents(r.price_cents, r.landed)),
    url: s.domains[0] ? `https://${s.domains[0]}` : `${base}/s/${s.slug}`,
  })));
  send(res, A.storesPage({ rows, flash: flashOf(req) }));
});

admin.post('/tiendas/:slug', async (req, res) => {
  const store = getStore(req.params.slug);
  if (!store) return res.redirect(303, '/admin/tiendas');
  const markup = Math.min(500, Math.max(5, Number(req.body.markup) || store.markup * 100)) / 100;
  await updateStoreSettings(store.slug, { markup, active: req.body.active === '1' });
  back(res, '/admin/tiendas', `${store.name}: guardado`);
});

// ---------------------------------------------------------------------------
// Tareas automáticas.
// En Vercel no hay un proceso permanente: Vercel Cron llama a /api/cron una vez al día
// (ver vercel.json) con el encabezado Authorization: Bearer CRON_SECRET.
async function dailyTasks({ budgetMs }) {
  await retryFailedForwards();
  await refreshAllTracking();
  let state = await syncStatus();
  const lastFinished = state?.finished_at ? Date.parse(state.finished_at.replace(' ', 'T')) : 0;
  if (!state?.run || (state.finished_at && Date.now() - lastFinished > 20 * 3600_000)) state = await startSync();
  return syncStep({ budgetMs });
}

app.get('/api/cron', async (req, res) => {
  if (!env.cronSecret || !safeEqual(req.get('authorization') || '', `Bearer ${env.cronSecret}`)) return res.status(401).send('No autorizado');
  res.json(await dailyTasks({ budgetMs: env.syncStepMs }));
});

// Sincronización completa en servidores con proceso permanente (tu computadora, un VPS).
let syncing = null;
export function runSync() {
  syncing ??= syncCatalog().finally(() => { syncing = null; });
  return syncing;
}

function schedule(minutes, fn, name) {
  if (!minutes) return;
  setInterval(() => fn().catch((err) => console.error(`[${name}]`, err.message)), minutes * 60_000).unref();
}

if (process.argv[1] === import.meta.filename) {
  if (await catalogIsEmpty()) {
    console.log('Catálogo vacío: importando productos del proveedor…');
    await runSync().then((r) => console.log(`Importados ${r.imported} productos de ${r.supplier}.`)).catch((err) => console.error('[sync]', err.message));
  }
  schedule(env.syncEveryMinutes, runSync, 'sync');
  schedule(env.trackingEveryMinutes, async () => { await retryFailedForwards(); await refreshAllTracking(); }, 'rastreo');
  if (!env.adminPassword) console.warn('Aviso: ADMIN_PASSWORD no está definido; el panel /admin no permitirá entrar.');
  app.listen(env.port, () => {
    console.log(`Servidor en ${env.baseUrl}`);
    for (const s of STORES) console.log(`  ${s.name.padEnd(16)} ${env.baseUrl}/s/${s.slug}/`);
    console.log(`  Panel central    ${env.baseUrl}/admin`);
  });
}

export default app;
