-- monadic — jobs
--
-- A job is a GLOBAL, ingestion-owned record. It is deliberately NOT the same
-- thing as an application. Jobs are never deleted, only closed, because
-- first_seen/last_seen/closed_at is the history that makes freshness and
-- "closed since I saved it" answerable.
--
-- Typed columns here are a projection of `raw`. Every one of them is nullable
-- except the four the ATSes genuinely always give us: company, source,
-- source id, title. When a new field turns out to matter, it gets pulled out
-- of `raw` in a later migration and backfilled — no re-ingestion required.

create table public.jobs (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,

  source            public.ats_source not null,
  -- The ATS's own identifier for this posting.
  source_job_id     text not null,
  url               text,

  title             text not null,
  department        text,
  team              text,
  employment_type   text,

  -- Location as the board gave it, plus a best-effort parse. location_raw is
  -- the trustworthy one; the parsed parts are convenience for filtering.
  location_raw      text,
  location_city     text,
  location_region   text,
  location_country  text,
  remote_policy     text check (remote_policy in ('remote', 'hybrid', 'onsite')),

  -- Derived classifications used by the browse filters. Unconstrained text on
  -- purpose: the vocabulary is unsettled and lives in the ingestion config, so
  -- reclassifying is a backfill rather than a migration.
  role_type         text,
  seniority         text,

  -- ------------------------------------------------------------------------
  -- Compensation. Missing far more often than present. comp_source records
  -- HOW we know, so the UI can distinguish "not listed" from "we read it out
  -- of the description prose and might be wrong".
  -- ------------------------------------------------------------------------
  comp_min          numeric(12, 2),
  comp_max          numeric(12, 2),
  comp_currency     text,
  comp_period       text check (comp_period in ('year', 'month', 'week', 'day', 'hour')),
  comp_source       text not null default 'none'
    check (comp_source in ('none', 'structured', 'description')),
  comp_note         text,

  -- Years of experience required. Same treatment, same reasons.
  years_min         smallint,
  years_max         smallint,
  years_source      text not null default 'none'
    check (years_source in ('none', 'structured', 'description')),

  description_html  text,
  description_text  text,

  posted_at         timestamptz,

  -- ------------------------------------------------------------------------
  -- Lifecycle
  -- ------------------------------------------------------------------------
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  closed_at         timestamptz,
  is_open           boolean generated always as (closed_at is null) stored,

  -- Hash of the normalized payload, so an unchanged posting is a last_seen_at
  -- bump rather than a full rewrite.
  content_hash      text,

  raw               jsonb not null,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  search_tsv tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description_text, ''))
  ) stored,

  constraint jobs_source_identity_key unique (source, source_job_id),

  constraint jobs_comp_range_ck check (
    comp_min is null or comp_max is null or comp_min <= comp_max
  ),
  constraint jobs_years_range_ck check (
    years_min is null or years_max is null or years_min <= years_max
  ),
  -- You may not have a comp figure without saying where it came from.
  constraint jobs_comp_provenance_ck check (
    comp_source <> 'none' or (comp_min is null and comp_max is null)
  ),
  constraint jobs_years_provenance_ck check (
    years_source <> 'none' or (years_min is null and years_max is null)
  ),
  constraint jobs_seen_order_ck check (last_seen_at >= first_seen_at)
);

-- Default sort: newest first, open only.
create index jobs_open_first_seen_idx
  on public.jobs (first_seen_at desc)
  where closed_at is null;

create index jobs_company_idx        on public.jobs (company_id);
create index jobs_first_seen_idx     on public.jobs (first_seen_at desc);
create index jobs_last_seen_idx      on public.jobs (last_seen_at);
create index jobs_role_type_idx      on public.jobs (role_type)     where role_type is not null;
create index jobs_seniority_idx      on public.jobs (seniority)     where seniority is not null;
create index jobs_remote_idx         on public.jobs (remote_policy) where remote_policy is not null;
create index jobs_comp_min_idx       on public.jobs (comp_min)      where comp_min is not null;
create index jobs_years_min_idx      on public.jobs (years_min)     where years_min is not null;

create index jobs_search_idx on public.jobs using gin (search_tsv);

-- So that "I want to filter on a field I haven't extracted yet" is a query,
-- not a migration.
create index jobs_raw_idx on public.jobs using gin (raw jsonb_path_ops);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

comment on column public.jobs.raw is
  'The untouched ATS response for this posting. Source of truth; typed columns above are a projection of it.';

-- ---------------------------------------------------------------------------
-- ingestion_runs
-- ---------------------------------------------------------------------------
-- One row per company per fetch attempt. Exists so that a pipeline returning
-- zero rows forever is visible instead of silent.
--
-- `status` is the gate on closure detection: closure_applied may only be true
-- for a run that reached 'success'. 'empty_suspect' is a clean 200 that
-- returned no jobs for a board that previously had some — recorded, but never
-- allowed to close anything on its own.

create table public.ingestion_runs (
  id             uuid primary key default gen_random_uuid(),

  -- Groups every company's run within one `npm run ingest` invocation.
  batch_id       uuid not null,

  company_id     uuid references public.companies (id) on delete set null,
  source         public.ats_source,
  kind           text not null default 'pull' check (kind in ('pull', 'resolve')),

  status         text not null check (status in (
                   'success',              -- clean 200, parsed, closure eligible
                   'empty_suspect',        -- clean 200 but zero jobs on a board that had some
                   'not_modified',         -- 304; nothing changed, nothing to close
                   'skipped_unresolved',   -- no ATS identity for this company
                   'failure'               -- transport, non-2xx, or parse error
                 )),

  http_status    integer,

  jobs_returned  integer,
  jobs_created   integer,
  jobs_updated   integer,
  jobs_closed    integer,
  closure_applied boolean not null default false,

  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  duration_ms    integer,

  error_message  text,
  error_detail   jsonb,

  created_at     timestamptz not null default now(),

  -- The invariant the whole closure rule rests on, enforced by the database
  -- rather than by the ingestion code remembering to check.
  constraint ingestion_runs_closure_requires_success check (
    closure_applied = false or status = 'success'
  )
);

create index ingestion_runs_batch_idx    on public.ingestion_runs (batch_id);
create index ingestion_runs_company_idx  on public.ingestion_runs (company_id, started_at desc);
create index ingestion_runs_started_idx  on public.ingestion_runs (started_at desc);
create index ingestion_runs_problems_idx on public.ingestion_runs (started_at desc)
  where status in ('failure', 'empty_suspect');
