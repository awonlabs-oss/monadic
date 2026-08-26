-- monadic — let maintenance scripts clean up after themselves
--
-- service_role was granted select, insert, update on the three global tables
-- and deliberately not delete, on the reasoning that ingestion never deletes a
-- job — it closes it by setting closed_at.
--
-- That reasoning still holds for ingestion, but it left check-rls.ts unable to
-- remove the throwaway company and job it creates. The deletes failed and the
-- script did not inspect the error, so the probe rows survived and would have
-- shown up in the job feed as though they were real postings. A test fixture
-- leaking into the product's main list is worse than the narrower grant.
--
-- Scoped to the two tables a fixture actually needs. ingestion_runs is left
-- append-only for service_role as well: run history is diagnostic evidence and
-- nothing should be quietly removing it.
--
-- Applications remain protected regardless: applications.job_id is
-- ON DELETE RESTRICT, so deleting a job that someone has applied to still
-- fails. Cleanup has to remove the application first, as its owner.

grant delete on public.companies to service_role;
grant delete on public.jobs to service_role;
