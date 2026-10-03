'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { IdentifyResult } from '@/lib/identify';
import { TYPE_SECTION } from '@/lib/i18n/config';
import { tr } from '@/lib/i18n/text';
import { useI18n } from '@/components/layout/Providers';

const T = {
  es: {
    choose: 'Elige o toma una fotografía',
    hint: 'Consejos: buena luz, enfoque nítido, incluye hojas, flores o frutos y una referencia de tamaño. Para hongos: sombrero, láminas y base del pie.',
    submit: 'Identificar (preliminar)',
    busy: 'Analizando…',
    prelim: 'Identificación preliminar',
    observed: 'Características visibles',
    candidates: 'Posibilidades',
    possible: 'Posible',
    less: 'Menos probable',
    confirm: 'Cómo confirmarlo',
    supporting: 'Rasgos coincidentes',
    lookalikes: '☠️ Especies tóxicas similares',
    toxicDb: '☠️ Marcada como tóxica en HerbaNatura',
    inDb: 'Ver ficha',
    notPlant: 'La imagen no parece una planta u hongo, o la calidad no permite analizarla.',
    mushroom: 'Los hongos NO se pueden identificar con seguridad por fotografía. Varias especies mortales se parecen a especies comestibles.',
    privacy: 'La imagen se procesa y no se guarda.',
    error: 'No se pudo identificar la imagen.',
  },
  en: {
    choose: 'Choose or take a photo',
    hint: 'Tips: good light, sharp focus, include leaves, flowers or fruit and a size reference. For mushrooms: cap, gills and stem base.',
    submit: 'Identify (preliminary)',
    busy: 'Analyzing…',
    prelim: 'Preliminary identification',
    observed: 'Visible features',
    candidates: 'Possibilities',
    possible: 'Possible',
    less: 'Less likely',
    confirm: 'How to confirm',
    supporting: 'Matching features',
    lookalikes: '☠️ Similar toxic species',
    toxicDb: '☠️ Marked as toxic in HerbaNatura',
    inDb: 'View entry',
    notPlant: 'The image does not look like a plant or fungus, or its quality is too low.',
    mushroom: 'Mushrooms CANNOT be safely identified from a photo. Several deadly species resemble edible ones.',
    privacy: 'The image is processed and not stored.',
    error: 'Could not identify the image.',
  },
};

export function IdentifyForm() {
  const { locale, dict } = useI18n();
  const t = T[locale];
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<IdentifyResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setErr('');
    setRes(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('locale', locale);
      const r = await fetch('/api/identify', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? t.error);
      setRes(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="rounded-2xl border-2 border-danger/50 bg-danger-soft p-4 font-semibold">{dict.disclaimers.identification}</p>
      <form onSubmit={submit} className="rounded-2xl border border-border bg-surface p-5">
        <label className="block font-medium" htmlFor="photo">{t.choose}</label>
        <input
          id="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="mt-2 block w-full text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > 5 * 1024 * 1024) { setErr('> 5 MB'); return; }
            setFile(f);
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
        <p className="mt-2 text-xs text-muted">{t.hint} {t.privacy}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt="" className="mt-4 max-h-72 rounded-xl object-contain" />}
        <button disabled={!file || busy} className="mt-4 rounded-xl bg-accent px-5 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? t.busy : t.submit}</button>
      </form>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      {res && (
        <div className="space-y-4" aria-live="polite">
          <h2 className="font-serif text-2xl font-semibold">🔍 {t.prelim}</h2>
          {res.mushroomInvolved && <p className="rounded-xl border border-danger bg-danger-soft p-3 text-sm font-semibold">{t.mushroom}</p>}
          {!res.isPlantOrFungus && <p className="rounded-xl bg-warn-soft p-3 text-sm">{t.notPlant}</p>}
          {res.imageQuality && <p className="text-sm text-muted">{res.imageQuality}</p>}
          {res.observedFeatures.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
              <p className="font-semibold">{t.observed}</p>
              <ul className="mt-1 list-disc pl-5">{res.observedFeatures.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}
          {res.toxicLookalikes.length > 0 && (
            <div className="rounded-2xl border border-danger/50 bg-danger-soft p-4 text-sm">
              <p className="font-semibold">{t.lookalikes}</p>
              <ul className="mt-1 list-disc pl-5">{res.toxicLookalikes.map((x) => <li key={x.scientificName}><em>{x.scientificName}</em> — {x.reason}</li>)}</ul>
            </div>
          )}
          <h3 className="font-semibold">{t.candidates}</h3>
          <ul className="space-y-3">
            {res.candidates.map((c) => (
              <li key={c.scientificName} className={`rounded-2xl border p-4 text-sm ${c.toxicInDatabase ? 'border-danger bg-danger-soft' : 'border-border bg-surface'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <em className="font-serif text-lg font-semibold not-italic"><span className="italic">{c.scientificName}</span></em>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{c.likelihood === 'possible' ? t.possible : t.less}</span>
                  {c.toxicInDatabase && <span className="rounded-full bg-danger px-2 py-0.5 text-xs text-white">{t.toxicDb}</span>}
                </div>
                {c.commonNames.length > 0 && <p className="text-muted">{c.commonNames.join(', ')}</p>}
                {c.supportingFeatures.length > 0 && <p className="mt-2"><span className="font-medium">{t.supporting}:</span> {c.supportingFeatures.join('; ')}</p>}
                {c.howToConfirm.length > 0 && <p className="mt-1"><span className="font-medium">{t.confirm}:</span> {c.howToConfirm.join('; ')}</p>}
                {c.entity && <Link className="mt-2 inline-block text-accent underline" href={`/${locale}/${TYPE_SECTION[c.entity.type]}/${c.entity.slug}`}>{t.inDb}: {tr(c.entity.name, locale)} →</Link>}
              </li>
            ))}
          </ul>
          <p className="rounded-2xl border-2 border-danger/50 bg-danger-soft p-4 font-semibold">{dict.disclaimers.identification}</p>
        </div>
      )}
    </div>
  );
}
