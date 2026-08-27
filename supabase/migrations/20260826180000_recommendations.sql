-- monadic — the recommendation feed
--
-- Splits the single feed in two. /jobs stays as it is: everything, searched and
-- filtered. /for-you ranks the same corpus against stated criteria.
--
-- The whole design rests on one distinction: a criterion is *applicable* to a
-- job only when the job says something about it. 38% of open postings state no
-- pay and 27% no years, so scoring a silent job as a miss would rank it below a
-- job that stated its terms and failed them — punishing the posting for being
-- quiet rather than for being wrong. Silence is neutral: it neither matches nor
-- counts against, and the denominator shrinks instead.
--
-- Nothing here is a black box. The function returns which criteria matched, not
-- a score, so the card can say "matches 4 of 5" and the detail page can list
-- exactly which four.

-- ---------------------------------------------------------------------------
-- Criteria the existing table cannot express
-- ---------------------------------------------------------------------------
-- seniority_ceiling is free text and cannot be compared against jobs.years_min,
-- so the band it was standing in for becomes two integers beside it.

alter table public.search_criteria
  add column if not exists years_min             smallint,
  add column if not exists years_max             smallint,
  -- Mirrors include_missing_comp, which already exists and already defaults to
  -- the neutral behaviour.
  add column if not exists include_missing_years boolean not null default true,
  -- The window /for-you draws from. 60 days is a shade over the median posting
  -- age (51 days) — deep enough to rank from, shallow enough to exclude the
  -- long tail of postings that have been open for years.
  add column if not exists recency_days          smallint not null default 60;

alter table public.search_criteria
  add constraint search_criteria_years_order_ck
  check (years_min is null or years_max is null or years_min <= years_max);

comment on column public.search_criteria.company_stages is
  'Not evaluated. No ATS returns company stage and there is no column on companies '
  'holding it; the only sources are paid providers the brief rules out. Kept so the '
  'criterion can be stated, and ignored by recommend_jobs until there is data.';

-- ---------------------------------------------------------------------------
-- recommend_jobs
-- ---------------------------------------------------------------------------
-- Criteria arrive as parameters rather than being read from search_criteria
-- inside the function, matching search_jobs. It keeps the function stateless and
-- testable — a score can be checked against a hand-built criteria set without
-- writing a row first.

