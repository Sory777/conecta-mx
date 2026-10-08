import { z } from "zod";

const text = (max = 120) => z.string().trim().min(1, "Requerido").max(max);

export const customerSchema = z.object({
  firstName: text(60),
  lastName: text(60),
  phone: z.string().trim().regex(/^\+?[\d\s-]{10,16}$/, "Teléfono inválido"),
  email: z.string().trim().toLowerCase().email("Correo inválido").max(120),
});

export const addressSchema = z.object({
  street: text(120),
  number: text(30),
  neighborhood: text(80),
  city: text(80),
  state: text(60),
  postalCode: z.string().trim().regex(/^\d{5}$/, "Código postal de 5 dígitos"),
  references: z.string().trim().max(300).default(""),
});

export const lineSchema = z.object({
  productId: z.string().min(1).max(64),
  size: z.string().min(1).max(20),
  color: z.string().min(1).max(60),
  quantity: z.number().int().min(1).max(50),
});

export const orderRequestSchema = z.object({
  customer: customerSchema,
  address: addressSchema,
  shippingMethodId: z.string().min(1),
  paymentMethod: z.enum(["mercadopago", "stripe", "paypal", "transferencia"]),
  couponCode: z.string().trim().max(40).optional().nullable(),
  items: z.array(lineSchema).min(1).max(50),
});

export type OrderRequest = z.infer<typeof orderRequestSchema>;
