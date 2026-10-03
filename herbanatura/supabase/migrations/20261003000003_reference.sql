-- HerbaNatura · 0003 · Reference data: sources, evidence levels, regions.

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9][a-z0-9-]*$'),
  kind source_kind not null,
  title text not null check (char_length(title) <= 500),
  publisher text not null check (char_length(publisher) <= 300),
  url text not null check (url ~ '^https?://'),
  doi text check (doi is null or doi ~ '^10\.\d{4,9}/\S+$'),
  pmid text check (pmid is null or pmid ~ '^\d{1,9}$'),
  language text not null default 'en',
  notes localized_text,
  added_at date not null default current_date,
  -- Set only when a human verified the content of the source.
  reviewed_at date,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger sources_touch before update on public.sources for each row execute function public.hn_touch_updated_at();

create table public.evidence_levels (
  level evidence_level primary key,
  name localized_text not null,
  description localized_text not null,
  sort_order smallint not null
);

insert into public.evidence_levels (level, name, description, sort_order) values
  ('A', '{"es":"Evidencia clínica consistente","en":"Consistent clinical evidence"}',
        '{"es":"Varios ensayos clínicos de calidad y/o revisiones sistemáticas concordantes en humanos.","en":"Several good-quality clinical trials and/or concordant systematic reviews in humans."}', 1),
  ('B', '{"es":"Evidencia clínica limitada","en":"Limited clinical evidence"}',
        '{"es":"Algunos ensayos en humanos con limitaciones de tamaño, duración o calidad.","en":"Some human trials with limitations in size, duration or quality."}', 2),
  ('C', '{"es":"Evidencia preliminar","en":"Preliminary evidence"}',
        '{"es":"Estudios piloto, ensayos pequeños o no aleatorizados.","en":"Pilot studies, small or non-randomized trials."}', 3),
  ('D', '{"es":"Evidencia observacional","en":"Observational evidence"}',
        '{"es":"Cohortes y casos y controles: muestran asociación, no causalidad.","en":"Cohort and case-control studies: show association, not causation."}', 4),
  ('E', '{"es":"Evidencia preclínica","en":"Preclinical evidence"}',
        '{"es":"Sólo estudios en células y/o animales.","en":"Only cell and/or animal studies."}', 5),
  ('F', '{"es":"Uso tradicional","en":"Traditional use"}',
        '{"es":"Uso documentado sin evidencia clínica suficiente.","en":"Documented use without sufficient clinical evidence."}', 6),
  ('X', '{"es":"Insuficiente o contradictoria","en":"Insufficient or conflicting"}',
        '{"es":"Datos escasos, de baja calidad o con resultados opuestos; incluye evidencia negativa.","en":"Scarce, low-quality or conflicting data; includes negative evidence."}', 7);

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name localized_text not null,
  level region_level not null,
  parent_id uuid references public.regions (id) on delete restrict,
  code text,
  created_at timestamptz not null default now()
);
create index regions_parent_idx on public.regions (parent_id);
