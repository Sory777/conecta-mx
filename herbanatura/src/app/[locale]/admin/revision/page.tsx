import { getRepository } from '@/lib/data';
import { adminAccess } from '@/lib/admin/guard';
import { pageContext } from '@/lib/i18n/server';
import { reviewAction } from '../actions';

export default async function ReviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await pageContext(params);
  const access = await adminAccess();
  const items = await getRepository().reviewQueue();
  const disabled = access.kind !== 'staff';
  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold">Cola de revisión ({items.length})</h2>
      <p className="text-sm text-muted">Contenido pendiente, estudios detectados automáticamente y borradores generados por IA.</p>
      <ul className="mt-4 space-y-3">
        {items.map((i) => (
          <li key={`${i.table}:${i.id}`} className="rounded-2xl border border-border bg-surface p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-xs">{i.table}</span>
              <span className="font-semibold">{i.title}</span>
              <span className={`text-xs ${i.sourceCount ? 'text-muted' : 'font-semibold text-danger'}`}>📚 {i.sourceCount} fuente(s)</span>
              <span className="text-xs text-muted">{String(i.updatedAt).slice(0, 10)}</span>
            </div>
            {i.subtitle && <p className="mt-1 text-muted">{i.subtitle}</p>}
            {i.href && <a className="text-xs underline" href={i.href} target="_blank" rel="noopener noreferrer">Abrir fuente ↗</a>}
            <form action={reviewAction} className="mt-3 flex flex-wrap items-center gap-2">
              <fieldset disabled={disabled} className="flex flex-wrap items-center gap-2 disabled:opacity-50">
                <input type="hidden" name="table" value={i.table} />
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="locale" value={locale} />
                <input name="notes" placeholder="Notas de revisión (fuente contrastada, motivo…)" maxLength={4000} className="min-w-[16rem] flex-1 rounded-lg border border-border bg-bg px-3 py-1.5" />
                <button name="decision" value="reviewed" className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white">{dict.review.reviewed}</button>
                <button name="decision" value="insufficient_info" className="rounded-lg border border-border px-3 py-1.5">{dict.review.insufficient_info}</button>
                <button name="decision" value="rejected" className="rounded-lg border border-danger px-3 py-1.5 text-danger">{dict.review.rejected}</button>
              </fieldset>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
