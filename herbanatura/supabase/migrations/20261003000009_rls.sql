-- HerbaNatura · 0009 · Row Level Security and grants.
-- Model:
--   * Public (anon + authenticated): read published, non-rejected knowledge.
--   * Staff (editor/reviewer/admin): read everything, write knowledge.
--     Only review_content() (reviewer role) changes review status.
--   * Users: full control over their own rows only.

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'admin_users', 'sources', 'evidence_levels', 'regions',
    'entities', 'plants', 'plant_parts', 'mushrooms', 'foods', 'compounds', 'conditions', 'medications',
    'entity_aliases', 'entity_regions', 'safety_warnings', 'preparations', 'images',
    'entity_relations', 'evidence_claims', 'interactions', 'traditional_knowledge',
    'studies', 'clinical_trials', 'study_entities', 'study_results', 'claim_studies', 'citations',
    'search_documents', 'favorites', 'search_history', 'collections', 'collection_items', 'saved_studies',
    'user_alerts', 'health_profiles', 'ai_queries', 'subscriptions', 'sponsors', 'ad_placements',
    'content_reviews', 'audit_logs', 'literature_watches', 'study_candidates', 'ai_drafts'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

/* --------------------------------------------------- public read */

create or replace function public.hn_entity_visible(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.entities where id = p_id and published and review_status <> 'rejected')
$$;

create policy sources_read on public.sources for select using (true);
create policy levels_read on public.evidence_levels for select using (true);
create policy regions_read on public.regions for select using (true);

create policy entities_read on public.entities for select
  using ((published and review_status <> 'rejected') or public.is_staff());

do $$
declare
  t text;
begin
  -- Type tables and satellites inherit visibility from the parent entity.
  foreach t in array array['plants', 'plant_parts', 'mushrooms', 'foods', 'compounds', 'conditions', 'medications',
                           'entity_aliases', 'entity_regions', 'preparations', 'images', 'search_documents'] loop
    execute format('create policy %I on public.%I for select using (public.hn_entity_visible(entity_id) or public.is_staff())', t || '_read', t);
  end loop;
  -- Reviewable content: rejected rows are hidden from the public.
  foreach t in array array['safety_warnings', 'traditional_knowledge'] loop
    execute format('create policy %I on public.%I for select using ((review_status <> ''rejected'' and public.hn_entity_visible(entity_id)) or public.is_staff())', t || '_read', t);
  end loop;
end;
$$;

create policy relations_read on public.entity_relations for select
  using ((review_status <> 'rejected' and public.hn_entity_visible(subject_id) and public.hn_entity_visible(object_id)) or public.is_staff());
create policy claims_read on public.evidence_claims for select
  using ((review_status <> 'rejected' and public.hn_entity_visible(subject_id)) or public.is_staff());
create policy interactions_read on public.interactions for select
  using ((review_status <> 'rejected' and public.hn_entity_visible(agent_id) and public.hn_entity_visible(medication_id)) or public.is_staff());
