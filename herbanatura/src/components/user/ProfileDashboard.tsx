'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CONDITION_FLAGS, type ConditionFlag, type HealthProfile, userStore, useUserData } from '@/lib/user/local-store';
import { TYPE_SECTION } from '@/lib/i18n/config';
import { useI18n } from '@/components/layout/Providers';

const T = {
  es: {
    title: 'Mi perfil',
    local: 'Tus datos se guardan sólo en este dispositivo. No necesitas cuenta.',
    favorites: 'Favoritos',
    viewed: 'Plantas y fichas consultadas',
    history: 'Historial de búsquedas',
    historyOn: 'Guardar historial en este dispositivo',
    studies: 'Estudios guardados',
    collections: 'Colecciones personales',
    newCollection: 'Nueva colección',
    addFavs: 'Añadir favoritos actuales',
    empty: 'Vacío.',
    health: 'Perfil de salud (opcional)',
    healthIntro: 'Sólo se usa para mostrarte advertencias en las fichas (p. ej., “esta planta tiene posibles interacciones con uno de tus medicamentos”). Nunca para diagnosticar. Se guarda sólo en este dispositivo.',
    age: 'Edad',
    sex: 'Sexo',
    pregnant: 'Embarazo',
    breastfeeding: 'Lactancia',
    meds: 'Medicamentos que tomas',
    flags: 'Condiciones relevantes',
    allergies: 'Alergias (texto libre)',
    saveHealth: 'Guardar perfil de salud',
    clearHealth: 'Borrar perfil de salud',
    saved: 'Guardado.',
    data: 'Tus datos',
    export: 'Exportar mis datos (JSON)',
    deleteAll: 'Eliminar todos mis datos de este dispositivo',
    confirm: '¿Seguro? Se borrarán favoritos, historial, colecciones y perfil de salud de este dispositivo.',
    account: 'Cuenta',
    flagsL: {
      liver_disease: 'Enfermedad hepática',
      kidney_disease: 'Enfermedad renal',
      bleeding_disorder: 'Trastorno de coagulación',
      diabetes: 'Diabetes',
      upcoming_surgery: 'Cirugía próxima',
      cancer_treatment: 'En tratamiento oncológico',
      asteraceae_allergy: 'Alergia a Asteraceae (ambrosía, margaritas…)',
      transplant: 'Trasplante',
    } as Record<ConditionFlag, string>,
    sexes: { female: 'Mujer', male: 'Hombre', intersex: 'Intersexual', undisclosed: 'Prefiero no decirlo' },
  },
  en: {
    title: 'My profile',
    local: 'Your data is stored only on this device. No account needed.',
    favorites: 'Favorites',
    viewed: 'Viewed entries',
    history: 'Search history',
    historyOn: 'Keep history on this device',
    studies: 'Saved studies',
    collections: 'Personal collections',
    newCollection: 'New collection',
    addFavs: 'Add current favorites',
    empty: 'Empty.',
    health: 'Health profile (optional)',
    healthIntro: 'Used only to show warnings on entries (e.g., “this plant may interact with one of your medicines”). Never to diagnose. Stored only on this device.',
    age: 'Age',
    sex: 'Sex',
    pregnant: 'Pregnancy',
    breastfeeding: 'Breastfeeding',
    meds: 'Medicines you take',
    flags: 'Relevant conditions',
    allergies: 'Allergies (free text)',
    saveHealth: 'Save health profile',
    clearHealth: 'Delete health profile',
    saved: 'Saved.',
    data: 'Your data',
    export: 'Export my data (JSON)',
    deleteAll: 'Delete all my data from this device',
    confirm: 'Are you sure? Favorites, history, collections and health profile will be deleted from this device.',
    account: 'Account',
    flagsL: {
      liver_disease: 'Liver disease',
      kidney_disease: 'Kidney disease',
      bleeding_disorder: 'Bleeding disorder',
      diabetes: 'Diabetes',
      upcoming_surgery: 'Upcoming surgery',
      cancer_treatment: 'In cancer treatment',
      asteraceae_allergy: 'Asteraceae allergy (ragweed, daisies…)',
      transplant: 'Transplant',
    } as Record<ConditionFlag, string>,
    sexes: { female: 'Female', male: 'Male', intersex: 'Intersex', undisclosed: 'Prefer not to say' },
  },
};

