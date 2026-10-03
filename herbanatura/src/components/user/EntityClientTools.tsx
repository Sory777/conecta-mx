'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import type { EntityType, SafetyStatus, SafetyTopic } from '@/lib/domain/types';
import { userStore, useUserData } from '@/lib/user/local-store';
import { useI18n } from '@/components/layout/Providers';

export function FavoriteButton({ slug, type, name }: { slug: string; type: EntityType; name: string }) {
  const { dict } = useI18n();
  const data = useUserData();
  const fav = data.favorites.some((f) => f.slug === slug);
  return (
    <button
      onClick={() => userStore.toggleFavorite({ slug, type, name })}
      aria-pressed={fav}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${fav ? 'border-accent bg-accent text-white' : 'border-border bg-surface hover:border-accent'}`}
    >
      {fav ? '★' : '☆'} {fav ? dict.entity.unfavorite : dict.entity.favorite}
    </button>
  );
}

export function ViewRecorder({ slug, type, name }: { slug: string; type: EntityType; name: string }) {
  useEffect(() => {
    userStore.recordView({ slug, type, name });
  }, [slug, type, name]);
  return null;
}

export interface PersonalAlertInput {
  entityType: EntityType;
  family?: string | null;
  interactions: { medicationSlug: string; medicationName: string; kind: string; categories: string[] }[];
  safety: { topic: SafetyTopic; status: SafetyStatus }[];
}

const T = {
  es: {
    title: 'Advertencias según tu perfil (guardado sólo en este dispositivo)',
    interaction: (m: string, k: string) => `Esta ficha tiene una ${k.toLowerCase()} registrada con uno de tus medicamentos: ${m}.`,
    topic: (t: string, s: string) => `${t}: ${s}.`,
    noInfo: (t: string) => `${t}: no hay información verificada. Consulta antes de usarla.`,
    asteraceae: 'Pertenece a la familia Asteraceae y registraste alergia a esta familia.',
    oncology: 'Registraste que estás en tratamiento oncológico: consulta con tu equipo antes de usar cualquier producto natural.',
    surgery: 'Registraste una cirugía próxima o un trastorno de coagulación: revisa las notas sobre sangrado e informa a tu médico.',
    none: 'No encontramos advertencias específicas para tu perfil. Eso no significa que sea seguro para ti.',
    disclaimer: 'Esto no es un diagnóstico. Sólo cruza tu perfil con la información registrada.',
    edit: 'Editar perfil',
  },
  en: {
    title: 'Warnings for your profile (stored only on this device)',
    interaction: (m: string, k: string) => `This entry has a recorded ${k.toLowerCase()} with one of your medicines: ${m}.`,
    topic: (t: string, s: string) => `${t}: ${s}.`,
    noInfo: (t: string) => `${t}: no verified information. Ask before using it.`,
    asteraceae: 'It belongs to the Asteraceae family and you recorded an allergy to this family.',
    oncology: 'You recorded that you are in cancer treatment: talk to your team before using any natural product.',
    surgery: 'You recorded upcoming surgery or a bleeding disorder: check the bleeding notes and tell your doctor.',
    none: 'No specific warnings found for your profile. That does not mean it is safe for you.',
    disclaimer: 'This is not a diagnosis. It only cross-checks your profile with recorded information.',
    edit: 'Edit profile',
  },
};

export function PersonalAlerts({ input }: { input: PersonalAlertInput }) {
  const { dict, locale } = useI18n();
  const { health } = useUserData();
  if (!health || input.entityType === 'condition' || input.entityType === 'medication') return null;
  const t = T[locale];
  const alerts: string[] = [];
  for (const i of input.interactions)
    if (health.medications.includes(i.medicationSlug)) alerts.push(t.interaction(i.medicationName, dict.interactionKinds[i.kind as keyof typeof dict.interactionKinds]));
  const topicAlert = (topic: SafetyTopic) => {
    const notes = input.safety.filter((s) => s.topic === topic);
    if (!notes.length) alerts.push(t.noInfo(dict.safetyTopics[topic]));
    else notes.forEach((n) => alerts.push(t.topic(dict.safetyTopics[topic], dict.safetyStatus[n.status])));
  };
  if (health.pregnant) topicAlert('pregnancy');
  if (health.breastfeeding) topicAlert('lactation');
  if (health.ageBand === '<18') topicAlert('children');
  if (health.ageBand === '65+') topicAlert('elderly');
  if (health.conditionFlags.includes('liver_disease')) topicAlert('liver');
  if (health.conditionFlags.includes('kidney_disease')) topicAlert('kidney');
  if (health.conditionFlags.includes('upcoming_surgery') || health.conditionFlags.includes('bleeding_disorder')) alerts.push(t.surgery);
  if (health.conditionFlags.includes('cancer_treatment')) alerts.push(t.oncology);
  if (health.conditionFlags.includes('asteraceae_allergy') && input.family === 'Asteraceae') alerts.push(t.asteraceae);

  return (
    <aside className="rounded-2xl border border-warn/40 bg-warn-soft p-4 text-sm" aria-live="polite">
      <p className="font-semibold">👤 {t.title}</p>
      {alerts.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {alerts.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2">{t.none}</p>
      )}
      <p className="mt-2 text-xs text-muted">
        {t.disclaimer}{' '}
        <Link href={`/${locale}/perfil#salud`} className="underline">
          {t.edit}
        </Link>
      </p>
    </aside>
  );
}
