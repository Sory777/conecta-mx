import 'server-only';
import { serverEnv } from '@/lib/env';

/**
 * Minimal NCBI E-utilities client (public API; ≤3 req/s without key, ≤10 with
 * NCBI_API_KEY). Returns metadata only — never full text.
 */
const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export const PUBMED_TYPES = {
  rct: 'randomized controlled trial[pt]',
  clinical_trial: 'clinical trial[pt]',
  meta_analysis: 'meta-analysis[pt]',
  systematic_review: 'systematic review[pt]',
  review: 'review[pt]',
  observational: 'observational study[pt]',
  animal: '(animals[mh] NOT humans[mh])',
  humans: 'humans[mh]',
} as const;
export type PubmedType = keyof typeof PUBMED_TYPES;

export interface PubmedRecord {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  year: number | null;
  doi: string | null;
  publicationTypes: string[];
  url: string;
}

let last = 0;
async function throttle() {
  const gap = serverEnv.ncbiApiKey ? 110 : 350;
  const wait = Math.max(0, last + gap - Date.now());
  last = Date.now() + wait;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

function params(extra: Record<string, string>) {
  const p = new URLSearchParams({ db: 'pubmed', retmode: 'json', tool: 'herbanatura', ...extra });
  if (serverEnv.ncbiEmail) p.set('email', serverEnv.ncbiEmail);
  if (serverEnv.ncbiApiKey) p.set('api_key', serverEnv.ncbiApiKey);
  return p;
}

async function get<T>(path: string, p: URLSearchParams, revalidate: number): Promise<T> {
  await throttle();
  const res = await fetch(`${BASE}/${path}?${p}`, { next: { revalidate }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`pubmed ${path} ${res.status}`);
  return res.json() as Promise<T>;
}

export function buildQuery(term: string, opts: { types?: PubmedType[] } = {}) {
  const t = term.replace(/[^\p{L}\p{N}\s\-\[\]()"':.,/]/gu, ' ').trim();
  const types = (opts.types ?? []).map((x) => PUBMED_TYPES[x]);
  return types.length ? `(${t}) AND (${types.join(' OR ')})` : t;
}

export async function pubmedCount(query: string, from?: number, to?: number): Promise<number> {
  const p = params({ term: query, retmax: '0' });
  if (from || to) {
    p.set('datetype', 'pdat');
    p.set('mindate', String(from ?? 1800));
    p.set('maxdate', String(to ?? new Date().getFullYear()));
  }
  const r = await get<{ esearchresult: { count: string } }>('esearch.fcgi', p, 60 * 60 * 24 * 7);
  return Number(r.esearchresult.count) || 0;
}

export async function pubmedSearch(query: string, opts: { from?: number; to?: number; limit?: number; sort?: 'relevance' | 'pub_date' } = {}) {
  const p = params({ term: query, retmax: String(Math.min(opts.limit ?? 20, 50)), sort: opts.sort ?? 'relevance' });
  if (opts.from || opts.to) {
    p.set('datetype', 'pdat');
    p.set('mindate', String(opts.from ?? 1800));
    p.set('maxdate', String(opts.to ?? new Date().getFullYear()));
  }
  const s = await get<{ esearchresult: { count: string; idlist: string[] } }>('esearch.fcgi', p, 60 * 60 * 24);
  const ids = s.esearchresult.idlist;
  return { count: Number(s.esearchresult.count) || 0, records: ids.length ? await pubmedSummaries(ids) : [] };
}

type Summary = {
  uid: string;
  title: string;
  authors?: { name: string }[];
  pubdate?: string;
  source?: string;
  fulljournalname?: string;
  articleids?: { idtype: string; value: string }[];
  pubtype?: string[];
};

export async function pubmedSummaries(ids: string[]): Promise<PubmedRecord[]> {
  const ok = ids.filter((id) => /^\d{1,9}$/.test(id));
  if (!ok.length) return [];
  const r = await get<{ result: Record<string, Summary> & { uids: string[] } }>('esummary.fcgi', params({ id: ok.join(',') }), 60 * 60 * 24 * 7);
  return (r.result.uids ?? []).map((uid) => {
    const x = r.result[uid] as Summary;
    const year = Number((x.pubdate ?? '').slice(0, 4));
    return {
      pmid: uid,
      title: x.title?.replace(/<[^>]+>/g, '') ?? '',
      authors: (x.authors ?? []).map((a) => a.name).slice(0, 10),
      journal: x.fulljournalname || x.source || '',
      year: Number.isFinite(year) && year > 0 ? year : null,
      doi: x.articleids?.find((a) => a.idtype === 'doi')?.value ?? null,
      publicationTypes: x.pubtype ?? [],
      url: `https://pubmed.ncbi.nlm.nih.gov/${uid}/`,
    };
  });
}
