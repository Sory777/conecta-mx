import type { ClaimContext, EntityRef, EntityType, ResolvedClaim, ResolvedInteraction } from '@/lib/domain/types';
import type { EntitySummary, KnowledgeRepository, LexiconEntry } from '@/lib/data/repository';
import { toSummary } from '@/lib/domain/entity';
import { triage, type TriageResult } from '@/lib/safety/triage';
import { boundedLevenshtein, normalize, STOPWORDS } from './normalize';

export interface RecognizedEntity {
  entity: EntityRef;
  matched: string;
  fuzzy: boolean;
}

export interface RelationChain {
  agent: EntityRef;
  /** Natural sources (plant/food/mushroom) of a compound, or compounds of a plant/food. */
  via: EntityRef[];
  condition: EntityRef | null;
  claims: ResolvedClaim[];
}

export interface SearchResponse {
  query: string;
  recognized: RecognizedEntity[];
  requestedTypes: EntityType[];
  requestedContexts: ClaimContext[];
  chains: RelationChain[];
  /** Claims for recognized conditions when no agent was named. */
  conditionClaims: ResolvedClaim[];
  interactions: ResolvedInteraction[];
  /** Medication + agent pairs with no interaction record (shown as “Información insuficiente”). */
  missingInteractions: { agent: EntityRef; medication: EntityRef }[];
  results: EntitySummary[];
  triage: TriageResult;
}

const MAX_NGRAM = 6;

const TYPE_WORDS: Record<string, EntityType> = {
  planta: 'plant', plantas: 'plant', hierba: 'plant', hierbas: 'plant', plant: 'plant', plants: 'plant', herb: 'plant', herbs: 'plant',
  hongo: 'mushroom', hongos: 'mushroom', seta: 'mushroom', setas: 'mushroom', mushroom: 'mushroom', mushrooms: 'mushroom', fungi: 'mushroom',
  alimento: 'food', alimentos: 'food', comida: 'food', comidas: 'food', food: 'food', foods: 'food',
  compuesto: 'compound', compuestos: 'compound', sustancia: 'compound', sustancias: 'compound', molecula: 'compound', moleculas: 'compound', compound: 'compound', compounds: 'compound',
  medicamento: 'medication', medicamentos: 'medication', farmaco: 'medication', farmacos: 'medication', medicina: 'medication', drug: 'medication', drugs: 'medication', medication: 'medication',
};

const CONTEXT_PATTERNS: [RegExp, ClaimContext][] = [
  [/\b(prevencion|prevenir|previene|riesgo|prevention|prevent|risk)\b/, 'prevention'],
  [/\b(complementari\w*|junto con|adjunt\w*|complementary)\b/, 'complementary'],
  [/\b(tratar|tratamiento|curar|cura|treat|treatment|cure)\b/, 'cancer_treatment'],
  [/\b(investigad\w*|investigacion|estudiad\w*|estudios|research\w*|studied|studies)\b/, 'research'],
];

const AGENT_TYPES: EntityType[] = ['plant', 'mushroom', 'food', 'compound'];

export class Lexicon {
  private exact = new Map<string, LexiconEntry[]>();
  private byTokenCount = new Map<number, [string, LexiconEntry[]][]>();

  constructor(entries: LexiconEntry[]) {
    for (const e of entries) {
      const key = normalize(e.term);
      if (!key) continue;
      const list = this.exact.get(key) ?? [];
      if (!list.some((x) => x.entityId === e.entityId)) list.push(e);
      this.exact.set(key, list);
    }
    for (const [k, v] of this.exact) {
      const n = k.split(' ').length;
      const arr = this.byTokenCount.get(n) ?? [];
      arr.push([k, v]);
      this.byTokenCount.set(n, arr);
    }
  }

  lookup(phrase: string): LexiconEntry[] | undefined {
    return this.exact.get(phrase);
  }

