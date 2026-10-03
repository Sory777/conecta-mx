-- HerbaNatura · 0001 · Foundation: extensions, enums, shared helpers.
-- Vocabularies mirror src/lib/domain/types.ts — keep them in sync.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

/* ------------------------------------------------------------ enums */

create type entity_type as enum ('plant', 'mushroom', 'food', 'compound', 'condition', 'medication');
create type review_status as enum ('pending_review', 'reviewed', 'rejected', 'insufficient_info');
create type evidence_level as enum ('A', 'B', 'C', 'D', 'E', 'F', 'X');
create type evidence_category as enum (
  'clinical_strong', 'clinical_limited', 'preliminary', 'observational',
  'preclinical', 'in_vitro', 'animal', 'insufficient', 'negative'
);
create type claim_context as enum ('general', 'prevention', 'research', 'complementary', 'cancer_treatment', 'safety');
create type study_type as enum (
  'in_vitro', 'animal', 'case_report', 'observational', 'cohort', 'case_control',
  'non_randomized_trial', 'rct', 'systematic_review', 'meta_analysis', 'narrative_review',
  'guideline', 'regulatory_evaluation'
);
create type study_result as enum ('positive', 'negative', 'mixed', 'null', 'unclear');
create type source_kind as enum ('government', 'journal', 'database', 'academic', 'ethnobotanical', 'book', 'other');
create type interaction_kind as enum ('documented', 'possible', 'theoretical', 'insufficient');
create type severity as enum ('major', 'moderate', 'minor', 'not_graded');
create type safety_topic as enum (
  'toxicity', 'overdose', 'side_effects', 'allergies', 'contraindications', 'pregnancy',
  'lactation', 'children', 'elderly', 'liver', 'kidney', 'surgery'
);
create type safety_status as enum ('documented_risk', 'caution', 'no_known_risk', 'insufficient', 'pending');
create type mushroom_edibility as enum ('medicinal', 'edible', 'toxic', 'deadly', 'unknown');
create type condition_kind as enum ('disease', 'symptom', 'cancer', 'risk_factor');
create type relation_predicate as enum ('contains', 'source_of', 'derived_from', 'lookalike_of', 'related_to', 'part_of');
create type region_level as enum ('macro_region', 'country', 'state', 'municipality', 'cultural');
create type alias_kind as enum ('common', 'regional', 'scientific_synonym', 'brand', 'abbreviation', 'misspelling');
create type medication_category as enum (
  'anticoagulant', 'antiplatelet', 'oncology', 'cardiovascular', 'psychiatric',
  'immunosuppressant', 'hormonal', 'antiretroviral', 'antidiabetic'
);
create type staff_role as enum ('editor', 'reviewer', 'admin');
create type traditional_documentation as enum ('documented', 'pending_verification');
create type preparation_context as enum ('traditional', 'studied_in_research', 'commercial');

/* ----------------------------------------------------- shared domain */

-- Localized text: {"es": "...", "en": "...", ...}. Spanish is mandatory.
create domain localized_text as jsonb
  check (value is null or (jsonb_typeof(value) = 'object' and jsonb_typeof(value -> 'es') = 'string'));

/* --------------------------------------------------------- helpers */

-- Immutable normalization used by indexes (lowercase, no diacritics, alnum only).
create or replace function public.hn_normalize(s text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(
    regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(s, ''))), '[^a-z0-9]+', ' ', 'g'),
    '\s+', ' ', 'g'))
$$;

create or replace function public.hn_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Text of every value of a localized_text, for search documents.
create or replace function public.hn_lt_all(t jsonb)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(string_agg(v, ' '), '') from jsonb_each_text(coalesce(t, '{}'::jsonb)) as x(k, v)
$$;
