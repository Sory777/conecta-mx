import { supabase } from './supabase';

const MAX_BYTES = 4_000_000; // 4MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.78;

// Phone cameras routinely produce 2-4MB photos. With thousands of free
// businesses each uploading several, serving those originals to every
// visitor is what makes the app feel slow at scale. Downscale and
// re-encode as JPEG in the browser before upload so what actually goes
// to storage (and gets downloaded by every visitor) is typically
// 100-300KB instead. GIFs are left untouched to preserve animation.
async function compressImage(file: File): Promise<File> {
  if (file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export async function uploadImage(file: File, folder = 'businesses'): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Formato no soportado. Usa JPG, PNG, WebP o GIF.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('La imagen pesa más de 4MB. Reduce el tamaño.');
  }
  const compressed = await compressImage(file);
  const ext = compressed.type === 'image/jpeg' ? 'jpg' : (file.name.split('.').pop()?.toLowerCase() || 'jpg');
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  // Each upload gets a unique random filename and is never overwritten in
  // practice, so it's safe to let browsers/CDN cache it for a long time.
  const { error } = await supabase.storage.from('images').upload(path, compressed, { cacheControl: '31536000', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('images').getPublicUrl(path);
  return data.publicUrl;
}

const MAX_VIDEO_BYTES = 100_000_000; // 100MB
const ALLOWED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime'];

export async function uploadVideo(file: File, folder = 'ads'): Promise<string> {
  if (!ALLOWED_VIDEO.includes(file.type)) {
    throw new Error('Formato no soportado. Usa MP4, WebM o MOV.');
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('El video pesa más de 100MB. Reduce el tamaño o la duración.');
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('videos').upload(path, file, { cacheControl: '3600', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('videos').getPublicUrl(path);
  return data.publicUrl;
}
