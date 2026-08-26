-- monadic — contacts
--
-- Contacts are user-scoped: they are my relationships, not shared facts about a
-- company. Every contact records which ContactProvider produced it and keeps
-- that provider's untouched response in `raw`, so the day a second provider is
-- added, nothing about existing rows has to change.

create table public.contacts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,

  -- Contacts hang off a company. The link to a specific application is the
  -- application_contacts join, because the same recruiter shows up again on
  -- the next role at the same company.
  company_id          uuid references public.companies (id) on delete set null,

  full_name           text not null,
  title               text,
  email               text,
  phone               text,
  linkedin_url        text,

  -- Default relationship. Per-application overrides live on the join row.
  role                text check (role in ('recruiter', 'hiring_manager', 'referral', 'interviewer', 'other')),

  -- ------------------------------------------------------------------------
  -- Provider provenance. 'manual' is the only implemented provider.
  -- ------------------------------------------------------------------------
  provider            text not null default 'manual',
  provider_record_id  text,
  provider_confidence numeric(3, 2) check (provider_confidence between 0 and 1),
  raw                 jsonb not null default '{}'::jsonb,

  notes               text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index contacts_user_idx on public.contacts (user_id);
create index contacts_company_idx on public.contacts (company_id);

-- One contact per email address per user, when an email is known at all.
create unique index contacts_user_email_uidx
  on public.contacts (user_id, lower(email))
  where email is not null;

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

comment on column public.contacts.provider is
  'Which ContactProvider implementation produced this row. Free text rather than a CHECK so adding a provider is a code change only.';
