-- HerbaNatura · 0004 · Knowledge entities (class-table inheritance).
-- `entities` is the supertable every claim, interaction, relation and citation
-- points to, so the knowledge graph keeps referential integrity.

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  entity_type entity_type not null,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$' and char_length(slug) <= 120),
  name localized_text not null,
  scientific_name text check (char_length(scientific_name) <= 200),
  summary localized_text,
  simple_summary localized_text,
  tags text[] not null default '{}',
  -- Editorial workflow
  review_status review_status not null default 'pending_review',
  published boolean not null default true,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index entities_type_idx on public.entities (entity_type, slug);
create index entities_tags_idx on public.entities using gin (tags);
create index entities_status_idx on public.entities (review_status);
create trigger entities_touch before update on public.entities for each row execute function public.hn_touch_updated_at();

-- Enforce that a type table row matches its supertable type.
create or replace function public.hn_check_entity_type()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected public.entity_type := tg_argv[0]::public.entity_type;
begin
  if not exists (select 1 from public.entities where id = new.entity_id and entity_type = expected) then
    raise exception 'entity % is not of type %', new.entity_id, expected;
  end if;
  return new;
end;
$$;

create table public.plants (
  entity_id uuid primary key references public.entities (id) on delete cascade,
  family text not null,
  synonyms text[] not null default '{}',
  botanical_description localized_text,
  distribution localized_text,
  legal_notes localized_text,
  name_ambiguity localized_text
);
create trigger plants_type before insert or update on public.plants for each row execute function public.hn_check_entity_type('plant');

create table public.plant_parts (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.plants (entity_id) on delete cascade,
  part text not null,
  ordinal smallint not null default 0,
  unique (entity_id, part)
);

create table public.mushrooms (
  entity_id uuid primary key references public.entities (id) on delete cascade,
  family text not null,
  synonyms text[] not null default '{}',
  edibility mushroom_edibility not null default 'unknown',
  description localized_text,
  distribution localized_text
);
create trigger mushrooms_type before insert or update on public.mushrooms for each row execute function public.hn_check_entity_type('mushroom');

create table public.foods (
  entity_id uuid primary key references public.entities (id) on delete cascade,
  family text,
  food_group text not null,
  nutrients jsonb not null default '[]' check (jsonb_typeof(nutrients) = 'array')
);
create trigger foods_type before insert or update on public.foods for each row execute function public.hn_check_entity_type('food');

create table public.compounds (
  entity_id uuid primary key references public.entities (id) on delete cascade,
  formula text check (formula is null or formula ~ '^[A-Za-z0-9()+\-·.]+$'),
  compound_class text[] not null default '{}',
  pubchem_query text not null,
  bioavailability localized_text,
  -- [{text: localized_text, studyTypes: study_type[], citations: [...]}]; never filled without sources.
  mechanisms_investigated jsonb not null default '[]' check (jsonb_typeof(mechanisms_investigated) = 'array')
);
create trigger compounds_type before insert or update on public.compounds for each row execute function public.hn_check_entity_type('compound');

create table public.conditions (
  entity_id uuid primary key references public.entities (id) on delete cascade,
  kind condition_kind not null,
  is_cancer boolean not null default false,
  icd10 text,
  parent_id uuid references public.conditions (entity_id) on delete set null
);
create index conditions_parent_idx on public.conditions (parent_id);
create trigger conditions_type before insert or update on public.conditions for each row execute function public.hn_check_entity_type('condition');

create table public.medications (
  entity_id uuid primary key references public.entities (id) on delete cascade,
  drug_class localized_text not null,
  atc_code text check (atc_code is null or atc_code ~ '^[A-Z][0-9]{2}([A-Z]([A-Z]([0-9]{2})?)?)?$'),
  categories medication_category[] not null default '{}'
);
create trigger medications_type before insert or update on public.medications for each row execute function public.hn_check_entity_type('medication');

create table public.entity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  normalized text generated always as (public.hn_normalize(name)) stored,
  lang text not null default 'es',
  kind alias_kind not null default 'common',
  region_id uuid references public.regions (id) on delete set null,
  ordinal smallint not null default 0,
  unique (entity_id, name, lang)
);
create index entity_aliases_entity_idx on public.entity_aliases (entity_id);
create index entity_aliases_trgm_idx on public.entity_aliases using gin (normalized extensions.gin_trgm_ops);

create table public.entity_regions (
  entity_id uuid not null references public.entities (id) on delete cascade,
  region_id uuid not null references public.regions (id) on delete cascade,
  ordinal smallint not null default 0,
  primary key (entity_id, region_id)
);
create index entity_regions_region_idx on public.entity_regions (region_id);

create table public.safety_warnings (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities (id) on delete cascade,
  topic safety_topic not null,
  status safety_status not null,
  text localized_text not null,
  ordinal smallint not null default 0,
  review_status review_status not null default 'pending_review',
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index safety_warnings_entity_idx on public.safety_warnings (entity_id);
create trigger safety_touch before update on public.safety_warnings for each row execute function public.hn_touch_updated_at();

create table public.preparations (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities (id) on delete cascade,
  name localized_text not null,
  description localized_text not null,
  context preparation_context not null,
  ordinal smallint not null default 0
);
create index preparations_entity_idx on public.preparations (entity_id);

create table public.images (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities (id) on delete cascade,
  storage_path text,
  url text not null check (url ~ '^https?://'),
  thumb_url text,
  author text not null,
  license text not null,
  source_url text not null,
  caption localized_text,
  -- Botanical identity of the photograph confirmed by a person.
  verified boolean not null default false,
  ordinal smallint not null default 0,
  created_at timestamptz not null default now()
);
create index images_entity_idx on public.images (entity_id);
