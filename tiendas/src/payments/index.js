// Cobro al cliente. El dinero de la venta entra a TU cuenta de pagos; luego el
// sistema paga al proveedor solo el costo (desde tu saldo en el proveedor) y
// la diferencia queda registrada como tu ganancia.
import { env } from '../config/env.js';

const mock = {
  name: 'mock',
  async createCheckout({ order, returnUrl }) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_PAYMENTS !== '1') {
      throw new Error('Pagos demo desactivados en producción: configura PAYMENTS=stripe');
    }
    return { redirectUrl: `${returnUrl}?order=${encodeURIComponent(order.number)}&demo=1`, ref: `DEMO-${order.number}` };
  },
  async confirm({ order }) {
    return { paid: true, ref: `DEMO-${order.number}` };
  },
};

async function stripeApi(method, path, params) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe: ${json.error?.message || res.status}`);
  return json;
}

const stripe = {
  name: 'stripe',
  async createCheckout({ order, items, store, returnUrl, cancelUrl }) {
    if (!env.stripeSecretKey) throw new Error('Falta STRIPE_SECRET_KEY');
    const params = {
      mode: 'payment',
      success_url: `${returnUrl}?order=${encodeURIComponent(order.number)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      customer_email: order.email,
      'metadata[order_number]': order.number,
      'metadata[store]': store.slug,
      'payment_intent_data[statement_descriptor_suffix]': store.name.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 22) || 'TIENDA',
    };
    items.forEach((it, i) => {
      params[`line_items[${i}][quantity]`] = it.qty;
      params[`line_items[${i}][price_data][currency]`] = 'mxn';
      params[`line_items[${i}][price_data][unit_amount]`] = it.unit_price_cents;
      params[`line_items[${i}][price_data][product_data][name]`] = it.title.slice(0, 250);
    });
    const session = await stripeApi('POST', '/checkout/sessions', params);
    return { redirectUrl: session.url, ref: session.id };
  },
  async confirm({ order, query }) {
    const id = String(query.session_id || '');
    if (!id || id !== order.payment_ref) return { paid: false };
    const s = await stripeApi('GET', `/checkout/sessions/${encodeURIComponent(id)}`);
    const paid = s.payment_status === 'paid'
      && s.metadata?.order_number === order.number
      && s.amount_total === order.total_cents
      && s.currency === 'mxn';
    return { paid, ref: s.payment_intent || id };
  },
};

const PROVIDERS = { mock, stripe };

export function getPayments(name = env.payments) {
  const p = PROVIDERS[name];
  if (!p) throw new Error(`Proveedor de pagos desconocido: ${name}`);
  return p;
}

export function estimateFeeCents(totalCents) {
  return Math.round(totalCents * env.paymentFeePct / 100 + env.paymentFeeFixed * 100);
}
