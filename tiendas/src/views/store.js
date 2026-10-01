// Vistas de la tienda. La estructura es idéntica para las 10 marcas;
// la identidad sale de themeCss() y de los atributos data-* del <body>.
import { html, raw, money, esc } from './html.js';
import { icon, logoMark, productImage, fontsHref } from './brand.js';
import { CATEGORIES } from '../config/stores.js';
import { MX_STATES, STATUS_LABELS } from '../services/orders.js';

const I = (store, name, size) => raw(icon(name, { size, stroke: store.iconStroke }));

export function layout({ store, prefix, title, body, description }) {
  const nav = store.categories.map((c) => html`<a href="${prefix}/c/${c}">${CATEGORIES[c].name}</a>`);
  const isDark = parseInt(store.palette.bg.slice(1, 3), 16) < 80;
  return html`<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title ? `${title} · ${store.name}` : `${store.name} — ${store.tagline}`}</title>
<meta name="description" content="${description || store.heroText}">
<meta name="theme-color" content="${store.palette.primary}">
<meta name="color-scheme" content="${isDark ? 'dark' : 'light'}">
<link rel="icon" href="${prefix}/logo-mark.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${raw(esc(fontsHref(store)))}">
<link rel="stylesheet" href="/static/store.css">
<link rel="stylesheet" href="${prefix}/theme.css">
</head>
<body data-store="${store.slug}" data-prefix="${prefix}" data-header="${store.header}" data-hero="${store.hero}" data-card="${store.card}" data-button="${store.button}" data-mood="${store.mood || 'default'}">
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="${prefix}/" aria-label="${store.name}, inicio">${raw(logoMark(store, 36))}<span class="brand-name">${store.name}</span></a>
    <nav class="main-nav" aria-label="Categorías">${nav}</nav>
    <div class="header-actions">
      <form class="search" action="${prefix}/buscar" role="search">
        <input name="q" type="search" placeholder="Buscar productos" aria-label="Buscar productos">
        <button class="icon-btn" aria-label="Buscar">${I(store, 'search', 18)}</button>
      </form>
      <a class="icon-btn cart-link" href="${prefix}/carrito" aria-label="Carrito">${I(store, 'cart', 22)}<span class="cart-count" data-cart-count hidden>0</span></a>
    </div>
  </div>
</header>
<main>${body}</main>
<footer class="site-footer">
  <div class="wrap footer-inner">
    <div>
      <a class="brand" href="${prefix}/">${raw(logoMark(store, 28))}<span class="brand-name">${store.name}</span></a>
      <p class="muted">${store.tagline}</p>
    </div>
    <nav aria-label="Información">
      <a href="${prefix}/envios">Envíos y devoluciones</a>
      <a href="${prefix}/privacidad">Aviso de privacidad</a>
      <a href="${prefix}/pedido">Rastrear mi pedido</a>
    </nav>
    <p class="muted small">© ${new Date().getFullYear()} ${store.name}. Precios en MXN con IVA incluido.</p>
  </div>
</footer>
<div class="toast" role="status" aria-live="polite" hidden></div>
<script src="/static/cart.js" defer></script>
</body>
</html>`;
}

function productCard(store, prefix, p) {
  return html`<article class="card product-card">
  <a href="${prefix}/p/${p.id}" class="card-media">${raw(productImage(store, p))}</a>
  <div class="card-body">
    <span class="eyebrow">${CATEGORIES[p.category]?.name || p.category}</span>
    <h3 class="card-title"><a href="${prefix}/p/${p.id}">${p.title}</a></h3>
    <div class="card-foot">
      <span class="price">${money(p.price_cents)}</span>
      <button class="btn btn-sm" data-add="${p.id}" aria-label="Agregar ${p.title} al carrito">${I(store, 'plus', 16)}<span>Agregar</span></button>
    </div>
  </div>
</article>`;
}

