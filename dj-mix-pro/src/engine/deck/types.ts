export interface TrackInfo {
  title: string;
  artist: string;
  fileName: string;
  /** Segundos; se completa al decodificar. */
  duration: number;
  /** Se calcularán en la FASE 2 (análisis). null = aún no analizado. */
  bpm: number | null;
  key: string | null;
  /** Object URL de la portada si el archivo la trae (ID3 APIC). */
  artworkUrl: string | null;
}
