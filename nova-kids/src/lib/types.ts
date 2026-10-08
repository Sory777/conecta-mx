// Modelo de dominio de NOVA KIDS. Es independiente del proveedor de datos
// (archivo local o Supabase), así que la UI nunca depende de cómo se guarda.

export type Gender = "nina" | "nino" | "unisex";
export type ProductStatus = "active" | "draft" | "archived";

export interface ProductColor {
  name: string;
  hex: string;
}

export interface ProductImage {
  url: string;
  alt: string;
}

export interface Product {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  /** Precio en pesos MXN (enteros o con centavos). */
  price: number;
  /** Precio anterior; si es mayor que `price` el producto se muestra en oferta. */
  compareAtPrice: number | null;
  categoryId: string;
  gender: Gender;
  sizes: string[];
  colors: ProductColor[];
  /** Existencias por variante. Clave: `${talla}|${color}`. */
  stock: Record<string, number>;
  /** La primera imagen es la principal. */
  images: ProductImage[];
  status: ProductStatus;
  isNew: boolean;
  featured: boolean;
  soldCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProductInput = Omit<Product, "id" | "createdAt" | "updatedAt" | "soldCount"> & {
  soldCount?: number;
};

/**
 * Las categorías pueden ser de tipo de prenda (las asigna cada producto) o
 * colecciones dinámicas: por género, novedades u ofertas.
 */
export type CategoryKind = "garment" | "gender" | "new" | "sale";

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string | null;
  kind: CategoryKind;
  /** Solo para kind = "gender". */
  gender: Gender | null;
  sortOrder: number;
  visible: boolean;
}

export type CategoryInput = Omit<Category, "id">;

export type OrderStatus = "pendiente" | "pagado" | "preparando" | "enviado" | "entregado" | "cancelado";
export type PaymentMethodId = "mercadopago" | "stripe" | "paypal" | "transferencia";

export interface OrderCustomer {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface OrderAddress {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
  references: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  slug: string;
  image: string | null;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderStatusChange {
  status: OrderStatus;
  at: string;
  note?: string;
}

export interface Order {
  id: string;
  number: string;
  customer: OrderCustomer;
  address: OrderAddress;
  items: OrderItem[];
  shippingMethodId: string;
  shippingLabel: string;
  paymentMethod: PaymentMethodId;
  paymentReference: string | null;
  couponCode: string | null;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  history: OrderStatusChange[];
  createdAt: string;
  updatedAt: string;
}

export type NewOrder = Omit<Order, "id" | "number" | "createdAt" | "updatedAt" | "history" | "status">;

export const ORDER_STATUSES: { id: OrderStatus; label: string }[] = [
  { id: "pendiente", label: "Pendiente" },
  { id: "pagado", label: "Pagado" },
  { id: "preparando", label: "Preparando" },
  { id: "enviado", label: "Enviado" },
  { id: "entregado", label: "Entregado" },
  { id: "cancelado", label: "Cancelado" },
];

export const GENDER_LABELS: Record<Gender, string> = {
  nina: "Niña",
  nino: "Niño",
  unisex: "Unisex",
};
