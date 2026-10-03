-- HerbaNatura · 0010 · Read API (RPC). Every function returns JSON in the exact
-- shapes of src/lib/domain/types.ts (camelCase). SECURITY INVOKER: RLS applies.

create or replace function public.hn_date(t timestamptz)
returns text language sql stable set search_path = '' as $$
  select to_char(t at time zone 'UTC', 'YYYY-MM-DD')
$$;

create or replace function public.hn_reviewer_name(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select display_name from public.profiles where id = p_user
$$;

create or replace function public.hn_citations(p_table text, p_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('sourceId', c.source_id, 'locator', c.locator) order by c.ordinal, c.created_at), '[]'::jsonb)
  from public.citations c where c.target_table = p_table and c.target_id = p_id
$$;

create or replace function public.hn_source_json(s public.sources)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id, 'kind', s.kind, 'title', s.title, 'publisher', s.publisher, 'url', s.url,
    'doi', s.doi, 'pmid', s.pmid, 'language', s.language, 'addedAt', s.added_at::text,
    'reviewedAt', s.reviewed_at::text, 'notes', s.notes)
$$;

-- Sources cited by any of the given targets, ordered by first citation.
create or replace function public.hn_sources_for(p_table text, p_ids uuid[])
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.hn_source_json(s) order by x.first_ord), '[]'::jsonb)
  from (
    select c.source_id, min(c.ordinal) as first_ord
    from public.citations c where c.target_table = p_table and c.target_id = any (p_ids)
    group by c.source_id
  ) x
  join public.sources s on s.id = x.source_id
$$;