const grid = (store, prefix, products) => products.length
  ? html`<div class="grid">${products.map((p) => productCard(store, prefix, p))}</div>`
  : html`<p class="empty">Aún no hay productos aquí. Vuelve pronto.</p>`;

function trustBar(store) {
  return html`<section class="trust wrap" aria-label="Beneficios">
  <div>${I(store, 'truck', 22)}<span><strong>Envío gratis</strong> a todo México</span></div>
  <div>${I(store, 'lock', 22)}<span><strong>Pago seguro</strong> con tarjeta</span></div>
  <div>${I(store, 'package', 22)}<span><strong>Rastreo</strong> de tu pedido</span></div>
  <div>${I(store, 'chat', 22)}<span><strong>Soporte</strong> por correo</span></div>
</section>`;
}

export function homePage({ store, prefix, featured, products }) {
  const body = html`
<section class="hero">
  <div class="wrap hero-inner">
    <div class="hero-copy">
      <span class="eyebrow">${store.tagline}</span>
      <h1>${store.heroTitle}</h1>
      <p>${store.heroText}</p>
      <a class="btn btn-lg" href="${prefix}/c/${store.categories[0]}">Ver ${CATEGORIES[store.categories[0]].name.toLowerCase()} ${I(store, 'arrow', 18)}</a>
    </div>
    <div class="hero-art" aria-hidden="true">${raw(logoMark(store, 220))}</div>
  </div>
</section>
${trustBar(store)}
<section class="wrap section">
  <h2 class="section-title">Categorías</h2>
  <div class="cats">${store.categories.map((c) => html`<a class="card cat" href="${prefix}/c/${c}">${I(store, CATEGORIES[c].icon, 32)}<span>${CATEGORIES[c].name}</span></a>`)}</div>
</section>
${featured.length ? html`<section class="wrap section"><h2 class="section-title">Los más vendidos</h2>${grid(store, prefix, featured)}</section>` : ''}
<section class="wrap section"><h2 class="section-title">Más para ti</h2>${grid(store, prefix, products)}</section>`;
  return layout({ store, prefix, body });
}

export function listPage({ store, prefix, title, products, q }) {
  const body = html`<section class="wrap section page-head">
  <h1>${title}</h1>
  ${q != null ? html`<p class="muted">${products.length} resultado${products.length === 1 ? '' : 's'} para “${q}”</p>` : ''}
</section>
<section class="wrap section">${grid(store, prefix, products)}</section>`;
  return layout({ store, prefix, title, body });
}

export function productPage({ store, prefix, product, related }) {
  const body = html`<section class="wrap section product">
  <div class="card product-media">${raw(productImage(store, product))}</div>
  <div class="product-info">
    <a class="eyebrow" href="${prefix}/c/${product.category}">${CATEGORIES[product.category]?.name}</a>
    <h1>${product.title}</h1>
    <p class="price price-lg">${money(product.price_cents)}</p>
    <p>${product.description}</p>
    <div class="buy">
      <div class="qty" data-qty>
        <button class="icon-btn" data-qty-dec aria-label="Menos">${I(store, 'minus', 16)}</button>
        <input type="number" min="1" max="10" value="1" aria-label="Cantidad">
        <button class="icon-btn" data-qty-inc aria-label="Más">${I(store, 'plus', 16)}</button>
      </div>
      <button class="btn btn-lg" data-add="${product.id}" data-with-qty>${I(store, 'cart', 18)} Agregar al carrito</button>
    </div>
    <ul class="facts">
      <li>${I(store, 'truck', 18)} Envío gratis. Entrega estimada de 10 a 20 días hábiles.</li>
      <li>${I(store, 'package', 18)} Recibirás tu número de guía en cuanto se envíe.</li>
      <li>${I(store, 'shield', 18)} Si llega dañado o no llega, te devolvemos tu dinero.</li>
    </ul>
  </div>
</section>
${related.length ? html`<section class="wrap section"><h2 class="section-title">También te puede gustar</h2>${grid(store, prefix, related)}</section>` : ''}`;
  return layout({ store, prefix, title: product.title, description: product.description, body });
}

