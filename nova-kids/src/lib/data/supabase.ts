import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Category, CategoryInput, Order, Product, ProductInput } from "../types";
import {
  ConflictError,
  NotFoundError,
  OutOfStockError,
  type StockRequest,
  type StoreRepository,
} from "./repository";

/**
 * Proveedor Supabase. Se usa desde el servidor con la service role key;
 * el esquema está en supabase/migrations/0001_nova_kids_schema.sql.
 */

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para DATA_PROVIDER=supabase.");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

type Row = Record<string, unknown>;

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function toProduct(r: Row): Product {
  return {
    id: r.id as string,
    slug: r.slug as string,
    sku: r.sku as string,
    name: r.name as string,
    description: r.description as string,
    price: Number(r.price),
    compareAtPrice: num(r.compare_at_price),
    categoryId: r.category_id as string,
    gender: r.gender as Product["gender"],
    sizes: (r.sizes as string[]) ?? [],
    colors: (r.colors as Product["colors"]) ?? [],
    stock: (r.stock as Product["stock"]) ?? {},
    images: (r.images as Product["images"]) ?? [],
    status: r.status as Product["status"],
    isNew: Boolean(r.is_new),
    featured: Boolean(r.featured),
    soldCount: Number(r.sold_count ?? 0),
    seoTitle: (r.seo_title as string) ?? null,
    seoDescription: (r.seo_description as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function fromProduct(p: Partial<ProductInput>): Row {
  const map: Record<string, string> = {
    slug: "slug", sku: "sku", name: "name", description: "description", price: "price",
    compareAtPrice: "compare_at_price", categoryId: "category_id", gender: "gender", sizes: "sizes",
    colors: "colors", stock: "stock", images: "images", status: "status", isNew: "is_new",
    featured: "featured", soldCount: "sold_count", seoTitle: "seo_title", seoDescription: "seo_description",
  };
  const row: Row = {};
  for (const [key, value] of Object.entries(p)) {
    if (map[key] && value !== undefined) row[map[key]] = value;
  }
  return row;
}

function toCategory(r: Row): Category {
  return {
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    description: (r.description as string) ?? "",
    image: (r.image as string) ?? null,
    kind: r.kind as Category["kind"],
    gender: (r.gender as Category["gender"]) ?? null,
    sortOrder: Number(r.sort_order ?? 0),
    visible: Boolean(r.visible),
  };
}

function fromCategory(c: Partial<CategoryInput>): Row {
  const row: Row = {};
  if (c.slug !== undefined) row.slug = c.slug;
  if (c.name !== undefined) row.name = c.name;
  if (c.description !== undefined) row.description = c.description;
  if (c.image !== undefined) row.image = c.image;
  if (c.kind !== undefined) row.kind = c.kind;
  if (c.gender !== undefined) row.gender = c.gender;
  if (c.sortOrder !== undefined) row.sort_order = c.sortOrder;
  if (c.visible !== undefined) row.visible = c.visible;
  return row;
}

function toOrder(r: Row): Order {
  return {
    id: r.id as string,
    number: r.number as string,
    customer: r.customer as Order["customer"],
    address: r.address as Order["address"],
    items: r.items as Order["items"],
    shippingMethodId: r.shipping_method_id as string,
    shippingLabel: r.shipping_label as string,
    paymentMethod: r.payment_method as Order["paymentMethod"],
    paymentReference: (r.payment_reference as string) ?? null,
    couponCode: (r.coupon_code as string) ?? null,
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    shipping: Number(r.shipping),
    total: Number(r.total),
    status: r.status as Order["status"],
    history: (r.history as Order["history"]) ?? [],
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function check<T>(res: { data: T | null; error: { code?: string; message: string } | null }, what = "Registro"): T {
  if (res.error) {
    if (res.error.code === "23505") throw new ConflictError("Ya existe un registro con ese identificador (URL o slug).");
    if (res.error.code === "23503") throw new ConflictError("No se puede eliminar: hay registros relacionados.");
    if (res.error.code === "PGRST116") throw new NotFoundError(what);
    throw new Error(res.error.message);
  }
  return res.data as T;
}

export const supabaseRepository: StoreRepository = {
  async listProducts(opts) {
    let q = supabaseAdmin().from("products").select("*").order("created_at", { ascending: false });
    if (!opts?.includeInactive) q = q.eq("status", "active");
    return check(await q).map(toProduct);
  },
  async getProductBySlug(slug) {
    const data = check(await supabaseAdmin().from("products").select("*").eq("slug", slug).maybeSingle());
    return data ? toProduct(data) : null;
  },
  async getProductById(id) {
    const data = check(await supabaseAdmin().from("products").select("*").eq("id", id).maybeSingle());
    return data ? toProduct(data) : null;
  },
  async createProduct(input) {
    return toProduct(check(await supabaseAdmin().from("products").insert(fromProduct(input)).select().single()));
  },
  async updateProduct(id, input) {
    const row = { ...fromProduct(input), updated_at: new Date().toISOString() };
    return toProduct(check(await supabaseAdmin().from("products").update(row).eq("id", id).select().single(), "Producto"));
  },
  async deleteProduct(id) {
    check(await supabaseAdmin().from("products").delete().eq("id", id));
  },

  async listCategories(opts) {
    let q = supabaseAdmin().from("categories").select("*").order("sort_order");
    if (!opts?.includeHidden) q = q.eq("visible", true);
    return check(await q).map(toCategory);
  },
  async getCategoryBySlug(slug) {
    const data = check(await supabaseAdmin().from("categories").select("*").eq("slug", slug).maybeSingle());
    return data ? toCategory(data) : null;
  },
  async createCategory(input) {
    return toCategory(check(await supabaseAdmin().from("categories").insert(fromCategory(input)).select().single()));
  },
  async updateCategory(id, input) {
    return toCategory(
      check(await supabaseAdmin().from("categories").update(fromCategory(input)).eq("id", id).select().single(), "Categoría"),
    );
  },
  async deleteCategory(id) {
    check(await supabaseAdmin().from("categories").delete().eq("id", id));
  },

  async createOrder(order, stock: StockRequest[]) {
    const res = await supabaseAdmin().rpc("place_order", { p_order: order, p_items: stock });
    if (res.error?.message.startsWith("OUT_OF_STOCK:")) {
      throw new OutOfStockError(JSON.parse(res.error.message.slice("OUT_OF_STOCK:".length)) as StockRequest);
    }
    return toOrder(check(res) as Row);
  },
  async listOrders() {
    return check(await supabaseAdmin().from("orders").select("*").order("created_at", { ascending: false })).map(toOrder);
  },
  async getOrder(id) {
    const data = check(await supabaseAdmin().from("orders").select("*").eq("id", id).maybeSingle());
    return data ? toOrder(data) : null;
  },
  async getOrderByNumber(number) {
    const data = check(await supabaseAdmin().from("orders").select("*").eq("number", number.toUpperCase()).maybeSingle());
    return data ? toOrder(data) : null;
  },
  async updateOrderStatus(id, status, note) {
    const res = await supabaseAdmin().rpc("set_order_status", { p_id: id, p_status: status, p_note: note ?? null });
    if (res.error?.message === "NOT_FOUND") throw new NotFoundError("Pedido");
    return toOrder(check(res) as Row);
  },
  async setPaymentReference(id, reference) {
    const row = { payment_reference: reference, updated_at: new Date().toISOString() };
    return toOrder(check(await supabaseAdmin().from("orders").update(row).eq("id", id).select().single(), "Pedido"));
  },
};
