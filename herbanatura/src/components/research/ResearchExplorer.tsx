'use client';

import { useState } from 'react';
import type { PubmedRecord } from '@/lib/research/pubmed';
import type { TrialRecord } from '@/lib/research/clinicaltrials';
import { userStore, useUserData } from '@/lib/user/local-store';
import { useI18n } from '@/components/layout/Providers';

const T = {
  es: {
    pubmed: 'PubMed',
    trials: 'Ensayos clínicos',
    term: 'Término (en inglés funciona mejor: curcumin, green tea…)',
    types: 'Tipo de estudio',
    from: 'Desde',
    to: 'Hasta',
    sort: 'Orden',
    relevance: 'Relevancia',
    recent: 'Más recientes',
    search: 'Buscar',
    condition: 'Enfermedad / condición',
    intervention: 'Intervención (planta, compuesto…)',
    country: 'País',
    status: 'Estado',
    any: 'Cualquiera',
    results: 'resultados',
    external: 'Registros externos sin revisar por HerbaNatura. Un resultado listado no implica eficacia: revisa el tipo de estudio, la población y las limitaciones en la fuente original.',
    save: 'Guardar',
    saved: 'Guardado',
    error: 'No se pudo consultar la fuente externa.',
    typeLabels: { rct: 'Ensayo aleatorizado', clinical_trial: 'Ensayo clínico', meta_analysis: 'Metaanálisis', systematic_review: 'Revisión sistemática', review: 'Revisión', observational: 'Observacional', animal: 'Sólo animales', humans: 'En humanos' },
  },
  en: {
    pubmed: 'PubMed',
    trials: 'Clinical trials',
    term: 'Term (English works best: curcumin, green tea…)',
    types: 'Study type',
    from: 'From',
    to: 'To',
    sort: 'Sort',
    relevance: 'Relevance',
    recent: 'Most recent',
    search: 'Search',
    condition: 'Disease / condition',
    intervention: 'Intervention (plant, compound…)',
    country: 'Country',
    status: 'Status',
    any: 'Any',
    results: 'results',
    external: 'External records not reviewed by HerbaNatura. A listed result does not imply efficacy: check study type, population and limitations in the original source.',
    save: 'Save',
    saved: 'Saved',
    error: 'Could not query the external source.',
    typeLabels: { rct: 'Randomized trial', clinical_trial: 'Clinical trial', meta_analysis: 'Meta-analysis', systematic_review: 'Systematic review', review: 'Review', observational: 'Observational', animal: 'Animal only', humans: 'Humans' },
  },
};

const STATUSES = ['RECRUITING', 'NOT_YET_RECRUITING', 'ACTIVE_NOT_RECRUITING', 'COMPLETED', 'TERMINATED', 'WITHDRAWN'];
const input = 'mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm';

