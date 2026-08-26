-- monadic — applications and their timeline
--
-- An application is mine and references a job. The job row stays owned by
-- ingestion and is never mutated by anything in this file.
--
-- History lives in application_events, which is append-only. `status` and
-- `status_changed_at` on the application are a denormalized cache of the latest
-- status_change event, maintained only by set_application_status(). They exist
-- so the pipeline board can sort without a lateral join per row.

create table public.applications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,

  -- restrict, not cascade: losing an application because ingestion deleted a
  -- job would be data loss. Jobs are closed, never deleted, so this should
  -- never fire — it is here to make sure of that.
  job_id            uuid not null references public.jobs (id) on delete restrict,

  -- 'shortlisted', not 'saved'. A job saved in the feed
  -- (job_interactions.state = 'saved') is a bookmark; an application at
  -- 'shortlisted' is a tracked pipeline entry. Distinct states, distinct names,
  -- so the pipeline data stays unambiguous when it gets trained on later.
  status            text not null default 'shortlisted' check (status in (
                      'shortlisted', 'applied', 'recruiter_screen',
                      'technical', 'onsite', 'offer', 'rejected', 'withdrawn'
                    )),
  status_changed_at timestamptz not null default now(),
  applied_at        timestamptz,

  next_action       text,
  next_action_at    date,

  source            text check (source in ('job_feed', 'referral', 'recruiter_outreach', 'other')),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint applications_unique_per_job unique (user_id, job_id)
);

create index applications_user_status_idx on public.applications (user_id, status);
create index applications_job_idx on public.applications (job_id);
create index applications_next_action_idx on public.applications (user_id, next_action_at)
  where next_action_at is not null;
create index applications_status_changed_idx on public.applications (user_id, status_changed_at desc);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

comment on column public.applications.status is
  'Cache of the latest status_change event. Write only through set_application_status(); application_events is the source of truth.';

-- ---------------------------------------------------------------------------
-- application_contacts
-- ---------------------------------------------------------------------------

create table public.application_contacts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  application_id  uuid not null references public.applications (id) on delete cascade,
  contact_id      uuid not null references public.contacts (id) on delete cascade,

  role_in_process text check (role_in_process in ('recruiter', 'hiring_manager', 'referral', 'interviewer', 'other')),
  notes           text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint application_contacts_unique unique (application_id, contact_id)
);

create index application_contacts_user_idx on public.application_contacts (user_id);
create index application_contacts_contact_idx on public.application_contacts (contact_id);

create trigger application_contacts_set_updated_at
  before update on public.application_contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- application_events — append-only timeline
-- ---------------------------------------------------------------------------
-- occurred_at and created_at are deliberately separate: an interview logged on
-- Thursday may have happened on Tuesday, and stage-duration analysis later
-- needs the Tuesday.
--
-- Append-only is enforced by RLS granting only SELECT and INSERT — there is no
-- UPDATE or DELETE policy for this table anywhere in the schema.

create table public.application_events (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  application_id      uuid not null references public.applications (id) on delete cascade,

  event_type          text not null check (event_type in (
                        'created', 'status_change', 'interview',
                        'message_sent', 'message_received', 'note', 'task'
                      )),

  occurred_at         timestamptz not null default now(),

  -- Populated for status_change.
  from_status         text,
  to_status           text,

  title               text,
  body                text,

  contact_id          uuid references public.contacts (id) on delete set null,
  -- FK added in the outreach migration; outreach_messages does not exist yet.
  outreach_message_id uuid,

  metadata            jsonb not null default '{}'::jsonb,

  created_at          timestamptz not null default now(),

  constraint application_events_status_change_shape check (
    event_type <> 'status_change' or to_status is not null
  )
);

create index application_events_timeline_idx
  on public.application_events (application_id, occurred_at desc);
create index application_events_user_idx on public.application_events (user_id);
create index application_events_type_idx on public.application_events (application_id, event_type);
