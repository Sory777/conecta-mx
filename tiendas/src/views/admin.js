// Panel central: una sola vista para las 10 tiendas.
import { html, raw, money } from './html.js';
import { logoMark } from './brand.js';
import { STORES, CATEGORIES, getStore } from '../config/stores.js';
import { STATUS_LABELS } from '../services/orders.js';
import { unitProfitCents } from '../services/catalog.js';

const STATUS_TONE = {
  pending_payment: 'neutral', paid: 'info', supplier_error: 'critical', sent_to_supplier: 'info',
  shipped: 'info', delivered: 'good', cancelled: 'neutral',
};
const badge = (status) => html`<span class="badge ${STATUS_TONE[status]}">${STATUS_LABELS[status] || status}</span>`;
const storeChip = (slug) => {
  const s = getStore(slug);
  return s ? html`<span class="chip">${raw(logoMark(s, 18))}${s.name}</span>` : slug;
};
const pct = (n) => `${(n * 100).toFixed(0)} %`;

function layout({ title, active, body, flash }) {
  const nav = [['/admin', 'Resumen', 'home'], ['/admin/pedidos', 'Pedidos', 'orders'], ['/admin/productos', 'Productos', 'products'], ['/admin/tiendas', 'Tiendas', 'stores']];
  return html`<!doctype html>
<html lang="es-MX"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Panel de tiendas</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="/static/admin.css">
</head><body>
<header class="top">
  <div class="wrap top-inner">
    <a class="logo" href="/admin">Panel de tiendas</a>
    <nav>${nav.map(([href, label, key]) => html`<a href="${href}" class="${active === key ? 'on' : ''}">${label}</a>`)}</nav>
    <form method="post" action="/admin/logout"><button class="link">Salir</button></form>
  </div>
</header>
<main class="wrap">
${flash ? html`<p class="flash">${flash}</p>` : ''}
${body}
</main>
</body></html>`;
}

export function loginPage({ error, configured }) {
  return html`<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Entrar · Panel de tiendas</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/static/admin.css"></head>
<body><main class="login">
<form class="panel" method="post" action="/admin/login">
  <h1>Panel de tiendas</h1>
  ${configured ? '' : html`<p class="flash warn">Define ADMIN_PASSWORD en el archivo .env para activar el panel.</p>`}
  ${error ? html`<p class="flash warn">${error}</p>` : ''}
  <label>Contraseña<input type="password" name="password" autocomplete="current-password" required autofocus></label>
  <button class="btn">Entrar</button>
</form></main></body></html>`;
}

function filters({ action, store, extra = '' }) {
  return html`<form class="filters" method="get" action="${action}">
  <label>Tienda <select name="store" onchange="this.form.submit()"><option value="">Todas</option>
    ${STORES.map((s) => html`<option value="${s.slug}" ${raw(store === s.slug ? 'selected' : '')}>${s.name}</option>`)}</select></label>
  ${raw(extra)}
  <noscript><button class="btn sm">Filtrar</button></noscript>
</form>`;
}

