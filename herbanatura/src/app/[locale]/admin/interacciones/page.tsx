import { adminAccess } from '@/lib/admin/guard';
import { entityOptions, sourceOptions } from '@/lib/admin/options';
import { EVIDENCE_LEVELS, INTERACTION_KINDS, SEVERITIES } from '@/lib/domain/types';
import { pageContext } from '@/lib/i18n/server';
import { AdminForm, Field, Select } from '@/components/admin/fields';
import { createInteractionAction } from '../actions';

export default async function NewInteractionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await pageContext(params);
  const disabled = (await adminAccess()).kind !== 'staff';
  const [agents, meds, sources] = await Promise.all([entityOptions(['plant', 'mushroom', 'food', 'compound']), entityOptions(['medication']), sourceOptions()]);
  return (
    <div className="max-w-3xl">
      <h2 className="font-serif text-2xl font-semibold">Agregar interacción</h2>
      <p className="mb-4 text-sm text-muted">No se registran interacciones sin fuente. Si la fuente no clasifica la gravedad, usa “no clasificada”. Si la evidencia es insuficiente, elige ese tipo.</p>
      <AdminForm action={createInteractionAction} disabled={disabled} submit="Enviar a revisión">
        <input type="hidden" name="locale" value={locale} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Planta / producto" name="agent_id" required options={agents} />
          <Select label="Medicamento" name="medication_id" required options={meds} />
          <Select label="Tipo" name="kind" required options={INTERACTION_KINDS.map((k) => [k, dict.interactionKinds[k]])} />
          <Select label="Gravedad" name="severity" required defaultValue="not_graded" options={SEVERITIES.map((s) => [s, dict.severity[s]])} />
          <Select label="Nivel de evidencia" name="level" required options={EVIDENCE_LEVELS.map((l) => [l, `${l} — ${dict.levels[l]}`])} />
        </div>
        <Field label="Efecto (es)" name="effect_es" required textarea />
        <Field label="Efecto (en)" name="effect_en" textarea />
        <Field label="Mecanismo conocido (es) — vacío si no está establecido" name="mechanism_es" textarea />
        <Select label="Fuentes" name="source_ids" multiple required options={sources} />
        <Field label="Localizador" name="locator" />
      </AdminForm>
    </div>
  );
}
