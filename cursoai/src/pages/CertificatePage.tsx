import { Printer, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { formatDate } from '../lib/format';
import { ErrorBox, Spinner, useToast } from '../components/ui';

export function CertificatePage({ code }: { code: string }) {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => api.certificate(code), [code]);
  if (loading) return <Spinner />;
  if (error || !data) return <div className="page"><ErrorBox error={error} onRetry={reload} /></div>;
  const url = `${window.location.origin}/#/certificado/${data.code}`;
  return (
    <div className="page max-w-3xl">
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden /> Imprimir / guardar PDF
        </button>
        <button
          className="btn-secondary"
          onClick={() => navigator.clipboard?.writeText(url).then(() => toast('Enlace de verificación copiado'), () => toast(url, 'info'))}
        >
          Copiar enlace de verificación
        </button>
      </div>
      <article className="relative overflow-hidden rounded-3xl border-4 border-double border-brand-200 bg-white p-6 text-center shadow-sm sm:p-12" aria-label="Certificado">
        <img src="/icon.svg" alt="" className="mx-auto h-12 w-12" />
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Certificado de finalización</p>
        <p className="mt-6 text-sm text-slate-500">Se certifica que</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">{data.recipient_name}</h1>
        <p className="mt-4 text-sm text-slate-500">completó el curso</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">{data.course_title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-700">{data.goal_outcome}</p>
        <dl className="mx-auto mt-8 grid max-w-lg grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Resultado</dt>
            <dd className="font-semibold text-slate-900">{Math.round(data.score * 100)}%</dd>
          </div>
          <div>
            <dt className="text-slate-500">Duración</dt>
            <dd className="font-semibold text-slate-900">{data.hours} h</dd>
          </div>
          <div>
            <dt className="text-slate-500">Fecha</dt>
            <dd className="font-semibold text-slate-900">{formatDate(data.issued_at)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-slate-600">{data.result_summary}</p>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden /> Identificador: <strong className="font-mono">{data.code}</strong>
        </p>
        <p className="mx-auto mt-4 max-w-xl border-t border-slate-100 pt-4 text-[11px] leading-relaxed text-slate-400">{data.disclaimer}</p>
      </article>
    </div>
  );
}
