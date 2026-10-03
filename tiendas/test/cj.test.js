import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.CJ_API_KEY = 'test';
process.env.CJ_DELAY_MS = '0';
process.env.CJ_PER_SEARCH = '2';
process.env.PGLITE_DIR = 'memory://';

const calls = [];
// API de CJ simulada: dos búsquedas que comparten el producto más vendido.
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url);
  calls.push(u.pathname + u.search);
  const ok = (data) => ({ ok: true, json: async () => ({ result: true, code: 200, data }) });
  if (u.pathname.endsWith('/authentication/getAccessToken')) return ok({ accessToken: 'tok' });
  if (u.pathname.endsWith('/product/listV2')) {
    const kw = u.searchParams.get('keyWord');
    const list = {
      'wireless earbuds': [
        { id: 'P1', nameEn: 'TWS Earbuds', bigImage: 'https://img/p1.jpg', sellPrice: '5.10', listedNum: 9000, warehouseInventoryNum: 50 },
        { id: 'P2', nameEn: 'Earbuds Pro', bigImage: 'https://img/p2.jpg', sellPrice: '3.20 -- 4.80', listedNum: 7000 },
        { id: 'P3', nameEn: 'Earbuds Mini', bigImage: 'https://img/p3.jpg', sellPrice: '2.00', listedNum: 100 },
      ],
      'bluetooth earphones': [
        { id: 'P1', nameEn: 'TWS Earbuds', bigImage: 'https://img/p1.jpg', sellPrice: '5.10', listedNum: 9000 },
        { id: 'P4', nameEn: 'Sport Earphones', bigImage: 'https://img/p4.jpg', sellPrice: '4.00', listedNum: 5000, warehouseInventoryNum: 0 },
        { id: 'P5', nameEn: 'Neckband', bigImage: 'https://img/p5.jpg', sellPrice: '6.00', listedNum: 4000 },
        { id: 'P6', nameEn: 'Clip Earbuds', bigImage: 'https://img/p6.jpg', sellPrice: '7.00', listedNum: 3000 },
      ],
    }[kw];
    return ok({ content: [{ productList: list }] });
  }
  if (u.pathname.endsWith('/product/variant/query')) {
    const pid = u.searchParams.get('pid');
    return ok([{ vid: `V-${pid}`, variantSellPrice: '4.5', variantImage: null }]);
  }
  if (u.pathname.endsWith('/logistic/freightCalculate')) return ok([{ logisticName: 'CJPacket Ordinary', logisticPrice: '2.75' }]);
  throw new Error(`URL inesperada ${url}`);
};

const { cjSupplier, pickColorVariant } = await import('../src/suppliers/cj.js');

test('CJ: toma los más vendidos de cada búsqueda sin repetir productos entre tiendas', async () => {
  const out = await cjSupplier.fetchCatalog({
    searches: [
      { store: 'voltia', category: 'gadgets', query: 'wireless earbuds', label: 'Audífonos inalámbricos', icon: 'headphones' },
      { store: 'pixelpop', category: 'gadgets', query: 'bluetooth earphones', label: 'Audífonos', icon: 'headphones' },
    ],
  });
  assert.deepEqual(out.map((p) => [p.store, p.supplierProductId]), [
    ['voltia', 'P1'], ['voltia', 'P2'], // los 2 más vendidos
    ['pixelpop', 'P5'], ['pixelpop', 'P6'], // P1 ya es de voltia y P4 está agotado
  ]);
  const listCall = calls.find((c) => c.includes('listV2'));
  assert.match(listCall, /orderBy=1&sort=desc/, 'ordenado por ventas (listedNum)');
  assert.equal(out[0].supplierVariantId, 'V-P1');
  assert.equal(out[0].costUsd, 4.5);
  assert.equal(out[0].shippingUsd, 2.75);
  assert.equal(out[0].popularity, 9000);
  assert.equal(out[0].imageUrl, 'https://img/p1.jpg');
});

test('CJ: tiendas en negro y blanco solo toman variantes de esos colores', () => {
  const colors = { black: 'Negro', white: 'Blanco' };
  const pick = (names) => pickColorVariant(names.map((n, i) => ({ vid: `V${i}`, variantKey: n })), colors);
  assert.equal(pick(['Red-M', 'Black-M', 'White-M']).variant.vid, 'V1');
  assert.equal(pick(['Red-M', 'Black-M']).colorEs, 'Negro');
  assert.equal(pick(['White XL']).colorEs, 'Blanco');
  assert.equal(pick(['Black Red-L', 'Pink-S', 'Blackish-M']), null, 'combinados, otros colores o falsos positivos se descartan');
  assert.equal(pick([]), null);
});
