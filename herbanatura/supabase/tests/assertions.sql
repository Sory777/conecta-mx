-- Assertions run by scripts/test-migrations.sh after migrations + seed.
\set ON_ERROR_STOP 1

create or replace function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
end $$;

-- Expect a statement to fail. Returns true when it raised.
create or replace function pg_temp.fails(stmt text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  return true;
end $$;

-- Test users: an editor, a reviewer and two regular users.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'editor@test'),
  ('00000000-0000-0000-0000-0000000000a1', 'reviewer@test'),
  ('00000000-0000-0000-0000-0000000000b1', 'ana@test'),
  ('00000000-0000-0000-0000-0000000000b2', 'beto@test');
insert into public.admin_users (user_id, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'editor'),
  ('00000000-0000-0000-0000-0000000000a1', 'reviewer');

/* ----------------------------------------------------------- helpers */
select pg_temp.check(public.hn_normalize('  Cúrcuma  LONGA ') = 'curcuma longa', 'hn_normalize');
select pg_temp.check((select count(*) from public.profiles) = 4, 'profiles created by trigger');

/* ------------------------------------------------------- seed loaded */
select pg_temp.check((select count(*) from public.entities) > 90, 'entities seeded');
select pg_temp.check((select count(*) from public.regions where level = 'municipality') = 46, 'guanajuato municipalities');
select pg_temp.check((select count(*) from public.search_documents) = (select count(*) from public.entities), 'search documents maintained by trigger');
select pg_temp.check((select count(*) from public.evidence_claims where review_status <> 'pending_review') = 0, 'demo claims pending');