export function dashboardPage({ totals, perStore, recent, days, store, flash, supplierLabel, paymentsLabel, lastSync }) {
  const maxProfit = Math.max(1, ...perStore.map((r) => r.profit));
  const periodSel = html`<label>Periodo <select name="days" onchange="this.form.submit()">
    ${[[7, 'Últimos 7 días'], [30, 'Últimos 30 días'], [90, 'Últimos 90 días'], [0, 'Todo']].map(([v, l]) => html`<option value="${v}" ${raw(days === v ? 'selected' : '')}>${l}</option>`)}
  </select></label>`;
  const body = html`
<div class="head">
  <h1>Resumen</h1>
  <div class="actions">
    <form method="post" action="/admin/sync"><button class="btn sm ghost">Sincronizar catálogo</button></form>
    <form method="post" action="/admin/tracking"><button class="btn sm ghost">Actualizar envíos</button></form>
  </div>
</div>
${filters({ action: '/admin', store, extra: periodSel.toString() })}
<p class="muted small">Proveedor: <strong>${supplierLabel}</strong> · Pagos: <strong>${paymentsLabel}</strong> · Última sincronización: ${lastSync || 'nunca'}</p>
<section class="kpis">
  <div class="kpi hero"><span>Tu ganancia</span><strong>${money(totals.profit)}</strong><small>${totals.revenue ? `${pct(totals.profit / totals.revenue)} de margen neto` : 'Sin ventas aún'}</small></div>
  <div class="kpi"><span>Ventas cobradas</span><strong>${money(totals.revenue)}</strong><small>${totals.orders} pedido${totals.orders === 1 ? '' : 's'}</small></div>
  <div class="kpi"><span>Pagado a proveedores</span><strong>${money(totals.cost)}</strong><small>Comisiones de pago: ${money(totals.fees)}</small></div>
  <div class="kpi"><span>Ticket promedio</span><strong>${money(totals.orders ? Math.round(totals.revenue / totals.orders) : 0)}</strong><small>${totals.issues ? html`<a href="/admin/pedidos?status=supplier_error">${totals.issues} con error de proveedor</a>` : 'Sin incidencias'}</small></div>
</section>
<section class="panel">
  <h2>Ganancia por tienda</h2>
  <table class="table bars">
    <thead><tr><th>Tienda</th><th class="num">Pedidos</th><th class="num">Ventas</th><th class="num">Ganancia</th><th class="bar-col" aria-hidden="true"></th></tr></thead>
    <tbody>${perStore.map((r) => html`<tr>
      <td>${storeChip(r.slug)}</td><td class="num">${r.orders}</td><td class="num">${money(r.revenue)}</td><td class="num"><strong>${money(r.profit)}</strong></td>
      <td class="bar-col" aria-hidden="true"><span class="bar" style="width:${Math.max(0, (r.profit / maxProfit) * 100).toFixed(1)}%" title="${getStore(r.slug).name}: ${money(r.profit)}"></span></td>
    </tr>`)}</tbody>
  </table>
</section>
<section class="panel">
  <div class="head"><h2>Pedidos recientes</h2><a href="/admin/pedidos">Ver todos</a></div>
  ${ordersTable(recent)}
</section>`;
  return layout({ title: 'Resumen', active: 'home', body, flash });
}

function ordersTable(orders) {
  if (!orders.length) return html`<p class="muted">Todavía no hay pedidos.</p>`;
  return html`<div class="scroll"><table class="table">
  <thead><tr><th>Pedido</th><th>Tienda</th><th>Cliente</th><th>Estado</th><th class="num">Total</th><th class="num">Ganancia</th><th>Fecha</th></tr></thead>
  <tbody>${orders.map((o) => html`<tr>
    <td><a href="/admin/pedidos/${o.id}">${o.number}</a></td>
    <td>${storeChip(o.store_slug)}</td>
    <td>${o.customer_name}<br><span class="muted small">${o.city}, ${o.state}</span></td>
    <td>${badge(o.status)}</td>
    <td class="num">${money(o.total_cents)}</td>
    <td class="num">${o.status === 'pending_payment' || o.status === 'cancelled' ? html`<span class="muted">—</span>` : money(o.profit_cents)}</td>
    <td class="small">${o.created_at.slice(0, 16)}</td>
  </tr>`)}</tbody></table></div>`;
}

export function ordersPage({ orders, store, status, flash }) {
  const statusSel = html`<label>Estado <select name="status" onchange="this.form.submit()"><option value="">Todos</option>
    ${Object.entries(STATUS_LABELS).map(([k, v]) => html`<option value="${k}" ${raw(status === k ? 'selected' : '')}>${v}</option>`)}</select></label>`;
  const body = html`<div class="head"><h1>Pedidos</h1>
  <form method="post" action="/admin/retry"><button class="btn sm ghost">Reintentar envíos fallidos</button></form></div>
  ${filters({ action: '/admin/pedidos', store, extra: statusSel.toString() })}
  <section class="panel">${ordersTable(orders)}</section>`;
  return layout({ title: 'Pedidos', active: 'orders', body, flash });
}

