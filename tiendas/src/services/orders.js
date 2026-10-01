import crypto from 'node:crypto';
import { db, tx } from '../db.js';
import { getStoreProduct } from './catalog.js';
import { estimateFeeCents } from '../payments/index.js';
import { getSupplier } from '../suppliers/index.js';

export const MX_STATES = ['Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
  'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco',
  'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
  'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'];

export const STATUS_LABELS = {
  pending_payment: 'Pago pendiente',
  paid: 'Pagado',
  supplier_error: 'Error con proveedor',
  sent_to_supplier: 'Enviado al proveedor',
  shipped: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};
// Estados en los que la venta ya está cobrada y cuenta para ganancias.
export const PAID_STATUSES = ['paid', 'supplier_error', 'sent_to_supplier', 'shipped', 'delivered'];

export class ValidationError extends Error {}

export function validateCustomer(input) {
  const c = {};
  for (const k of ['name', 'email', 'phone', 'street', 'colonia', 'city', 'state', 'zip']) c[k] = String(input[k] ?? '').trim();
  const errors = {};
  if (c.name.length < 3) errors.name = 'Escribe tu nombre completo';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) errors.email = 'Correo no válido';
  c.phone = c.phone.replace(/\D/g, '').replace(/^52/, '');
  if (c.phone.length !== 10) errors.phone = 'Teléfono de 10 dígitos';
  if (c.street.length < 4) errors.street = 'Calle y número';
  if (c.colonia.length < 2) errors.colonia = 'Colonia requerida';
  if (c.city.length < 2) errors.city = 'Ciudad o municipio requerido';
  if (!MX_STATES.includes(c.state)) errors.state = 'Selecciona un estado';
  if (!/^\d{5}$/.test(c.zip)) errors.zip = 'Código postal de 5 dígitos';
  for (const k of Object.keys(c)) c[k] = c[k].slice(0, 200);
  return { customer: c, errors };
}

// Los precios SIEMPRE se recalculan desde la base: nunca se confía en el carrito del navegador.
export function priceCart(storeSlug, cart) {
  const lines = [];
  for (const raw of (Array.isArray(cart) ? cart : []).slice(0, 30)) {
    const qty = Math.min(10, Math.max(1, Math.floor(Number(raw?.qty) || 0)));
    const p = getStoreProduct(storeSlug, Number(raw?.id));
    if (!p || !qty) continue;
    const existing = lines.find((l) => l.product.id === p.id);
    if (existing) existing.qty = Math.min(10, existing.qty + qty);
    else lines.push({ product: p, qty });
  }
  const total = lines.reduce((s, l) => s + l.product.price_cents * l.qty, 0);
  const cost = lines.reduce((s, l) => s + (l.product.cost_cents + l.product.shipping_cents) * l.qty, 0);
  return { lines, total, cost };
}

