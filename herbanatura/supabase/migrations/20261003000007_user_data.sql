-- HerbaNatura · 0007 · Per-user data, subscriptions and advertising (kept apart from evidence).

create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_id uuid not null references public.entities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, entity_id)
);

-- Stored only with profiles.consent_history = true (checked by RLS).
create table public.search_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  query text not null check (char_length(query) <= 500),
  entity_id uuid references public.entities (id) on delete set null,
  created_at timestamptz not null default now()
);
create index search_history_user_idx on public.search_history (user_id, created_at desc);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index collections_user_idx on public.collections (user_id);
create trigger collections_touch before update on public.collections for each row execute function public.hn_touch_updated_at();

create table public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  entity_id uuid references public.entities (id) on delete cascade,
  study_id uuid references public.studies (id) on delete cascade,
  note text check (char_length(note) <= 2000),
  added_at timestamptz not null default now(),
  check ((entity_id is not null) <> (study_id is not null))
);
create unique index collection_items_unique on public.collection_items (collection_id, coalesce(entity_id, study_id));

create table public.saved_studies (
  user_id uuid not null references auth.users (id) on delete cascade,
  study_id uuid references public.studies (id) on delete cascade,
  -- External records (PubMed/ClinicalTrials.gov) saved before import.
  external_ref text check (external_ref ~ '^(pmid:\d{1,9}|nct:NCT\d{8})$'),
  title text not null,
  url text not null,
  created_at timestamptz not null default now(),
  check ((study_id is not null) or (external_ref is not null))
);
create unique index saved_studies_unique on public.saved_studies (user_id, coalesce(study_id::text, external_ref));

create table public.user_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('new_interaction', 'content_updated', 'new_study')),
  entity_id uuid references public.entities (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index user_alerts_user_idx on public.user_alerts (user_id);

-- OPT-IN cloud copy of the health profile. The app stores it on-device by default.
-- Minimal fields; age as a band, never a birth date.
create table public.health_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  age_band text check (age_band in ('<18', '18-39', '40-64', '65+')),
  sex text check (sex in ('female', 'male', 'intersex', 'undisclosed')),
  pregnant boolean not null default false,
  breastfeeding boolean not null default false,
  medication_ids uuid[] not null default '{}',
  condition_flags text[] not null default '{}' check (condition_flags <@ array[
    'liver_disease', 'kidney_disease', 'bleeding_disorder', 'diabetes', 'upcoming_surgery',
    'cancer_treatment', 'asteraceae_allergy', 'transplant'
  ]),
  allergies text check (char_length(allergies) <= 500),
  consent_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger health_profiles_touch before update on public.health_profiles for each row execute function public.hn_touch_updated_at();

-- AI usage log: no query text unless profiles.consent_ai_logging; purged after 30 days.
create table public.ai_queries (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  query text check (char_length(query) <= 2000),
  confidence text,
  source_count smallint,
  emergency boolean not null default false,
  model text,
  created_at timestamptz not null default now()
);
create index ai_queries_created_idx on public.ai_queries (created_at);

create or replace function public.purge_old_ai_queries()
returns integer
language sql
security definer
set search_path = ''
as $$
  with d as (delete from public.ai_queries where created_at < now() - interval '30 days' returning 1)
  select count(*)::integer from d
$$;

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null check (plan in ('free', 'premium')),
  status text not null check (status in ('active', 'trialing', 'past_due', 'canceled')),
  provider text not null default 'stripe',
  provider_customer_id text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

/* ------------------------------------------------------- advertising */
-- Deliberately NO foreign keys to evidence tables: an advertiser cannot be
-- linked to, or influence, any claim, level or interaction.
create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  disclosure text not null,
  created_at timestamptz not null default now()
);

create table public.ad_placements (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors (id) on delete cascade,
  slot text not null check (slot in ('home_footer', 'list_footer', 'education')),
  title text not null,
  body text not null,
  url text not null check (url ~ '^https://'),
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz
);