export function orderDetailPage({ order, items, events, flash }) {
  const canForward = ['paid', 'supplier_error'].includes(order.status);
  const canTrack = ['sent_to_supplier', 'shipped'].includes(order.status);
  const canCancel = ['pending_payment', 'supplier_error'].includes(order.status);
  const body = html`<div class="head"><h1>Pedido ${order.number}</h1>${badge(order.status)}</div>
<div class="cols">
  <section class="panel">
    <h2>Artículos</h2>
    <table class="table"><thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Costo proveedor</th></tr></thead>
    <tbody>${items.map((i) => html`<tr><td>${i.title}<br><span class="muted small">${i.supplier} · ${i.supplier_variant_id}</span></td><td class="num">${i.qty}</td><td class="num">${money(i.unit_price_cents * i.qty)}</td><td class="num">${money(i.unit_cost_cents * i.qty)}</td></tr>`)}</tbody></table>
    <dl class="ledger">
      <dt>Cobrado al cliente</dt><dd>${money(order.total_cents)}</dd>
      <dt>Costo proveedor (producto + envío)</dt><dd>− ${money(order.supplier_cost_cents)}</dd>
      <dt>Comisión de pago (estimada)</dt><dd>− ${money(order.payment_fee_cents)}</dd>
      <dt class="strong">Tu ganancia</dt><dd class="strong">${order.status === 'pending_payment' || order.status === 'cancelled' ? '—' : money(order.profit_cents)}</dd>
    </dl>
    <div class="actions">
      ${canForward ? html`<form method="post" action="/admin/pedidos/${order.id}/forward"><button class="btn sm">Enviar al proveedor</button></form>` : ''}
      ${canTrack ? html`<form method="post" action="/admin/pedidos/${order.id}/tracking"><button class="btn sm ghost">Actualizar rastreo</button></form>` : ''}
      ${canCancel ? html`<form method="post" action="/admin/pedidos/${order.id}/cancel" onsubmit="return confirm('¿Cancelar este pedido? Si ya se cobró, reembolsa al cliente desde tu procesador de pagos.')"><button class="btn sm danger">Cancelar</button></form>` : ''}
    </div>
    ${order.last_error ? html`<p class="flash warn">Último error: ${order.last_error}</p>` : ''}
  </section>
  <section class="panel">
    <h2>Cliente y envío</h2>
    <p><strong>${order.customer_name}</strong><br>${order.email}<br>${order.phone}</p>
    <p>${order.street}<br>Col. ${order.colonia}<br>${order.city}, ${order.state}<br>C.P. ${order.zip}</p>
    <p class="small">Tienda: ${storeChip(order.store_slug)}<br>Pago: ${order.payment_provider || '—'} ${order.payment_ref || ''}<br>
    Proveedor: ${order.supplier_order_id || '—'}<br>Guía: ${order.tracking_number || '—'}</p>
    <h2>Historial</h2>
    <ol class="timeline">${events.map((e) => html`<li><span class="small muted">${e.at}</span><br>${e.message}</li>`)}</ol>
  </section>
</div>`;
  return layout({ title: `Pedido ${order.number}`, active: 'orders', body, flash });
}

