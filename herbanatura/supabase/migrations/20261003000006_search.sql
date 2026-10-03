-- HerbaNatura · 0006 · Search: per-entity search documents (FTS es+en, trigram) and semantic-search scaffold.

create table public.search_documents (
  entity_id uuid primary key references public.entities (id) on delete cascade,
  entity_type entity_type not null,
  names text not null,          -- normalized names + aliases + scientific names (trigram)
  body text not null,           -- summaries and tags
  tsv tsvector generated always as (
    setweight(to_tsvector('simple', names), 'A') ||
    setweight(to_tsvector('spanish', public.hn_normalize(body)), 'B') ||
    setweight(to_tsvector('english', public.hn_normalize(body)), 'C')
  ) stored,
  updated_at timestamptz not null default now()
);
create index search_documents_tsv_idx on public.search_documents using gin (tsv);
create index search_documents_names_trgm_idx on public.search_documents using gin (names extensions.gin_trgm_ops);
create index search_documents_type_idx on public.search_documents (entity_type);

create or replace function public.refresh_search_document(p_entity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entities;
  syns text := '';
begin
  select * into e from public.entities where id = p_entity_id;
  if not found then
    delete from public.search_documents where entity_id = p_entity_id;
    return;
  end if;
  select coalesce(array_to_string(synonyms, ' '), '') into syns from public.plants where entity_id = p_entity_id;
  insert into public.search_documents (entity_id, entity_type, names, body, updated_at)
  values (
    e.id,
    e.entity_type,
    public.hn_normalize(concat_ws(' ',
      public.hn_lt_all(e.name), e.scientific_name, syns,
      (select string_agg(a.name, ' ') from public.entity_aliases a where a.entity_id = e.id))),
    concat_ws(' ', public.hn_lt_all(e.summary), array_to_string(e.tags, ' ')),
    now()
  )
  on conflict (entity_id) do update
    set entity_type = excluded.entity_type, names = excluded.names, body = excluded.body, updated_at = now();
end;
$$;

create or replace function public.hn_search_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'entities' then
    perform public.refresh_search_document(coalesce(new.id, old.id));
  else
    perform public.refresh_search_document(coalesce(new.entity_id, old.entity_id));
  end if;
  return null;
end;
$$;

create trigger entities_search after insert or update on public.entities
  for each row execute function public.hn_search_trigger();
create trigger aliases_search after insert or update or delete on public.entity_aliases
  for each row execute function public.hn_search_trigger();
create trigger plants_search after insert or update on public.plants
  for each row execute function public.hn_search_trigger();

/* ---------------------------------------------- semantic search scaffold */
-- pgvector is optional: the table is created only where the extension exists
-- (always on Supabase). Embeddings are computed offline from reviewed content.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'vector') then
    create extension if not exists vector with schema extensions;
    execute $sql$
      create table if not exists public.embeddings (
        id uuid primary key default gen_random_uuid(),
        target_table text not null check (target_table in ('entities', 'evidence_claims', 'studies', 'traditional_knowledge')),
        target_id uuid not null,
        locale text not null default 'es',
        model text not null,
        content_hash text not null,
        embedding extensions.vector(1024) not null,
        created_at timestamptz not null default now(),
        unique (target_table, target_id, locale, model)
      )
    $sql$;
    execute 'create index if not exists embeddings_hnsw_idx on public.embeddings using hnsw (embedding extensions.vector_cosine_ops)';
    execute 'alter table public.embeddings enable row level security';
    execute 'create policy embeddings_read on public.embeddings for select using (true)';
  end if;
end;
$$;
