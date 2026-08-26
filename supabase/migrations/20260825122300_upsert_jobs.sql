-- monadic — move the job upsert server-side
--
-- Ingestion was sending last_seen_at from the client clock. That works for a
-- genuine insert and fails for every update, for a reason worth writing down:
--
--   Postgres evaluates CHECK constraints against the tuple proposed for
--   insertion, BEFORE the unique violation is detected and ON CONFLICT switches
--   to the update path. So an upsert always forms a candidate row whose
--   first_seen_at is the column default, now(), and compares it against the
--   last_seen_at in the payload. That payload value was computed on the client
--   before the request went out, so it is always fractionally older than the
--   server's now(), and jobs_seen_order_ck fails every time.
--
--   The first ingest ran clean because nothing existed yet: those were real
--   inserts, and inserts omit last_seen_at so both columns took the same
--   default. The bug only appeared on the second run, against existing rows.
--
-- The fix is to stop sending a clock at all. now() is evaluated once, on the
-- server, inside the statement, so first_seen_at and last_seen_at are the same
-- transaction timestamp on insert and last_seen_at can only move forward on
-- update. Client clock skew stops being able to affect correctness.
--
-- It also collapses each chunk to one round trip, and returns the created and
-- updated split via `xmax = 0`, which distinguishes an inserted row from an
-- updated one inside RETURNING.

create or replace function public.upsert_jobs(
  p_company_id uuid,
  p_source     public.ats_source,
  p_jobs       jsonb
)
returns table (created bigint, updated bigint)
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
    returning (xmax = 0) as inserted
  )
  select
    count(*) filter (where inserted)     as created,
    count(*) filter (where not inserted) as updated
  from written;
$$;

grant execute on function public.upsert_jobs(uuid, public.ats_source, jsonb)
  to service_role, authenticated;
