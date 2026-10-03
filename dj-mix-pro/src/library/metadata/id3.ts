/**
 * Lector mínimo de ID3v2.3 / v2.4 (MP3): título, artista, BPM, tonalidad y portada.
 * Sólo lee la cabecera del archivo; no decodifica audio.
 */
export interface Id3Tags {
  title?: string;
  artist?: string;
  bpm?: number;
  key?: string;
  picture?: { mime: string; data: Uint8Array };
}

function syncsafe(b: Uint8Array, o: number): number {
  return ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
}

function decodeText(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const enc = bytes[0];
  const body = bytes.subarray(1);
  let label = 'latin1';
  if (enc === 1) label = 'utf-16';
  else if (enc === 2) label = 'utf-16be';
  else if (enc === 3) label = 'utf-8';
  return new TextDecoder(label).decode(body).replace(/\0+$/g, '').split('\0')[0].trim();
}

function parseApic(f: Uint8Array): Id3Tags['picture'] | undefined {
  const enc = f[0];
  let i = 1;
  while (i < f.length && f[i] !== 0) i++;
  const mime = new TextDecoder('latin1').decode(f.subarray(1, i)) || 'image/jpeg';
  i++; // fin del mime
  i++; // tipo de imagen
  // descripción terminada en 0 (o 00 en UTF-16)
  if (enc === 1 || enc === 2) {
    while (i + 1 < f.length && !(f[i] === 0 && f[i + 1] === 0)) i += 2;
    i += 2;
  } else {
    while (i < f.length && f[i] !== 0) i++;
    i++;
  }
  if (i >= f.length) return undefined;
  return { mime: mime.includes('/') ? mime : `image/${mime.toLowerCase()}`, data: f.slice(i) };
}

export function parseId3(buf: Uint8Array): Id3Tags | null {
  if (buf.length < 10 || buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return null; // "ID3"
  const version = buf[3];
  if (version !== 3 && version !== 4) return null;
  const flags = buf[5];
  const size = syncsafe(buf, 6);
  const end = Math.min(buf.length, 10 + size);
  let o = 10;
  if (flags & 0x40) {
    // cabecera extendida
    const ext = version === 4 ? syncsafe(buf, o) : new DataView(buf.buffer, buf.byteOffset).getUint32(o) + 4;
    o += ext;
  }
  const tags: Id3Tags = {};
  while (o + 10 <= end) {
    const id = String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]);
    if (!/^[A-Z0-9]{4}$/.test(id)) break; // padding
    const fsize =
      version === 4 ? syncsafe(buf, o + 4) : new DataView(buf.buffer, buf.byteOffset).getUint32(o + 4);
    const data = buf.subarray(o + 10, Math.min(end, o + 10 + fsize));
    switch (id) {
      case 'TIT2': tags.title = decodeText(data); break;
      case 'TPE1': tags.artist = decodeText(data); break;
      case 'TBPM': {
        const n = parseFloat(decodeText(data));
        if (Number.isFinite(n) && n > 0) tags.bpm = n;
        break;
      }
      case 'TKEY': tags.key = decodeText(data) || undefined; break;
      case 'APIC': if (!tags.picture) tags.picture = parseApic(data); break;
    }
    o += 10 + fsize;
  }
  return tags;
}

/** Lee sólo la etiqueta ID3 (no todo el archivo). */
export async function readId3(file: File): Promise<Id3Tags | null> {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (head.length < 10 || head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return null;
  const size = syncsafe(head, 6) + 10;
  const all = new Uint8Array(await file.slice(0, Math.min(size, 8 * 1024 * 1024)).arrayBuffer());
  try {
    return parseId3(all);
  } catch {
    return null;
  }
}
