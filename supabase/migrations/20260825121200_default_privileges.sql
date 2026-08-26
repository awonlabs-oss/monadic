-- monadic — make table grants apply to future tables too
--
-- 20260825120900_rls.sql granted DML with:
--
--     grant select, insert, update, delete on all tables in schema public
--       to authenticated;
--
-- `on all tables` is a point-in-time snapshot, not a standing rule. It grants
-- on the tables that exist at that instant and says nothing about later ones.
-- public.account_profiles arrived two migrations afterwards and therefore had
-- no DML grant at all — RLS was enabled and its policy was correct, but the
-- underlying privilege was missing, so even its owner got
-- "permission denied for table account_profiles".
--
-- This is the second bug of the same shape in this schema, after the
-- `grant execute on all functions` one fixed in 20260825121000. Both came from
-- treating `on all X` as a rule rather than a snapshot. Fixing the instance is
-- not enough; the default has to change, or the next table repeats it.
--
-- Two parts:
--   1. Re-run the grant, which is idempotent and repairs anything missed.
--   2. Set default privileges, so tables created from here on are covered
--      automatically by the role that runs migrations.
--
-- service_role is deliberately NOT given blanket future access. It holds the
-- secret key and bypasses RLS, so its reach stays explicitly enumerated: the
-- three global tables ingestion writes, and nothing else.

-- 1. Repair the present.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- 2. Fix the default for the future.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant usage, select on sequences to authenticated;

-- Restated so the anon revoke is not accidentally widened by the grant above.
revoke all on all tables in schema public from anon;