create or replace function public.hn_region_json(p_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('slug', r.slug, 'name', r.name, 'level', r.level, 'parentSlug', p.slug, 'code', r.code)
  from public.regions r left join public.regions p on p.id = r.parent_id
  where r.id = p_id
$$;

/* ------------------------------------------------------------ entities */

create or replace function public.hn_entity_ref(p_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', e.id, 'type', e.entity_type, 'slug', e.slug, 'name', e.name,
                            'scientificName', e.scientific_name, 'reviewStatus', e.review_status)
  from public.entities e
  where e.id = p_id and e.published and e.review_status <> 'rejected'
$$;

create or replace function public.hn_entity_summary(p_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select public.hn_entity_ref(e.id) || jsonb_build_object(
    'summary', e.summary,
    'tags', to_jsonb(e.tags),
    'family', coalesce(p.family, m.family, f.family),
    'hint', case e.entity_type
      when 'mushroom' then m.edibility::text
      when 'food' then f.food_group
      when 'compound' then coalesce(k.formula, array_to_string(k.compound_class, ', '))
      when 'condition' then c.kind::text
      when 'medication' then md.drug_class ->> 'es'
    end,
    'regions', coalesce((select jsonb_agg(r.slug order by er.ordinal) from public.entity_regions er
                         join public.regions r on r.id = er.region_id where er.entity_id = e.id), '[]'::jsonb),
    'parentSlug', (select pe.slug from public.entities pe where pe.id = c.parent_id))
  from public.entities e
  left join public.plants p on p.entity_id = e.id
  left join public.mushrooms m on m.entity_id = e.id
  left join public.foods f on f.entity_id = e.id
  left join public.compounds k on k.entity_id = e.id
  left join public.conditions c on c.entity_id = e.id
  left join public.medications md on md.entity_id = e.id
  where e.id = p_id and e.published and e.review_status <> 'rejected'
$$;

create or replace function public.hn_entity_json(p_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', e.id, 'type', e.entity_type, 'slug', e.slug, 'name', e.name,
    'summary', e.summary, 'simpleSummary', e.simple_summary, 'tags', to_jsonb(e.tags),
    'aliases', coalesce((select jsonb_agg(jsonb_build_object('name', a.name, 'lang', a.lang, 'kind', a.kind, 'region', r.slug) order by a.ordinal)
                         from public.entity_aliases a left join public.regions r on r.id = a.region_id where a.entity_id = e.id), '[]'::jsonb),
    'citations', public.hn_citations('entities', e.id),
    'safety', coalesce((select jsonb_agg(jsonb_build_object('topic', s.topic, 'status', s.status, 'text', s.text,
                                                            'citations', public.hn_citations('safety_warnings', s.id),
                                                            'reviewStatus', s.review_status) order by s.ordinal)
                        from public.safety_warnings s where s.entity_id = e.id and s.review_status <> 'rejected'), '[]'::jsonb),
    'images', coalesce((select jsonb_agg(jsonb_build_object('url', i.url, 'thumbUrl', i.thumb_url, 'author', i.author, 'license', i.license,
                                                            'sourceUrl', i.source_url, 'caption', i.caption, 'verified', i.verified) order by i.ordinal)
                        from public.images i where i.entity_id = e.id), '[]'::jsonb),
    'regions', coalesce((select jsonb_agg(r.slug order by er.ordinal) from public.entity_regions er
                         join public.regions r on r.id = er.region_id where er.entity_id = e.id), '[]'::jsonb),
    'reviewStatus', e.review_status, 'reviewedAt', e.reviewed_at, 'reviewedBy', public.hn_reviewer_name(e.reviewed_by),
    'updatedAt', public.hn_date(e.updated_at)
  ) ||
  case e.entity_type
    when 'plant' then (select jsonb_build_object('plant', jsonb_build_object(
      'scientificName', e.scientific_name, 'family', p.family, 'synonyms', to_jsonb(p.synonyms),
      'botanicalDescription', p.botanical_description, 'distribution', p.distribution,
      'partsUsed', coalesce((select jsonb_agg(pp.part order by pp.ordinal) from public.plant_parts pp where pp.entity_id = e.id), '[]'::jsonb),
      'preparations', coalesce((select jsonb_agg(jsonb_build_object('name', pr.name, 'description', pr.description, 'context', pr.context,
                                                                    'citations', public.hn_citations('preparations', pr.id)) order by pr.ordinal)
                                from public.preparations pr where pr.entity_id = e.id), '[]'::jsonb),
      'legalNotes', p.legal_notes, 'nameAmbiguity', p.name_ambiguity)) from public.plants p where p.entity_id = e.id)
    when 'mushroom' then (select jsonb_build_object('mushroom', jsonb_build_object(
      'scientificName', e.scientific_name, 'family', m.family, 'synonyms', to_jsonb(m.synonyms), 'edibility', m.edibility,
      'description', m.description, 'distribution', m.distribution)) from public.mushrooms m where m.entity_id = e.id)
    when 'food' then (select jsonb_build_object('food', jsonb_build_object(
      'scientificName', e.scientific_name, 'family', f.family, 'foodGroup', f.food_group, 'nutrients', f.nutrients))
      from public.foods f where f.entity_id = e.id)
    when 'compound' then (select jsonb_build_object('compound', jsonb_build_object(
      'formula', k.formula, 'compoundClass', to_jsonb(k.compound_class), 'pubchemQuery', k.pubchem_query,
      'bioavailability', k.bioavailability, 'mechanismsInvestigated', k.mechanisms_investigated))
      from public.compounds k where k.entity_id = e.id)
    when 'condition' then (select jsonb_build_object('condition', jsonb_build_object(
      'kind', c.kind, 'isCancer', c.is_cancer, 'icd10', c.icd10,
      'parentSlug', (select pe.slug from public.entities pe where pe.id = c.parent_id)))
      from public.conditions c where c.entity_id = e.id)
    when 'medication' then (select jsonb_build_object('medication', jsonb_build_object(
      'drugClass', md.drug_class, 'atcCode', md.atc_code, 'categories', to_jsonb(md.categories)))
      from public.medications md where md.entity_id = e.id)
  end
  from public.entities e
  where e.id = p_id and e.published and e.review_status <> 'rejected'
$$;

/* ------------------------------------------------- claims & co. */

create or replace function public.hn_claim_json(c public.evidence_claims)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'subjectId', c.subject_id, 'conditionId', c.condition_id, 'context', c.context,
    'level', c.level, 'category', c.category, 'studyTypes', to_jsonb(c.study_types), 'humanEvidence', c.human_evidence,
    'statement', c.statement, 'simple', c.simple, 'whatWeKnow', c.what_we_know, 'whatWeDontKnow', c.what_we_dont_know,
    'underInvestigation', c.under_investigation, 'risks', c.risks, 'limitations', c.limitations,
    'researchDoses', c.research_doses,
    'studyIds', coalesce((select jsonb_agg(cs.study_id) from public.claim_studies cs where cs.claim_id = c.id), '[]'::jsonb),
    'citations', public.hn_citations('evidence_claims', c.id),
    'reviewStatus', c.review_status, 'reviewedAt', c.reviewed_at, 'reviewedBy', public.hn_reviewer_name(c.reviewed_by),
    'updatedAt', public.hn_date(c.updated_at),
    'subject', public.hn_entity_ref(c.subject_id),
    'condition', public.hn_entity_ref(c.condition_id),
    'sources', public.hn_sources_for('evidence_claims', array[c.id]))
$$;

create or replace function public.hn_interaction_json(i public.interactions)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', i.id, 'agentId', i.agent_id, 'medicationId', i.medication_id, 'kind', i.kind, 'severity', i.severity,
    'effect', i.effect, 'mechanism', i.mechanism, 'level', i.level,
    'citations', public.hn_citations('interactions', i.id),
    'reviewStatus', i.review_status, 'reviewedAt', i.reviewed_at, 'reviewedBy', public.hn_reviewer_name(i.reviewed_by),
    'updatedAt', public.hn_date(i.updated_at),
    'agent', public.hn_entity_ref(i.agent_id), 'medication', public.hn_entity_ref(i.medication_id),
    'sources', public.hn_sources_for('interactions', array[i.id]))