create function public.recommend_jobs(
  p_roles           text[]  default null,
  p_years_min       int     default null,
  p_years_max       int     default null,
  p_comp_floor      numeric default null,
  p_cities          text[]  default null,
  p_remote          text[]  default null,
  p_us_only         boolean default true,
  p_recency_days    int     default 60,
  -- Saved and tracked jobs have been decided on. Leaving them in the feed means
  -- the same postings greet you every visit while new ones sit below them.
  p_exclude_engaged boolean default true,
  -- A job matching nothing is not a recommendation. The caller passes 0 when no
  -- criteria are set at all, where every job would otherwise score zero.
  p_min_matched     int     default 1,
  p_limit           int     default 25,
  p_offset          int     default 0
)
returns table (
  id uuid, company_name text, company_slug text, company_logo_url text,
  title text, url text, department text, employment_type text,
  location_raw text, location_cities text[], remote_policy text,
  comp_min numeric, comp_max numeric, comp_currency text, comp_period text, comp_source text,
  years_min smallint, years_max smallint, years_source text,
  posted_at timestamptz, first_seen_at timestamptz,
  interaction_state text, application_id uuid,
  matched int, applicable int, matched_keys text[], total_count bigint
)
language sql stable security invoker set search_path = ''
as $$
  with eligible as (
    select f.*, j.location_cities as cities
    from public.job_feed f
    join public.jobs j on j.id = f.id
    where f.is_open
      and f.interaction_state <> 'dismissed'
      and (not p_us_only or j.us_eligible)
      and (p_recency_days is null
           or f.posted_at >= now() - make_interval(days => p_recency_days))
      and (not p_exclude_engaged
           or (f.interaction_state <> 'saved' and f.application_id is null))
  ),
  scored as (
    select e.*,
      -- Role. The only criterion applicable to every job, because every job has
      -- a title. Three ways to match, because 6,666 open postings carry 5,251
      -- distinct titles and there is no taxonomy to match against: a substring
      -- for the obvious case, trigram similarity for near-misses and word
      -- order, and a stemmed match so "engineering" finds "engineer".
      (p_roles is not null and cardinality(p_roles) > 0) as role_applicable,
      (p_roles is not null and cardinality(p_roles) > 0 and exists (
        select 1 from unnest(p_roles) as r
        where e.title ilike '%' || r || '%'
           or extensions.similarity(e.title, r) > 0.35
           or to_tsvector('english', e.title) @@ plainto_tsquery('english', r)
      )) as role_matched,

      (p_years_min is not null or p_years_max is not null)
        and e.years_source <> 'none' as years_applicable,
      ((p_years_min is not null or p_years_max is not null)
        and e.years_source <> 'none'
        -- Overlap, not containment: a role wanting 3–7 years is open to someone
        -- targeting 0–5.
        and (p_years_max is null or e.years_min <= p_years_max)
        and (p_years_min is null or coalesce(e.years_max, e.years_min) >= p_years_min)
      ) as years_matched,

      (p_comp_floor is not null and e.comp_source <> 'none') as comp_applicable,
      (p_comp_floor is not null and e.comp_source <> 'none'
        and coalesce(e.comp_max, e.comp_min) >= p_comp_floor) as comp_matched,

      (p_cities is not null and cardinality(p_cities) > 0
        and e.cities is not null and cardinality(e.cities) > 0) as city_applicable,
      (p_cities is not null and cardinality(p_cities) > 0
        and e.cities is not null and e.cities && p_cities) as city_matched,

      (p_remote is not null and cardinality(p_remote) > 0
        and e.remote_policy is not null) as remote_applicable,
      (p_remote is not null and cardinality(p_remote) > 0
        and e.remote_policy = any(p_remote)) as remote_matched
    from eligible e
  ),
  totalled as (
    select s.*,
      (s.role_matched::int + s.years_matched::int + s.comp_matched::int
        + s.city_matched::int + s.remote_matched::int) as n_matched,
      (s.role_applicable::int + s.years_applicable::int + s.comp_applicable::int
        + s.city_applicable::int + s.remote_applicable::int) as n_applicable,
      array_remove(array[
        case when s.role_matched   then 'role'   end,
        case when s.years_matched  then 'years'  end,
        case when s.comp_matched   then 'comp'   end,
        case when s.city_matched   then 'city'   end,
        case when s.remote_matched then 'remote' end
      ], null) as keys
    from scored s
  )
  select t.id, t.company_name, t.company_slug, t.company_logo_url,
    t.title, t.url, t.department, t.employment_type,
    t.location_raw, t.cities, t.remote_policy,
    t.comp_min, t.comp_max, t.comp_currency, t.comp_period, t.comp_source,
    t.years_min, t.years_max, t.years_source,
    t.posted_at, t.first_seen_at, t.interaction_state, t.application_id,
    t.n_matched, t.n_applicable, t.keys,
    count(*) over () as total_count
  from totalled t
  where t.n_matched >= p_min_matched
  order by
    -- Absolute matches before the ratio, deliberately. Ranking by ratio alone
    -- puts a job matching 1 of 1 above one matching 4 of 5, which is backwards:
    -- the second is the better role and the first merely said less. Ordering by
    -- count first also rewards postings that state their terms at all.
    t.n_matched desc,
    (t.n_matched::numeric / nullif(t.n_applicable, 0)) desc nulls last,
    t.posted_at desc nulls last, t.first_seen_at desc, t.id
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

grant execute on function public.recommend_jobs(
  text[], int, int, numeric, text[], text[], boolean, int, boolean, int, int, int
) to authenticated, service_role;