  fuzzy(phrase: string, tokens: number): LexiconEntry[] | undefined {
    if (phrase.length < 5) return undefined;
    const max = phrase.length >= 9 ? 2 : 1;
    // Ties are all returned (e.g. "curcumna" → cúrcuma and curcumina): ambiguity is shown, not hidden.
    let best = max + 1;
    let out: LexiconEntry[] = [];
    for (const [k, v] of this.byTokenCount.get(tokens) ?? []) {
      const d = boundedLevenshtein(phrase, k, max);
      if (d > max) continue;
      if (d < best) [best, out] = [d, [...v]];
      else if (d === best) out.push(...v);
    }
    return out.length ? out : undefined;
  }
}

/** Greedy longest-match entity recognition over the normalized query. */
export function recognize(query: string, lexicon: Lexicon): RecognizedEntity[] {
  const tokens = normalize(query).split(' ').filter(Boolean);
  const found: RecognizedEntity[] = [];
  const seen = new Set<string>();
  let i = 0;
  while (i < tokens.length) {
    let matched = 0;
    for (let n = Math.min(MAX_NGRAM, tokens.length - i); n >= 1 && !matched; n--) {
      const words = tokens.slice(i, i + n);
      if (words.every((w) => STOPWORDS.has(w))) continue;
      if (STOPWORDS.has(words[0]) || STOPWORDS.has(words[words.length - 1])) continue;
      const phrase = words.join(' ');
      let entries = lexicon.lookup(phrase);
      let fuzzy = false;
      if (!entries) {
        entries = lexicon.fuzzy(phrase, n);
        fuzzy = !!entries;
      }
      if (entries) {
        for (const e of entries) {
          if (seen.has(e.entityId)) continue;
          seen.add(e.entityId);
          found.push({
            entity: { id: e.entityId, type: e.type, slug: e.slug, name: e.name, reviewStatus: 'pending_review' },
            matched: phrase,
            fuzzy,
          });
        }
        matched = n;
      }
    }
    i += matched || 1;
  }
  return found;
}

export function detectTypes(query: string): EntityType[] {
  const out = new Set<EntityType>();
  for (const w of normalize(query).split(' ')) if (TYPE_WORDS[w]) out.add(TYPE_WORDS[w]);
  return [...out];
}

export function detectContexts(query: string): ClaimContext[] {
  const n = normalize(query);
  return CONTEXT_PATTERNS.filter(([re]) => re.test(n)).map(([, c]) => c);
}

/** Conditions plus their ancestors and descendants (e.g. colorectal ↔ cancer). */
async function expandConditions(repo: KnowledgeRepository, conditions: EntityRef[]): Promise<Map<string, EntityRef>> {
  const out = new Map<string, EntityRef>();
  if (!conditions.length) return out;
  const { items } = await repo.listEntities({ type: 'condition', limit: 10_000 });
  const bySlug = new Map(items.map((i) => [i.slug, i]));
  for (const c of conditions) {
    out.set(c.id, c);
    let p = bySlug.get(c.slug)?.parentSlug ?? null;
    while (p && bySlug.has(p)) {
      const ref = bySlug.get(p)!;
      out.set(ref.id, ref);
      p = ref.parentSlug ?? null;
    }
    for (const i of items) if (i.parentSlug === c.slug) out.set(i.id, i);
  }
  return out;
}

/** Contexts that restrict results. “research” is informational and never filters. */
function allowedContexts(requested: ClaimContext[]): Set<ClaimContext> | null {
  const filtering = requested.filter((c) => c !== 'research');
  if (!filtering.length) return null;
  const set = new Set<ClaimContext>([...filtering, 'safety']);
  // Asking about treating a disease must also surface what is only under investigation.
  if (set.has('cancer_treatment')) ['research', 'complementary', 'general'].forEach((c) => set.add(c as ClaimContext));
  return set;
}

/**
 * “Plantas investigadas para cáncer” must include claims about compounds
 * contained in plants (curcumin → turmeric). A compound matches a requested
 * source type when any entity of that type contains it.
 */
async function subjectTypeMatcher(repo: KnowledgeRepository, types: EntityType[]) {
  const cache = new Map<string, boolean>();
  return async (subject: EntityRef): Promise<boolean> => {
    if (!types.length || types.includes(subject.type)) return true;
    if (subject.type !== 'compound') return false;
    if (!cache.has(subject.id)) {
      const rels = await repo.listRelations([subject.id]);
      cache.set(subject.id, rels.some((r) => r.objectId === subject.id && r.predicate === 'contains' && types.includes(r.subject.type)));
    }
    return cache.get(subject.id)!;
  };
}

