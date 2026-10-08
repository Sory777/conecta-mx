import { NextResponse } from "next/server";
import { repo } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Catálogo público (productos activos + categorías visibles) para búsqueda instantánea. */
export async function GET() {
  const [products, categories] = await Promise.all([repo().listProducts(), repo().listCategories()]);
  return NextResponse.json(
    { products, categories },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } },
  );
}
