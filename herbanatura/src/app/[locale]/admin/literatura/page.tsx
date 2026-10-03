import Link from 'next/link';
import { adminAccess } from '@/lib/admin/guard';
import { pageContext } from '@/lib/i18n/server';
import { sessionClient } from '@/lib/supabase/clients';
import { AdminForm, Field } from '@/components/admin/fields';
import { createWatchAction } from '../actions';

export default async function LiteratureAdmin({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await pageContext(params);
  const access = await adminAccess();
  const watches = access.kind === 'staff' ? ((await (await sessionClient()).from('literature_watches').select('id,label,pubmed_query,last_run_at,active').order('created_at')).data ?? []) : [];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Vigilancia de literatura</h2>
        <p className="mb-4 text-sm text-muted">
          El cron <code>/api/cron/literature</code> consulta PubMed para cada vigilancia y guarda los nuevos registros como candidatos <strong>pendientes</strong>. Ningún estudio ni conclusión se publica automáticamente. Revísalos en <Link className="underline" href={`/${locale}/admin/revision`}>Revisión</Link>.
        </p>
        <AdminForm action={createWatchAction} disabled={access.kind !== 'staff'} submit="Crear vigilancia">
          <input type="hidden" name="locale" value={locale} />
          <Field label="Nombre" name="label" required placeholder="Curcumina + cáncer colorrectal" />
          <Field label="Consulta PubMed" name="pubmed_query" required textarea placeholder="curcumin[tiab] AND colorectal neoplasms[mh]" />
        </AdminForm>
      </div>
      <div>
        <h2 className="font-serif text-2xl font-semibold">Vigilancias activas</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {watches.map((w) => (
            <li key={w.id} className="rounded-xl border border-border bg-surface p-3">
              <p className="font-medium">{w.label}</p>
              <code className="text-xs">{w.pubmed_query}</code>
              <p className="text-xs text-muted">Última ejecución: {w.last_run_at ?? 'nunca'}</p>
            </li>
          ))}
          {!watches.length && <li className="text-muted">{access.kind === 'demo' ? 'Ejemplo en seed.sql: “Curcumina + cáncer colorrectal”.' : 'Sin vigilancias.'}</li>}
        </ul>
      </div>
    </div>
  );
}
