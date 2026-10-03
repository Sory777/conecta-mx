import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.PGLITE_DIR = 'memory://';
process.env.SESSION_SECRET = 'prueba';
process.env.ADMIN_PASSWORD = 'secreto-de-prueba';
process.env.SUPPLIER = 'mock';
process.env.PAYMENTS = 'mock';

const { app, runSync } = await import('../src/server.js');
const { q, one } = await import('../src/db.js');
const { STORES } = await import('../src/config/stores.js');

let server, base;
before(async () => {
  await runSync();
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const get = (p, opts) => fetch(base + p, { redirect: 'manual', ...opts });
const post = (p, body, opts = {}) => fetch(base + p, {
  method: 'POST', redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...opts.headers },
  body: new URLSearchParams(body).toString(),
});

const customer = {
  name: '<b>Ana</b> López', email: 'ana@example.com', phone: '55 1234 5678', street: 'Av. Juárez 123',
  colonia: 'Centro', city: 'Guadalajara', state: 'Jalisco', zip: '44100',
};

test('las 10 tiendas cargan con identidad propia', async () => {
  assert.equal(STORES.length, 10);
  assert.equal(new Set(STORES.map((s) => s.palette.primary)).size, 10, 'paletas únicas');
  assert.equal(new Set(STORES.map((s) => s.logoShape)).size, 10, 'logotipos únicos');
  for (const s of STORES) {
    const res = await get(`/s/${s.slug}/`);
    assert.equal(res.status, 200);
    const page = await res.text();
    assert.match(page, new RegExp(`data-hero="${s.hero}"`));
    assert.match(page, /class="grid"/);
    const css = await (await get(`/s/${s.slug}/theme.css`)).text();
    assert.ok(css.includes(s.palette.primary));
  }
});

test('cada tienda tiene productos propios, distintos a los de las demás', async () => {
  const owners = await q('SELECT product_id FROM tiendas.store_products GROUP BY product_id HAVING COUNT(DISTINCT store_slug) > 1');
  assert.deepEqual(owners, [], 'ningún producto se repite entre tiendas');
  for (const s of STORES) {
    const rows = await q(`SELECT sp.price_cents, sp.featured, p.cost_cents + p.shipping_cents landed, p.popularity
      FROM tiendas.store_products sp JOIN tiendas.products p ON p.id = sp.product_id WHERE sp.store_slug = $1 ORDER BY p.popularity DESC`, [s.slug]);
    assert.ok(rows.length >= 20, `${s.slug} tiene productos`);
    for (const r of rows) assert.ok(r.price_cents > r.landed, 'precio mayor al costo');
    assert.deepEqual(rows.slice(0, 4).map((r) => r.featured), [1, 1, 1, 1], 'los más populares son los destacados');
    for (const c of s.categories) {
      const { n } = await one('SELECT COUNT(*)::int n FROM tiendas.store_products sp JOIN tiendas.products p ON p.id = sp.product_id WHERE sp.store_slug = $1 AND category = $2', [s.slug, c]);
      assert.ok(n > 0, `${s.slug} tiene ${c}`);
    }
  }
});

test('las búsquedas de nicho se reparten por turnos y ninguna se repite', async () => {
  const { nicheSearches } = await import('../src/services/catalog.js');
  const list = nicheSearches();
  const total = STORES.reduce((n, s) => n + Object.values(s.niche).flat().length * Object.keys(s.audiences || { _: 1 }).length, 0);
  assert.equal(list.length, total);
  assert.deepEqual(list.slice(0, 10).map((x) => x.store), STORES.map((s) => s.slug));
  assert.equal(new Set(list.map((x) => `${x.store}:${x.query}`)).size, total);
});

test('el carrito ignora precios enviados por el navegador', async () => {
  const { product_id: id, price_cents } = await one("SELECT product_id, price_cents FROM tiendas.store_products WHERE store_slug = 'voltia' LIMIT 1");
  const res = await fetch(`${base}/s/voltia/api/cart`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id, qty: 2, price: 1 }, { id: 999999, qty: 1 }] }),
  });
  const data = await res.json();
  assert.deepEqual(data.items, [{ id, qty: 2 }]);
  assert.equal(data.totalFmt.replace(/[^\d]/g, ''), String(price_cents * 2));
});

