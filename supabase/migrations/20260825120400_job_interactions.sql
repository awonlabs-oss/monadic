-- monadic — saving and dismissing jobs
--
-- Two tables on purpose:
--
--   job_interactions  current state, one row per (user, job). What the feed
--                     reads to decide whether to show a job as saved or hidden.
--   job_signals       append-only log of every save/unsave/dismiss/undismiss.
--
-- The log exists because dismissal reasons were called out as training data for
-- scoring later. A current-state-only table silently destroys that data the
-- first time a job is un-dismissed and re-dismissed for a different reason.

-- ---------------------------------------------------------------------------
-- dismissal_reasons — a lookup table, not a CHECK constraint
-- ---------------------------------------------------------------------------
-- This vocabulary will change as I learn what I actually reject things for.
-- As a lookup table, adding a reason is an INSERT; as a CHECK it would be a
-- migration every time. Referential integrity is preserved either way, which
-- matters because these values are meant to be trained on.

create table public.dismissal_reasons (
  code        text primary key,
  label       text not null,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.dismissal_reasons is
  'Controlled vocabulary for why a job was dismissed. Seeded, extend by INSERT. Rows are never deleted — deactivate instead, so historical signals keep resolving.';

-- ---------------------------------------------------------------------------
-- job_interactions — current state
-- ---------------------------------------------------------------------------

create table public.job_interactions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  job_id                 uuid not null references public.jobs (id) on delete cascade,

  state                  text not null default 'none'
    check (state in ('none', 'saved', 'dismissed')),

  dismissal_reason_code  text references public.dismissal_reasons (code),
  dismissal_note         text,

  saved_at               timestamptz,
  dismissed_at           timestamptz,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint job_interactions_unique unique (user_id, job_id),

  -- A dismissal without a reason is the one shape that would make the training
  -- data useless, so it is refused outright.
  constraint job_interactions_dismissal_needs_reason check (
    state <> 'dismissed' or dismissal_reason_code is not null
  )
);

create index job_interactions_user_state_idx on public.job_interactions (user_id, state);
create index job_interactions_job_idx on public.job_interactions (job_id);

create trigger job_interactions_set_updated_at
  before update on public.job_interactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- job_signals — append-only history
-- ---------------------------------------------------------------------------

create table public.job_signals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  job_id       uuid not null references public.jobs (id) on delete cascade,

  signal       text not null check (signal in ('saved', 'unsaved', 'dismissed', 'undismissed')),

  reason_code  text references public.dismissal_reasons (code),
  reason_note  text,

  -- Denormalized snapshot of the filter-relevant job facts at the moment of the
  -- signal. Jobs mutate on re-ingestion (comp gets added, title gets edited);
  -- without this, a signal recorded against "no comp listed" would later look
  -- like it was recorded against a posting that did list comp.
  job_snapshot jsonb not null default '{}'::jsonb,

  created_at   timestamptz not null default now(),

  constraint job_signals_dismissal_needs_reason check (
    signal <> 'dismissed' or reason_code is not null
  )
);

create index job_signals_user_created_idx on public.job_signals (user_id, created_at desc);
create index job_signals_job_idx on public.job_signals (job_id);
create index job_signals_reason_idx on public.job_signals (reason_code) where reason_code is not null;
