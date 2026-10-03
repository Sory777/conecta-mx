-- HerbaNatura · 0005 · Evidence, interactions, traditional knowledge, studies, citations, graph.

create table public.entity_relations (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.entities (id) on delete cascade,
  predicate relation_predicate not null,
  object_id uuid not null references public.entities (id) on delete cascade,
  note localized_text,
  review_status review_status not null default 'pending_review',
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subject_id, predicate, object_id),
  check (subject_id <> object_id)
);
create index entity_relations_object_idx on public.entity_relations (object_id, predicate);
create trigger relations_touch before update on public.entity_relations for each row execute function public.hn_touch_updated_at();

create table public.evidence_claims (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.entities (id) on delete cascade,
  condition_id uuid references public.entities (id) on delete cascade,
  context claim_context not null,
  level evidence_level not null,
  category evidence_category not null,
  study_types study_type[] not null default '{}',
  human_evidence boolean not null,
  statement localized_text not null,
  simple localized_text not null,
  what_we_know jsonb not null default '[]' check (jsonb_typeof(what_we_know) = 'array'),
  what_we_dont_know jsonb not null default '[]' check (jsonb_typeof(what_we_dont_know) = 'array'),
  under_investigation jsonb not null default '[]' check (jsonb_typeof(under_investigation) = 'array'),
  risks jsonb not null default '[]' check (jsonb_typeof(risks) = 'array'),
  limitations jsonb not null default '[]' check (jsonb_typeof(limitations) = 'array'),
  research_doses localized_text,
  review_status review_status not null default 'pending_review',
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Rigor rules enforced by the database, not only by the UI:
  -- preclinical-only evidence can never be flagged as human evidence…
  constraint preclinical_is_not_human check (not (category in ('preclinical', 'in_vitro', 'animal') and human_evidence)),
  -- …and a cancer-treatment claim can only reach level A/B with human evidence.
  constraint cancer_treatment_needs_humans check (not (context = 'cancer_treatment' and level in ('A', 'B') and not human_evidence))
);
create index evidence_claims_subject_idx on public.evidence_claims (subject_id);
create index evidence_claims_condition_idx on public.evidence_claims (condition_id, context);
create index evidence_claims_status_idx on public.evidence_claims (review_status);
create trigger claims_touch before update on public.evidence_claims for each row execute function public.hn_touch_updated_at();

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.entities (id) on delete cascade,
  medication_id uuid not null references public.entities (id) on delete cascade,
  kind interaction_kind not null,
  severity severity not null default 'not_graded',
  effect localized_text not null,
  mechanism localized_text,
  level evidence_level not null,
  review_status review_status not null default 'pending_review',
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, medication_id)
);
create index interactions_medication_idx on public.interactions (medication_id);
create trigger interactions_touch before update on public.interactions for each row execute function public.hn_touch_updated_at();

create or replace function public.hn_check_interaction_types()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.entities where id = new.medication_id and entity_type = 'medication') then
    raise exception 'interaction medication_id must reference a medication';
  end if;
  if not exists (select 1 from public.entities where id = new.agent_id and entity_type in ('plant', 'mushroom', 'food', 'compound')) then
    raise exception 'interaction agent_id must reference a plant, mushroom, food or compound';
  end if;
  return new;
end;
$$;
create trigger interactions_types before insert or update on public.interactions for each row execute function public.hn_check_interaction_types();

create table public.traditional_knowledge (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities (id) on delete cascade,
  region_id uuid not null references public.regions (id) on delete restrict,
  culture text,
  use localized_text not null,
  preparation localized_text,
  part_used text,
  documentation traditional_documentation not null default 'pending_verification',
  review_status review_status not null default 'pending_review',
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.traditional_knowledge is 'Documented traditional use. Never evidence of efficacy.';
create index traditional_entity_idx on public.traditional_knowledge (entity_id);
create index traditional_region_idx on public.traditional_knowledge (region_id);
create trigger traditional_touch before update on public.traditional_knowledge for each row execute function public.hn_touch_updated_at();

/* ---------------------------------------------------------- studies */

-- Bibliographic records only: metadata + own summary + link. No copyrighted full text.
create table public.studies (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) <= 1000),
  authors text[] not null default '{}',
  year smallint not null check (year between 1800 and 2100),
  journal text,
  study_type study_type not null,
  population text,
  sample_size integer check (sample_size is null or sample_size >= 0),
  intervention text,
  comparator text,
  outcome localized_text,
  result study_result not null default 'unclear',
  limitations localized_text,
  country text,
  doi text unique check (doi is null or doi ~ '^10\.\d{4,9}/\S+$'),
  pmid text unique check (pmid is null or pmid ~ '^\d{1,9}$'),
  nct_id text check (nct_id is null or nct_id ~ '^NCT\d{8}$'),
  url text not null check (url ~ '^https?://'),
  -- Where the metadata came from (pubmed, clinicaltrials, manual). Identifiers must come from an import.
  imported_from text not null default 'manual' check (imported_from in ('pubmed', 'clinicaltrials', 'manual')),
  review_status review_status not null default 'pending_review',
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Manually created records may not carry identifiers (prevents hand-typed DOIs/PMIDs).
  constraint identifiers_must_be_imported check (imported_from <> 'manual' or (doi is null and pmid is null and nct_id is null))
);
create index studies_year_idx on public.studies (year desc);
create index studies_type_idx on public.studies (study_type);
create index studies_title_trgm_idx on public.studies using gin (public.hn_normalize(title) extensions.gin_trgm_ops);
create trigger studies_touch before update on public.studies for each row execute function public.hn_touch_updated_at();