$$;

create or replace function public.api_list_claims(
  p_subject_ids uuid[] default null,
  p_condition_ids uuid[] default null,
  p_contexts claim_context[] default null,
  p_cancer_only boolean default false,
  p_subject_types entity_type[] default null
) returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.hn_claim_json(c) order by c.created_at, c.id), '[]'::jsonb)
  from public.evidence_claims c
  join public.entities s on s.id = c.subject_id and s.published and s.review_status <> 'rejected'
  where c.review_status <> 'rejected'
    and (p_subject_ids is null or c.subject_id = any (p_subject_ids))
    and (p_condition_ids is null or c.condition_id = any (p_condition_ids))
    and (p_contexts is null or c.context = any (p_contexts))
    and (not p_cancer_only or exists (select 1 from public.conditions k where k.entity_id = c.condition_id and k.is_cancer))
    and (p_subject_types is null or s.entity_type = any (p_subject_types))
$$;

create or replace function public.api_list_interactions(p_medication_id uuid default null, p_agent_ids uuid[] default null)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.hn_interaction_json(i) order by i.created_at, i.id), '[]'::jsonb)
  from public.interactions i
  where i.review_status <> 'rejected'
    and public.hn_entity_ref(i.agent_id) is not null and public.hn_entity_ref(i.medication_id) is not null
    and (p_medication_id is null or i.medication_id = p_medication_id)
    and (p_agent_ids is null or i.agent_id = any (p_agent_ids))
$$;

create or replace function public.api_list_relations(p_ids uuid[])
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'subjectId', r.subject_id, 'predicate', r.predicate, 'objectId', r.object_id, 'note', r.note,
    'citations', public.hn_citations('entity_relations', r.id), 'reviewStatus', r.review_status,
    'subject', public.hn_entity_ref(r.subject_id), 'object', public.hn_entity_ref(r.object_id)
  ) order by r.created_at, r.id), '[]'::jsonb)
  from public.entity_relations r
  where r.review_status <> 'rejected'
    and (r.subject_id = any (p_ids) or r.object_id = any (p_ids))
    and public.hn_entity_ref(r.subject_id) is not null and public.hn_entity_ref(r.object_id) is not null
