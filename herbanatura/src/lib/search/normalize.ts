/** Lowercase, strip diacritics and punctuation, collapse whitespace. Mirrors SQL `hn_normalize()`. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[×]/g, 'x')
    .replace(/[^a-z0-9α-ωδ+\-\s']/g, ' ')
    .replace(/['’]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Function words ignored when recognizing entities in a query (es + en). */
export const STOPWORDS = new Set([
  'a', 'al', 'and', 'con', 'contra', 'de', 'del', 'el', 'en', 'for', 'in', 'la', 'las', 'los', 'o', 'of', 'on', 'or',
  'para', 'por', 'que', 'se', 'sobre', 'the', 'to', 'un', 'una', 'y', 'with', 'vs', 'versus', 'entre', 'mi', 'my',
  'como', 'how', 'what', 'cual', 'cuales', 'es', 'is', 'son', 'are', 'dice', 'sabe', 'sabemos', 'know',
  'plantas', 'planta', 'plants', 'plant', 'hongos', 'hongo', 'mushrooms', 'alimentos', 'alimento', 'foods', 'food',
  'compuestos', 'compuesto', 'compounds', 'naturales', 'natural', 'estudiados', 'estudiadas', 'investigadas',
  'investigados', 'investigacion', 'research', 'studied', 'relacionados', 'related', 'pueden', 'puede', 'can',
  'interactuar', 'interact', 'tiene', 'tienen', 'has', 'have',
]);

/** Levenshtein distance with early exit when it exceeds `max`. */
export function boundedLevenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
