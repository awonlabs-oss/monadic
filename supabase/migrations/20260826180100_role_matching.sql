-- monadic — fix what counts as a role match, and make the role criterion decisive
--
-- Two faults, both found by running the first version against the real corpus.
--
-- Trigram similarity over the whole title is the wrong instrument for a
-- multi-word role. "solutions engineer" returned 62 titles, and the top of them
-- were "EHS Engineer", "Security Operations Engineer", "Security Engineer" and
-- "Applications Engineer" — none of which are solutions engineering. The shared
-- word "engineer" is most of both strings, so similarity clears any threshold
-- loose enough to also accept the near-misses that matter.
--
-- Requiring every word instead is too strict in the other direction:
-- plainto_tsquery ANDs its lexemes, so "forward deployed engineer" would reject
-- "Deployed Engineer (Federal)" for lacking "forward".
--
-- So the test is the fraction of the role's significant words present in the
-- title, at two thirds or better. "Deployed Engineer" carries two of three and
-- matches; "Security Engineer" carries one of two and does not. Substring and a
-- much stricter trigram survive alongside it, the first for exact phrases and
-- the second for typos.
--
-- Second fault: matching any one criterion admitted 2,040 of 2,497 eligible
-- jobs, because "pays over $130k" is true of a great many roles that are
-- nothing to do with you. Role is the axis the feed is about — the others
-- qualify a role, they do not substitute for one — so when roles are stated, a
-- job has to match one to appear at all.

drop function if exists public.recommend_jobs(
  text[], int, int, numeric, text[], text[], boolean, int, boolean, int, int, int
);

create function public.recommend_jobs(
  p_roles           text[]  default null,
  p_years_min       int     default null,
  p_years_max       int     default null,
  p_comp_floor      numeric default null,
  p_cities          text[]  default null,
  p_remote          text[]  default null,
  p_us_only         boolean default true,
  p_recency_days    int     default 60,
  p_exclude_engaged boolean default true,
  -- Off only for diagnostics, where seeing what the other criteria do on their
  -- own is the point.
  p_require_role    boolean default true,
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
    select f.*, j.location_cities as cities,
      -- Computed once per job rather than once per role word below.
      to_tsvector('english', f.title) as title_tsv
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
      (p_roles is not null and cardinality(p_roles) > 0) as role_applicable,
      (p_roles is not null and cardinality(p_roles) > 0 and exists (
        select 1 from unnest(p_roles) as r
        where
          -- The exact phrase, wherever it sits in the title.
          e.title ilike '%' || btrim(r) || '%'
          -- A typo or a word-order difference, not a family resemblance.
          or extensions.similarity(e.title, btrim(r)) > 0.6
          -- Two thirds of the role's significant words. Words of three
          -- characters or fewer are dropped: "of", "and", "AI" carry no
          -- discrimination and would let a two-word role match on one real word.
          or (
            select count(*) filter (
                     where e.title_tsv @@ plainto_tsquery('english', w)
                   )::numeric / greatest(count(*), 1)
            from unnest(string_to_array(lower(btrim(r)), ' ')) as w
            where length(w) > 3
          ) >= 0.66
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
    and (not p_require_role or not t.role_applicable or t.role_matched)
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

-- Thirteen parameters, and the two booleans are not adjacent: p_us_only,
-- p_recency_days, then p_exclude_engaged and p_require_role together.
grant execute on function public.recommend_jobs(
  text[], int, int, numeric, text[], text[], boolean, int, boolean, boolean, int, int, int
) to authenticated, service_role;
