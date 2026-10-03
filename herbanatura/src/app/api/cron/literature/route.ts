import { timingSafeEqual } from 'node:crypto';
import { isSupabaseConfigured, serverEnv } from '@/lib/env';
import { log } from '@/lib/logger';
import { pubmedSearch } from '@/lib/research/pubmed';
import { serviceClient } from '@/lib/supabase/clients';

function authorized(req: Request) {
  const secret = serverEnv.cronSecret;
  const got = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!secret || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

/**
 * Scheduled job: for each active literature watch, fetch new PubMed records and
 * store them as `study_candidates` (pending review). NOTHING is published here.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSupabaseConfigured()) return Response.json({ skipped: 'supabase not configured' });
  const db = serviceClient();
  const { data: watches, error } = await db.from('literature_watches').select('id, label, pubmed_query, last_run_at').eq('active', true).limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  let inserted = 0;
  for (const w of watches ?? []) {
    try {
      const since = w.last_run_at ? new Date(w.last_run_at).getFullYear() : new Date().getFullYear() - 1;
      const { records } = await pubmedSearch(w.pubmed_query, { from: since, sort: 'pub_date', limit: 50 });
      if (records.length) {
        const rows = records.map((r) => ({ watch_id: w.id, pmid: r.pmid, title: r.title.slice(0, 1000), journal: r.journal, year: r.year, authors: r.authors, publication_types: r.publicationTypes }));
        const { count } = await db.from('study_candidates').upsert(rows, { onConflict: 'pmid', ignoreDuplicates: true, count: 'exact' });
        inserted += count ?? 0;
      }
      await db.from('literature_watches').update({ last_run_at: new Date().toISOString() }).eq('id', w.id);
    } catch (e) {
      log.error('literature_watch_failed', { watch: w.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  log.info('literature_cron', { watches: watches?.length ?? 0, inserted });
  return Response.json({ watches: watches?.length ?? 0, inserted });
}