$$;

create or replace function public.api_traditional_uses(p_region_slugs text[] default null, p_entity_id uuid default null)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'entityId', t.entity_id, 'regionSlug', r.slug, 'culture', t.culture, 'use', t.use,
    'preparation', t.preparation, 'partUsed', t.part_used, 'documentation', t.documentation,
    'citations', public.hn_citations('traditional_knowledge', t.id),
    'reviewStatus', t.review_status, 'reviewedAt', t.reviewed_at, 'reviewedBy', public.hn_reviewer_name(t.reviewed_by),
    'updatedAt', public.hn_date(t.updated_at),
    'entity', public.hn_entity_ref(t.entity_id), 'region', public.hn_region_json(t.region_id),
    'sources', public.hn_sources_for('traditional_knowledge', array[t.id])
  ) order by t.created_at, t.id), '[]'::jsonb)
  from public.traditional_knowledge t
  join public.regions r on r.id = t.region_id
  where t.review_status <> 'rejected'
    and public.hn_entity_ref(t.entity_id) is not null
    and (p_region_slugs is null or r.slug = any (p_region_slugs))
    and (p_entity_id is null or t.entity_id = p_entity_id)
$$;

create or replace function public.hn_study_json(s public.studies)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id, 'title', s.title, 'authors', to_jsonb(s.authors), 'year', s.year, 'journal', s.journal, 'type', s.study_type,
    'population', s.population, 'sampleSize', s.sample_size, 'intervention', s.intervention, 'comparator', s.comparator,
    'outcome', s.outcome, 'result', s.result, 'limitations', s.limitations, 'country', s.country,
    'doi', s.doi, 'pmid', s.pmid, 'nctId', s.nct_id, 'url', s.url,
    'entityIds', coalesce((select jsonb_agg(se.entity_id) from public.study_entities se join public.entities e on e.id = se.entity_id
                           where se.study_id = s.id and e.entity_type <> 'condition'), '[]'::jsonb),
    'conditionIds', coalesce((select jsonb_agg(se.entity_id) from public.study_entities se join public.entities e on e.id = se.entity_id
                              where se.study_id = s.id and e.entity_type = 'condition'), '[]'::jsonb),
    'reviewStatus', s.review_status, 'reviewedAt', s.reviewed_at, 'reviewedBy', public.hn_reviewer_name(s.reviewed_by),
    'updatedAt', public.hn_date(s.updated_at))
$$;

create or replace function public.api_list_studies(
  p_entity_ids uuid[] default null,
  p_condition_ids uuid[] default null,
  p_types study_type[] default null,
  p_year_from int default null,
  p_year_to int default null,
  p_country text default null,
  p_q text default null,
  p_limit int default 100
) returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.hn_study_json(s) order by s.year desc, s.id), '[]'::jsonb)
  from (
    select * from public.studies s
    where s.review_status <> 'rejected'
      and (p_entity_ids is null or exists (select 1 from public.study_entities se where se.study_id = s.id and se.entity_id = any (p_entity_ids)))
      and (p_condition_ids is null or exists (select 1 from public.study_entities se where se.study_id = s.id and se.entity_id = any (p_condition_ids)))
      and (p_types is null or s.study_type = any (p_types))
      and (p_year_from is null or s.year >= p_year_from)
      and (p_year_to is null or s.year <= p_year_to)
      and (p_country is null or s.country = p_country)
      and (p_q is null or public.hn_normalize(s.title) like '%' || public.hn_normalize(p_q) || '%')
    order by s.year desc, s.id
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ) s
$$;

/* ------------------------------------------------------- entry points */

