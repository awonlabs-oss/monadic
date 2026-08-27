-- monadic — stop rewriting rows that have not changed
--
-- The second full ingest died with "canceling statement due to statement
-- timeout" inside upsert_jobs.
--
-- content_hash exists to prevent exactly this. contentHash() in normalize.ts is
-- documented as making "an unchanged posting a last_seen_at bump instead of a
-- full rewrite" — but the SQL never consulted it. Every posting on every board
-- was rewritten in full on every run: description_html, description_text and
-- the raw JSONB, which together run to some 20KB a row, plus the GIN index
-- entries for the generated search_tsv. Two hundred of those in one statement,
-- for a board where nothing had changed since yesterday.
--
-- The first ingest ran clean because every row was an insert. The cost only
-- appears on re-ingest, which is the case that will run every day.
--
-- So the conflict path now writes only when the content actually differs. What
-- is left is a bump of last_seen_at on one unindexed column, which Postgres can
-- do as a heap-only tuple update — no index maintenance, no TOAST rewrite.
--
-- last_seen_at still has to move for unchanged rows: it is what the detail page
-- means by "last checked", and a posting that stopped being re-confirmed would
-- silently start looking stale. Closure does not depend on it — persist.ts
-- diffs source_job_ids in memory — so the two concerns stay separate.

-- Dropped first: the return type gains a column, and CREATE OR REPLACE cannot
-- change a function's signature.
drop function if exists public.upsert_jobs(uuid, public.ats_source, jsonb);

create function public.upsert_jobs(
  p_company_id uuid,
  p_source     public.ats_source,
  p_jobs       jsonb
)
returns table (created bigint, updated bigint, unchanged bigint)
language sql
security invoker
set search_path = ''
as $$
  with input as (
    select * from jsonb_to_recordset(p_jobs) as x(
      source_job_id      text,
      url                text,
      title              text,
      department         text,
      team               text,
      employment_type    text,
      location_raw       text,
      location_cities    text[],
      location_countries text[],
      us_eligible        boolean,
      remote_policy      text,
      comp_min           numeric,
      comp_max           numeric,
      comp_currency      text,
      comp_period        text,
      comp_source        text,
      comp_note          text,
      years_min          smallint,
      years_max          smallint,
      years_source       text,
      description_html   text,
      description_text   text,
      posted_at          timestamptz,
      content_hash       text,
      raw                jsonb
    )
  ),
  written as (
    insert into public.jobs (
      company_id, source, source_job_id, url, title, department, team,
      employment_type, location_raw, location_cities, location_countries,
      us_eligible, remote_policy, comp_min, comp_max, comp_currency,
      comp_period, comp_source, comp_note, years_min, years_max, years_source,
      description_html, description_text, posted_at, content_hash, raw
    )
    select
      p_company_id, p_source, i.source_job_id, i.url,
      coalesce(nullif(btrim(i.title), ''), '(untitled)'),
      i.department, i.team, i.employment_type, i.location_raw,
      coalesce(i.location_cities, '{}'), coalesce(i.location_countries, '{}'),
      coalesce(i.us_eligible, false),
      i.remote_policy, i.comp_min, i.comp_max, i.comp_currency, i.comp_period,
      coalesce(i.comp_source, 'none'), i.comp_note,
      i.years_min, i.years_max, coalesce(i.years_source, 'none'),
      i.description_html, i.description_text, i.posted_at, i.content_hash,
      coalesce(i.raw, '{}'::jsonb)
    from input i
    on conflict (source, source_job_id) do update set
      company_id         = excluded.company_id,
      url                = excluded.url,
      title              = excluded.title,
      department         = excluded.department,
      team               = excluded.team,
      employment_type    = excluded.employment_type,
      location_raw       = excluded.location_raw,
      location_cities    = excluded.location_cities,
      location_countries = excluded.location_countries,
      us_eligible        = excluded.us_eligible,
      remote_policy      = excluded.remote_policy,
      comp_min           = excluded.comp_min,
      comp_max           = excluded.comp_max,
      comp_currency      = excluded.comp_currency,
      comp_period        = excluded.comp_period,
      comp_source        = excluded.comp_source,
      comp_note          = excluded.comp_note,
      years_min          = excluded.years_min,
      years_max          = excluded.years_max,
      years_source       = excluded.years_source,
      description_html   = excluded.description_html,
      description_text   = excluded.description_text,
      posted_at          = excluded.posted_at,
      content_hash       = excluded.content_hash,
      raw                = excluded.raw,
      -- Server-side, and never first_seen_at: rewriting that would reset the
      -- ordering the feed sorts on every time a board is re-read.
      last_seen_at       = now(),
      -- A posting that reappears after being closed is open again.
      closed_at          = null
    -- The whole point. A reopened posting is written even when its content is
    -- identical, because closed_at has to be cleared.
    where public.jobs.content_hash is distinct from excluded.content_hash
       or public.jobs.closed_at is not null
    returning id, (xmax = 0) as inserted
  ),
  -- Everything the conflict path skipped, which is every posting that came back
  -- byte-identical. One unindexed column, so this is a HOT update.
  refreshed as (
    update public.jobs j
       set last_seen_at = now()
      from input i
     where j.source = p_source
       and j.source_job_id = i.source_job_id
       and j.id not in (select w.id from written w)
    returning 1
  )
  select
    (select count(*) filter (where w.inserted)     from written w),
    (select count(*) filter (where not w.inserted) from written w),
    (select count(*) from refreshed);
$$;

grant execute on function public.upsert_jobs(uuid, public.ats_source, jsonb)
  to service_role, authenticated;