create policy studies_read on public.studies for select using (review_status <> 'rejected' or public.is_staff());
create policy trials_read on public.clinical_trials for select using (true);
create policy study_entities_read on public.study_entities for select using (true);
create policy study_results_read on public.study_results for select using (true);
create policy claim_studies_read on public.claim_studies for select using (true);
create policy citations_read on public.citations for select using (true);
create policy ads_read on public.ad_placements for select
  using (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

/* ------------------------------------------------------ staff write */

do $$
declare
  t text;
begin
  foreach t in array array[
    'sources', 'regions', 'entities', 'plants', 'plant_parts', 'mushrooms', 'foods', 'compounds', 'conditions', 'medications',
    'entity_aliases', 'entity_regions', 'safety_warnings', 'preparations', 'images', 'entity_relations', 'evidence_claims',
    'interactions', 'traditional_knowledge', 'studies', 'clinical_trials', 'study_entities', 'study_results', 'claim_studies',
    'citations', 'literature_watches', 'sponsors', 'ad_placements'
  ] loop
    execute format('create policy %I on public.%I for insert with check (public.has_staff_role(array[''editor'']::public.staff_role[]))', t || '_staff_insert', t);
    execute format('create policy %I on public.%I for update using (public.has_staff_role(array[''editor'']::public.staff_role[]))', t || '_staff_update', t);
    execute format('create policy %I on public.%I for delete using (public.has_staff_role(array[''admin'']::public.staff_role[]))', t || '_admin_delete', t);
  end loop;
end;
$$;

-- Editors cannot set review status directly; it changes only through review_content().
create or replace function public.hn_guard_review_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.review_status <> 'pending_review')
     or (tg_op = 'UPDATE' and new.review_status is distinct from old.review_status) then
    if coalesce(current_setting('hn.reviewing', true), '') <> 'on' and auth.uid() is not null then
      raise exception 'review status changes only through review_content()' using errcode = '42501';
    end if;
  end if;
  -- Any edit of reviewed content sends it back to review.
  if tg_op = 'UPDATE' and old.review_status = 'reviewed' and new.review_status = 'reviewed'
     and coalesce(current_setting('hn.reviewing', true), '') <> 'on' and auth.uid() is not null then
    new.review_status := 'pending_review';
    new.reviewed_at := null;
    new.reviewed_by := null;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['entities', 'safety_warnings', 'entity_relations', 'evidence_claims', 'interactions', 'traditional_knowledge', 'studies'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.hn_guard_review_columns()', t || '_review_guard', t);
  end loop;
end;
$$;

-- review_content() flags its own session so the guard lets it through.
create or replace function public.review_content(p_table text, p_id uuid, p_decision review_status, p_notes text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  creator uuid;
  is_admin boolean;
begin
  if not public.has_staff_role(array['reviewer']::public.staff_role[]) then
    raise exception 'only reviewers can review content' using errcode = '42501';
  end if;
  if p_table not in ('evidence_claims', 'interactions', 'traditional_knowledge', 'entity_relations', 'safety_warnings', 'entities', 'studies') then
    raise exception 'table % is not reviewable', p_table;
  end if;
  if p_decision = 'pending_review' then
    raise exception 'decision must be reviewed, rejected or insufficient_info';
  end if;

  execute format('select created_by from public.%I where id = $1', p_table) into creator using p_id;
  is_admin := exists (select 1 from public.admin_users where user_id = auth.uid() and role = 'admin');
  if p_decision = 'reviewed' and creator = auth.uid() and not is_admin then
    raise exception 'content must be approved by someone other than its author' using errcode = '42501';
  end if;

  perform set_config('hn.reviewing', 'on', true);
  execute format(
    'update public.%I set review_status = $1, reviewed_at = now(), reviewed_by = auth.uid() where id = $2',
    p_table
  ) using p_decision, p_id;
  perform set_config('hn.reviewing', 'off', true);

  insert into public.content_reviews (target_table, target_id, decision, notes, reviewer_id)
  values (p_table, p_id, p_decision, p_notes, auth.uid());
end;
$$;

-- Candidates and AI drafts are decided by reviewers.
create policy candidates_staff on public.study_candidates for all
  using (public.is_staff()) with check (public.is_staff());
create policy ai_drafts_read on public.ai_drafts for select using (public.is_staff());
create policy ai_drafts_decide on public.ai_drafts for update
  using (public.has_staff_role(array['reviewer']::public.staff_role[]))
  with check (decided_by = auth.uid());
create policy reviews_read on public.content_reviews for select using (public.is_staff());
create policy audit_read on public.audit_logs for select using (public.has_staff_role(array['admin']::public.staff_role[]));
create policy watches_read on public.literature_watches for select using (public.is_staff());
create policy admin_users_read on public.admin_users for select using (user_id = auth.uid() or public.is_staff());
create policy admin_users_manage on public.admin_users for all
  using (public.has_staff_role(array['admin']::public.staff_role[]))
  with check (public.has_staff_role(array['admin']::public.staff_role[]));
create policy sponsors_staff on public.sponsors for select using (public.is_staff());

/* --------------------------------------------------------- own rows */

create policy profiles_own_read on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy profiles_own_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy favorites_own on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy history_own_read on public.search_history for select using (user_id = auth.uid());
create policy history_own_delete on public.search_history for delete using (user_id = auth.uid());
create policy history_own_insert on public.search_history for insert with check (
  user_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and consent_history)
);
create policy collections_own on public.collections for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy collection_items_own on public.collection_items for all
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));
create policy saved_studies_own on public.saved_studies for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy alerts_own on public.user_alerts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Health data: owner only. Not even staff can read it.
create policy health_own on public.health_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_queries_own_read on public.ai_queries for select using (user_id = auth.uid());
create policy subscriptions_own_read on public.subscriptions for select using (user_id = auth.uid());

/* ------------------------------------------------------------ grants */

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
-- Column-level restrictions
revoke update on public.profiles from authenticated;
grant update (display_name, locale, consent_history, consent_ai_logging) on public.profiles to authenticated;
revoke insert, update, delete on public.subscriptions, public.audit_logs, public.content_reviews, public.ai_queries from authenticated;
revoke select on public.health_profiles, public.ai_queries, public.audit_logs from anon;