create or replace function public.api_entity(p_slug text)
returns jsonb language sql stable set search_path = '' as $$
  select public.hn_entity_json(e.id) from public.entities e where e.slug = p_slug
$$;

create or replace function public.api_entity_refs(p_ids uuid[])
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.hn_entity_ref(x.id) order by x.ord), '[]'::jsonb)
  from unnest(p_ids) with ordinality as x(id, ord)
  where public.hn_entity_ref(x.id) is not null
$$;

create or replace function public.api_entity_detail(p_slug text)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  e public.entities;
  v_entity jsonb;
  v_relations jsonb;
  v_claims jsonb;
  v_interactions jsonb;
  v_traditional jsonb;
  v_studies jsonb;
  v_contained uuid[];
  v_source_ids uuid[];
begin
  select * into e from public.entities where slug = p_slug and published and review_status <> 'rejected';
  if not found then
    return null;
  end if;
  v_entity := public.hn_entity_json(e.id);
  v_relations := public.api_list_relations(array[e.id]);
  select coalesce(array_agg((x ->> 'objectId')::uuid), '{}') into v_contained
  from jsonb_array_elements(v_relations) x
  where (x ->> 'subjectId')::uuid = e.id and x ->> 'predicate' = 'contains';

  if e.entity_type = 'condition' then
    v_claims := public.api_list_claims(p_condition_ids => array[e.id]);
  else
    v_claims := public.api_list_claims(p_subject_ids => array[e.id] || v_contained);
  end if;
  if e.entity_type = 'medication' then
    v_interactions := public.api_list_interactions(p_medication_id => e.id);
  else
    v_interactions := public.api_list_interactions(p_agent_ids => array[e.id]);
  end if;
  select coalesce(jsonb_agg(x - 'entity'), '[]'::jsonb) into v_traditional
  from jsonb_array_elements(public.api_traditional_uses(p_entity_id => e.id)) x;
  v_studies := public.api_list_studies(p_entity_ids => array[e.id]);

  select coalesce(array_agg(distinct c.source_id), '{}') into v_source_ids
  from public.citations c
  where (c.target_table = 'entities' and c.target_id = e.id)
     or (c.target_table = 'safety_warnings' and c.target_id in (select id from public.safety_warnings where entity_id = e.id and review_status <> 'rejected'))
     or (c.target_table = 'evidence_claims' and c.target_id in (select (x ->> 'id')::uuid from jsonb_array_elements(v_claims) x))
     or (c.target_table = 'interactions' and c.target_id in (select (x ->> 'id')::uuid from jsonb_array_elements(v_interactions) x))
     or (c.target_table = 'traditional_knowledge' and c.target_id in (select (x ->> 'id')::uuid from jsonb_array_elements(v_traditional) x));

  return jsonb_build_object(
    'entity', v_entity,
    'relations', v_relations,
    'claims', v_claims,
    'interactions', v_interactions,
    'traditionalUses', v_traditional,
    'studies', v_studies,
    'sources', coalesce((select jsonb_agg(public.hn_source_json(s) order by s.key) from public.sources s where s.id = any (v_source_ids)), '[]'::jsonb)
  );
end;
$$;

create or replace function public.api_list_entities(
  p_type entity_type default null,
  p_tag text default null,
  p_region text default null,
  p_limit int default 200,
  p_offset int default 0
) returns jsonb language sql stable set search_path = '' as $$
  with base as (
    select e.id, e.name from public.entities e
    where e.published and e.review_status <> 'rejected'
      and (p_type is null or e.entity_type = p_type)
      and (p_tag is null or p_tag = any (e.tags))
      and (p_region is null or exists (select 1 from public.entity_regions er join public.regions r on r.id = er.region_id
                                       where er.entity_id = e.id and r.slug = p_region))
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'items', coalesce((select jsonb_agg(public.hn_entity_summary(b.id) order by public.hn_normalize(b.name ->> 'es'))
                       from (select * from base order by public.hn_normalize(name ->> 'es')
                             limit least(greatest(coalesce(p_limit, 200), 1), 10000) offset greatest(coalesce(p_offset, 0), 0)) b), '[]'::jsonb))
