import type {
  Category,
  CategoryInput,
  NewOrder,
  Order,
  OrderStatus,
  Product,
  ProductInput,
} from "../types";

export interface StockRequest {
  productId: string;
  size: string;
  color: string;
  quantity: number;
}

/**
 * Contrato único de acceso a datos. Cualquier backend (archivo local,
 * Supabase u otro) debe implementarlo; el resto de la app solo usa esto.
 */
export interface StoreRepository {
  // Productos
  listProducts(opts?: { includeInactive?: boolean }): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | null>;
  getProductById(id: string): Promise<Product | null>;
  createProduct(input: ProductInput): Promise<Product>;
  updateProduct(id: string, input: Partial<ProductInput>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;

  // Categorías
  listCategories(opts?: { includeHidden?: boolean }): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | null>;
  createCategory(input: CategoryInput): Promise<Category>;
  updateCategory(id: string, input: Partial<CategoryInput>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  // Pedidos
  /**
   * Crea el pedido y descuenta inventario de forma atómica. Lanza
   * `OutOfStockError` si alguna variante no alcanza.
   */
  createOrder(order: NewOrder, stock: StockRequest[]): Promise<Order>;
  listOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  getOrderByNumber(number: string): Promise<Order | null>;
  updateOrderStatus(id: string, status: OrderStatus, note?: string): Promise<Order>;
  setPaymentReference(id: string, reference: string): Promise<Order>;
}

export class OutOfStockError extends Error {
  constructor(public readonly item: StockRequest) {
    super(`Sin existencias suficientes para ${item.productId} (${item.size} / ${item.color})`);
    this.name = "OutOfStockError";
  }
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} no encontrado`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export function formatOrderNumber(seq: number): string {
  return `NK-${String(seq).padStart(6, "0")}`;
}