const EMPTY_HEALTH: HealthProfile = { pregnant: false, breastfeeding: false, medications: [], conditionFlags: [], allergies: '' };

function Box({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-serif text-xl font-semibold">{title}</h2>
      <div className="mt-3 text-sm">{children}</div>
    </section>
  );
}

export function ProfileDashboard({ medications, accountEnabled }: { medications: { slug: string; name: string }[]; accountEnabled: boolean }) {
  const { locale } = useI18n();
  const t = T[locale];
  const data = useUserData();
  const [health, setHealth] = useState<HealthProfile>(data.health ?? EMPTY_HEALTH);
  const [msg, setMsg] = useState('');
  const [newName, setNewName] = useState('');
  const link = (type: keyof typeof TYPE_SECTION, slug: string) => `/${locale}/${TYPE_SECTION[type]}/${slug}`;

  const download = () => {
    const blob = new Blob([userStore.export()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `herbanatura-datos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <p className="rounded-xl bg-accent-soft p-3 text-sm lg:col-span-2">🔒 {t.local}</p>

      <Box title={`★ ${t.favorites}`}>
        {data.favorites.length ? (
          <ul className="space-y-1">{data.favorites.map((f) => <li key={f.slug}><Link className="underline" href={link(f.type, f.slug)}>{f.name}</Link></li>)}</ul>
        ) : <p className="text-muted">{t.empty}</p>}
      </Box>

      <Box title={`🕘 ${t.viewed}`}>
        {data.viewed.length ? (
          <ul className="space-y-1">{data.viewed.slice(0, 15).map((f) => <li key={f.slug}><Link className="underline" href={link(f.type, f.slug)}>{f.name}</Link></li>)}</ul>
        ) : <p className="text-muted">{t.empty}</p>}
      </Box>

      <Box title={`🔎 ${t.history}`}>
        <label className="mb-2 flex items-center gap-2">
          <input type="checkbox" checked={data.historyEnabled} onChange={(e) => userStore.update((d) => ({ ...d, historyEnabled: e.target.checked, history: e.target.checked ? d.history : [], viewed: e.target.checked ? d.viewed : [] }))} />
          {t.historyOn}
        </label>
        {data.history.length ? (
          <ul className="space-y-1">{data.history.slice(0, 20).map((h) => <li key={h.at}><Link className="underline" href={`/${locale}/buscar?q=${encodeURIComponent(h.query)}`}>{h.query}</Link></li>)}</ul>
        ) : <p className="text-muted">{t.empty}</p>}
      </Box>

      <Box title={`📄 ${t.studies}`}>
        {data.savedStudies.length ? (
          <ul className="space-y-1">{data.savedStudies.map((s) => <li key={s.ref}><a className="underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></li>)}</ul>
        ) : <p className="text-muted">{t.empty}</p>}
      </Box>

      <Box title={`📚 ${t.collections}`}>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName.trim().slice(0, 120);
            if (!name) return;
            userStore.update((d) => ({ ...d, collections: [...d.collections, { id: crypto.randomUUID(), name, items: [] }] }));
            setNewName('');
          }}
        >
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t.newCollection} className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-1.5" />
          <button className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white">+</button>
        </form>
        <ul className="mt-3 space-y-3">
          {data.collections.map((c) => (
            <li key={c.id} className="rounded-xl bg-surface-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{c.name}</span>
                <span className="flex gap-2 text-xs">
                  <button className="underline" onClick={() => userStore.update((d) => ({ ...d, collections: d.collections.map((x) => (x.id === c.id ? { ...x, items: [...x.items, ...d.favorites.filter((f) => !x.items.some((i) => i.slug === f.slug))] } : x)) }))}>{t.addFavs}</button>
                  <button className="text-danger underline" onClick={() => userStore.update((d) => ({ ...d, collections: d.collections.filter((x) => x.id !== c.id) }))}>✕</button>
                </span>
              </div>
              <p className="mt-1 text-muted">{c.items.map((i) => i.name).join(', ') || t.empty}</p>
            </li>
          ))}
        </ul>
      </Box>

      <Box title={`👤 ${t.health}`} id="salud">
        <p className="text-muted">{t.healthIntro}</p>
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            userStore.setHealth({ ...health, allergies: health.allergies.slice(0, 500) });
            setMsg(t.saved);
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label>{t.age}
              <select className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5" value={health.ageBand ?? ''} onChange={(e) => setHealth({ ...health, ageBand: (e.target.value || undefined) as HealthProfile['ageBand'] })}>
                <option value="">—</option>
                {(['<18', '18-39', '40-64', '65+'] as const).map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label>{t.sex}
              <select className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5" value={health.sex ?? ''} onChange={(e) => setHealth({ ...health, sex: (e.target.value || undefined) as HealthProfile['sex'] })}>
                <option value="">—</option>
                {(Object.keys(t.sexes) as (keyof typeof t.sexes)[]).map((s) => <option key={s} value={s}>{t.sexes[s]}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2"><input type="checkbox" checked={health.pregnant} onChange={(e) => setHealth({ ...health, pregnant: e.target.checked })} /> {t.pregnant}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={health.breastfeeding} onChange={(e) => setHealth({ ...health, breastfeeding: e.target.checked })} /> {t.breastfeeding}</label>
          </div>
          <fieldset>
            <legend className="font-medium">{t.meds}</legend>
            <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {medications.map((m) => (
                <label key={m.slug} className="flex items-center gap-2">
                  <input type="checkbox" checked={health.medications.includes(m.slug)} onChange={(e) => setHealth({ ...health, medications: e.target.checked ? [...health.medications, m.slug] : health.medications.filter((x) => x !== m.slug) })} />
                  {m.name}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="font-medium">{t.flags}</legend>
            <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {CONDITION_FLAGS.map((f) => (
                <label key={f} className="flex items-center gap-2">
                  <input type="checkbox" checked={health.conditionFlags.includes(f)} onChange={(e) => setHealth({ ...health, conditionFlags: e.target.checked ? [...health.conditionFlags, f] : health.conditionFlags.filter((x) => x !== f) })} />
                  {t.flagsL[f]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">{t.allergies}
            <input maxLength={500} className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-1.5" value={health.allergies} onChange={(e) => setHealth({ ...health, allergies: e.target.value })} />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">{t.saveHealth}</button>
            <button type="button" className="text-danger underline" onClick={() => { userStore.setHealth(null); setHealth(EMPTY_HEALTH); setMsg(''); }}>{t.clearHealth}</button>
            <span role="status" className="text-accent">{msg}</span>
          </div>
        </form>
      </Box>

      <Box title={`🗂️ ${t.data}`}>
        <div className="flex flex-wrap gap-3">
          <button onClick={download} className="rounded-lg border border-border px-4 py-2 font-medium hover:border-accent">⬇️ {t.export}</button>
          <button onClick={() => { if (confirm(t.confirm)) { userStore.clear(); setHealth(EMPTY_HEALTH); } }} className="rounded-lg border border-danger px-4 py-2 font-medium text-danger">🗑️ {t.deleteAll}</button>
        </div>
        {accountEnabled && <p className="mt-4"><Link href={`/${locale}/entrar`} className="text-accent underline">{t.account} →</Link></p>}
      </Box>
    </div>
  );
}
