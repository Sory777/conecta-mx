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

// Busca la primera variante cuyo nombre/clave contenga un color permitido y ningún
// otro color (CJ nombra las variantes como "Black-XL", "White M", "Black Red-L"…).
const OTHER_COLORS = /\b(red|blue|pink|green|yellow|purple|orange|brown|gr[ae]y|beige|khaki|navy|apricot|coffee|wine|camel|rose|violet|multicolou?r|colorful)\b/;
export function pickColorVariant(variants, colors) {
  for (const v of variants) {
    const name = `${v.variantKey || ''} ${v.variantNameEn || ''}`.toLowerCase();
    if (OTHER_COLORS.test(name)) continue;
    for (const [en, es] of Object.entries(colors)) {
      if (new RegExp(`\\b${en}\\b`).test(name)) return { variant: v, colorEs: es };
    }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Relevancia -------------------------------------------------------------
// CJ, al ordenar por popularidad, devuelve productos muy vendidos aunque no tengan que ver
// con la búsqueda (cepillos de cabello al buscar "playera calavera"). Por eso primero pedimos
// los resultados por relevancia, descartamos los que no coinciden con la búsqueda y, entre
// los que sí, nos quedamos con los más vendidos (listedNum: tiendas que lo venden en CJ).
const STOP = new Set(['women', 'men', 'for', 'and', 'with', 'the', 'a', 'of', 'style']);
// Sinónimos del tipo de producto (la última palabra de cada búsqueda).
const SYN = {
  't-shirt': ['t-shirt', 'tshirt', 't shirt', 'tee', 'shirt'],
  shirt: ['shirt', 'blouse', 'top'],
  hoodie: ['hoodie', 'hooded', 'sweatshirt'],
  sweater: ['sweater', 'pullover', 'cardigan', 'jumper'],
  pants: ['pants', 'trousers', 'joggers', 'sweatpants'],
  jeans: ['jeans', 'denim pants'],
  jacket: ['jacket', 'coat', 'outerwear'],
  shorts: ['shorts'],
  trunks: ['trunks', 'board shorts', 'swim shorts'],
  swimsuit: ['swimsuit', 'swimwear', 'bikini', 'one piece', 'monokini'],
  dress: ['dress'],
  skirt: ['skirt'],
  leggings: ['leggings', 'legging'],
  socks: ['socks'],
  pajamas: ['pajamas', 'pajama', 'pyjama', 'sleepwear'],
  earbuds: ['earbuds', 'earphones', 'headphones', 'headset'],
  headphones: ['headphones', 'headset', 'earphones'],
  watch: ['watch', 'smartwatch'],
  bag: ['bag', 'handbag', 'purse', 'tote'],
  case: ['case', 'cover'],
};
const norm = (s) => ` ${String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

export function isRelevant(name, query) {
  const n = norm(name);
  const words = String(query).toLowerCase().split(/\s+/);
  // Público: una búsqueda de caballero no acepta productos de dama y viceversa.
  if (words[0] === 'men' && /\s(women|woman|womens|ladies|lady|girl|girls)\s/.test(n)) return false;
  if (words[0] === 'women' && /\s(men|mens|man|boys)\s/.test(n)) return false;
  // Ropa de bebé o niño nunca entra (las tiendas son de adultos).
  if (/\s(baby|babies|newborn|infant|toddler|kids|children|child)\s/.test(n)) return false;
  const tokens = words.filter((t) => t && !STOP.has(t));
  if (!tokens.length) return true;
  // Coincidencia por inicio de palabra; acepta singular y plural (toys/toy, lights/light).
  const has = (t) => (SYN[t] || [t]).flatMap((v) => [v, v.replace(/s$/, '')]).some((v) => n.includes(norm(v).trimEnd()));
  if (!has(tokens.at(-1))) return false; // el tipo de producto es obligatorio
  return tokens.filter(has).length / tokens.length >= 0.6;
}

async function topProducts(keyword, size) {
  let list;
  try {
    // Sin orderBy = orden por relevancia de CJ.
    const data = await cj('GET', `/product/listV2?keyWord=${encodeURIComponent(keyword)}&page=1&size=${size}`);
    list = (data?.content || []).flatMap((g) => g.productList || []).map((p) => ({
      pid: p.id, name: p.nameEn, image: p.bigImage, price: p.sellPrice, listed: Number(p.listedNum) || 0,
      inventory: p.warehouseInventoryNum,
    }));
  } catch {
    // Cuentas/versiones antiguas: endpoint clásico.
    const data = await cj('GET', `/product/list?pageNum=1&pageSize=${size}&productNameEn=${encodeURIComponent(keyword)}`);
    list = (data?.list || []).map((p) => ({
      pid: p.pid, name: p.productNameEn, image: p.productImage, price: p.sellPrice, listed: Number(p.listedNum) || 0,
    }));
  }
  return list.filter((p) => isRelevant(p.name, keyword)).sort((a, b) => b.listed - a.listed);
}

export const cjSupplier = {
  name: 'cj',
  label: 'CJ Dropshipping',

  // searches: [{ store, category, query, label, icon }]. Cada producto se asigna a una sola
  // tienda: si dos búsquedas encuentran el mismo, se queda con la primera y la otra toma el siguiente.
  // exclude: ids de producto que ya tomó otra tienda en esta sincronización.
  async fetchCatalog({ searches, perSearch = env.cjPerSearch, exclude = [] } = {}) {
    const used = new Set(exclude);
    const out = [];
    for (const s of searches) {
      // Si CJ falla (llave inválida, límite…) el error sube y queda registrado en la sincronización.
      const candidates = await topProducts(s.query, 100);
      let taken = 0;
      let shippingUsd = null; // se cotiza una vez por búsqueda: productos parecidos, envío parecido
      for (const p of candidates) {
        if (taken >= perSearch) break;
        if (!p.pid || used.has(p.pid) || p.inventory === 0) continue;
        await sleep(env.cjDelayMs);
        const variants = (await cj('GET', `/product/variant/query?pid=${encodeURIComponent(p.pid)}`).catch(() => [])) || [];
        let v = variants[0];
        let colorEs = null;
        if (s.colors) {
          // Tienda con colores restringidos: solo variantes cuyo nombre incluya un color permitido.
          const match = pickColorVariant(variants, s.colors);
          if (!match) continue;
          ({ variant: v, colorEs } = match);
        }
        const vid = v?.vid || p.pid;
        const costUsd = num(v?.variantSellPrice ?? p.price);
        if (!costUsd) continue;
        if (shippingUsd == null) await sleep(env.cjDelayMs);
        used.add(p.pid);
        taken += 1;
        out.push({
          store: s.store,
          searchTerm: s.query,
          audience: s.audience || null,
          popularity: p.listed,
          supplierProductId: p.pid,
          supplierVariantId: vid,
          title: colorEs ? `${p.name} · ${colorEs}` : p.name,
          color: colorEs,
          description: `${s.label}. ${p.name}`,
          category: s.category,
          imageUrl: v?.variantImage || p.image || null,
          icon: s.icon,
          costUsd,
          shippingUsd: (shippingUsd ??= await shippingFor(vid)),
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
