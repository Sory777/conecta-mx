/** "01. Artista - Título (Extended Mix).mp3" → { artist, title } */
export function parseFileName(fileName: string): { artist: string; title: string } {
  let base = fileName.replace(/\.[a-z0-9]{2,5}$/i, '');
  base = base.replace(/_/g, ' ').replace(/^\s*\d{1,3}\s*[.\-)]\s*/, '').trim();
  const m = base.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (m) return { artist: m[1].trim(), title: m[2].trim() };
  return { artist: '', title: base || fileName };
}
