import { getRepository } from '@/lib/data';
import { adminAccess } from '@/lib/admin/guard';
import { SOURCE_KINDS } from '@/lib/domain/types';
import { pageContext } from '@/lib/i18n/server';
import { AdminForm, Field, Select } from '@/components/admin/fields';
import { createSourceAction } from '../actions';

export default async function SourcesAdmin({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await pageContext(params);
  const disabled = (await adminAccess()).kind !== 'staff';
  const sources = await getRepository().listSources();
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Agregar fuente</h2>
        <p className="mb-4 text-sm text-muted">Prioriza NIH, NCCIH, NCI, PubMed, OMS, universidades, organismos sanitarios, revistas y bases botánicas reconocidas.</p>
        <AdminForm action={createSourceAction} disabled={disabled}>
          <input type="hidden" name="locale" value={locale} />
          <Field label="Clave" name="key" required placeholder="nccih-ginger" />
          <Select label="Tipo" name="kind" required options={SOURCE_KINDS.map((k) => [k, k])} />
          <Field label="Título" name="title" required />
          <Field label="Editor / institución" name="publisher" required />
          <Field label="URL" name="url" required placeholder="https://" />
          <Field label="Idioma" name="language" defaultValue="es" />
        </AdminForm>
      </div>
      <div>
        <h2 className="font-serif text-2xl font-semibold">Fuentes ({sources.length})</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {sources.map((s) => (
            <li key={s.id} className="rounded-xl border border-border bg-surface p-3">
              <a className="font-medium underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
              <p className="text-xs text-muted">{s.publisher} · {s.kind} · añadida {s.addedAt} · revisada {s.reviewedAt ?? 'pendiente'}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