export async function search(repo: KnowledgeRepository, query: string, lexicon?: Lexicon): Promise<SearchResponse> {
  const lex = lexicon ?? new Lexicon(await repo.getLexicon());
  const recognized = recognize(query, lex);
  const refs = await repo.getEntityRefs(recognized.map((r) => r.entity.id));
  const refById = new Map(refs.map((r) => [r.id, r]));
  for (const r of recognized) r.entity = refById.get(r.entity.id) ?? r.entity;

  const requestedTypes = detectTypes(query);
  const requestedContexts = detectContexts(query);
  const t = triage(query);

  const agents = recognized.filter((r) => AGENT_TYPES.includes(r.entity.type)).map((r) => r.entity);
  const conditions = recognized.filter((r) => r.entity.type === 'condition').map((r) => r.entity);
  const medications = recognized.filter((r) => r.entity.type === 'medication').map((r) => r.entity);

  const condMap = await expandConditions(repo, conditions);
  const allowed = allowedContexts(requestedContexts);
  const contextOk = (c: ResolvedClaim) => !allowed || allowed.has(c.context);

  // 1) Relation chains for each agent (optionally restricted to the recognized conditions)
  const chains: RelationChain[] = [];
  for (const agent of agents) {
    const relations = await repo.listRelations([agent.id]);
    const via = relations
      .filter((r) => (r.subjectId === agent.id && r.predicate === 'contains') || (r.objectId === agent.id && r.predicate === 'contains'))
      .map((r) => (r.subjectId === agent.id ? r.object : r.subject));
    const claims = (await repo.listClaims({ subjectIds: [agent.id, ...via.map((v) => v.id)] })).filter(
      (c) => (!condMap.size || (c.conditionId && condMap.has(c.conditionId))) && contextOk(c),
    );
    if (condMap.size) {
      for (const cond of conditions) chains.push({ agent, via, condition: cond, claims });
    } else {
      chains.push({ agent, via, condition: null, claims });
    }
  }

  // 2) Condition-only queries: list claims for the condition(s), filtered by requested types/contexts
  let conditionClaims: ResolvedClaim[] = [];
  if (conditions.length && !agents.length) {
    const typeOk = await subjectTypeMatcher(repo, requestedTypes.filter((x) => x !== 'medication'));
    conditionClaims = [];
    for (const c of await repo.listClaims({ conditionIds: [...condMap.keys()] })) if (contextOk(c) && (await typeOk(c.subject))) conditionClaims.push(c);
  }

  // 3) Interactions
  let interactions: ResolvedInteraction[] = [];
  const missingInteractions: SearchResponse['missingInteractions'] = [];
  for (const med of medications) {
    const list = await repo.listInteractions({ medicationId: med.id });
    const filtered = list.filter(
      (i) => (!agents.length || agents.some((a) => a.id === i.agentId)) && (!requestedTypes.length || requestedTypes.includes(i.agent.type) || requestedTypes.includes('medication')),
    );
    interactions.push(...filtered);
    for (const a of agents) if (!list.some((i) => i.agentId === a.id)) missingInteractions.push({ agent: a, medication: med });
  }
  if (!medications.length && agents.length) {
    interactions = await repo.listInteractions({ agentIds: agents.map((a) => a.id) });
  }

  // 4) Plain results: recognized entities first, then full-text matches
  const results: EntitySummary[] = [];
  const pushUnique = (s: EntitySummary) => {
    if (!results.some((r) => r.id === s.id)) results.push(s);
  };
  for (const r of recognized) {
    const e = await repo.getEntity(r.entity.slug);
    if (e) pushUnique(toSummary(e));
  }
  const ft = await repo.fullTextSearch(query, { types: requestedTypes.length ? requestedTypes : undefined, limit: recognized.length ? 6 : 20 });
  ft.forEach(pushUnique);

  return {
    query,
    recognized,
    requestedTypes,
    requestedContexts,
    chains,
    conditionClaims,
    interactions,
    missingInteractions,
    results: t.withholdRemedies ? [] : results,
    triage: t,
  };
}