/* ---------------------------------------------------- API functions */
select pg_temp.check(public.api_entity_detail('curcuma') is not null, 'api_entity_detail curcuma');
select pg_temp.check(jsonb_array_length(public.api_entity_detail('curcuma') -> 'claims') = 3, 'curcuma detail includes curcumin claims');
select pg_temp.check(public.api_entity_detail('curcuma') #>> '{entity,plant,scientificName}' = 'Curcuma longa L.', 'plant details');
select pg_temp.check(jsonb_array_length(public.api_entity_detail('warfarina') -> 'interactions') = 5, 'warfarin interactions');
select pg_temp.check((public.api_full_text_search('curcuma') -> 0 ->> 'slug') = 'curcuma', 'full text search ranks curcuma first');
select pg_temp.check(jsonb_array_length(public.api_full_text_search('curcumna')) > 0, 'trigram tolerates typos');
select pg_temp.check((select count(*) from public.api_lexicon() where term = 'cáncer de colon') = 1, 'lexicon has aliases');
select pg_temp.check(jsonb_array_length(public.api_list_claims(p_cancer_only => true)) >= 8, 'cancer claims');
select pg_temp.check((public.api_list_entities(p_type => 'plant') ->> 'total')::int = 29, 'plant count');
select pg_temp.check(jsonb_array_length(public.api_regions(p_parent_slug => 'mexico')) = 32, 'mexican states');

/* ------------------------------------------------------ rigor rules */
select pg_temp.check(pg_temp.fails($$
  insert into public.evidence_claims (subject_id, context, level, category, human_evidence, statement, simple)
  select id, 'research', 'E', 'preclinical', true, '{"es":"x"}', '{"es":"x"}' from public.entities where slug = 'curcumina'
$$), 'preclinical claim cannot be human evidence');
select pg_temp.check(pg_temp.fails($$
  insert into public.evidence_claims (subject_id, context, level, category, human_evidence, statement, simple)
  select id, 'cancer_treatment', 'A', 'clinical_strong', false, '{"es":"x"}', '{"es":"x"}' from public.entities where slug = 'curcumina'
$$), 'cancer treatment A/B requires human evidence');
select pg_temp.check(pg_temp.fails($$
  insert into public.studies (title, year, study_type, url, doi) values ('x', 2020, 'rct', 'https://example.org', '10.1000/xyz')
$$), 'manual studies cannot carry hand-typed DOIs');
select pg_temp.check(pg_temp.fails($$
  insert into public.interactions (agent_id, medication_id, kind, effect, level)
  select a.id, b.id, 'possible', '{"es":"x"}', 'X' from public.entities a, public.entities b where a.slug = 'warfarina' and b.slug = 'curcuma'
$$), 'interaction direction enforced');
select pg_temp.check(pg_temp.fails($$
  insert into public.compounds (entity_id, pubchem_query) select id, 'x' from public.entities where slug = 'curcuma'
$$), 'type table must match entity type');

/* --------------------------------------------------------------- RLS */
set role anon;
select pg_temp.check((select count(*) from public.evidence_claims) > 0, 'anon reads claims');
select pg_temp.check(pg_temp.fails($$insert into public.sources (key, kind, title, publisher, url) values ('x', 'other', 'x', 'x', 'https://x.org')$$), 'anon cannot write');
select pg_temp.check(pg_temp.fails($$select count(*) from public.health_profiles$$), 'anon cannot touch health profiles');
reset role;

-- Regular user: own rows only; cannot write knowledge; cannot self-promote.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
insert into public.health_profiles (user_id, age_band, pregnant) values (auth.uid(), '18-39', true);
insert into public.favorites (user_id, entity_id) select auth.uid(), id from public.entities where slug = 'curcuma';
select pg_temp.check(pg_temp.fails($$insert into public.search_history (user_id, query) values (auth.uid(), 'x')$$), 'history requires consent');
update public.profiles set consent_history = true where id = auth.uid();
insert into public.search_history (user_id, query) values (auth.uid(), 'curcumina');
select pg_temp.check(pg_temp.fails($$update public.profiles set plan = 'premium' where id = auth.uid()$$), 'user cannot set own plan');
select pg_temp.check(pg_temp.fails($$insert into public.admin_users (user_id, role) values (auth.uid(), 'admin')$$), 'user cannot self-promote');
select pg_temp.check(pg_temp.fails($$
  insert into public.entities (entity_type, slug, name) values ('plant', 'hack', '{"es":"x"}')
$$), 'user cannot create knowledge');
select pg_temp.check(pg_temp.fails($$select public.review_content('evidence_claims', gen_random_uuid(), 'reviewed')$$), 'user cannot review');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
select pg_temp.check((select count(*) from public.health_profiles) = 0, 'other user health profile invisible');
select pg_temp.check((select count(*) from public.favorites) = 0, 'other user favorites invisible');

-- Editor: creates content as pending; cannot approve it.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
insert into public.entities (entity_type, slug, name, scientific_name) values ('plant', 'prueba-editor', '{"es":"Prueba"}', 'Testus plantus');
insert into public.plants (entity_id, family) select id, 'Testaceae' from public.entities where slug = 'prueba-editor';
select pg_temp.check((select review_status from public.entities where slug = 'prueba-editor') = 'pending_review', 'new content is pending');
select pg_temp.check(pg_temp.fails($$update public.entities set review_status = 'reviewed' where slug = 'prueba-editor'$$), 'editor cannot self-approve');
select pg_temp.check(pg_temp.fails($$select public.review_content('entities', (select id from public.entities where slug = 'prueba-editor'), 'reviewed')$$), 'editor is not a reviewer');
insert into public.evidence_claims (subject_id, context, level, category, human_evidence, statement, simple)
  select id, 'general', 'X', 'insufficient', false, '{"es":"Sin fuente"}', '{"es":"Sin fuente"}' from public.entities where slug = 'prueba-editor';

-- Reviewer: approves content with sources; claims without sources are refused.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select pg_temp.check(pg_temp.fails($$
  select public.review_content('evidence_claims', (select c.id from public.evidence_claims c join public.entities e on e.id = c.subject_id where e.slug = 'prueba-editor'), 'reviewed')
$$), 'claim without source cannot be approved');
select public.review_content('evidence_claims',
  (select c.id from public.evidence_claims c join public.entities e on e.id = c.subject_id join public.entities k on k.id = c.condition_id
   where e.slug = 'menta' and k.slug = 'sindrome-intestino-irritable'), 'reviewed', 'Contrastado con NCCIH');
select pg_temp.check((select count(*) from public.evidence_claims where review_status = 'reviewed') = 1, 'review_content approves');
select pg_temp.check((select count(*) from public.content_reviews) = 1, 'review logged');
select public.review_content('entities', (select id from public.entities where slug = 'prueba-editor'), 'rejected', 'Prueba');
reset role;
select pg_temp.check((select count(*) from public.audit_logs where table_name = 'evidence_claims' and action = 'UPDATE') >= 1, 'audit log written');

-- Rejected content disappears from the public API.
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.check(public.api_entity_detail('prueba-editor') is null, 'rejected entity hidden');
select pg_temp.check((public.api_entity_detail('menta') -> 'claims' -> 0 ->> 'reviewStatus') = 'reviewed', 'reviewed claim visible');
reset role;

-- Editing reviewed content sends it back to review.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
update public.evidence_claims set simple = '{"es":"Editado"}' where review_status = 'reviewed';
reset role;
select pg_temp.check((select count(*) from public.evidence_claims where review_status = 'reviewed') = 0, 'edit resets review');

select 'all assertions passed' as result;