export function cartPage({ store, prefix }) {
  const body = html`<section class="wrap section page-head"><h1>Tu carrito</h1></section>
<section class="wrap section cart-layout">
  <div class="card cart-lines" data-cart-lines><p class="muted">Cargando…</p></div>
  <aside class="card summary">
    <h2>Resumen</h2>
    <div class="row"><span>Subtotal</span><span data-cart-total>—</span></div>
    <div class="row"><span>Envío</span><span>Gratis</span></div>
    <div class="row total"><span>Total</span><span data-cart-total>—</span></div>
    <a class="btn btn-lg btn-block" href="${prefix}/checkout" data-checkout-link>Continuar al pago</a>
  </aside>
</section>`;
  return layout({ store, prefix, title: 'Carrito', body });
}

function field(name, label, { values, errors, type = 'text', autocomplete, inputmode, full } = {}) {
  return html`<label class="field${full ? ' full' : ''}">
  <span>${label}</span>
  <input name="${name}" type="${type}" value="${values?.[name] || ''}" ${raw(autocomplete ? `autocomplete="${autocomplete}"` : '')} ${raw(inputmode ? `inputmode="${inputmode}"` : '')} required aria-invalid="${errors?.[name] ? 'true' : 'false'}">
  ${errors?.[name] ? html`<small class="error">${errors[name]}</small>` : ''}
</label>`;
}

export function checkoutPage({ store, prefix, values = {}, errors = {}, message, demoPayments }) {
  const f = (n, l, o) => field(n, l, { values, errors, ...o });
  const body = html`<section class="wrap section page-head"><h1>Datos de envío</h1></section>
<section class="wrap section cart-layout">
  <form class="card checkout-form" method="post" action="${prefix}/checkout" data-checkout-form>
    ${message ? html`<p class="alert">${message}</p>` : ''}
    <div class="fields">
      ${f('name', 'Nombre completo', { autocomplete: 'name', full: true })}
      ${f('email', 'Correo electrónico', { type: 'email', autocomplete: 'email' })}
      ${f('phone', 'Teléfono (10 dígitos)', { type: 'tel', autocomplete: 'tel-national', inputmode: 'numeric' })}
      ${f('street', 'Calle y número', { autocomplete: 'address-line1', full: true })}
      ${f('colonia', 'Colonia', { autocomplete: 'address-line2' })}
      ${f('zip', 'Código postal', { autocomplete: 'postal-code', inputmode: 'numeric' })}
      ${f('city', 'Ciudad o municipio', { autocomplete: 'address-level2' })}
      <label class="field"><span>Estado</span>
        <select name="state" required aria-invalid="${errors.state ? 'true' : 'false'}">
          <option value="">Selecciona…</option>
          ${MX_STATES.map((s) => html`<option ${raw(values.state === s ? 'selected' : '')}>${s}</option>`)}
        </select>
        ${errors.state ? html`<small class="error">${errors.state}</small>` : ''}
      </label>
    </div>
    <input type="hidden" name="cart" data-cart-field>
    <button class="btn btn-lg btn-block">${I(store, 'lock', 18)} Pagar de forma segura</button>
    ${demoPayments ? html`<p class="muted small">Modo demostración: el pago se aprueba automáticamente.</p>` : ''}
  </form>
  <aside class="card summary">
    <h2>Tu pedido</h2>
    <div data-cart-mini><p class="muted">Cargando…</p></div>
    <div class="row total"><span>Total</span><span data-cart-total>—</span></div>
  </aside>
</section>`;
  return layout({ store, prefix, title: 'Pago', body });
}

const STEPS = ['paid', 'sent_to_supplier', 'shipped', 'delivered'];

