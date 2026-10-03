import Link from 'next/link';
import { getRepository } from '@/lib/data';
import { adminAccess } from '@/lib/admin/guard';
import { sourceOptions } from '@/lib/admin/options';
import { ENTITY_TYPES, type Entity, type EntityType } from '@/lib/domain/types';
import { pageContext } from '@/lib/i18n/server';
import { scientificName } from '@/lib/domain/entity';
import { AdminForm, Field, Select } from '@/components/admin/fields';
import { ReviewBadge } from '@/components/evidence/badges';
import { saveEntityAction } from '../actions';

type SP = { tipo?: string; editar?: string; nuevo?: string; ok?: string };

export default async function ContentPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale, dict } = await pageContext(params);
  const sp = await searchParams;
  const repo = getRepository();
  const disabled = (await adminAccess()).kind !== 'staff';
  const type = (ENTITY_TYPES as readonly string[]).includes(sp.tipo ?? '') ? (sp.tipo as EntityType) : 'plant';
  const { items } = await repo.listEntities({ type, limit: 10000 });
  const editing: Entity | null = sp.editar ? await repo.getEntity(sp.editar) : null;
  const showForm = !!editing || sp.nuevo === '1';
  const t = editing?.type ?? type;
  const sources = await sourceOptions();
  const d: Record<string, unknown> = (editing ? (editing as unknown as Record<string, Record<string, unknown>>)[t] : undefined) ?? {};
  const sci = editing ? scientificName(editing) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <div className="flex flex-wrap gap-1">
          {ENTITY_TYPES.map((x) => (
            <Link key={x} href={`/${locale}/admin/contenido?tipo=${x}`} className={`rounded-full border px-3 py-1 text-sm ${x === type ? 'border-accent bg-accent text-white' : 'border-border'}`}>{dict.types[x]}</Link>
          ))}
        </div>
        {sp.ok && <p className="mt-3 rounded-lg bg-accent-soft p-2 text-sm">Guardado: {sp.ok} (pendiente de revisión).</p>}
        <Link href={`/${locale}/admin/contenido?tipo=${type}&nuevo=1`} className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">+ Crear {dict.types[type].toLowerCase()}</Link>
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2 px-4 py-2">
              <span>{i.name.es} <span className="sci text-muted">{i.scientificName}</span></span>
              <span className="flex items-center gap-2">
                <ReviewBadge status={i.reviewStatus} dict={dict} />
                <Link className="underline" href={`/${locale}/admin/contenido?tipo=${type}&editar=${i.slug}`}>Editar</Link>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {showForm && (
        <div>
          <h2 className="mb-3 font-serif text-2xl font-semibold">{editing ? `Editar: ${editing.name.es}` : `Crear ${dict.types[t].toLowerCase()}`}</h2>
          <AdminForm action={saveEntityAction} disabled={disabled}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="entity_type" value={t} />
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Slug (URL)" name="slug" required defaultValue={editing?.slug} placeholder="ej. curcuma" />
              <Field label="Nombre científico" name="scientific_name" defaultValue={sci} />
              <Field label="Nombre (es)" name="name_es" required defaultValue={editing?.name.es} />
              <Field label="Nombre (en)" name="name_en" defaultValue={editing?.name.en} />
            </div>
            <Field label="Resumen (es)" name="summary_es" textarea defaultValue={editing?.summary?.es} hint="Sin fuente verificada, escribe exactamente: Pendiente de investigación/verificación." />
            <Field label="Resumen (en)" name="summary_en" textarea defaultValue={editing?.summary?.en} />
            <Field label="Explicación sencilla (es)" name="simple_es" textarea defaultValue={editing?.simpleSummary?.es} />
            <Field label="Explicación sencilla (en)" name="simple_en" textarea defaultValue={editing?.simpleSummary?.en} />
            <Field label="Otros nombres (uno por línea; añade |en para inglés)" name="aliases" textarea defaultValue={editing?.aliases.map((a) => (a.lang === 'es' ? a.name : `${a.name}|${a.lang}`)).join('\n')} />
            <Field label="Etiquetas (coma)" name="tags" defaultValue={editing?.tags.join(', ')} />
            {(t === 'plant' || t === 'mushroom' || t === 'food') && <Field label="Familia" name="family" defaultValue={d.family as string} />}
            {(t === 'plant' || t === 'mushroom') && <Field label="Sinónimos (coma)" name="synonyms" defaultValue={(d.synonyms as string[] | undefined)?.join(', ')} />}
            {t === 'plant' && (
              <>
                <Field label="Partes usadas (coma)" name="parts" defaultValue={(d.partsUsed as string[] | undefined)?.join(', ')} />
                <Field label="Distribución (es)" name="distribution_es" textarea defaultValue={(d.distribution as { es?: string } | null)?.es} />
                <Field label="Advertencia de nombre ambiguo (es)" name="name_ambiguity_es" textarea defaultValue={(d.nameAmbiguity as { es?: string } | null)?.es} />
                <Field label="Situación legal (es)" name="legal_es" textarea defaultValue={(d.legalNotes as { es?: string } | null)?.es} />
              </>
            )}
            {t === 'mushroom' && <Select label="Comestibilidad" name="edibility" required defaultValue={d.edibility as string} options={Object.entries(dict.edibility) as [string, string][]} />}
            {t === 'food' && <Field label="Grupo de alimentos" name="food_group" defaultValue={d.foodGroup as string} />}
            {t === 'compound' && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Fórmula" name="formula" defaultValue={d.formula as string} />
                <Field label="Clase química (coma)" name="compound_class" defaultValue={(d.compoundClass as string[] | undefined)?.join(', ')} />
                <Field label="Consulta PubChem" name="pubchem_query" defaultValue={d.pubchemQuery as string} />
              </div>
            )}
            {t === 'condition' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Tipo" name="condition_kind" required defaultValue={d.kind as string} options={[['disease', 'Enfermedad'], ['symptom', 'Síntoma'], ['cancer', 'Cáncer'], ['risk_factor', 'Factor de riesgo']]} />
                <Field label="CIE-10" name="icd10" defaultValue={d.icd10 as string} />
              </div>
            )}
            {t === 'medication' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Clase farmacológica (es)" name="drug_class_es" defaultValue={(d.drugClass as { es?: string } | undefined)?.es} />
                <Field label="Código ATC" name="atc_code" defaultValue={d.atcCode as string} />
              </div>
            )}
            {!editing && <Select label="Fuentes de la ficha" name="source_ids" multiple options={sources} />}
          </AdminForm>
        </div>
      )}
    </div>
  );
}
