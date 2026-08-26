-- monadic — US scope, city filter, recency window; sort reduced to one ordering
--
-- Three changes to the feed query.
--
-- 1. p_us_only, defaulting true. 762 of 2,380 open postings are not US roles.
--    The rows stay in the database — nothing is discarded at ingestion — so
--    widening scope later is a parameter, not a re-ingest.
--
-- 2. p_cities, matching against the parsed array. A posting routinely names
--    several cities and any of them should match.
--
-- 3. p_posted_within, in days. "Posted today / this week / this month" select a
--    subset rather than reorder one, so they are a filter; the feed keeps a
--    single ordering underneath, newest posted first.
--
-- The pay sort is gone. Ordering by pay put every posting that states a salary
-- above every posting that does not, which is 59% of the feed pushed below the
-- fold for a reason that has nothing to do with the job. Pay is a filter.

drop function if exists public.search_jobs(
  text, int, int, boolean, numeric, boolean, text[], text, boolean, boolean, text, int, int
);

create function public.search_jobs(
  p_query                 text    default null,
  p_years_min             int     default null,
  p_years_max             int     default null,
  p_include_years_unknown boolean default true,
  p_comp_min              numeric default null,
  p_include_comp_unknown  boolean default true,
  p_remote                text[]  default null,
  p_cities                text[]  default null,
  p_company               text    default null,
  p_saved_only            boolean default false,
  p_search_descriptions   boolean default false,
  p_us_only               boolean default true,
  p_posted_within         int     default null,
  p_limit                 int     default 24,
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
  location_cities    text[],
  remote_policy      text,
  comp_min           numeric,
  comp_max           numeric,
  comp_currency      text,
  comp_period        text,
  comp_source        text,
  years_min          smallint,
  years_max          smallint,
  years_source       text,
  posted_at          timestamptz,
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
    select
      nullif(btrim(coalesce(p_query, '')), '') as term,
      case
        when nullif(btrim(coalesce(p_query, '')), '') is null then null
        else websearch_to_tsquery('english', nullif(btrim(coalesce(p_query, '')), ''))
      end as tsq
  ),
  matched as (
    select
      f.*,
      j.location_cities as cities,
      case
        when (select term from q) is null then 0::real
        else
          (case when f.title ilike '%' || (select term from q) || '%' then 3 else 0 end)
          + extensions.similarity(f.title, (select term from q)) * 2
          + ts_rank(to_tsvector('english', f.title), (select tsq from q)) * 2
          + case
              when p_search_descriptions
              then ts_rank(j.search_tsv, (select tsq from q))
              else 0
            end
      end as rank
    from public.job_feed f
    join public.jobs j on j.id = f.id
    where f.is_open
      and f.interaction_state <> 'dismissed'
      and (not p_us_only or j.us_eligible)
      and (p_cities is null or j.location_cities && p_cities)
      and (p_posted_within is null
           or f.posted_at >= now() - make_interval(days => p_posted_within))
      and (
        (select term from q) is null
        or f.title ilike '%' || (select term from q) || '%'
        or to_tsvector('english', f.title) @@ (select tsq from q)
        or extensions.similarity(f.title, (select term from q)) > 0.3
        or (p_search_descriptions and j.search_tsv @@ (select tsq from q))
      )
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
    m.location_raw, m.cities, m.remote_policy,
    m.comp_min, m.comp_max, m.comp_currency, m.comp_period, m.comp_source,
    m.years_min, m.years_max, m.years_source,
    m.posted_at, m.first_seen_at, m.interaction_state, m.application_id,
    count(*) over () as total_count
  from matched m
  order by
    case when (select term from q) is null then 0 else m.rank end desc,
    m.posted_at desc nulls last,
    m.first_seen_at desc,
    m.id
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.search_jobs(
  text, int, int, boolean, numeric, boolean, text[], text[], text, boolean, boolean, boolean, int, int, int
) to authenticated, service_role;

-- ---------------------------------------------------------------------------

drop function if exists public.job_facets(
  text, int, int, boolean, numeric, boolean, text[], text, boolean
);

create function public.job_facets(
  p_query                 text    default null,
  p_years_min             int     default null,
  p_years_max             int     default null,
  p_include_years_unknown boolean default true,
  p_comp_min              numeric default null,
  p_include_comp_unknown  boolean default true,
  p_remote                text[]  default null,
  p_cities                text[]  default null,
  p_company               text    default null,
  p_search_descriptions   boolean default false,
  p_us_only               boolean default true,
  p_posted_within         int     default null
)
returns table (dimension text, key text, n bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select
      nullif(btrim(coalesce(p_query, '')), '') as term,
      case
        when nullif(btrim(coalesce(p_query, '')), '') is null then null
        else websearch_to_tsquery('english', nullif(btrim(coalesce(p_query, '')), ''))
      end as tsq
  ),
  base as (
    select f.*, j.location_cities as cities
    from public.job_feed f
    join public.jobs j on j.id = f.id
    where f.is_open
      and f.interaction_state <> 'dismissed'
      and (not p_us_only or j.us_eligible)
      and (
        (select term from q) is null
        or f.title ilike '%' || (select term from q) || '%'
        or to_tsvector('english', f.title) @@ (select tsq from q)
        or extensions.similarity(f.title, (select term from q)) > 0.3
        or (p_search_descriptions and j.search_tsv @@ (select tsq from q))
      )
      and (p_company is null or f.company_slug = p_company)
  ),
  flagged as (
    select
      b.*,
      (
        (p_years_min is null and p_years_max is null)
        or (b.years_source = 'none' and p_include_years_unknown)
        or (
          b.years_source <> 'none'
          and (p_years_max is null or b.years_min <= p_years_max)
          and (p_years_min is null or coalesce(b.years_max, b.years_min) >= p_years_min)
        )
      ) as ok_years,
      (
        p_comp_min is null
        or (b.comp_source = 'none' and p_include_comp_unknown)
        or (b.comp_source <> 'none' and coalesce(b.comp_max, b.comp_min) >= p_comp_min)
      ) as ok_comp,
      (p_remote is null or b.remote_policy = any(p_remote)) as ok_remote,
      (p_cities is null or b.cities && p_cities) as ok_city,
      (p_posted_within is null
        or b.posted_at >= now() - make_interval(days => p_posted_within)) as ok_recency
    from base b
  )
  select 'total'::text, 'all'::text, count(*)::bigint
  from flagged where ok_years and ok_comp and ok_remote and ok_city and ok_recency

  union all
  select 'years', v.key, count(*)::bigint
  from flagged f,
       (values ('0-2', 0, 2), ('3-5', 3, 5), ('6-9', 6, 9), ('10', 10, null::int))
         as v(key, lo, hi)
  where f.ok_comp and f.ok_remote and f.ok_city and f.ok_recency
    and f.years_source <> 'none'
    and (v.hi is null or f.years_min <= v.hi)
    and coalesce(f.years_max, f.years_min) >= v.lo
  group by v.key

  union all
  select 'years', 'unstated', count(*)::bigint
  from flagged where ok_comp and ok_remote and ok_city and ok_recency and years_source = 'none'

  union all
  select 'comp', v.key, count(*)::bigint
  from flagged f,
       (values ('100', 100000), ('150', 150000), ('200', 200000), ('250', 250000))
         as v(key, lo)
  where f.ok_years and f.ok_remote and f.ok_city and f.ok_recency
    and f.comp_source <> 'none'
    and coalesce(f.comp_max, f.comp_min) >= v.lo
  group by v.key

  union all
  select 'comp', 'unlisted', count(*)::bigint
  from flagged where ok_years and ok_remote and ok_city and ok_recency and comp_source = 'none'

  union all
  select 'remote', f.remote_policy, count(*)::bigint
  from flagged f
  where f.ok_years and f.ok_comp and f.ok_city and f.ok_recency and f.remote_policy is not null
  group by f.remote_policy

  union all
  select 'city', city, count(*)::bigint
  from flagged f, unnest(f.cities) as city
  where f.ok_years and f.ok_comp and f.ok_remote and f.ok_recency
  group by city

  union all
  select 'recency', v.key, count(*)::bigint
  from flagged f, (values ('1', 1), ('7', 7), ('30', 30)) as v(key, days)
  where f.ok_years and f.ok_comp and f.ok_remote and f.ok_city
    and f.posted_at >= now() - make_interval(days => v.days)
  group by v.key;
$$;

grant execute on function public.job_facets(
  text, int, int, boolean, numeric, boolean, text[], text[], text, boolean, boolean, int
) to authenticated, service_role;
