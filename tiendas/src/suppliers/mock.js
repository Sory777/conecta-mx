// Proveedor de demostración: simula un mayorista chino (estilo CJ/AliExpress)
// para poder probar todo el flujo sin credenciales. Los pedidos "avanzan" solos:
// procesando -> enviado (con guía) -> entregado.

import crypto from 'node:crypto';

// Rango de costo (USD) y envío por categoría, para generar precios realistas.
const COST = { gadgets: [4, 22, 2.4], ropa: [4, 14, 2.2], accesorios: [2, 12, 1.6] };
const VARIANTS = ['Negro', 'Blanco', 'Arena', 'Azul marino', 'Rosa', 'Verde olivo', 'Gris', 'Lavanda'];
const h = (s) => crypto.createHash('sha1').update(s).digest().readUInt32BE(0);

const orders = new Map();

export const mockSupplier = {
  name: 'mock',
  label: 'Proveedor demo (simulado)',

  // Genera, por cada búsqueda del nicho de cada tienda, los N productos "más vendidos".
  async fetchCatalog({ searches, perSearch = 3 } = {}) {
    const out = [];
    for (const s of searches) {
      for (let i = 0; i < perSearch; i++) {
        const key = `${s.store}:${s.query}:${i}`;
        const [min, max, ship] = COST[s.category] || COST.accesorios;
        const variant = VARIANTS[(h(s.store + s.query) + i * 3) % VARIANTS.length];
        out.push({
          store: s.store,
          searchTerm: s.query,
          popularity: 4000 - i * 900 + (h(key) % 500),
          supplierProductId: `MOCK-${s.store}-${h(s.query) % 100000}-${i}`,
          supplierVariantId: `MOCK-V-${s.store}-${h(s.query) % 100000}-${i}`,
          title: `${s.label} · ${variant}`,
          description: `${s.label} en color ${variant.toLowerCase()}. Uno de los más vendidos de su categoría; se envía directo desde el almacén del proveedor.`,
          category: s.category,
          imageUrl: null,
          icon: s.icon,
          costUsd: Math.round((min + (h(key + 'c') % 1000) / 1000 * (max - min)) * 100) / 100,
          shippingUsd: ship,
        });
      }
    }
    return out;
  },

  async createOrder(order) {
    if (!order.items.length) throw new Error('Pedido sin artículos');
    const id = `MOCK-SO-${order.number}`;
    orders.set(id, { createdAt: Date.now() });
    return { supplierOrderId: id };
  },

  async getOrderStatus(supplierOrderId) {
    const o = orders.get(supplierOrderId);
    // Tras un reinicio no hay memoria: tratamos el pedido como ya enviado.
    const age = o ? Date.now() - o.createdAt : Infinity;
    if (age < 60_000) return { status: 'processing' };
    const trackingNumber = 'LP' + supplierOrderId.replace(/\D/g, '').padStart(9, '0') + 'CN';
    if (age < 5 * 60_000) return { status: 'shipped', trackingNumber };
    return { status: 'delivered', trackingNumber };
  },
};
