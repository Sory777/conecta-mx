import { NextResponse } from "next/server";
import { z } from "zod";
import { repo } from "@/lib/data";
import { mainImage } from "@/lib/product";

const schema = z.object({ productIds: z.array(z.string().max(64)).max(100) });

/** Devuelve el estado actual (precio, inventario, variantes) de los productos del carrito. */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const products = await repo().listProducts();
  const wanted = new Set(parsed.data.productIds);
  const result = products
    .filter((p) => wanted.has(p.id))
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      image: mainImage(p),
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      sizes: p.sizes,
      colors: p.colors,
      stock: p.stock,
    }));
  return NextResponse.json({ products: result });
}
