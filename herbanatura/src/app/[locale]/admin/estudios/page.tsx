import { getRepository } from '@/lib/data';
import { adminAccess } from '@/lib/admin/guard';
import { entityOptions } from '@/lib/admin/options';
import { STUDY_TYPES } from '@/lib/domain/types';
import { pageContext } from '@/lib/i18n/server';
import { AdminForm, Field, Select } from '@/components/admin/fields';
import { importPubmedAction } from '../actions';

export default async function StudiesAdmin({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await pageContext(params);
  const disabled = (await adminAccess()).kind !== 'staff';
  const [ents, studies] = await Promise.all([entityOptions(), getRepository().listStudies({ limit: 200 })]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Importar estudio desde PubMed</h2>
        <p className="mb-4 text-sm text-muted">Los identificadores (PMID, DOI) se obtienen de PubMed; la base de datos rechaza DOI o PMID escritos a mano. Después completa población, tamaño de muestra, intervención, comparador, resultado y limitaciones en la revisión.</p>
        <AdminForm action={importPubmedAction} disabled={disabled} submit="Importar (queda pendiente de revisión)">
          <input type="hidden" name="locale" value={locale} />
          <Field label="PMID" name="pmid" required placeholder="solo dígitos" />
          <Select label="Tipo de estudio" name="study_type" required options={STUDY_TYPES.map((s) => [s, dict.studyTypes[s]])} />
          <Select label="Entidades relacionadas" name="entity_ids" multiple options={ents} />
        </AdminForm>
      </div>
      <div>
        <h2 className="font-serif text-2xl font-semibold">Estudios ({studies.length})</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {studies.map((s) => <li key={s.id} className="rounded-xl border border-border bg-surface p-3"><a className="underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a><p className="text-xs text-muted">{s.year} · {dict.studyTypes[s.type]} · {dict.review[s.reviewStatus]}</p></li>)}
          {!studies.length && <li className="text-muted">Sin estudios todavía.</li>}
        </ul>
      </div>
    </div>
  );
}
