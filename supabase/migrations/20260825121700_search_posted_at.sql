-- monadic — return posted_at from search_jobs
--
-- The redesigned feed card replaces the relative age ("2d") with an absolute
-- posted date ("Posted 21 Aug"). That wants the ATS's own publication date
-- rather than first_seen_at, which only records when ingestion first noticed a
-- posting — for the first run of a new board those are the same day for
-- everything, which would make every card claim to have been posted today.
--
-- posted_at is nullable: Lever supplies createdAt, Ashby publishedAt,
-- Greenhouse first_published, but any of them can be absent. The card falls
-- back to first_seen_at and says "Seen" instead of "Posted", so the label never
-- claims more than is known.

-- Dropped first: CREATE OR REPLACE cannot change a function's return type, and
-- adding a column to RETURNS TABLE does exactly that.
drop function if exists public.search_jobs(
  text, int, int, boolean, numeric, boolean, text[], text, boolean, boolean, int, int
);

create function public.search_jobs(
  p_query                 text    default null,
  p_years_min             int     default null,
  p_years_max             int     default null,
  p_include_years_unknown boolean default true,
  p_comp_min              numeric default null,
  p_include_comp_unknown  boolean default true,
  p_remote                text[]  default null,
  p_company               text    default null,
  p_saved_only            boolean default false,
  p_search_descriptions   boolean default false,
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
    m.location_raw, m.remote_policy,
    m.comp_min, m.comp_max, m.comp_currency, m.comp_period, m.comp_source,
    m.years_min, m.years_max, m.years_source,
    m.posted_at, m.first_seen_at, m.interaction_state, m.application_id,
    count(*) over () as total_count
  from matched m
  order by m.rank desc, m.first_seen_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.search_jobs(
  text, int, int, boolean, numeric, boolean, text[], text, boolean, boolean, int, int
) to authenticated, service_role;
