-- monadic — make search title-first, with descriptions opt-in
--
-- The first version matched title OR description together. Measured against the
-- real corpus that is not a filter:
--
--   "engineer"  ->  1,907 of 2,380 postings (80%)
--   title only  ->    768
--
-- Almost every engineering posting says "engineer" somewhere in its prose, so
-- folding descriptions into the default made the result set the whole feed
-- while looking like it had filtered something.
--
-- Title is now the default subject. Description search is a deliberate,
-- visible choice, because it is genuinely useful for the other question —
-- "which postings mention Kubernetes" — just not for "show me engineer roles".
--
-- Title matching stays forgiving: substring, English stemming, and trigram
-- similarity. Worth knowing that the stemmer does more work than it appears to:
-- "engineer" and the misspelling "enginer" both stem to "engin", which is why
-- typo tolerance survives even without the trigram arm.

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
          -- An exact substring in the title is the strongest signal a reader
          -- would recognise, so it outweighs everything else.
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
    m.first_seen_at, m.interaction_state, m.application_id,
    count(*) over () as total_count
  from matched m
  order by m.rank desc, m.first_seen_at desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

-- The old 11-argument signature is now shadowed by the 12-argument one and
-- would otherwise linger as a callable duplicate.
drop function if exists public.search_jobs(
  text, int, int, boolean, numeric, boolean, text[], text, boolean, int, int
);

grant execute on function public.search_jobs(
  text, int, int, boolean, numeric, boolean, text[], text, boolean, boolean, int, int
) to authenticated, service_role;
