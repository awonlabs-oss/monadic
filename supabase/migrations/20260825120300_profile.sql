-- monadic — profile and search criteria
--
-- The parsed resume is modelled as relational child tables rather than one
-- jsonb blob, because the two things that will consume it both want set
-- operations: the editing UI needs per-row identity to edit and reorder, and
-- scoring later needs "skills in the profile that also appear in the posting".
-- `profiles.raw` still holds the untouched parser output, so nothing the parser
-- produced is lost by the projection.

create table public.profiles (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,

  full_name              text,
  email                  text,
  phone                  text,
  location               text,
  -- {"linkedin": "...", "github": "...", "portfolio": "..."}
  links                  jsonb not null default '{}'::jsonb,

  headline               text,
  summary                text,

  -- Aggregate signals. Nullable: the parser will often not be able to tell.
  years_experience_total numeric(4, 1),
  seniority_signal       text,

  -- Provenance of the current parse. The file itself is not stored.
  source_file_name       text,
  source_file_hash       text,
  source_file_type       text check (source_file_type in ('pdf', 'docx')),
  parsed_at              timestamptz,
  parser_version         text,

  -- Untouched parser output.
  raw                    jsonb not null default '{}'::jsonb,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint profiles_user_key unique (user_id)
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profile_experiences — roles held
-- ---------------------------------------------------------------------------
-- Resume dates are frequently imprecise ("2021", "Jan 2021", "Present"). Both
-- a normalized date and the text as written are kept: the date sorts and
-- computes, the text is what gets shown back when the normalization is wrong.

create table public.profile_experiences (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,

  company_name  text not null,
  title         text,
  location      text,
  description   text,

  start_date    date,
  start_text    text,
  end_date      date,
  end_text      text,
  is_current    boolean not null default false,

  seniority     text,
  sort_order    integer not null default 0,

  source        text not null default 'parsed' check (source in ('parsed', 'manual')),
  raw           jsonb not null default '{}'::jsonb,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint profile_experiences_date_order check (
    start_date is null or end_date is null or start_date <= end_date
  ),
  constraint profile_experiences_current_has_no_end check (
    is_current = false or end_date is null
  )
);

create index profile_experiences_profile_idx on public.profile_experiences (profile_id, sort_order);
create index profile_experiences_user_idx on public.profile_experiences (user_id);

create trigger profile_experiences_set_updated_at
  before update on public.profile_experiences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profile_skills — skills and domains
-- ---------------------------------------------------------------------------
-- Domains are folded in here as category = 'domain' rather than given their own
-- table: they behave identically (a named tag with a source and optional years)
-- and scoring will want to match them the same way.

create table public.profile_skills (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,

  name        text not null,
  category    text check (category in ('language', 'framework', 'tool', 'platform', 'domain', 'other')),
  years       numeric(4, 1),
  proficiency text check (proficiency in ('familiar', 'proficient', 'expert')),

  source      text not null default 'parsed' check (source in ('parsed', 'manual')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index profile_skills_unique_name
  on public.profile_skills (profile_id, lower(name));
create index profile_skills_user_idx on public.profile_skills (user_id);
create index profile_skills_category_idx on public.profile_skills (profile_id, category);

create trigger profile_skills_set_updated_at
  before update on public.profile_skills
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- profile_education
-- ---------------------------------------------------------------------------

create table public.profile_education (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  profile_id   uuid not null references public.profiles (id) on delete cascade,

  institution  text not null,
  degree       text,
  field        text,
  start_year   smallint,
  end_year     smallint,
  notes        text,
  sort_order   integer not null default 0,

  source       text not null default 'parsed' check (source in ('parsed', 'manual')),
  raw          jsonb not null default '{}'::jsonb,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint profile_education_year_order check (
    start_year is null or end_year is null or start_year <= end_year
  )
);

create index profile_education_profile_idx on public.profile_education (profile_id, sort_order);
create index profile_education_user_idx on public.profile_education (user_id);

create trigger profile_education_set_updated_at
  before update on public.profile_education
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- search_criteria — what I am looking for
-- ---------------------------------------------------------------------------
-- Kept separate from profiles: the profile describes who I am and is derived
-- from a document; criteria describe what I want and are authored by hand.
-- They change on completely different schedules.

create table public.search_criteria (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,

  target_role_types    text[] not null default '{}',
  seniority_ceiling    text,
  company_stages       text[] not null default '{}',

  locations            text[] not null default '{}',
  remote_preference    text check (remote_preference in ('remote_only', 'remote_preferred', 'hybrid_ok', 'onsite_ok', 'any')),

  comp_floor           numeric(12, 2),
  comp_currency        text not null default 'USD',
  comp_period          text not null default 'year'
    check (comp_period in ('year', 'month', 'week', 'day', 'hour')),
  -- Comp is missing on most postings. Excluding them by default would hide
  -- most of the feed, so this defaults to keeping them.
  include_missing_comp boolean not null default true,

  notes                text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint search_criteria_user_key unique (user_id)
);

create trigger search_criteria_set_updated_at
  before update on public.search_criteria
  for each row execute function public.set_updated_at();