export function orderPage({ store, prefix, order, items, justPaid }) {
  const reached = STEPS.indexOf(order.status === 'supplier_error' ? 'paid' : order.status);
  const body = html`<section class="wrap section narrow">
  ${justPaid ? html`<div class="card thanks" data-clear-cart>${I(store, 'shield', 32)}<div><h1>¡Gracias por tu compra!</h1><p>Te enviaremos actualizaciones a <strong>${order.email}</strong>.</p></div></div>` : html`<h1>Pedido ${order.number}</h1>`}
  <div class="card">
    <p class="muted small">Pedido <strong>${order.number}</strong></p>
    ${order.status === 'pending_payment' ? html`<p class="alert">Aún no recibimos tu pago.</p>` : ''}
    ${order.status === 'cancelled' ? html`<p class="alert">Este pedido fue cancelado.</p>` : ''}
    ${reached >= 0 ? html`<ol class="steps">${['Pago recibido', 'Preparando envío', 'En camino', 'Entregado'].map((s, i) => html`<li class="${i <= reached ? 'done' : ''}">${s}</li>`)}</ol>` : ''}
    ${order.tracking_number ? html`<p>Número de guía: <strong>${order.tracking_number}</strong></p>` : ''}
    <ul class="mini-lines">${items.map((i) => html`<li><span>${i.qty} × ${i.title}</span><span>${money(i.unit_price_cents * i.qty)}</span></li>`)}</ul>
    <div class="row total"><span>Total</span><span>${money(order.total_cents)}</span></div>
    <p class="muted small">Envío a: ${order.street}, Col. ${order.colonia}, ${order.city}, ${order.state}, C.P. ${order.zip}</p>
  </div>
</section>`;
  return layout({ store, prefix, title: `Pedido ${order.number}`, body });
}

export function trackPage({ store, prefix, error }) {
  const body = html`<section class="wrap section narrow">
  <h1>Rastrear mi pedido</h1>
  <form class="card" method="post" action="${prefix}/pedido">
    ${error ? html`<p class="alert">${error}</p>` : ''}
    <div class="fields">
      <label class="field full"><span>Número de pedido</span><input name="number" required placeholder="${store.slug.slice(0, 3).toUpperCase()}-000000-ABC123"></label>
      <label class="field full"><span>Correo con el que compraste</span><input name="email" type="email" required></label>
    </div>
    <button class="btn btn-lg btn-block">Consultar</button>
  </form>
</section>`;
  return layout({ store, prefix, title: 'Rastrear pedido', body });
}

export function infoPage({ store, prefix, kind }) {
  const pages = {
    envios: ['Envíos y devoluciones', html`
<p>Nuestros productos se envían directamente desde los almacenes de nuestros proveedores. El envío es gratuito a todo México.</p>
<ul><li>Preparación: 1 a 4 días hábiles.</li><li>Entrega estimada: 10 a 20 días hábiles.</li><li>Te enviamos el número de guía en cuanto el paquete sale.</li></ul>
<p>Si tu pedido llega dañado, incompleto o no llega en 45 días, escríbenos con tu número de pedido y te reembolsamos o reenviamos sin costo. Puedes cancelar sin costo mientras tu pedido no haya sido enviado.</p>`],
    privacidad: ['Aviso de privacidad', html`
<p>${store.name} usa tus datos (nombre, correo, teléfono y dirección) únicamente para procesar y entregar tu pedido. Compartimos tu dirección de envío con el proveedor y la paquetería que entregan tu compra. No vendemos tus datos.</p>
<p>Puedes solicitar el acceso, rectificación o eliminación de tus datos (derechos ARCO) escribiéndonos con tu número de pedido.</p>`],
  };
  const [title, content] = pages[kind];
  return layout({ store, prefix, title, body: html`<section class="wrap section narrow prose"><h1>${title}</h1>${content}</section>` });
}

export function notFoundPage({ store, prefix }) {
  return layout({ store, prefix, title: 'No encontrado', body: html`<section class="wrap section narrow"><h1>No encontramos esta página</h1><p><a class="btn" href="${prefix}/">Volver a la tienda</a></p></section>` });
}

export { STATUS_LABELS };
