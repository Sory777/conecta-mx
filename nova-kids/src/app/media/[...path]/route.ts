import { promises as fs } from "fs";
import path from "path";
import { UPLOAD_DIR } from "@/lib/storage";

export const runtime = "nodejs";

/** Sirve las fotos subidas en modo local (.data/uploads). En Supabase se usan URLs públicas del bucket. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const file = path.resolve(UPLOAD_DIR, ...parts);
  if (!file.startsWith(path.resolve(UPLOAD_DIR) + path.sep) || !file.endsWith(".webp")) {
    return new Response("No encontrado", { status: 404 });
  }
  try {
    const data = await fs.readFile(file);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
