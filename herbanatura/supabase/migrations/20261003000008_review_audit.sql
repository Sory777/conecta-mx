-- HerbaNatura · 0008 · Editorial review workflow, audit log, literature monitoring, AI drafts.

create table public.content_reviews (
  id bigint generated always as identity primary key,
  target_table text not null,
  target_id uuid not null,
  decision review_status not null,
  notes text check (char_length(notes) <= 4000),
  reviewer_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index content_reviews_target_idx on public.content_reviews (target_table, target_id, created_at desc);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_row_idx on public.audit_logs (table_name, row_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create or replace function public.hn_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rid uuid;
begin
  begin
    rid := coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'), (to_jsonb(new) ->> 'entity_id'), (to_jsonb(old) ->> 'entity_id'))::uuid;
  exception when others then
    rid := null;
  end;
  insert into public.audit_logs (table_name, row_id, action, actor_id, old_data, new_data)
  values (
    tg_table_name, rid, tg_op, auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'entities', 'plants', 'mushrooms', 'foods', 'compounds', 'conditions', 'medications',
    'entity_aliases', 'safety_warnings', 'preparations', 'images', 'entity_relations',
    'evidence_claims', 'interactions', 'traditional_knowledge', 'studies', 'citations', 'sources', 'admin_users'
  ] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.hn_audit()', t || '_audit', t);
  end loop;
end;
$$;

-- review_content() is defined in the RLS migration, next to the guard it cooperates with.

/* ------------------------------------------- literature monitoring */

create table public.literature_watches (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  pubmed_query text not null check (char_length(pubmed_query) <= 1000),
  entity_ids uuid[] not null default '{}',
  active boolean not null default true,
  last_run_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- New studies detected automatically. NEVER published without human review.
create table public.study_candidates (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid references public.literature_watches (id) on delete set null,
  pmid text unique check (pmid ~ '^\d{1,9}$'),
  title text not null,
  journal text,
  year smallint,
  authors text[] not null default '{}',
  publication_types text[] not null default '{}',
  status review_status not null default 'pending_review',
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  study_id uuid references public.studies (id) on delete set null,
  created_at timestamptz not null default now()
);
create index study_candidates_status_idx on public.study_candidates (status, created_at desc);

-- AI-generated drafts (summaries, translations). Stored apart from published content.
create table public.ai_drafts (
  id uuid primary key default gen_random_uuid(),
  target_table text not null,
  target_id uuid,
  payload jsonb not null,
  model text not null,
  status review_status not null default 'pending_review',
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ai_drafts_human_decision check (status = 'pending_review' or decided_by is not null)
);
