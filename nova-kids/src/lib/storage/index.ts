import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { dataProvider } from "../data";
import { DATA_DIR } from "../data/local";
import { supabaseAdmin } from "../data/supabase";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

/**
 * Optimiza la foto (máx. 1600 px, WebP) y la guarda en el almacenamiento activo.
 * Devuelve la URL pública.
 */
export async function storeProductImage(file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) throw new Error("Formato no permitido. Usa JPG, PNG, WebP o AVIF.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("La imagen supera 8 MB.");

  const input = Buffer.from(await file.arrayBuffer());
  const optimized = await sharp(input)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const name = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}.webp`;

  if (dataProvider() === "supabase") {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "product-images";
    const { error } = await supabaseAdmin()
      .storage.from(bucket)
      .upload(name, optimized, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (error) throw new Error(error.message);
    return supabaseAdmin().storage.from(bucket).getPublicUrl(name).data.publicUrl;
  }

  const target = path.join(UPLOAD_DIR, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, optimized);
  return `/media/${name}`;
}