$$;

create or replace function public.api_full_text_search(p_q text, p_types entity_type[] default null, p_limit int default 20)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  nq text := public.hn_normalize(p_q);
  tokens text;
  q tsquery;
begin
  select string_agg(t || ':*', ' | ') into tokens from unnest(string_to_array(nq, ' ')) t where length(t) > 1;
  if tokens is null then
    return '[]'::jsonb;
  end if;
  q := to_tsquery('simple', tokens) || to_tsquery('spanish', tokens) || to_tsquery('english', tokens);
  return coalesce((
    select jsonb_agg(public.hn_entity_summary(x.entity_id) order by x.rank desc)
    from (
      select d.entity_id, ts_rank_cd(d.tsv, q) + extensions.word_similarity(nq, d.names) as rank
      from public.search_documents d
      join public.entities e on e.id = d.entity_id and e.published and e.review_status <> 'rejected'
      where (d.tsv @@ q or nq operator(extensions.<%) d.names)
        and (p_types is null or d.entity_type = any (p_types))
      order by rank desc
      limit least(greatest(coalesce(p_limit, 20), 1), 100)
    ) x
  ), '[]'::jsonb);
end;
$$;

-- Recognition lexicon. Rows (not one JSON document) so PostgREST can stream/paginate.
create or replace function public.api_lexicon()
returns table (entity_id uuid, type entity_type, slug text, name jsonb, term text, kind text)
language sql stable set search_path = '' as $$
  select e.id, e.entity_type, e.slug, e.name, n.value, 'name'
  from public.entities e, jsonb_each_text(e.name) n
  where e.published and e.review_status <> 'rejected'
  union all
  select e.id, e.entity_type, e.slug, e.name, e.scientific_name, 'scientific'
  from public.entities e where e.scientific_name is not null and e.published and e.review_status <> 'rejected'
  union all
  select e.id, e.entity_type, e.slug, e.name, array_to_string((string_to_array(e.scientific_name, ' '))[1:2], ' '), 'scientific'
  from public.entities e where e.scientific_name like '% % %' and e.published and e.review_status <> 'rejected'
  union all
  select e.id, e.entity_type, e.slug, e.name, a.name, case when a.kind = 'scientific_synonym' then 'scientific' else 'alias' end
  from public.entity_aliases a join public.entities e on e.id = a.entity_id
  where e.published and e.review_status <> 'rejected'
  union all
  select e.id, e.entity_type, e.slug, e.name, array_to_string((string_to_array(s.syn, ' '))[1:2], ' '), 'scientific'
  from public.plants p join public.entities e on e.id = p.entity_id, unnest(p.synonyms) as s(syn)
  where e.published and e.review_status <> 'rejected'
$$;

create or replace function public.api_regions(p_parent_slug text default null, p_level region_level default null)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.hn_region_json(r.id) order by r.level, r.code nulls last, public.hn_normalize(r.name ->> 'es')), '[]'::jsonb)
  from public.regions r left join public.regions p on p.id = r.parent_id
  where (p_parent_slug is null or p.slug = p_parent_slug) and (p_level is null or r.level = p_level)
$$;

create or replace function public.api_sources()
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(public.hn_source_json(s) order by s.kind, s.title), '[]'::jsonb) from public.sources s
$$;

