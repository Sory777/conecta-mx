'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/components/layout/Providers';

interface Bucket {
  from: number;
  to: number;
  count: number;
}

const T = {
  es: {
    note: 'Número de publicaciones indexadas en PubMed por periodo. Indica actividad de investigación, NO calidad ni resultado de la evidencia.',
    unavailable: 'Cronología no disponible en este momento.',
    reviews: 'de ellas, revisiones sistemáticas / metaanálisis',
    trials: 'ensayos clínicos',
  },
  en: {
    note: 'Number of PubMed-indexed publications per period. It shows research activity, NOT evidence quality or results.',
    unavailable: 'Timeline unavailable right now.',
    reviews: 'of which systematic reviews / meta-analyses',
    trials: 'clinical trials',
  },
};

export function Timeline({ term }: { term: string }) {
  const { locale, dict } = useI18n();
  const t = T[locale];
  const [data, setData] = useState<{ buckets: Bucket[]; trials: Bucket[]; reviews: Bucket[] } | null | 'error'>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/research/timeline?term=${encodeURIComponent(term)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => alive && setData(d))
      .catch(() => alive && setData('error'));
    return () => {
      alive = false;
    };
  }, [term]);
  if (data === null) return <p className="text-sm text-muted">{dict.common.loading}</p>;
  if (data === 'error' || !data.buckets.length) return <p className="text-sm italic text-muted">{t.unavailable}</p>;
  const max = Math.max(1, ...data.buckets.map((b) => b.count));
  return (
    <div>
      <ol className="space-y-2">
        {data.buckets.map((b, i) => (
          <li key={b.from} className="grid grid-cols-[96px_1fr] items-center gap-3 text-sm">
            <span className="font-mono text-xs text-muted">
              {b.from}–{b.to}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 rounded-full bg-accent" style={{ width: `${Math.max(2, (b.count / max) * 100)}%` }} aria-hidden />
              <span className="whitespace-nowrap text-xs">
                {b.count.toLocaleString(locale)} · {data.trials[i]?.count ?? 0} {t.trials} · {data.reviews[i]?.count ?? 0} {t.reviews}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">{t.note}</p>
    </div>
  );
}