export function productsPage({ products, store, category, flash }) {
  const catSel = html`<label>Categoría <select name="category" onchange="this.form.submit()"><option value="">Todas</option>
    ${Object.entries(CATEGORIES).map(([k, v]) => html`<option value="${k}" ${raw(category === k ? 'selected' : '')}>${v.name}</option>`)}</select></label>`;
  const body = html`<div class="head"><h1>Productos <span class="muted">(${products.length})</span></h1>
  <form method="post" action="/admin/sync"><button class="btn sm ghost">Sincronizar catálogo</button></form></div>
  ${filters({ action: '/admin/productos', store, extra: catSel.toString() })}
  <p class="muted small">Cada tienda vende solo sus productos, elegidos entre los más vendidos de su nicho. «Popularidad» es el número de tiendas que venden el producto en el proveedor. «Ganas por pieza» ya descuenta el costo del producto, el envío y la comisión de pago estimada. Puedes poner el nombre en español u ocultar un producto que no te guste: la sincronización respeta ambos cambios.</p>
  <section class="panel"><div class="scroll"><table class="table">
  <thead><tr><th>Producto</th><th>Tienda</th><th>Categoría</th><th class="num">Popularidad</th><th class="num">Costo + envío</th><th class="num">Precio venta</th><th class="num">Ganas por pieza</th><th>Estado</th></tr></thead>
  <tbody>${products.map((p) => html`<tr>
    <td><form method="post" action="/admin/productos/${p.id}" class="inline title-form">
      <input name="title" value="${p.title_custom || p.title}" aria-label="Nombre del producto" maxlength="200">
      <button class="btn sm ghost">Guardar</button></form>
      <span class="muted small">${p.title_custom ? html`Original: ${p.title} · ` : ''}${p.supplier} · ${p.search_term || ''}</span></td>
    <td>${p.store_slug ? storeChip(p.store_slug) : '—'}</td>
    <td>${CATEGORIES[p.category]?.name || p.category}</td>
    <td class="num">${p.popularity.toLocaleString('es-MX')}</td>
    <td class="num">${money(p.cost_cents + p.shipping_cents)}</td>
    <td class="num">${p.price_cents == null ? '—' : money(p.price_cents)}</td>
    <td class="num">${p.price_cents == null ? '—' : (() => {
      const g = unitProfitCents(p.price_cents, p.cost_cents + p.shipping_cents);
      return html`<strong>${money(g)}</strong><br><span class="muted small">${pct(g / p.price_cents)} del precio</span>`;
    })()}</td>
    <td>${!p.active ? html`<span class="badge neutral">Inactivo</span>` : p.hidden ? html`<span class="badge neutral">Oculto</span>` : html`<span class="badge good">Activo</span>`}
      ${p.active ? html`<form method="post" action="/admin/productos/${p.id}"><input type="hidden" name="hidden" value="${p.hidden ? '0' : '1'}"><button class="link small">${p.hidden ? 'Mostrar' : 'Ocultar'}</button></form>` : ''}</td>
  </tr>`)}</tbody></table></div></section>`;
  return layout({ title: 'Productos', active: 'products', body, flash });
}

export function storesPage({ rows, flash }) {
  const body = html`<div class="head"><h1>Tiendas</h1></div>
  <p class="muted">Cambia el margen de cada tienda: los precios se recalculan al guardar. Una tienda inactiva deja de aceptar pedidos.</p>
  <div class="store-grid">${rows.map(({ store: s, markup, active, products, url, avgPrice, avgProfit }) => html`
  <section class="panel store-card" style="--p:${s.palette.primary};--a:${s.palette.accent};--b:${s.palette.bg};--t:${s.palette.text}">
    <div class="swatch">${raw(logoMark(s, 44))}<div><strong>${s.name}</strong><br><span class="small">${s.tagline}</span></div></div>
    <p class="small muted">${s.fonts.heading} / ${s.fonts.body} · cabecera ${s.header} · héroe ${s.hero} · tarjetas ${s.card}</p>
    <p class="per-piece">Precio promedio <strong>${money(avgPrice)}</strong> · ganas en promedio <strong>${money(avgProfit)}</strong> por pieza${avgPrice ? ` (${pct(avgProfit / avgPrice)})` : ''}</p>
    <p class="small"><a href="${url}" target="_blank" rel="noopener">${url}</a> · ${products} productos · <a href="${url}/logo.svg" target="_blank" rel="noopener">logotipo SVG</a></p>
    <form method="post" action="/admin/tiendas/${s.slug}" class="inline">
      <label>Margen % <input type="number" name="markup" min="5" max="500" step="1" value="${Math.round(markup * 100)}"></label>
      <label class="check"><input type="checkbox" name="active" value="1" ${raw(active ? 'checked' : '')}> Activa</label>
      <button class="btn sm">Guardar</button>
    </form>
  </section>`)}</div>`;
  return layout({ title: 'Tiendas', active: 'stores', body, flash });
}
