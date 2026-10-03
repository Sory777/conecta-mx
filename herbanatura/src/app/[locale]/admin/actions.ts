'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { CLAIM_CONTEXTS, ENTITY_TYPES, EVIDENCE_CATEGORIES, EVIDENCE_LEVELS, INTERACTION_KINDS, REVIEW_STATUSES, SEVERITIES, SOURCE_KINDS, STUDY_TYPES } from '@/lib/domain/types';
import { requireStaff } from '@/lib/admin/guard';
import { pubmedSummaries } from '@/lib/research/pubmed';

const text = (max = 2000) => z.string().trim().max(max);
const opt = (max = 2000) => text(max).optional().transform((v) => (v ? v : null));
const slug = z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,119}$/, 'slug: minúsculas, números y guiones');
const uuid = z.string().uuid();
const lt = (es: string | null, en: string | null) => (es ? { es, ...(en ? { en } : {}) } : null);
const lines = (v: string | null | undefined) => (v ?? '').split('\n').map((x) => x.trim()).filter(Boolean);
const ltList = (es: string | null, en: string | null) => {
  const a = lines(es);
  const b = lines(en);
  return a.map((x, i) => (b[i] ? { es: x, en: b[i] } : { es: x }));
};

function form<T extends z.ZodRawShape>(shape: T, fd: FormData) {
  const obj: Record<string, unknown> = {};
  for (const k of Object.keys(shape)) {
    const all = fd.getAll(k);
    obj[k] = all.length > 1 ? all.map(String) : all.length ? String(all[0]) : undefined;
  }
  const r = z.object(shape).safeParse(obj);
  if (!r.success) throw new Error(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return r.data;
}

async function cite(db: Awaited<ReturnType<typeof requireStaff>>['db'], table: string, id: string, sourceIds: string[], locator: string | null) {
  if (!sourceIds.length) return;
  const { error } = await db.from('citations').insert(sourceIds.map((s, i) => ({ source_id: s, target_table: table, target_id: id, locator, ordinal: i })));
  if (error) throw new Error(error.message);
}

const asArray = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : []) as string[];

/* ------------------------------------------------------------- review */