create table public.clinical_trials (
  nct_id text primary key check (nct_id ~ '^NCT\d{8}$'),
  study_id uuid unique references public.studies (id) on delete set null,
  title text not null,
  phase text,
  overall_status text,
  start_date date,
  completion_date date,
  conditions text[] not null default '{}',
  interventions text[] not null default '{}',
  countries text[] not null default '{}',
  url text not null,
  fetched_at timestamptz not null default now()
);

create table public.study_entities (
  study_id uuid not null references public.studies (id) on delete cascade,
  entity_id uuid not null references public.entities (id) on delete cascade,
  primary key (study_id, entity_id)
);
create index study_entities_entity_idx on public.study_entities (entity_id);

-- Result of a study for a specific (agent, condition) pair.
create table public.study_results (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies (id) on delete cascade,
  entity_id uuid not null references public.entities (id) on delete cascade,
  condition_id uuid references public.entities (id) on delete cascade,
  result study_result not null,
  summary localized_text,
  unique (study_id, entity_id, condition_id)
);
create index study_results_condition_idx on public.study_results (condition_id);

create table public.claim_studies (
  claim_id uuid not null references public.evidence_claims (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  primary key (claim_id, study_id)
);

/* -------------------------------------------------------- citations */

create table public.citations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete restrict,
  target_table text not null check (target_table in (
    'entities', 'evidence_claims', 'interactions', 'traditional_knowledge', 'safety_warnings', 'entity_relations', 'studies', 'preparations'
  )),
  target_id uuid not null,
  locator text check (char_length(locator) <= 300),
  ordinal smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (source_id, target_table, target_id, locator)
);
create index citations_target_idx on public.citations (target_table, target_id);

-- Polymorphic cleanup: remove citations when the cited row disappears.
create or replace function public.hn_delete_citations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.citations where target_table = tg_table_name and target_id = old.id;
  return old;
end;
$$;
create trigger entities_citations_cleanup after delete on public.entities for each row execute function public.hn_delete_citations();
create trigger claims_citations_cleanup after delete on public.evidence_claims for each row execute function public.hn_delete_citations();
create trigger interactions_citations_cleanup after delete on public.interactions for each row execute function public.hn_delete_citations();
create trigger traditional_citations_cleanup after delete on public.traditional_knowledge for each row execute function public.hn_delete_citations();
create trigger safety_citations_cleanup after delete on public.safety_warnings for each row execute function public.hn_delete_citations();
create trigger relations_citations_cleanup after delete on public.entity_relations for each row execute function public.hn_delete_citations();
create trigger studies_citations_cleanup after delete on public.studies for each row execute function public.hn_delete_citations();

-- A claim or interaction cannot be approved without at least one source.
create or replace function public.hn_require_source_on_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.review_status = 'reviewed' and not exists (
    select 1 from public.citations where target_table = tg_table_name and target_id = new.id
  ) then
    raise exception 'cannot mark % % as reviewed without a source', tg_table_name, new.id;
  end if;
  return new;
end;
$$;
create trigger claims_require_source before update of review_status on public.evidence_claims
  for each row execute function public.hn_require_source_on_review();
create trigger interactions_require_source before update of review_status on public.interactions
  for each row execute function public.hn_require_source_on_review();
create trigger traditional_require_source before update of review_status on public.traditional_knowledge
  for each row execute function public.hn_require_source_on_review();

/* ------------------------------------------------------ graph views */

create view public.plant_compounds with (security_invoker = true) as
  select r.subject_id as plant_id, r.object_id as compound_id, r.review_status
  from public.entity_relations r
  join public.entities s on s.id = r.subject_id and s.entity_type = 'plant'
  join public.entities o on o.id = r.object_id and o.entity_type = 'compound'
  where r.predicate = 'contains';

create view public.food_compounds with (security_invoker = true) as
  select r.subject_id as food_id, r.object_id as compound_id, r.review_status
  from public.entity_relations r
  join public.entities s on s.id = r.subject_id and s.entity_type = 'food'
  join public.entities o on o.id = r.object_id and o.entity_type = 'compound'
  where r.predicate = 'contains';

-- Homogeneous edge list over every relationship kind: the knowledge graph.
create view public.v_knowledge_edges with (security_invoker = true) as
  select r.id as edge_id, 'relation'::text as edge_kind, r.subject_id, r.predicate::text as predicate, r.object_id,
         null::evidence_level as level, null::claim_context as context, r.review_status
  from public.entity_relations r
  union all
  select c.id, 'claim', c.subject_id, 'evidence_for', c.condition_id, c.level, c.context, c.review_status
  from public.evidence_claims c where c.condition_id is not null
  union all
  select i.id, 'interaction', i.agent_id, 'interacts_with:' || i.kind::text, i.medication_id, i.level, null, i.review_status
  from public.interactions i;