test('checkout valida los datos de envío', async () => {
  const res = await post('/s/lume/checkout', { ...customer, zip: '12', cart: '[]' });
  assert.equal(res.status, 400);
  assert.match(await res.text(), /Código postal de 5 dígitos/);
});

test('pedido completo: pago -> proveedor -> ganancia en el panel', async () => {
  const items = (await q("SELECT product_id id FROM tiendas.store_products WHERE store_slug = 'nebula' LIMIT 2")).map((r) => ({ id: r.id, qty: 1 }));
  const res = await post('/s/nebula/checkout', { ...customer, cart: JSON.stringify(items) });
  assert.equal(res.status, 303);
  const pay = new URL(res.headers.get('location'));
  assert.equal(pay.pathname, '/s/nebula/pedido/confirmar');

  const confirm = await get(pay.pathname + pay.search);
  assert.equal(confirm.status, 303);
  const orderUrl = confirm.headers.get('location');

  const order = await one("SELECT * FROM tiendas.orders WHERE store_slug = 'nebula' ORDER BY id DESC LIMIT 1");
  assert.equal(order.status, 'sent_to_supplier');
  assert.match(order.supplier_order_id, /^mock:MOCK-SO-NEB-/);
  assert.equal(order.phone, '5512345678');
  assert.equal(order.profit_cents, order.total_cents - order.supplier_cost_cents - order.payment_fee_cents);
  assert.ok(order.profit_cents > 0, 'la venta deja ganancia');

  const page = await (await get(orderUrl)).text();
  assert.match(page, /¡Gracias por tu compra!/);
  // Sin token no se puede ver el pedido de otra persona.
  assert.equal((await get(`/s/nebula/pedido/${order.number}`)).status, 404);
  assert.equal((await get(`/s/voltia${new URL(base + orderUrl).pathname.replace('/s/nebula', '')}`)).status, 404);

  // El panel exige sesión.
  assert.equal((await get('/admin')).status, 303);
  assert.equal((await post('/admin/login', { password: 'mala' })).status, 401);
  const login = await post('/admin/login', { password: 'secreto-de-prueba' });
  assert.equal(login.status, 303);
  const cookie = login.headers.get('set-cookie').split(';')[0];

  const dash = await (await get('/admin?days=0', { headers: { cookie } })).text();
  assert.match(dash, /Tu ganancia/);
  assert.ok(dash.includes(order.number));
  const detail = await (await get(`/admin/pedidos/${order.id}`, { headers: { cookie } })).text();
  assert.ok(detail.includes('&lt;b&gt;Ana&lt;/b&gt;'), 'datos del cliente escapados');
  assert.ok(!detail.includes('<b>Ana</b>'));

  // Origen externo bloqueado (CSRF).
  const csrf = await post('/admin/sync', {}, { headers: { cookie, origin: 'https://malicioso.example' } });
  assert.equal(csrf.status, 403);

  // Cambiar el margen de una tienda recalcula sus precios.
  const before = (await one("SELECT SUM(price_cents)::int8 s FROM tiendas.store_products WHERE store_slug = 'kiro'")).s;
  const save = await post('/admin/tiendas/kiro', { markup: '120', active: '1' }, { headers: { cookie } });
  assert.equal(save.status, 303);
  const afterSum = (await one("SELECT SUM(price_cents)::int8 s FROM tiendas.store_products WHERE store_slug = 'kiro'")).s;
  assert.ok(afterSum > before);
});

test('error del proveedor queda registrado y se puede reintentar', async () => {
  const { mockSupplier } = await import('../src/suppliers/mock.js');
  const { forwardToSupplier, markPaid, createOrder } = await import('../src/services/orders.js');
  const id = (await one("SELECT product_id FROM tiendas.store_products WHERE store_slug = 'alasnegras' LIMIT 1")).product_id;
  const order = await createOrder('alasnegras', [{ id, qty: 1 }], customer);
  await markPaid(order.id, 'TEST');
  const original = mockSupplier.createOrder;
  mockSupplier.createOrder = async () => { throw new Error('Sin saldo'); };
  let o = await forwardToSupplier(order.id);
  assert.equal(o.status, 'supplier_error');
  assert.equal(o.last_error, 'Sin saldo');
  mockSupplier.createOrder = original;
  o = await forwardToSupplier(order.id);
  assert.equal(o.status, 'sent_to_supplier');
});