export async function reviewAction(fd: FormData) {
  const { db } = await requireStaff();
  const f = form(
    {
      table: z.enum(['evidence_claims', 'interactions', 'traditional_knowledge', 'entity_relations', 'safety_warnings', 'entities', 'studies', 'study_candidates', 'ai_drafts']),
      id: uuid,
      decision: z.enum(REVIEW_STATUSES).refine((d) => d !== 'pending_review'),
      notes: opt(4000),
      locale: z.enum(['es', 'en']),
    },
    fd,
  );
  if (f.table === 'study_candidates' || f.table === 'ai_drafts') {
    const uid = (await db.auth.getUser()).data.user!.id;
    const { error } = await db.from(f.table).update({ status: f.decision, decided_by: uid, decided_at: new Date().toISOString() }).eq('id', f.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.rpc('review_content', { p_table: f.table, p_id: f.id, p_decision: f.decision, p_notes: f.notes });
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/${f.locale}`, 'layout');
}

/* ------------------------------------------------------------ entities */

export async function saveEntityAction(fd: FormData) {
  const { db } = await requireStaff();
  const f = form(
    {
      locale: z.enum(['es', 'en']),
      id: uuid.optional(),
      entity_type: z.enum(ENTITY_TYPES),
      slug,
      name_es: text(200).min(1),
      name_en: opt(200),
      scientific_name: opt(200),
      summary_es: opt(),
      summary_en: opt(),
      simple_es: opt(),
      simple_en: opt(),
      tags: opt(500),
      aliases: opt(4000),
      family: opt(120),
      synonyms: opt(1000),
      parts: opt(500),
      distribution_es: opt(),
      name_ambiguity_es: opt(),
      legal_es: opt(),
      edibility: z.enum(['medicinal', 'edible', 'toxic', 'deadly', 'unknown']).optional(),
      food_group: opt(120),
      formula: opt(60),
      compound_class: opt(300),
      pubchem_query: opt(200),
      condition_kind: z.enum(['disease', 'symptom', 'cancer', 'risk_factor']).optional(),
      icd10: opt(20),
      drug_class_es: opt(200),
      atc_code: opt(10),
      source_ids: z.union([uuid, z.array(uuid)]).optional(),
    },
    fd,
  );
  const base = {
    entity_type: f.entity_type,
    slug: f.slug,
    name: lt(f.name_es, f.name_en),
    scientific_name: f.scientific_name,
    summary: lt(f.summary_es, f.summary_en),
    simple_summary: lt(f.simple_es, f.simple_en),
    tags: (f.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
  };
  const { data: row, error } = f.id ? await db.from('entities').update(base).eq('id', f.id).select('id').single() : await db.from('entities').insert(base).select('id').single();
  if (error) throw new Error(error.message);
  const id = row.id as string;
  const csv = (v: string | null) => (v ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const typeRow: Record<string, Record<string, unknown>> = {
    plant: { family: f.family ?? 'Pendiente', synonyms: csv(f.synonyms), distribution: lt(f.distribution_es, null), name_ambiguity: lt(f.name_ambiguity_es, null), legal_notes: lt(f.legal_es, null) },
    mushroom: { family: f.family ?? 'Pendiente', synonyms: csv(f.synonyms), edibility: f.edibility ?? 'unknown' },
    food: { family: f.family, food_group: f.food_group ?? 'sin clasificar' },
    compound: { formula: f.formula, compound_class: csv(f.compound_class), pubchem_query: f.pubchem_query ?? f.name_en ?? f.name_es },
    condition: { kind: f.condition_kind ?? 'disease', is_cancer: f.condition_kind === 'cancer', icd10: f.icd10 },
    medication: { drug_class: lt(f.drug_class_es ?? 'Pendiente', null), atc_code: f.atc_code },
  };
  const table = { plant: 'plants', mushroom: 'mushrooms', food: 'foods', compound: 'compounds', condition: 'conditions', medication: 'medications' }[f.entity_type];
  const t = await db.from(table).upsert({ entity_id: id, ...typeRow[f.entity_type] });
  if (t.error) throw new Error(t.error.message);
  if (f.entity_type === 'plant') {
    await db.from('plant_parts').delete().eq('entity_id', id);
    const parts = csv(f.parts);
    if (parts.length) await db.from('plant_parts').insert(parts.map((part, ordinal) => ({ entity_id: id, part, ordinal })));
  }
  // Aliases: one per line, optional "|en" suffix for language.
  await db.from('entity_aliases').delete().eq('entity_id', id);
  const aliases = lines(f.aliases).map((l, ordinal) => {
    const [name, lang] = l.split('|').map((x) => x.trim());
    return { entity_id: id, name, lang: lang || 'es', ordinal };
  });
  if (aliases.length) await db.from('entity_aliases').insert(aliases);
  if (!f.id) await cite(db, 'entities', id, asArray(f.source_ids), null);
  revalidatePath(`/${f.locale}`, 'layout');
  redirect(`/${f.locale}/admin/contenido?ok=${encodeURIComponent(f.slug)}`);
}

/* -------------------------------------------------------------- claims */

export async function createClaimAction(fd: FormData) {
  const { db } = await requireStaff();
  const f = form(
    {
      locale: z.enum(['es', 'en']),
      subject_id: uuid,
      condition_id: uuid.optional().or(z.literal('').transform(() => undefined)),
      context: z.enum(CLAIM_CONTEXTS),
      level: z.enum(EVIDENCE_LEVELS),
      category: z.enum(EVIDENCE_CATEGORIES),
      study_types: z.union([z.enum(STUDY_TYPES), z.array(z.enum(STUDY_TYPES))]).optional(),
      human_evidence: z.enum(['on']).optional(),
      statement_es: text().min(10),
      statement_en: opt(),
      simple_es: text().min(10),
      simple_en: opt(),
      know_es: opt(4000),
      dontknow_es: opt(4000),
      investigating_es: opt(4000),
      risks_es: opt(4000),
      limitations_es: opt(4000),
      source_ids: z.union([uuid, z.array(uuid)]),
      locator: opt(300),
    },
    fd,
  );
  const sources = asArray(f.source_ids);
  if (!sources.length) throw new Error('Toda afirmación necesita al menos una fuente.');
  const { data, error } = await db
    .from('evidence_claims')
    .insert({
      subject_id: f.subject_id,
      condition_id: f.condition_id ?? null,
      context: f.context,
      level: f.level,
      category: f.category,
      study_types: asArray(f.study_types),
      human_evidence: f.human_evidence === 'on',
      statement: lt(f.statement_es, f.statement_en),
      simple: lt(f.simple_es, f.simple_en),
      what_we_know: ltList(f.know_es, null),
      what_we_dont_know: ltList(f.dontknow_es, null),
      under_investigation: ltList(f.investigating_es, null),
      risks: ltList(f.risks_es, null),
      limitations: ltList(f.limitations_es, null),
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await cite(db, 'evidence_claims', data.id, sources, f.locator);
  revalidatePath(`/${f.locale}/admin`, 'layout');
  redirect(`/${f.locale}/admin/revision`);
}

/* -------------------------------------------------------- interactions */

export async function createInteractionAction(fd: FormData) {
  const { db } = await requireStaff();
  const f = form(
    {
      locale: z.enum(['es', 'en']),
      agent_id: uuid,
      medication_id: uuid,
      kind: z.enum(INTERACTION_KINDS),
      severity: z.enum(SEVERITIES),
      level: z.enum(EVIDENCE_LEVELS),
      effect_es: text().min(3),
      effect_en: opt(),
      mechanism_es: opt(),
      source_ids: z.union([uuid, z.array(uuid)]),
      locator: opt(300),
    },
    fd,
  );
  const sources = asArray(f.source_ids);
  if (!sources.length) throw new Error('Toda interacción necesita al menos una fuente.');
  const { data, error } = await db
    .from('interactions')
    .insert({ agent_id: f.agent_id, medication_id: f.medication_id, kind: f.kind, severity: f.severity, level: f.level, effect: lt(f.effect_es, f.effect_en), mechanism: lt(f.mechanism_es, null) })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await cite(db, 'interactions', data.id, sources, f.locator);
  redirect(`/${f.locale}/admin/revision`);
}

/* ------------------------------------------------------------- sources */

export async function createSourceAction(fd: FormData) {
  const { db } = await requireStaff();
  const f = form(
    { locale: z.enum(['es', 'en']), key: slug, kind: z.enum(SOURCE_KINDS), title: text(500).min(3), publisher: text(300).min(2), url: z.string().url().regex(/^https?:\/\//), language: text(10).default('es') },
    fd,
  );
  const { error } = await db.from('sources').insert({ key: f.key, kind: f.kind, title: f.title, publisher: f.publisher, url: f.url, language: f.language });
  if (error) throw new Error(error.message);
  revalidatePath(`/${f.locale}/admin/fuentes`);
}

/* ------------------------------------------------------------- studies */

/** Studies are imported from PubMed by PMID — identifiers are never typed by hand. */
export async function importPubmedAction(fd: FormData) {
  const { db } = await requireStaff();
  const f = form({ locale: z.enum(['es', 'en']), pmid: z.string().trim().regex(/^\d{1,9}$/), study_type: z.enum(STUDY_TYPES), entity_ids: z.union([uuid, z.array(uuid)]).optional() }, fd);
  const [rec] = await pubmedSummaries([f.pmid]);
  if (!rec || !rec.title) throw new Error('PMID no encontrado en PubMed.');
  const { data, error } = await db
    .from('studies')
    .insert({ title: rec.title, authors: rec.authors, year: rec.year ?? new Date().getFullYear(), journal: rec.journal, study_type: f.study_type, pmid: rec.pmid, doi: rec.doi, url: rec.url, imported_from: 'pubmed' })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  const ents = asArray(f.entity_ids);
  if (ents.length) await db.from('study_entities').insert(ents.map((entity_id) => ({ study_id: data.id, entity_id })));
  redirect(`/${f.locale}/admin/revision`);
}

/* ---------------------------------------------------------- literature */

export async function createWatchAction(fd: FormData) {
  const { db } = await requireStaff();
  const f = form({ locale: z.enum(['es', 'en']), label: text(200).min(3), pubmed_query: text(1000).min(3) }, fd);
  const { error } = await db.from('literature_watches').insert({ label: f.label, pubmed_query: f.pubmed_query });
  if (error) throw new Error(error.message);
  revalidatePath(`/${f.locale}/admin/literatura`);
}
