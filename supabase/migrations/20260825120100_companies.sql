-- monadic — companies
--
-- Companies are a GLOBAL, ingestion-owned record. They are not user-scoped:
-- "Acme Robotics uses Greenhouse under slug acmerobotics" is a fact about the
-- world, not about me. Which companies *I* care about is a separate user-scoped
-- table (tracked_companies) so that adding a second user later needs no
-- migration.

create table public.companies (
  id                     uuid primary key default gen_random_uuid(),

  name                   text not null,
  -- Internal stable identifier, derived from name at seed time. Distinct from
  -- ats_slug, which is whatever the ATS happens to call this board.
  slug                   text not null,

  website_url            text,
  careers_url            text,

  -- ------------------------------------------------------------------------
  -- Resolver cache. The resolver writes here exactly once per company and is
  -- then permanently short-circuited by ats_resolved_at being non-null.
  -- ------------------------------------------------------------------------
  ats_source             public.ats_source,
  ats_slug               text,
  ats_board_url          text,

  ats_resolution_status  text not null default 'unresolved'
    check (ats_resolution_status in ('unresolved', 'resolved', 'failed', 'manual')),
  ats_resolution_method  text
    check (ats_resolution_method in ('probe', 'fingerprint', 'manual')),
  ats_resolved_at        timestamptz,
  ats_resolution_error   text,

  -- Conditional-request state for the board endpoint. Support is uneven across
  -- the three ATSes, so both are nullable and used opportunistically.
  ats_etag               text,
  ats_last_modified      text,

  -- Whatever the resolver learned about the board, untouched.
  raw                    jsonb not null default '{}'::jsonb,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint companies_slug_key unique (slug),

  -- A company cannot claim to be resolved without an actual board identity.
  constraint companies_resolved_needs_identity check (
    ats_resolution_status not in ('resolved', 'manual')
    or (ats_source is not null and ats_slug is not null)
  ),

  -- Resolution status and the resolved-at stamp move together. This is what
  -- makes "never resolve the same company twice" enforceable rather than
  -- merely intended.
  constraint companies_resolution_stamp check (
    (ats_resolution_status = 'unresolved' and ats_resolved_at is null)
    or (ats_resolution_status <> 'unresolved' and ats_resolved_at is not null)
  )
);

-- Two companies cannot share one ATS board.
create unique index companies_ats_identity_uidx
  on public.companies (ats_source, ats_slug)
  where ats_source is not null and ats_slug is not null;

-- The resolver's work queue.
create index companies_unresolved_idx
  on public.companies (created_at)
  where ats_resolution_status = 'unresolved';

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

comment on column public.companies.ats_resolved_at is
  'Set once, by the resolver. Non-null means the resolver will never run for this company again, including after a failure. Clearing this column is the deliberate escape hatch for a retry.';

-- ---------------------------------------------------------------------------
-- tracked_companies — my seed list
-- ---------------------------------------------------------------------------
-- User-scoped. Ingestion pulls boards for companies tracked by at least one
-- user. Today that is exactly one user, which is the point: the multi-user
-- version of this is the same table.

create table public.tracked_companies (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  company_id   uuid not null references public.companies (id) on delete cascade,

  is_active    boolean not null default true,
  priority     smallint,
  notes        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint tracked_companies_unique unique (user_id, company_id)
);

create index tracked_companies_user_idx on public.tracked_companies (user_id);
create index tracked_companies_company_idx on public.tracked_companies (company_id);

create trigger tracked_companies_set_updated_at
  before update on public.tracked_companies
  for each row execute function public.set_updated_at();
