import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { defaultCategories } from "../default-categories";
import { stockKey } from "../product";
import type { Category, CategoryInput, NewOrder, Order, OrderStatus, Product } from "../types";
import {
  ConflictError,
  NotFoundError,
  OutOfStockError,
  formatOrderNumber,
  type StockRequest,
  type StoreRepository,
} from "./repository";

/**
 * Proveedor de datos en archivo JSON (`.data/store.json`).
 * Ideal para desarrollo o un servidor con disco persistente.
 * En plataformas serverless (Vercel) usa DATA_PROVIDER=supabase.
 */

interface StoreFile {
  version: 1;
  products: Product[];
  categories: Category[];
  orders: Order[];
  orderSeq: number;
}

// En Vercel el disco es de solo lectura salvo /tmp (temporal): sirve como modo demostración.
// Para datos permanentes en Vercel usa DATA_PROVIDER=supabase.
export const DATA_DIR = process.env.VERCEL ? "/tmp/nova-kids-data" : path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "store.json");

// Estado en globalThis: Next puede instanciar este módulo varias veces en el mismo proceso.
const g = globalThis as unknown as {
  __novaStore?: { cache: StoreFile | null; loading: Promise<StoreFile> | null; queue: Promise<unknown> };
};
const state = (g.__novaStore ??= { cache: null, loading: null, queue: Promise.resolve() });

async function seed(): Promise<StoreFile> {
  const now = new Date().toISOString();
  const categories: Category[] = defaultCategories.map((c) => ({ ...c, id: c.slug }));
  let products: Product[] = [];
  if (process.env.SEED_DEMO_DATA !== "false") {
    const { demoProducts } = await import("@/demo/demo-products");
    products = demoProducts(categories, now);
  }
  return { version: 1, products, categories, orders: [], orderSeq: 1000 };
}

async function load(): Promise<StoreFile> {
  if (state.cache) return state.cache;
  // Una sola carga en vuelo aunque lleguen varias lecturas en paralelo.
  state.loading ??= (async () => {
    let data: StoreFile;
    try {
      data = JSON.parse(await fs.readFile(FILE, "utf8")) as StoreFile;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      data = await seed();
      await persist(data);
    }
    state.cache = data;
    return data;
  })().finally(() => {
    state.loading = null;
  });
  return state.loading;
}

async function persist(data: StoreFile) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, FILE);
}

/** Serializa lecturas-escrituras para evitar condiciones de carrera en el archivo. */
function mutate<T>(fn: (data: StoreFile) => T | Promise<T>): Promise<T> {
  const run = state.queue.then(async () => {
    const data = await load();
    const result = await fn(data);
    await persist(data);
    return result;
  });
  state.queue = run.catch(() => undefined);
  return run;
}

async function read(): Promise<StoreFile> {
  await state.queue;
  return load();
}

const clone = <T>(v: T): T => structuredClone(v);

function ensureUniqueSlug(data: StoreFile, slug: string, exceptId?: string) {
  if (data.products.some((p) => p.slug === slug && p.id !== exceptId)) {
    throw new ConflictError(`Ya existe un producto con la URL "${slug}".`);
  }
}

function adjustStock(data: StoreFile, items: StockRequest[], direction: 1 | -1) {
  for (const item of items) {
    const product = data.products.find((p) => p.id === item.productId);
    if (!product) continue;
    const key = stockKey(item.size, item.color);
    product.stock[key] = (product.stock[key] ?? 0) + direction * item.quantity;
    product.soldCount = Math.max(0, product.soldCount - direction * item.quantity);
  }
}