function newOrderNumber(storeSlug) {
  const d = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  return `${storeSlug.slice(0, 3).toUpperCase()}-${d}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export function createOrder(storeSlug, cart, customerInput) {
  const { customer, errors } = validateCustomer(customerInput);
  if (Object.keys(errors).length) throw Object.assign(new ValidationError('Revisa tus datos'), { errors });
  const { lines, total, cost } = priceCart(storeSlug, cart);
  if (!lines.length) throw new ValidationError('Tu carrito está vacío');

  return tx(() => {
    const number = newOrderNumber(storeSlug);
    const { lastInsertRowid: id } = db.prepare(`INSERT INTO orders
      (number, store_slug, status, customer_name, email, phone, street, colonia, city, state, zip, total_cents, supplier_cost_cents)
      VALUES (?, ?, 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(number, storeSlug, customer.name, customer.email, customer.phone, customer.street, customer.colonia,
        customer.city, customer.state, customer.zip, total, cost);
    const ins = db.prepare(`INSERT INTO order_items (order_id, product_id, supplier_variant_id, title, qty, unit_price_cents, unit_cost_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (const l of lines) {
      ins.run(id, l.product.id, l.product.supplier_variant_id, l.product.title, l.qty, l.product.price_cents,
        l.product.cost_cents + l.product.shipping_cents);
    }
    logEvent(id, 'created', `Pedido creado por ${customer.name}`);
    return getOrder(Number(id));
  });
}

export function getOrder(id) {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id) || null;
}
export function getOrderByNumber(number) {
  return db.prepare('SELECT * FROM orders WHERE number = ?').get(String(number)) || null;
}
export function getOrderItems(orderId) {
  return db.prepare('SELECT oi.*, p.supplier FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE order_id = ?').all(orderId);
}
export function getOrderEvents(orderId) {
  return db.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY id').all(orderId);
}
export function setPaymentRef(orderId, provider, ref) {
  db.prepare("UPDATE orders SET payment_provider = ?, payment_ref = ?, updated_at = datetime('now') WHERE id = ?").run(provider, ref, orderId);
}

function logEvent(orderId, type, message) {
  db.prepare('INSERT INTO order_events (order_id, type, message) VALUES (?, ?, ?)').run(orderId, type, message);
}

// Marca el pedido como pagado y registra la ganancia (venta - costo proveedor - comisión de pago).
export function markPaid(orderId, ref) {
  const o = getOrder(orderId);
  if (!o || o.status !== 'pending_payment') return false;
  const fee = estimateFeeCents(o.total_cents);
  const changed = db.prepare(`UPDATE orders SET status = 'paid', payment_ref = ?, payment_fee_cents = ?, profit_cents = ?,
    updated_at = datetime('now') WHERE id = ? AND status = 'pending_payment'`)
    .run(ref, fee, o.total_cents - o.supplier_cost_cents - fee, orderId).changes;
  if (changed) logEvent(orderId, 'paid', `Pago confirmado (${ref})`);
  return changed > 0;
}

// Envía el pedido al proveedor. Si hay artículos de varios proveedores, se crea un pedido en cada uno.
export async function forwardToSupplier(orderId) {
  const o = getOrder(orderId);
  if (!o || !['paid', 'supplier_error'].includes(o.status)) return o;
  // Reclamamos el pedido de forma atómica para no enviarlo dos veces.
  const claimed = db.prepare("UPDATE orders SET status = 'sent_to_supplier', updated_at = datetime('now') WHERE id = ? AND status IN ('paid','supplier_error')").run(orderId).changes;
  if (!claimed) return getOrder(orderId);

  const items = getOrderItems(orderId);
  const bySupplier = Map.groupBy(items, (i) => i.supplier);
  const ids = [];
  try {
    for (const [name, its] of bySupplier) {
      const { supplierOrderId } = await getSupplier(name).createOrder({
        number: bySupplier.size > 1 ? `${o.number}-${name}` : o.number,
        customer: { name: o.customer_name, email: o.email, phone: o.phone, street: o.street, colonia: o.colonia, city: o.city, state: o.state, zip: o.zip },
        items: its.map((i) => ({ variantId: i.supplier_variant_id, qty: i.qty })),
      });
      ids.push(`${name}:${supplierOrderId}`);
    }
    db.prepare("UPDATE orders SET supplier = ?, supplier_order_id = ?, last_error = NULL, updated_at = datetime('now') WHERE id = ?")
      .run([...bySupplier.keys()].join(','), ids.join(','), orderId);
    logEvent(orderId, 'forwarded', `Pedido enviado al proveedor: ${ids.join(', ')}`);
  } catch (err) {
    db.prepare("UPDATE orders SET status = 'supplier_error', supplier_order_id = ?, last_error = ?, updated_at = datetime('now') WHERE id = ?")
      .run(ids.join(',') || null, String(err.message).slice(0, 500), orderId);
    logEvent(orderId, 'supplier_error', `Falló el envío al proveedor: ${err.message}`);
  }
  return getOrder(orderId);
}

export async function refreshTracking(orderId) {
  const o = getOrder(orderId);
  if (!o?.supplier_order_id || !['sent_to_supplier', 'shipped'].includes(o.status)) return o;
  const parts = o.supplier_order_id.split(',').map((s) => s.split(/:(.*)/s));
  const results = [];
  for (const [name, id] of parts) results.push(await getSupplier(name).getOrderStatus(id));
  const rank = { processing: 0, shipped: 1, delivered: 2 };
  // El pedido avanza al estado del envío más atrasado.
  const worst = results.some((r) => r.status === 'cancelled') ? 'cancelled'
    : results.reduce((a, r) => (rank[r.status] < rank[a] ? r.status : a), 'delivered');
  const status = worst === 'processing' ? 'sent_to_supplier' : worst;
  const tracking = results.map((r) => r.trackingNumber).filter(Boolean).join(', ') || null;
  if (status !== o.status || tracking !== o.tracking_number) {
    db.prepare("UPDATE orders SET status = ?, tracking_number = ?, updated_at = datetime('now') WHERE id = ?").run(status, tracking, orderId);
    logEvent(orderId, status, `${STATUS_LABELS[status]}${tracking ? ` · guía ${tracking}` : ''}`);
  }
  return getOrder(orderId);
}

export async function refreshAllTracking() {
  const open = db.prepare("SELECT id FROM orders WHERE status IN ('sent_to_supplier','shipped')").all();
  for (const { id } of open) {
    try { await refreshTracking(id); } catch (err) { console.error(`[rastreo] pedido ${id}:`, err.message); }
  }
  return open.length;
}

export async function retryFailedForwards() {
  const failed = db.prepare("SELECT id FROM orders WHERE status IN ('paid','supplier_error')").all();
  for (const { id } of failed) await forwardToSupplier(id);
  return failed.length;
}

export function cancelOrder(orderId) {
  const changed = db.prepare("UPDATE orders SET status = 'cancelled', profit_cents = 0, updated_at = datetime('now') WHERE id = ? AND status IN ('pending_payment','supplier_error')").run(orderId).changes;
  if (changed) logEvent(orderId, 'cancelled', 'Pedido cancelado por el administrador');
  return changed > 0;
}
