import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-guard";
import { storeProductImage } from "@/lib/storage";

export const runtime = "nodejs";

/** Sube una o varias fotos (campo "files"). Devuelve las URLs optimizadas. */
export async function POST(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "No se recibió ninguna imagen." }, { status: 400 });
  if (files.length > 12) return NextResponse.json({ error: "Máximo 12 imágenes por carga." }, { status: 400 });
  const urls: string[] = [];
  try {
    for (const file of files) urls.push(await storeProductImage(file));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message, urls }, { status: 400 });
  }
  return NextResponse.json({ urls });
}