test('Alas Negras: solo ropa, solo negro y blanco, diseño monocromático', async () => {
  const store = STORES.find((s) => s.slug === 'alasnegras');
  const hex = Object.values(store.palette);
  for (const c of hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    assert.ok(r === g && g === b, `${c} es un gris neutro (sin color)`);
  }
  const rows = await q(`SELECT p.category, COALESCE(p.title_custom, p.title) title FROM tiendas.store_products sp
    JOIN tiendas.products p ON p.id = sp.product_id WHERE sp.store_slug = 'alasnegras'`);
  assert.ok(rows.length >= 40);
  for (const r of rows) {
    assert.ok(['playeras', 'sudaderas', 'chamarras', 'pantalones'].includes(r.category), `${r.title} es ropa`);
    assert.match(r.title, /· (Negro|Blanco)$/, `${r.title} es negro o blanco`);
  }
  const page = await (await get('/s/alasnegras/')).text();
  assert.match(page, /data-hero="noir"/);
  assert.match(page, /data-mood="noir"/);
  assert.doesNotMatch(page.slice(0, page.indexOf('class="trust')), /calavera|skull/i, 'cabecera y portada sin calaveras');
  for (const c of ['Playeras', 'Sudaderas', 'Chamarras', 'Pantalones']) assert.ok(page.includes(`>${c}<`));
});

test('ocultar un producto lo quita de la tienda y la sincronización lo respeta', async () => {
  const { setProductHidden } = await import('../src/services/catalog.js');
  const id = (await one("SELECT product_id FROM tiendas.store_products WHERE store_slug = 'kiro' LIMIT 1")).product_id;
  await setProductHidden(id, true);
  assert.equal((await get(`/s/kiro/p/${id}`)).status, 404);
  await runSync();
  assert.equal((await get(`/s/kiro/p/${id}`)).status, 404);
  await setProductHidden(id, false);
  assert.equal((await get(`/s/kiro/p/${id}`)).status, 200);
});

test('Alas Negras separa la colección en dama y caballero', async () => {
  const counts = await q(`SELECT p.audience, COUNT(*)::int n FROM tiendas.store_products sp JOIN tiendas.products p ON p.id = sp.product_id
    WHERE sp.store_slug = 'alasnegras' GROUP BY p.audience`);
  assert.deepEqual(counts.map((r) => r.audience).sort(), ['caballero', 'dama']);
  assert.ok(counts.every((r) => r.n >= 20));

  const dama = await (await get('/s/alasnegras/para/dama')).text();
  assert.match(dama, /para dama/);
  assert.doesNotMatch(dama, /para caballero/);
  const filtrada = await (await get('/s/alasnegras/c/playeras?para=caballero')).text();
  assert.match(filtrada, /Playera[^<]*para caballero/);
  assert.doesNotMatch(filtrada, /para dama/);
  assert.match(filtrada, /aria-current="page">Caballero</);
  assert.equal((await get('/s/alasnegras/para/ninos')).status, 404);
  // Otras tiendas no tienen públicos ni categorías ajenas.
  assert.equal((await get('/s/voltia/para/dama')).status, 404);
  assert.equal((await get('/s/voltia/c/playeras')).status, 404);
});

test('la sincronización por partes termina y no repite productos entre tiendas', async () => {
  const { startSync, syncStep } = await import('../src/services/catalog.js');
  await startSync('mock');
  let state, steps = 0;
  do { state = await syncStep({ budgetMs: 1 }); steps += 1; } while (!state.finished_at && steps < 500);
  assert.ok(state.finished_at, 'terminó');
  assert.ok(steps > 10, 'avanzó en varios pasos');
  assert.equal(state.cursor, state.total);
  assert.ok(state.imported > 400);
  const dupes = await q('SELECT product_id FROM tiendas.store_products GROUP BY product_id HAVING COUNT(DISTINCT store_slug) > 1');
  assert.deepEqual(dupes, []);
  assert.equal((await get('/s/voltia/')).status, 200);
});

test('la tarea programada exige el secreto', async () => {
  assert.equal((await get('/api/cron')).status, 401);
  assert.equal((await get('/api/cron', { headers: { authorization: 'Bearer otro' } })).status, 401);
});
