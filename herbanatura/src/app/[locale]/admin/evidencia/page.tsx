import { adminAccess } from '@/lib/admin/guard';
import { entityOptions, sourceOptions } from '@/lib/admin/options';
import { CLAIM_CONTEXTS, EVIDENCE_CATEGORIES, EVIDENCE_LEVELS, STUDY_TYPES } from '@/lib/domain/types';
import { pageContext } from '@/lib/i18n/server';
import { AdminForm, Field, Select } from '@/components/admin/fields';
import { createClaimAction } from '../actions';

export default async function NewClaimPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await pageContext(params);
  const disabled = (await adminAccess()).kind !== 'staff';
  const [agents, conditions, sources] = await Promise.all([entityOptions(['plant', 'mushroom', 'food', 'compound']), entityOptions(['condition']), sourceOptions()]);
  return (
    <div className="max-w-3xl">
      <h2 className="font-serif text-2xl font-semibold">Nueva afirmación de evidencia</h2>
      <p className="mb-4 text-sm text-muted">Reglas: una afirmación sólo preclínica no puede marcarse como evidencia en humanos; en tratamiento del cáncer, los niveles A/B exigen evidencia humana (la base de datos lo impide). Una fuente es obligatoria.</p>
      <AdminForm action={createClaimAction} disabled={disabled} submit="Enviar a revisión">
        <input type="hidden" name="locale" value={locale} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Sujeto (planta, hongo, alimento o compuesto)" name="subject_id" required options={agents} />
          <Select label="Condición" name="condition_id" options={conditions} />
          <Select label="Contexto" name="context" required options={CLAIM_CONTEXTS.map((c) => [c, dict.contexts[c]])} />
          <Select label="Nivel" name="level" required options={EVIDENCE_LEVELS.map((l) => [l, `${l} — ${dict.levels[l]}`])} />
          <Select label="Naturaleza de la evidencia" name="category" required options={EVIDENCE_CATEGORIES.map((c) => [c, dict.categories[c]])} />
          <Select label="Tipos de estudio" name="study_types" multiple options={STUDY_TYPES.map((s) => [s, dict.studyTypes[s]])} />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="human_evidence" /> Existe al menos un estudio en humanos</label>
        <Field label="Afirmación científica (es)" name="statement_es" required textarea />
        <Field label="Afirmación científica (en)" name="statement_en" textarea />
        <Field label="Explicación sencilla (es)" name="simple_es" required textarea />
        <Field label="Explicación sencilla (en)" name="simple_en" textarea />
        <Field label="¿Qué sabemos? (una idea por línea)" name="know_es" textarea />
        <Field label="¿Qué NO sabemos?" name="dontknow_es" textarea />
        <Field label="¿Qué se está investigando?" name="investigating_es" textarea />
        <Field label="¿Qué riesgos existen?" name="risks_es" textarea />
        <Field label="Limitaciones" name="limitations_es" textarea />
        <Select label="Fuentes" name="source_ids" multiple required options={sources} />
        <Field label="Localizador en la fuente" name="locator" placeholder="Sección / página" />
      </AdminForm>
    </div>
  );
}
