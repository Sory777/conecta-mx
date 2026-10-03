import type { TrackInfo } from '../../engine/deck/types';
import { parseFileName } from './filename';
import { readId3 } from './id3';

/** Metadatos rápidos de un archivo (antes de decodificar el audio). */
export async function readTrackInfo(file: File): Promise<TrackInfo> {
  const fromName = parseFileName(file.name);
  const tags = await readId3(file).catch(() => null);
  const artworkUrl = tags?.picture
    ? URL.createObjectURL(new Blob([tags.picture.data as BlobPart], { type: tags.picture.mime }))
    : null;
  return {
    title: tags?.title || fromName.title,
    artist: tags?.artist || fromName.artist || 'Artista desconocido',
    fileName: file.name,
    duration: 0,
    // El BPM/Key de las etiquetas se muestran como referencia; la FASE 2
    // los reemplazará por el análisis propio.
    bpm: tags?.bpm ?? null,
    key: tags?.key ?? null,
    artworkUrl,
  };
}
