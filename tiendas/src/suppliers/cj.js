// Adaptador para CJ Dropshipping (API v2.0): https://developers.cjdropshipping.com
// Necesita CJ_API_KEY (CJ > Authorization > API). Los pedidos se crean con
// payType=2 (pago automático con el saldo de tu cuenta CJ), así el proveedor
// cobra su costo de tu saldo y tú te quedas con el margen que cobró la tienda.
//
// Nota: la API de CJ cambia con frecuencia; las rutas y campos de aquí están
// tomados de su documentación v2.0. Si CJ responde con un error de campo,
// revisa la sección correspondiente de su documentación y ajusta el mapeo.
import { env } from '../config/env.js';

const BASE = 'https://developers.cjdropshipping.com/api2.0/v1';
let token = null;
let tokenExpires = 0;

async function getToken() {
  if (token && Date.now() < tokenExpires) return token;
  if (!env.cjApiKey) throw new Error('Falta CJ_API_KEY');
  const res = await fetch(`${BASE}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: env.cjApiKey }),
  });
  const json = await res.json();
  if (!json.result || !json.data?.accessToken) throw new Error(`CJ auth: ${json.message || res.status}`);
  token = json.data.accessToken;
  // Los tokens de CJ duran ~15 días; lo renovamos cada 12 h.
  tokenExpires = Date.now() + 12 * 3600_000;
  return token;
}

async function cj(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': await getToken() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.result === false || (json.code && json.code !== 200)) {
    throw new Error(`CJ ${path}: ${json.message || res.status}`);
  }
  return json.data;
}

const num = (v) => {
  // CJ a veces devuelve rangos de precio ("3.20 -- 4.10"): usamos el mayor.
  const parts = String(v ?? '').split(/[^0-9.]+/).filter(Boolean).map(Number);
  return parts.length ? Math.max(...parts) : 0;
};

async function shippingFor(vid) {
  try {
    const data = await cj('POST', '/logistic/freightCalculate', {
      startCountryCode: 'CN', endCountryCode: 'MX', products: [{ vid, quantity: 1 }],
    });
    const opt = (data || []).find((o) => o.logisticName === env.cjLogistic) || (data || [])[0];
    return opt ? num(opt.logisticPrice) : 3;
  } catch {
    return 3; // estimación conservadora si no se pudo cotizar
  }
}

export const cjSupplier = {
  name: 'cj',
  label: 'CJ Dropshipping',

  // CJ_KEYWORDS: "gadgets:earbuds,smart watch;ropa:hoodie;accesorios:wallet"
  async fetchCatalog({ perKeyword = 8 } = {}) {
    const groups = env.cjKeywords.split(';').map((g) => g.split(':')).filter((g) => g.length === 2);
    const out = [];
    for (const [category, words] of groups) {
      for (const keyword of words.split(',').map((w) => w.trim()).filter(Boolean)) {
        const data = await cj('GET', `/product/list?pageNum=1&pageSize=${perKeyword}&productNameEn=${encodeURIComponent(keyword)}`);
        for (const p of data?.list || []) {
          const variants = await cj('GET', `/product/variant/query?pid=${encodeURIComponent(p.pid)}`).catch(() => []);
          const v = (variants || [])[0];
          const vid = v?.vid || p.pid;
          out.push({
            supplierProductId: p.pid,
            supplierVariantId: vid,
            title: p.productNameEn,
            description: p.productNameEn,
            category: category.trim(),
            imageUrl: v?.variantImage || p.productImage || null,
            icon: null,
            costUsd: num(v?.variantSellPrice ?? p.sellPrice),
            shippingUsd: await shippingFor(vid),
          });
        }
      }
    }
    return out.filter((p) => p.costUsd > 0);
  },

  async createOrder(order) {
    const c = order.customer;
    const data = await cj('POST', '/shopping/order/createOrderV2', {
      orderNumber: order.number,
      shippingCountryCode: 'MX',
      shippingCountry: 'Mexico',
      shippingProvince: c.state,
      shippingCity: c.city,
      shippingAddress: `${c.street}, Col. ${c.colonia}`,
      shippingZip: c.zip,
      shippingCustomerName: c.name,
      shippingPhone: c.phone,
      email: c.email,
      logisticName: env.cjLogistic,
      fromCountryCode: 'CN',
      payType: 2,
      products: order.items.map((i) => ({ vid: i.variantId, quantity: i.qty })),
    });
    return { supplierOrderId: data?.orderId || data?.orderNum || String(data) };
  },

  async getOrderStatus(supplierOrderId) {
    const d = await cj('GET', `/shopping/order/getOrderDetail?orderId=${encodeURIComponent(supplierOrderId)}`);
    const s = String(d?.orderStatus || '').toUpperCase();
    const status = s === 'DELIVERED' ? 'delivered'
      : s === 'SHIPPED' ? 'shipped'
      : s === 'CANCELLED' ? 'cancelled'
      : 'processing';
    return { status, trackingNumber: d?.trackNumber || null };
  },
};
