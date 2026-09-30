// Sanitización de textos generados por usuarios (chat, reportes, nombres).
// El cliente además renderiza SIEMPRE con textContent (nunca innerHTML).

const CONTROL = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g;

export function cleanText(input: string, maxLen: number): string {
  return input.normalize('NFC').replace(CONTROL, '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

// Lista mínima de ejemplo. En producción: servicio de moderación / lista configurable por admin.
const BLOCKED_WORDS = ['idiota', 'imbecil', 'imbécil', 'pendejo', 'estupido', 'estúpido', 'puta', 'mierda'];

export function filterProfanity(text: string): string {
  let out = text;
  for (const w of BLOCKED_WORDS) {
    const re = new RegExp(`\\b${w}\\b`, 'gi');
    out = out.replace(re, (m) => m[0] + '*'.repeat(Math.max(1, m.length - 1)));
  }
  return out;
}

export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
export const CHARACTER_NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ ._-]{2,19}$/;
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
