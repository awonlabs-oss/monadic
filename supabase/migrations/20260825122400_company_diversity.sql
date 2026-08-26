-- monadic — cap how many roles one company can take on a page
--
-- With 94 companies the feed has plenty of variety available, but strict
-- newest-first ordering does not surface it: a company posting 400 roles
-- outranks 90 companies posting three each, simply by volume. The first page
-- ends up being a survey of one company's hiring rather than of the market.
--
-- Ordering by ceil(rank_within_company / N) interleaves instead. Every
-- company's newest N roles come first, ordered by date among themselves, then
-- everyone's next N, and so on. With N = 3 and 24 to a page, a page holds at
-- least eight companies and usually far more.
--
-- Nothing is hidden — every posting is still reachable, just later. The
-- alternative, ranking purely by date, is defensible too, which is why it stays
-- available as p_diversify = false rather than being removed.

drop function if exists public.search_jobs(
  text, int, int, boolean, numeric, boolean, text[], text[], text[], boolean, boolean, boolean, int, int, int
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
  p_companies             text[]  default null,
  p_saved_only            boolean default false,
  p_search_descriptions   boolean default false,
  p_us_only               boolean default true,
  p_posted_within         int     default null,
  p_diversify             boolean default true,
  p_per_company           int     default 3,
  p_limit                 int     default 24,
  p_offset                int     default 0
)
returns table (
  id uuid, company_name text, company_slug text, company_logo_url text,
  title text, url text, department text, employment_type text,
  location_raw text, location_cities text[], remote_policy text,
  comp_min numeric, comp_max numeric, comp_currency text, comp_period text, comp_source text,
  years_min smallint, years_max smallint, years_source text,
  posted_at timestamptz, first_seen_at timestamptz,
  interaction_state text, application_id uuid, total_count bigint
)
language sql stable security invoker set search_path = ''
as $$
  with q as (
    select
      nullif(btrim(coalesce(p_query, '')), '') as term,
      case when nullif(btrim(coalesce(p_query, '')), '') is null then null
           else websearch_to_tsquery('english', nullif(btrim(coalesce(p_query, '')), '')) end as tsq
  ),
  matched as (
    select f.*, j.location_cities as cities,
      case when (select term from q) is null then 0::real
        else (case when f.title ilike '%' || (select term from q) || '%' then 3 else 0 end)
          + extensions.similarity(f.title, (select term from q)) * 2
          + ts_rank(to_tsvector('english', f.title), (select tsq from q)) * 2
          + case when p_search_descriptions then ts_rank(j.search_tsv, (select tsq from q)) else 0 end
      end as rank
    from public.job_feed f
    join public.jobs j on j.id = f.id
    where f.is_open
      and f.interaction_state <> 'dismissed'
      and (not p_us_only or j.us_eligible)
      and (p_cities is null or j.location_cities && p_cities)
      and (p_companies is null or f.company_slug = any(p_companies))
      and (p_posted_within is null or f.posted_at >= now() - make_interval(days => p_posted_within))
      and ((select term from q) is null
           or f.title ilike '%' || (select term from q) || '%'
           or to_tsvector('english', f.title) @@ (select tsq from q)
           or extensions.similarity(f.title, (select term from q)) > 0.3
           or (p_search_descriptions and j.search_tsv @@ (select tsq from q)))
      and (p_remote is null or f.remote_policy = any(p_remote))
      and (not p_saved_only or f.interaction_state = 'saved')
      and ((p_years_min is null and p_years_max is null)
           or (f.years_source = 'none' and p_include_years_unknown)
           or (f.years_source <> 'none'
               and (p_years_max is null or f.years_min <= p_years_max)
               and (p_years_min is null or coalesce(f.years_max, f.years_min) >= p_years_min)))
      and (p_comp_min is null
           or (f.comp_source = 'none' and p_include_comp_unknown)
           or (f.comp_source <> 'none' and coalesce(f.comp_max, f.comp_min) >= p_comp_min))
  ),
  ranked as (
    select m.*,
      row_number() over (
        partition by m.company_slug
        order by m.posted_at desc nulls last, m.first_seen_at desc, m.id
      ) as within_company
    from matched m
  )
  select r.id, r.company_name, r.company_slug, r.company_logo_url,
    r.title, r.url, r.department, r.employment_type,
    r.location_raw, r.cities, r.remote_policy,
    r.comp_min, r.comp_max, r.comp_currency, r.comp_period, r.comp_source,
    r.years_min, r.years_max, r.years_source,
    r.posted_at, r.first_seen_at, r.interaction_state, r.application_id,
    count(*) over () as total_count
  from ranked r
  order by
    -- A query means the user asked for something specific; relevance wins and
    -- interleaving would only push the best match down the page.
    case when (select term from q) is null then 0 else r.rank end desc,
    case
      when p_diversify and (select term from q) is null
      then ceil(r.within_company::numeric / greatest(p_per_company, 1))
      else 1
    end,
    r.posted_at desc nulls last,
    r.first_seen_at desc,
    r.id
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

grant execute on function public.search_jobs(
  text, int, int, boolean, numeric, boolean, text[], text[], text[], boolean, boolean, boolean, int, boolean, int, int, int
) to authenticated, service_role;
