import Link from 'next/link';
import { getRepository } from '@/lib/data';
import { pageContext } from '@/lib/i18n/server';
import { ENTITY_TYPES } from '@/lib/domain/types';

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await pageContext(params);
  const s = await getRepository().stats();
  const card = 'rounded-2xl border border-border bg-surface p-4';
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {ENTITY_TYPES.map((t) => (
          <div key={t} className={card}><p className="text-xs text-muted">{dict.typesPlural[t]}</p><p className="font-serif text-3xl">{s.entities[t]}</p></div>
        ))}
        <div className={card}><p className="text-xs text-muted">Afirmaciones</p><p className="font-serif text-3xl">{s.claims}</p></div>
        <div className={card}><p className="text-xs text-muted">Interacciones</p><p className="font-serif text-3xl">{s.interactions}</p></div>
        <div className={card}><p className="text-xs text-muted">Estudios</p><p className="font-serif text-3xl">{s.studies}</p></div>
        <div className={card}><p className="text-xs text-muted">Fuentes</p><p className="font-serif text-3xl">{s.sources}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(s.byStatus).map(([k, v]) => (
          <div key={k} className={card}><p className="text-sm">{dict.review[k as keyof typeof dict.review]}</p><p className="font-serif text-2xl">{v}</p></div>
        ))}
      </div>
      <p className="text-sm"><Link className="text-accent underline" href={`/${locale}/admin/revision`}>Ir a la cola de revisión →</Link></p>
      <div className="rounded-2xl bg-surface-2 p-4 text-sm">
        <p className="font-semibold">Flujo editorial</p>
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          <li>Un editor crea o edita contenido → queda en 🟡 pendiente de revisión.</li>
          <li>Toda afirmación o interacción exige al menos una fuente (validado también en la base de datos).</li>
          <li>Un revisor distinto del autor aprueba 🟢, rechaza 🔴 o marca ⚪ información insuficiente.</li>
          <li>Editar contenido revisado lo devuelve a revisión. Todo cambio queda en la auditoría.</li>
          <li>Los estudios detectados automáticamente y los borradores de IA nunca se publican sin revisión humana.</li>
        </ol>
      </div>
    </div>
  );
}
