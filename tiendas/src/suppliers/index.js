// Interfaz común de proveedores. Para agregar otro (AliExpress DS, Spocket, etc.)
// crea un módulo con { name, label, fetchCatalog, createOrder, getOrderStatus }
// y regístralo aquí.
import { env } from '../config/env.js';
import { mockSupplier } from './mock.js';
import { cjSupplier } from './cj.js';

const SUPPLIERS = { mock: mockSupplier, cj: cjSupplier };

export function getSupplier(name = env.supplier) {
  const s = SUPPLIERS[name];
  if (!s) throw new Error(`Proveedor desconocido: ${name}`);
  return s;
}
