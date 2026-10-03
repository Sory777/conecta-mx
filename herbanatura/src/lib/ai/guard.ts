import type { RagDocument } from './context';

/**
 * Post-generation guard against invented references. Removes citation markers
 * that do not exist in the retrieved set, and any DOI/PMID/NCT/URL not present
 * in the retrieved sources.
 */
export function guardAnswer(text: string, docs: RagDocument[]): { text: string; cited: string[]; removed: number } {
  const keys = new Set(docs.map((d) => d.key));
  const allowedUrls = new Set(docs.flatMap((d) => d.sources.map((s) => s.url)));
  const allowedIds = new Set(docs.flatMap((d) => d.sources.flatMap((s) => [s.doi, s.pmid].filter(Boolean) as string[])));
  let removed = 0;
  let out = text.replace(/\[(D\d{1,3})\]/g, (m, k) => {
    if (keys.has(k)) return m;
    removed++;
    return '';
  });
  out = out.replace(/https?:\/\/[^\s)\]]+/g, (u) => {
    if (allowedUrls.has(u)) return u;
    removed++;
    return '[enlace eliminado]';
  });
  out = out.replace(/\b(?:doi:\s*)?10\.\d{4,9}\/[^\s)\]]+/gi, (d) => {
    if (allowedIds.has(d.replace(/^doi:\s*/i, ''))) return d;
    removed++;
    return '[DOI no verificado eliminado]';
  });
  out = out.replace(/\bPMID:?\s*(\d{1,9})\b/gi, (m, id) => {
    if (allowedIds.has(id)) return m;
    removed++;
    return '[PMID no verificado eliminado]';
  });
  out = out.replace(/\bNCT\d{8}\b/g, () => {
    removed++;
    return '[registro no verificado eliminado]';
  });
  const cited = [...new Set([...out.matchAll(/\[(D\d{1,3})\]/g)].map((m) => m[1]))].filter((k) => keys.has(k));
  return { text: out.replace(/[ \t]{2,}/g, ' ').trim(), cited, removed };
}
