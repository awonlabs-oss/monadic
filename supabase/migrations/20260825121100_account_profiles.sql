-- monadic — account identity
--
-- Deliberately separate from public.profiles, which holds the parsed resume.
-- The two have different lifecycles: profiles is re-derived from a document
-- every time a new resume is uploaded, and account identity must survive that
-- untouched. Merging them would mean re-parsing a resume could overwrite your
-- name.
--
-- This table is also where Google OAuth lands later. auth.users and
-- auth.identities already handle multiple providers per user, so adding a
-- provider is a dashboard toggle and a button — no migration. On first Google
-- sign-in the app copies given_name / family_name / picture into these columns.
--
-- Rows are created explicitly: by `npm run seed:user` today, and by the
-- post-sign-in path once auth exists. There is intentionally no on-signup
-- trigger — that pattern needs a SECURITY DEFINER function reachable from the
-- auth schema, and this schema has no security definer functions.

create table public.account_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,

  first_name  text,
  last_name   text,
  avatar_url  text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint account_profiles_user_key unique (user_id)
);

create index account_profiles_user_idx on public.account_profiles (user_id);

create trigger account_profiles_set_updated_at
  before update on public.account_profiles
  for each row execute function public.set_updated_at();

alter table public.account_profiles enable row level security;

create policy account_profiles_owner on public.account_profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.account_profiles is
  'Who you are as an account. Distinct from public.profiles, which is the parsed resume.';
