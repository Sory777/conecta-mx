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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Busca los productos más vendidos para una palabra clave. CJ no publica ventas
// reales; usamos su orden por "listedNum" (cuántas tiendas venden el producto),
// que es su indicador público de demanda.
async function topProducts(keyword, size) {
  try {
    const data = await cj('GET', `/product/listV2?keyWord=${encodeURIComponent(keyword)}&orderBy=1&sort=desc&page=1&size=${size}`);
    return (data?.content || []).flatMap((g) => g.productList || []).map((p) => ({
      pid: p.id, name: p.nameEn, image: p.bigImage, price: p.sellPrice, listed: Number(p.listedNum) || 0,
      inventory: p.warehouseInventoryNum,
    }));
  } catch {
    // Cuentas/versiones antiguas: endpoint clásico, ordenamos nosotros por listedNum.
    const data = await cj('GET', `/product/list?pageNum=1&pageSize=${size}&productNameEn=${encodeURIComponent(keyword)}`);
    return (data?.list || []).map((p) => ({
      pid: p.pid, name: p.productNameEn, image: p.productImage, price: p.sellPrice, listed: Number(p.listedNum) || 0,
    })).sort((a, b) => b.listed - a.listed);
  }
}

export const cjSupplier = {
  name: 'cj',
  label: 'CJ Dropshipping',

  // searches: [{ store, category, query, label, icon }]. Cada producto se asigna a una sola
  // tienda: si dos búsquedas encuentran el mismo, se queda con la primera y la otra toma el siguiente.
  async fetchCatalog({ searches, perSearch = env.cjPerSearch } = {}) {
    const used = new Set();
    const out = [];
    for (const s of searches) {
      let candidates;
      try {
        candidates = await topProducts(s.query, Math.min(100, perSearch * 4));
      } catch (err) {
        console.error(`[cj] búsqueda "${s.query}" (${s.store}):`, err.message);
        continue;
      }
      let taken = 0;
      for (const p of candidates) {
        if (taken >= perSearch) break;
        if (!p.pid || used.has(p.pid) || p.inventory === 0) continue;
        await sleep(env.cjDelayMs);
        const variants = await cj('GET', `/product/variant/query?pid=${encodeURIComponent(p.pid)}`).catch(() => []);
        const v = (variants || [])[0];
        const vid = v?.vid || p.pid;
        const costUsd = num(v?.variantSellPrice ?? p.price);
        if (!costUsd) continue;
        await sleep(env.cjDelayMs);
        used.add(p.pid);
        taken += 1;
        out.push({
          store: s.store,
          searchTerm: s.query,
          popularity: p.listed,
          supplierProductId: p.pid,
          supplierVariantId: vid,
          title: p.name,
          description: `${s.label}. ${p.name}`,
          category: s.category,
          imageUrl: v?.variantImage || p.image || null,
          icon: s.icon,
          costUsd,
          shippingUsd: await shippingFor(vid),
        });
      }
      await sleep(env.cjDelayMs);
    }
    return out;
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
