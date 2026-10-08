// Configuración editable de la tienda. Cambia aquí textos, redes sociales,
// métodos de envío y cupones sin tocar los componentes.

export const store = {
  name: "NOVA KIDS",
  tagline: "Moda infantil que impulsa su imaginación.",
  motto: "SUEÑA · JUEGA · VISTE",
  description:
    "NOVA KIDS es moda infantil con espíritu explorador: prendas cómodas, resistentes y con diseño propio para niñas y niños que sueñan en grande.",
  currency: "MXN",
  locale: "es-MX",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  contact: {
    email: "hola@novakids.mx",
    phone: "",
    /** Número con lada internacional, sin espacios ni signos. Ej: 5213312345678 */
    whatsapp: "",
    address: "México",
    hours: "Lunes a viernes, 10:00 – 18:00",
  },

  /** Deja vacía una red para ocultarla del footer. */
  social: {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    tiktok: "https://tiktok.com/",
    youtube: "https://youtube.com/",
  },

  /** Tallas en el orden en que deben mostrarse en filtros y selectores. */
  sizeOrder: ["2", "4", "6", "8", "10", "12", "14", "16"],

  /** Días que un producto se considera "nuevo" además del interruptor manual. */
  newProductDays: 30,

  /** Existencias por variante a partir de las cuales se muestra "últimas piezas". */
  lowStockThreshold: 3,
} as const;

export interface ShippingMethod {
  id: string;
  label: string;
  description: string;
  price: number;
  /** Si el subtotal llega a este monto, el envío es gratis. null = nunca. */
  freeFrom: number | null;
}

export const shippingMethods: ShippingMethod[] = [
  {
    id: "estandar",
    label: "Envío estándar",
    description: "3 a 6 días hábiles a todo México",
    price: 129,
    freeFrom: 999,
  },
  {
    id: "express",
    label: "Envío express",
    description: "1 a 2 días hábiles en zonas metropolitanas",
    price: 229,
    freeFrom: null,
  },
  {
    id: "recoger",
    label: "Recoger en punto de entrega",
    description: "Te contactamos para coordinar la entrega",
    price: 0,
    freeFrom: null,
  },
];
