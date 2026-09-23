import { supabase } from './supabase';

const MAX_BYTES = 4_000_000; // 4MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function uploadImage(file: File, folder = 'businesses'): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error('Formato no soportado. Usa JPG, PNG, WebP o GIF.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('La imagen pesa más de 4MB. Reduce el tamaño.');
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('images').upload(path, file, { cacheControl: '3600', upsert: true });
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
