'use client';

import { useState } from 'react';
import type { HerbaAnswer } from '@/lib/ai/herba';
import { useI18n } from '@/components/layout/Providers';
import { SafeText } from './SafeText';

const T = {
  es: {
    placeholder: 'Pregunta, por ejemplo: ¿Qué se sabe sobre la cúrcuma?',
    ask: 'Preguntar',
    thinking: 'Buscando en la base de conocimiento…',
    sources: '📚 Fuentes utilizadas',
    docs: 'Fragmentos de la base consultados',
    confidence: 'Nivel de confianza de la información',
    conf: { high: 'Alto — evidencia clínica revisada', moderate: 'Moderado — hay evidencia en humanos, con limitaciones o pendiente de revisión', low: 'Bajo — evidencia preclínica, tradicional o insuficiente', insufficient: 'Insuficiente — no hay evidencia registrada para responder' },
    confNote: 'Calculado a partir de la evidencia recuperada, no por la IA.',
    extractive: 'Modo extractivo: se muestran fragmentos de la base sin redacción automática.',
    gaps: 'Lo que la base NO puede responder',
    simple: '🧠 Explícamelo fácil',
    removed: 'referencias no verificables fueron eliminadas automáticamente.',
    examples: ['¿Qué se sabe sobre la cúrcuma?', '¿Qué plantas se han investigado para cáncer?', '¿Qué compuestos tiene el brócoli?', '¿Qué plantas pueden interactuar con warfarina?', 'Quiero tratar mi cáncer con plantas'],
    error: 'No se pudo obtener respuesta.',
  },
  en: {
    placeholder: 'Ask, for example: What is known about turmeric?',
    ask: 'Ask',
    thinking: 'Searching the knowledge base…',
    sources: '📚 Sources used',
    docs: 'Knowledge-base fragments consulted',
    confidence: 'Information confidence level',
    conf: { high: 'High — reviewed clinical evidence', moderate: 'Moderate — human evidence with limitations or pending review', low: 'Low — preclinical, traditional or insufficient evidence', insufficient: 'Insufficient — no recorded evidence to answer' },
    confNote: 'Computed from the retrieved evidence, not by the AI.',
    extractive: 'Extractive mode: knowledge-base fragments shown without automatic writing.',
    gaps: 'What the knowledge base CANNOT answer',
    simple: '🧠 Explain it simply',
    removed: 'unverifiable references were removed automatically.',
    examples: ['What is known about turmeric?', 'Which plants have been studied for cancer?', 'What compounds does broccoli contain?', 'Which plants can interact with warfarin?', 'I want to treat my cancer with plants'],
    error: 'Could not get an answer.',
  },
};

export function HerbaChat({ initial }: { initial?: string }) {
  const { locale } = useI18n();
  const t = T[locale];
  const [q, setQ] = useState(initial ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [answer, setAnswer] = useState<HerbaAnswer | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  async function ask(question: string) {
    if (question.trim().length < 2) return;
    setBusy(true);
    setErr('');
    setAnswer(null);
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, locale }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? t.error);
      setAnswer(await res.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  const confTone = answer?.confidence === 'high' ? 'bg-accent-soft' : answer?.confidence === 'moderate' ? 'bg-info-soft' : 'bg-warn-soft';
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="herba-q" className="sr-only">{t.placeholder}</label>
        <textarea id="herba-q" value={q} maxLength={1000} rows={2} onChange={(e) => setQ(e.target.value)} placeholder={t.placeholder} className="min-h-[3rem] flex-1 rounded-2xl border border-border bg-surface p-3 focus:outline-none focus:ring-2 focus:ring-accent" />
        <button disabled={busy} className="rounded-2xl bg-accent px-6 py-3 font-semibold text-white disabled:opacity-60">{t.ask}</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {t.examples.map((e) => (
          <button key={e} onClick={() => { setQ(e); ask(e); }} className="rounded-full border border-border bg-surface px-3 py-1 text-xs hover:border-accent">{e}</button>
        ))}
      </div>

      {busy && <p className="mt-6 animate-pulse text-sm text-muted" role="status">{t.thinking}</p>}
      {err && <p className="mt-6 text-sm text-danger" role="alert">{err}</p>}

      {answer && (
        <div className="mt-8 space-y-4" aria-live="polite">
          {answer.disclaimers.slice(0, -1).map((d) => <p key={d} className="rounded-xl border border-warn/40 bg-warn-soft p-3 text-sm">{d}</p>)}
          <article className={`rounded-2xl border p-5 ${answer.mode === 'emergency' ? 'border-danger bg-danger-soft' : 'border-border bg-surface'}`}>
            {answer.mode === 'extractive' && <p className="mb-3 text-xs text-muted">ℹ️ {t.extractive}</p>}
            <div className="hide-simple"><SafeText text={answer.answer} onCite={setFocus} /></div>
            <div className="only-simple"><SafeText text={answer.simple} onCite={setFocus} /></div>
            {answer.mode !== 'emergency' && (
              <details className="hide-simple mt-4 text-sm">
                <summary className="cursor-pointer text-accent">{t.simple}</summary>
                <div className="mt-2"><SafeText text={answer.simple} onCite={setFocus} /></div>
              </details>
            )}
            {!!answer.removedReferences && <p className="mt-3 text-xs text-muted">🛡️ {answer.removedReferences} {t.removed}</p>}
          </article>

          {answer.mode !== 'emergency' && (
            <div className={`rounded-2xl p-4 text-sm ${confTone}`}>
              <p className="font-semibold">{t.confidence}: {t.conf[answer.confidence]}</p>
              <p className="text-xs text-muted">{t.confNote}</p>
            </div>
          )}

          {answer.gaps.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
              <p className="font-semibold">❓ {t.gaps}</p>
              <ul className="mt-1 list-disc pl-5">{answer.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
            </div>
          )}

          {answer.sources.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
              <p className="font-semibold">{t.sources}</p>
              <ul className="mt-2 space-y-1">{answer.sources.map((s) => <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">{s.title}</a> <span className="text-muted">— {s.publisher}</span></li>)}</ul>
            </div>
          )}

          {answer.documents.length > 0 && (
            <details className="rounded-2xl border border-border bg-surface p-4 text-sm" open={!!focus}>
              <summary className="cursor-pointer font-semibold">{t.docs} ({answer.documents.length})</summary>
              <ul className="mt-2 space-y-1">
                {answer.documents.map((d) => (
                  <li key={d.key} className={focus === d.key ? 'rounded bg-accent-soft px-1' : ''}>
                    <span className="font-mono text-xs">{d.key}</span> · {d.title} {d.level && <span className="text-xs text-muted">· {d.level}</span>} <span className="text-xs text-muted">· {d.reviewStatus}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