export function ResearchExplorer({ initial }: { initial?: string }) {
  const { locale } = useI18n();
  const t = T[locale];
  const saved = useUserData().savedStudies;
  const [tab, setTab] = useState<'pubmed' | 'trials'>('pubmed');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pm, setPm] = useState<{ count: number; records: PubmedRecord[]; query: string } | null>(null);
  const [tr, setTr] = useState<{ total: number; records: TrialRecord[] } | null>(null);
  const [f, setF] = useState({ q: initial ?? '', types: [] as string[], from: '', to: '', sort: 'relevance', condition: '', intervention: initial ?? '', country: '', status: '' });

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setErr('');
    try {
      if (tab === 'pubmed') {
        const p = new URLSearchParams({ q: f.q, sort: f.sort });
        if (f.types.length) p.set('types', f.types.join(','));
        if (f.from) p.set('from', f.from);
        if (f.to) p.set('to', f.to);
        const r = await fetch(`/api/research/pubmed?${p}`);
        if (!r.ok) throw new Error();
        setPm(await r.json());
      } else {
        const p = new URLSearchParams();
        (['condition', 'intervention', 'country', 'status'] as const).forEach((k) => f[k] && p.set(k, f[k]));
        const r = await fetch(`/api/research/trials?${p}`);
        if (!r.ok) throw new Error();
        setTr(await r.json());
      }
    } catch {
      setErr(t.error);
    } finally {
      setBusy(false);
    }
  }

  const SaveBtn = ({ refId, title, url }: { refId: string; title: string; url: string }) => {
    const on = saved.some((s) => s.ref === refId);
    return <button onClick={() => userStore.toggleStudy({ ref: refId, title, url })} className={`rounded-full border px-2 py-0.5 text-xs ${on ? 'border-accent bg-accent text-white' : 'border-border'}`}>{on ? `★ ${t.saved}` : `☆ ${t.save}`}</button>;
  };

  return (
    <div>
      <div role="tablist" className="inline-flex rounded-full border border-border bg-surface p-0.5 text-sm">
        {(['pubmed', 'trials'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 font-medium ${tab === k ? 'bg-accent text-white' : 'text-muted'}`}>{t[k]}</button>
        ))}
      </div>
      <form onSubmit={run} className="mt-4 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        {tab === 'pubmed' ? (
          <>
            <label className="text-sm sm:col-span-2">{t.term}<input required minLength={2} maxLength={300} className={input} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></label>
            <label className="text-sm">{t.from}<input type="number" min={1800} max={2100} className={input} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
            <label className="text-sm">{t.to}<input type="number" min={1800} max={2100} className={input} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
            <fieldset className="text-sm sm:col-span-2 lg:col-span-3">
              <legend>{t.types}</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {Object.entries(t.typeLabels).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-1 rounded-full border border-border px-2 py-1">
                    <input type="checkbox" checked={f.types.includes(k)} onChange={(e) => setF({ ...f, types: e.target.checked ? [...f.types, k] : f.types.filter((x) => x !== k) })} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="text-sm">{t.sort}<select className={input} value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}><option value="relevance">{t.relevance}</option><option value="pub_date">{t.recent}</option></select></label>
          </>
        ) : (
          <>
            <label className="text-sm">{t.condition}<input maxLength={200} className={input} value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })} /></label>
            <label className="text-sm">{t.intervention}<input maxLength={200} className={input} value={f.intervention} onChange={(e) => setF({ ...f, intervention: e.target.value })} /></label>
            <label className="text-sm">{t.country}<input maxLength={100} className={input} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></label>
            <label className="text-sm">{t.status}<select className={input} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">{t.any}</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          </>
        )}
        <div className="flex items-end"><button disabled={busy} className="w-full rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-60">{busy ? '…' : t.search}</button></div>
      </form>
      <p className="mt-3 rounded-xl bg-warn-soft p-3 text-xs">{t.external}</p>
      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}

      {tab === 'pubmed' && pm && (
        <div className="mt-4">
          <p className="text-sm text-muted">{pm.count.toLocaleString(locale)} {t.results} · <code className="text-xs">{pm.query}</code></p>
          <ul className="mt-3 space-y-3">
            {pm.records.map((r) => (
              <li key={r.pmid} className="rounded-xl border border-border bg-surface p-4 text-sm">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">{r.title}</a>
                <p className="mt-1 text-xs text-muted">{r.authors.slice(0, 3).join(', ')}{r.authors.length > 3 ? ' et al.' : ''} · {r.journal} · {r.year ?? '—'} · PMID {r.pmid}{r.doi ? ` · DOI ${r.doi}` : ''}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {r.publicationTypes.slice(0, 4).map((p) => <span key={p} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{p}</span>)}
                  <SaveBtn refId={`pmid:${r.pmid}`} title={r.title} url={r.url} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {tab === 'trials' && tr && (
        <div className="mt-4">
          <p className="text-sm text-muted">{tr.total.toLocaleString(locale)} {t.results}</p>
          <ul className="mt-3 space-y-3">
            {tr.records.map((r) => (
              <li key={r.nctId} className="rounded-xl border border-border bg-surface p-4 text-sm">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">{r.title}</a>
                <p className="mt-1 text-xs text-muted">{r.nctId} · {r.status} · {r.studyType} {r.phases.join('/')} · {r.startDate ?? ''}</p>
                <p className="mt-1 text-xs">{r.conditions.slice(0, 4).join(', ')} — {r.interventions.slice(0, 4).join(', ')}</p>
                {r.countries.length > 0 && <p className="mt-1 text-xs text-muted">{r.countries.slice(0, 6).join(', ')}</p>}
                <div className="mt-2"><SaveBtn refId={`nct:${r.nctId}`} title={r.title} url={r.url} /></div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
