-- monadic — outreach templates and sent messages
--
-- Templates are editable database records, never hardcoded. Sent messages
-- snapshot the rendered text, because editing a template must not rewrite
-- history of what was actually sent.
--
-- Nothing here sends email. sent_at is recorded by me, by hand.

create table public.outreach_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,

  name        text not null,
  channel     text not null default 'email'
    check (channel in ('email', 'linkedin', 'other')),

  subject     text,
  body        text not null,

  -- Variable names detected in subject/body at save time, namespaced by their
  -- source: job.*, company.*, profile.*, contact.*, application.*.
  -- Cached for the editor's benefit; the renderer re-parses the body.
  variables   text[] not null default '{}',

  is_archived boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint outreach_templates_name_unique unique (user_id, name)
);

create index outreach_templates_user_idx on public.outreach_templates (user_id)
  where is_archived = false;

create trigger outreach_templates_set_updated_at
  before update on public.outreach_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- outreach_messages
-- ---------------------------------------------------------------------------
-- sent / opened / replied are three nullable timestamps rather than one status
-- enum, because they are not mutually exclusive and two of them are frequently
-- unknowable. A null opened_at means "no idea", which is the honest default and
-- is what the UI has to render.

create table public.outreach_messages (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,

  contact_id          uuid not null references public.contacts (id) on delete cascade,
  application_id      uuid references public.applications (id) on delete set null,
  template_id         uuid references public.outreach_templates (id) on delete set null,

  channel             text not null default 'email'
    check (channel in ('email', 'linkedin', 'other')),

  -- The rendered text as sent. Immutable in practice once sent_at is set.
  subject             text,
  body                text not null,
  -- What each variable resolved to, for auditing a template that rendered badly.
  variables_snapshot  jsonb not null default '{}'::jsonb,

  sent_at             timestamptz,
  opened_at           timestamptz,
  replied_at          timestamptz,
  bounced_at          timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- You cannot have been opened or replied to before you were sent.
  constraint outreach_messages_open_after_send check (
    opened_at is null or (sent_at is not null and opened_at >= sent_at)
  ),
  constraint outreach_messages_reply_after_send check (
    replied_at is null or (sent_at is not null and replied_at >= sent_at)
  )
);

create index outreach_messages_user_idx on public.outreach_messages (user_id, created_at desc);
create index outreach_messages_contact_idx on public.outreach_messages (contact_id);
create index outreach_messages_application_idx on public.outreach_messages (application_id)
  where application_id is not null;
create index outreach_messages_awaiting_reply_idx on public.outreach_messages (user_id, sent_at)
  where sent_at is not null and replied_at is null;

create trigger outreach_messages_set_updated_at
  before update on public.outreach_messages
  for each row execute function public.set_updated_at();

-- Close the loop left open in the applications migration.
alter table public.application_events
  add constraint application_events_outreach_fk
  foreign key (outreach_message_id)
  references public.outreach_messages (id)
  on delete set null;

create index application_events_outreach_idx
  on public.application_events (outreach_message_id)
  where outreach_message_id is not null;
