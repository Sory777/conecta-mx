import { useState } from 'react';
import { Award, CheckCircle2, Trophy } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { navigate } from '../lib/router';
import { useAsync } from '../lib/useAsync';
import { ErrorBox, Generating, useToast } from '../components/ui';

export function ProjectPage({ id }: { id: string }) {
  const toast = useToast();
  const { data, setData, error, loading, reload } = useAsync(() => api.project(id), [id]);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading && !data) {
    return (
      <div className="page">
        <Generating steps={['Preparando tu proyecto final…', 'Definiendo criterios de evaluación…']} />
      </div>
    );
  }
  if (error || !data) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>;
  const p = data;
  const last = p.last_submission;

  async function submit() {
    setBusy(true);
    try {
      setData(await api.submitProject(id, content));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No se pudo evaluar tu proyecto.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function certificate() {
    try {
      await api.next(id); // closes the course if everything is done
      const c = await api.issueCertificate(id);
      navigate(`/certificado/${c.code}`);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No se pudo generar el certificado.', 'error');
    }
  }

  if (busy) {
    return (
      <div className="page">
        <Generating steps={['Evaluando tu proyecto con los criterios…', 'Preparando comentarios útiles…']} />
      </div>
    );
  }

  return (
    <div className="page max-w-3xl">
      <a href={`#/curso/${id}`} className="text-sm text-slate-500 hover:text-slate-700">
        ← Volver al curso
      </a>
      <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-600">
        <Trophy className="h-4 w-4" aria-hidden /> Proyecto final
      </p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">{p.title}</h1>
      <p className="mt-2 whitespace-pre-line text-slate-700">{p.brief}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-semibold text-slate-900">Entregables</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {p.deliverables.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
        <section className="card p-4">
          <h2 className="font-semibold text-slate-900">Cómo se evaluará</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {p.criteria.map((c) => (
              <li key={c} className="flex gap-1.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden /> {c}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {last && (
        <section className={`card mt-6 p-5 ${last.passed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`} role="status">
          <p className="text-3xl font-bold text-slate-900">{Math.round(last.score * 100)}%</p>
          <p className="font-medium text-slate-800">{last.passed ? '¡Proyecto aprobado!' : 'Todavía no alcanza el nivel esperado (70%).'}</p>
          <p className="mt-2 text-sm text-slate-700">{last.evaluation.summary}</p>
          <table className="mt-3 w-full text-sm">
            <caption className="sr-only">Evaluación por criterio</caption>
            <tbody>
              {last.evaluation.criteria.map((c) => (
                <tr key={c.criterion} className="border-t border-black/5">
                  <td className="py-2 pr-2 align-top text-slate-800">
                    {c.criterion}
                    <p className="text-xs text-slate-500">{c.comment}</p>
                  </td>
                  <td className="py-2 text-right align-top font-semibold">{Math.round(c.score * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="font-semibold text-slate-900">Fortalezas</p>
              <ul className="list-disc pl-5 text-slate-700">{last.evaluation.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Para mejorar</p>
              <ul className="list-disc pl-5 text-slate-700">{last.evaluation.improvements.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
          </div>
          {last.passed && (
            <button className="btn-primary mt-4" onClick={certificate}>
              <Award className="h-5 w-5" aria-hidden /> Obtener certificado
            </button>
          )}
        </section>
      )}

      {!last?.passed && (
        <section className="mt-6">
          <label htmlFor="project" className="label">
            {last ? 'Mejora tu entrega' : 'Tu entrega'}
          </label>
          <textarea
            id="project"
            className="input min-h-[240px]"
            value={content}
            maxLength={20000}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe tu solución, pega tu código o documento, y explica tus decisiones…"
          />
          <p className="mt-1 text-xs text-slate-500">{content.length.toLocaleString('es-MX')} / 20,000 caracteres</p>
          <button className="btn-primary mt-3" disabled={!content.trim()} onClick={submit}>
            Enviar para evaluación
          </button>
        </section>
      )}
    </div>
  );
}