create or replace function public.api_stats()
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'entities', (select jsonb_object_agg(t, (select count(*) from public.entities e where e.entity_type = t::public.entity_type and e.published and e.review_status <> 'rejected'))
                 from unnest(enum_range(null::public.entity_type)) t),
    'claims', (select count(*) from public.evidence_claims where review_status <> 'rejected'),
    'interactions', (select count(*) from public.interactions where review_status <> 'rejected'),
    'traditionalUses', (select count(*) from public.traditional_knowledge where review_status <> 'rejected'),
    'studies', (select count(*) from public.studies where review_status <> 'rejected'),
    'sources', (select count(*) from public.sources),
    'byStatus', (select jsonb_object_agg(st, (
        (select count(*) from public.entities where review_status = st) +
        (select count(*) from public.evidence_claims where review_status = st) +
        (select count(*) from public.interactions where review_status = st) +
        (select count(*) from public.traditional_knowledge where review_status = st)))
      from unnest(enum_range(null::public.review_status)) st))
$$;

-- Staff only (RLS hides other users' pending rows anyway; this adds an explicit check).
create or replace function public.api_review_queue()
returns jsonb language plpgsql stable set search_path = '' as $$
begin
  if not public.is_staff() then
    raise exception 'staff only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(q order by q ->> 'updatedAt' desc)
    from (
      select jsonb_build_object('table', 'evidence_claims', 'id', c.id,
        'title', (s.name ->> 'es') || ' → ' || coalesce(k.name ->> 'es', '—') || ' (' || c.context || ', nivel ' || c.level || ')',
        'subtitle', c.statement ->> 'es', 'status', c.review_status, 'updatedAt', c.updated_at,
        'sourceCount', (select count(*) from public.citations ci where ci.target_table = 'evidence_claims' and ci.target_id = c.id)) q
      from public.evidence_claims c join public.entities s on s.id = c.subject_id left join public.entities k on k.id = c.condition_id
      where c.review_status = 'pending_review'
      union all
      select jsonb_build_object('table', 'interactions', 'id', i.id,
        'title', (a.name ->> 'es') || ' × ' || (m.name ->> 'es') || ' (' || i.kind || ')',
        'subtitle', i.effect ->> 'es', 'status', i.review_status, 'updatedAt', i.updated_at,
        'sourceCount', (select count(*) from public.citations ci where ci.target_table = 'interactions' and ci.target_id = i.id))
      from public.interactions i join public.entities a on a.id = i.agent_id join public.entities m on m.id = i.medication_id
      where i.review_status = 'pending_review'
      union all
      select jsonb_build_object('table', 'traditional_knowledge', 'id', t.id,
        'title', (e.name ->> 'es') || ' — uso tradicional (' || r.slug || ')',
        'subtitle', t.use ->> 'es', 'status', t.review_status, 'updatedAt', t.updated_at,
        'sourceCount', (select count(*) from public.citations ci where ci.target_table = 'traditional_knowledge' and ci.target_id = t.id))
      from public.traditional_knowledge t join public.entities e on e.id = t.entity_id join public.regions r on r.id = t.region_id
      where t.review_status = 'pending_review'
      union all
      select jsonb_build_object('table', 'study_candidates', 'id', sc.id, 'title', sc.title,
        'subtitle', concat_ws(' · ', sc.journal, sc.year::text, 'PMID ' || sc.pmid), 'status', sc.status, 'updatedAt', sc.created_at,
        'sourceCount', 1, 'href', 'https://pubmed.ncbi.nlm.nih.gov/' || sc.pmid || '/')
      from public.study_candidates sc where sc.status = 'pending_review'
      union all
      select jsonb_build_object('table', 'ai_drafts', 'id', d.id, 'title', 'Borrador IA: ' || d.target_table,
        'subtitle', left(d.payload::text, 200), 'status', d.status, 'updatedAt', d.created_at, 'sourceCount', 0)
      from public.ai_drafts d where d.status = 'pending_review'
    ) s(q)
  ), '[]'::jsonb);
end;
$$;

grant execute on all functions in schema public to anon, authenticated;

-- Internal / maintenance functions are not part of the public API.
revoke execute on function public.purge_old_ai_queries() from anon, authenticated, public;
revoke execute on function public.refresh_search_document(uuid) from anon, authenticated, public;