export const localRepository: StoreRepository = {
  async listProducts(opts) {
    const data = await read();
    return clone(opts?.includeInactive ? data.products : data.products.filter((p) => p.status === "active"));
  },
  async getProductBySlug(slug) {
    const data = await read();
    return clone(data.products.find((p) => p.slug === slug) ?? null);
  },
  async getProductById(id) {
    const data = await read();
    return clone(data.products.find((p) => p.id === id) ?? null);
  },
  createProduct(input) {
    return mutate((data) => {
      ensureUniqueSlug(data, input.slug);
      const now = new Date().toISOString();
      const product: Product = { soldCount: 0, ...input, id: randomUUID(), createdAt: now, updatedAt: now };
      data.products.push(product);
      return clone(product);
    });
  },
  updateProduct(id, input) {
    return mutate((data) => {
      const product = data.products.find((p) => p.id === id);
      if (!product) throw new NotFoundError("Producto");
      if (input.slug) ensureUniqueSlug(data, input.slug, id);
      Object.assign(product, input, { updatedAt: new Date().toISOString() });
      return clone(product);
    });
  },
  deleteProduct(id) {
    return mutate((data) => {
      data.products = data.products.filter((p) => p.id !== id);
    });
  },

  async listCategories(opts) {
    const data = await read();
    const list = opts?.includeHidden ? data.categories : data.categories.filter((c) => c.visible);
    return clone([...list].sort((a, b) => a.sortOrder - b.sortOrder));
  },
  async getCategoryBySlug(slug) {
    const data = await read();
    return clone(data.categories.find((c) => c.slug === slug) ?? null);
  },
  createCategory(input: CategoryInput) {
    return mutate((data) => {
      if (data.categories.some((c) => c.slug === input.slug)) throw new ConflictError("Ya existe esa categoría.");
      const category: Category = { ...input, id: randomUUID() };
      data.categories.push(category);
      return clone(category);
    });
  },
  updateCategory(id, input) {
    return mutate((data) => {
      const category = data.categories.find((c) => c.id === id);
      if (!category) throw new NotFoundError("Categoría");
      if (input.slug && data.categories.some((c) => c.slug === input.slug && c.id !== id)) {
        throw new ConflictError("Ya existe esa categoría.");
      }
      Object.assign(category, input);
      return clone(category);
    });
  },
  deleteCategory(id) {
    return mutate((data) => {
      if (data.products.some((p) => p.categoryId === id)) {
        throw new ConflictError("No se puede eliminar: hay productos en esta categoría.");
      }
      data.categories = data.categories.filter((c) => c.id !== id);
    });
  },

  createOrder(input: NewOrder, stock: StockRequest[]) {
    return mutate((data) => {
      for (const item of stock) {
        const product = data.products.find((p) => p.id === item.productId);
        const available = product?.stock[stockKey(item.size, item.color)] ?? 0;
        if (!product || available < item.quantity) throw new OutOfStockError(item);
      }
      adjustStock(data, stock, -1);
      data.orderSeq += 1;
      const now = new Date().toISOString();
      const order: Order = {
        ...input,
        id: randomUUID(),
        number: formatOrderNumber(data.orderSeq),
        status: "pendiente",
        history: [{ status: "pendiente", at: now }],
        createdAt: now,
        updatedAt: now,
      };
      data.orders.push(order);
      return clone(order);
    });
  },
  async listOrders() {
    const data = await read();
    return clone([...data.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },
  async getOrder(id) {
    const data = await read();
    return clone(data.orders.find((o) => o.id === id) ?? null);
  },
  async getOrderByNumber(number) {
    const data = await read();
    return clone(data.orders.find((o) => o.number === number.toUpperCase()) ?? null);
  },
  updateOrderStatus(id, status: OrderStatus, note) {
    return mutate((data) => {
      const order = data.orders.find((o) => o.id === id);
      if (!order) throw new NotFoundError("Pedido");
      if (order.status === status) return clone(order);
      const stock = order.items.map((i) => ({ productId: i.productId, size: i.size, color: i.color, quantity: i.quantity }));
      // Cancelar devuelve las piezas al inventario; reactivar las vuelve a apartar.
      if (status === "cancelado") adjustStock(data, stock, 1);
      else if (order.status === "cancelado") adjustStock(data, stock, -1);
      const now = new Date().toISOString();
      order.status = status;
      order.history.push({ status, at: now, ...(note ? { note } : {}) });
      order.updatedAt = now;
      return clone(order);
    });
  },
  setPaymentReference(id, reference) {
    return mutate((data) => {
      const order = data.orders.find((o) => o.id === id);
      if (!order) throw new NotFoundError("Pedido");
      order.paymentReference = reference;
      order.updatedAt = new Date().toISOString();
      return clone(order);
    });
  },
};
