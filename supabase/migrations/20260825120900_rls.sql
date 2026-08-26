-- monadic — row level security
--
-- Two categories of table, two policy shapes:
--
--   GLOBAL (companies, jobs, ingestion_runs, dismissal_reasons)
--     Owned by the ingestion layer. Readable by any authenticated session,
--     writable by nobody through the API. Writes happen with the service role,
--     which bypasses RLS by design, and only from scripts in scripts/ingest.
--     The absence of a write policy IS the policy.
--
--   USER-SCOPED (everything else)
--     Readable and writable only by the row's owner. Identical policy on every
--     table, no exceptions, so that the day a second user exists nothing here
--     changes.
--
-- auth.uid() is wrapped in a scalar subquery throughout. Postgres then
-- evaluates it once per statement instead of once per row, which is what keeps
-- these policies index-friendly rather than forcing a sequential scan.
--
-- The anon role is revoked outright. There is no unauthenticated surface in
-- this application, and there should not accidentally become one.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere. No table in public is left unprotected.
-- ---------------------------------------------------------------------------

alter table public.companies            enable row level security;
alter table public.jobs                 enable row level security;
alter table public.ingestion_runs       enable row level security;
alter table public.dismissal_reasons    enable row level security;

alter table public.tracked_companies    enable row level security;
alter table public.profiles             enable row level security;
alter table public.profile_experiences  enable row level security;
alter table public.profile_skills       enable row level security;
alter table public.profile_education    enable row level security;
alter table public.search_criteria      enable row level security;
alter table public.job_interactions     enable row level security;
alter table public.job_signals          enable row level security;
alter table public.contacts             enable row level security;
alter table public.applications         enable row level security;
alter table public.application_contacts enable row level security;
alter table public.application_events   enable row level security;
alter table public.outreach_templates   enable row level security;
alter table public.outreach_messages    enable row level security;

-- ---------------------------------------------------------------------------
-- Global tables: read-only to the application.
-- ---------------------------------------------------------------------------

create policy companies_select on public.companies
  for select to authenticated using (true);

create policy jobs_select on public.jobs
  for select to authenticated using (true);

create policy ingestion_runs_select on public.ingestion_runs
  for select to authenticated using (true);

create policy dismissal_reasons_select on public.dismissal_reasons
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- User-scoped tables: owner reads and writes, nobody else.
-- ---------------------------------------------------------------------------

create policy tracked_companies_owner on public.tracked_companies
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy profiles_owner on public.profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy profile_experiences_owner on public.profile_experiences
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy profile_skills_owner on public.profile_skills
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy profile_education_owner on public.profile_education
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy search_criteria_owner on public.search_criteria
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy job_interactions_owner on public.job_interactions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy contacts_owner on public.contacts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy applications_owner on public.applications
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy application_contacts_owner on public.application_contacts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy outreach_templates_owner on public.outreach_templates
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy outreach_messages_owner on public.outreach_messages
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Append-only tables: SELECT and INSERT only.
-- ---------------------------------------------------------------------------
-- There is deliberately no UPDATE or DELETE policy for these two. History is
-- not editable, and that is enforced by the database rather than by convention.

create policy application_events_read on public.application_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy application_events_append on public.application_events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy job_signals_read on public.job_signals
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy job_signals_append on public.job_signals
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Role grants
-- ---------------------------------------------------------------------------

-- Functions are granted to PUBLIC by default, and anon inherits that. Revoking
-- from anon alone would leave every function in this schema callable by an
-- unauthenticated session, so the revoke has to target PUBLIC.
revoke execute on all functions in schema public from public;
revoke all on all tables in schema public from anon;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke all on tables from anon;

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated, service_role;

-- Ingestion writes the global tables with the service role, which bypasses RLS.
-- It never touches user-scoped tables.
grant select, insert, update on
  public.companies, public.jobs, public.ingestion_runs
  to service_role;
