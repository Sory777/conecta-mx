import { z } from "zod";

const money = z.coerce.number().min(0).max(1_000_000);

export const productInputSchema = z
  .object({
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "URL inválida (usa minúsculas y guiones)").max(80),
    sku: z.string().trim().min(1, "SKU requerido").max(40),
    name: z.string().trim().min(2, "Nombre requerido").max(120),
    description: z.string().trim().max(4000).default(""),
    price: money,
    compareAtPrice: money.nullable(),
    categoryId: z.string().min(1, "Elige una categoría"),
    gender: z.enum(["nina", "nino", "unisex"]),
    sizes: z.array(z.string().trim().min(1).max(20)).min(1, "Agrega al menos una talla").max(30),
    colors: z
      .array(z.object({ name: z.string().trim().min(1).max(40), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) }))
      .min(1, "Agrega al menos un color")
      .max(20),
    stock: z.record(z.string(), z.coerce.number().int().min(0).max(100_000)),
    images: z.array(z.object({ url: z.string().min(1).max(500), alt: z.string().max(200).default("") })).max(20),
    status: z.enum(["active", "draft", "archived"]),
    isNew: z.boolean(),
    featured: z.boolean(),
    seoTitle: z.string().trim().max(70).nullable(),
    seoDescription: z.string().trim().max(170).nullable(),
  })
  .refine((p) => p.compareAtPrice === null || p.compareAtPrice > p.price, {
    message: "El precio anterior debe ser mayor que el precio actual (o déjalo vacío).",
    path: ["compareAtPrice"],
  })
  .refine((p) => new Set(p.colors.map((c) => c.name)).size === p.colors.length, {
    message: "Hay colores repetidos.",
    path: ["colors"],
  });

export const productPatchSchema = z.object({ status: z.enum(["active", "draft", "archived"]) });

export const categoryInputSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "URL inválida").max(60),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).default(""),
  image: z.string().max(500).nullable(),
  kind: z.enum(["garment", "gender", "new", "sale"]),
  gender: z.enum(["nina", "nino", "unisex"]).nullable(),
  sortOrder: z.coerce.number().int().min(0).max(999),
  visible: z.boolean(),
});

export const orderStatusSchema = z.object({
  status: z.enum(["pendiente", "pagado", "preparando", "enviado", "entregado", "cancelado"]),
  note: z.string().trim().max(300).optional(),
});

export function firstIssue(error: z.ZodError): string {
  const i = error.issues[0];
  return i ? i.message : "Datos inválidos";
}
