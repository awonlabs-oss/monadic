-- monadic — filtering, search, and company logos
--
-- Three things:
--   1. companies.logo_url, resolved from each company's own site.
--   2. pg_trgm, so title matching tolerates the way people actually type.
--   3. search_jobs(), one function owning every filter predicate.
--
-- The function exists so the predicate lives in exactly one place. Filters that
-- drift between the list query and the count query produce a feed whose "showing
-- 48 of 300" is a lie, and that is the kind of wrong nobody notices for weeks.
-- It returns the total alongside the rows via a window function, so both come
-- from a single evaluation of a single WHERE clause.

alter table public.companies add column if not exists logo_url text;

comment on column public.companies.logo_url is
  'Absolute URL to the company''s own icon, resolved from their site by scripts/logos.ts. Never a third-party logo provider.';

-- Installed into `extensions`, which is where Supabase keeps them. It matters
-- below: search_jobs pins search_path = '' so nothing resolves implicitly, which
-- means similarity() and gin_trgm_ops must both be schema-qualified.
create extension if not exists pg_trgm with schema extensions;

-- Title similarity, for queries that are close but not exact.
create index if not exists jobs_title_trgm_idx
  on public.jobs using gin (title extensions.gin_trgm_ops);

drop view if exists public.job_feed;

create view public.job_feed
with (security_invoker = true)
as
select
  j.id,
  j.company_id,
  c.name              as company_name,
  c.slug              as company_slug,
  c.logo_url          as company_logo_url,
  j.source,
  j.title,
  j.url,
  j.department,
  j.team,
  j.employment_type,
  j.location_raw,
  j.location_city,
  j.location_region,
  j.location_country,
  j.remote_policy,
  j.role_type,
  j.seniority,
  j.comp_min,
  j.comp_max,
  j.comp_currency,
  j.comp_period,
  j.comp_source,
  j.comp_note,
  j.years_min,
  j.years_max,
  j.years_source,
  j.posted_at,
  j.first_seen_at,
  j.last_seen_at,
  j.closed_at,
  j.is_open,
  coalesce(ji.state, 'none') as interaction_state,
  ji.dismissal_reason_code,
  a.id                       as application_id,
  a.status                   as application_status
from public.jobs j
join public.companies c on c.id = j.company_id
left join public.job_interactions ji
  on ji.job_id = j.id and ji.user_id = (select auth.uid())
left join public.applications a
  on a.job_id = j.id and a.user_id = (select auth.uid());

-- ---------------------------------------------------------------------------
-- search_jobs
-- ---------------------------------------------------------------------------
-- Matching is three-way and deliberately so:
--   * full-text over title and description, for "what is this job about"
--   * trigram similarity on the title, for near-misses and typos
--   * a plain substring match on the title, so a partial word still works
--
-- This is lexical, not semantic. It will not connect "forward deployed" to
-- "solutions engineer" the way an embedding would. True semantic search needs
-- pgvector and an embedding per posting, which is a real addition and sits
-- close to the scoring work that is out of Phase 1 scope.
--
-- Years and compensation both take an explicit include-unknown flag rather than
-- silently dropping rows. 39% of postings state no years and 59% state no pay,
-- so a filter that quietly excluded them would hide most of the feed and look
-- like a bug in ingestion.

create or replace function public.search_jobs(
  p_query                 text    default null,
  p_years_min             int     default null,
  p_years_max             int     default null,
  p_include_years_unknown boolean default true,
  p_comp_min              numeric default null,
  p_include_comp_unknown  boolean default true,
  p_remote                text[]  default null,
  p_company               text    default null,
  p_saved_only            boolean default false,
  p_limit                 int     default 48,
  p_offset                int     default 0
)
returns table (
  id                 uuid,
  company_name       text,
  company_slug       text,
  company_logo_url   text,
  title              text,
  url                text,
  department         text,
  employment_type    text,
  location_raw       text,
  remote_policy      text,
  comp_min           numeric,
  comp_max           numeric,
  comp_currency      text,
  comp_period        text,
  comp_source        text,
  years_min          smallint,
  years_max          smallint,
  years_source       text,
  first_seen_at      timestamptz,
  interaction_state  text,
  application_id     uuid,
  total_count        bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select nullif(btrim(coalesce(p_query, '')), '') as term
  ),
  matched as (
    select
      f.*,
      case
        when (select term from q) is null then 0::real
        else
          ts_rank(j.search_tsv, websearch_to_tsquery('english', (select term from q)))
          + extensions.similarity(f.title, (select term from q)) * 2
      end as rank
    from public.job_feed f
    join public.jobs j on j.id = f.id
    where f.is_open
      and f.interaction_state <> 'dismissed'
      and ((select term from q) is null
           or j.search_tsv @@ websearch_to_tsquery('english', (select term from q))
           or f.title ilike '%' || (select term from q) || '%'
           or extensions.similarity(f.title, (select term from q)) > 0.25)
      and (p_company is null or f.company_slug = p_company)
      and (p_remote is null or f.remote_policy = any(p_remote))
      and (not p_saved_only or f.interaction_state = 'saved')
      and (
        (p_years_min is null and p_years_max is null)
        or (f.years_source = 'none' and p_include_years_unknown)
        or (
          f.years_source <> 'none'
          and (p_years_max is null or f.years_min <= p_years_max)
          and (p_years_min is null or coalesce(f.years_max, f.years_min) >= p_years_min)
        )
      )
      and (
        p_comp_min is null
        or (f.comp_source = 'none' and p_include_comp_unknown)
        or (f.comp_source <> 'none' and coalesce(f.comp_max, f.comp_min) >= p_comp_min)
      )
  )
  select
    m.id, m.company_name, m.company_slug, m.company_logo_url,
    m.title, m.url, m.department, m.employment_type,
    m.location_raw, m.remote_policy,
    m.comp_min, m.comp_max, m.comp_currency, m.comp_period, m.comp_source,
    m.years_min, m.years_max, m.years_source,
    m.first_seen_at, m.interaction_state, m.application_id,
    count(*) over () as total_count
  from matched m
  order by
    case when (select term from q) is null then 0 else 1 end desc,
    m.rank desc,
    m.first_seen_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.search_jobs(
  text, int, int, boolean, numeric, boolean, text[], text, boolean, int, int
) to authenticated, service_role;
