-- monadic — narrow the function grants
--
-- 20260825120900_rls.sql ended with:
--
--     grant execute on all functions in schema public to authenticated, service_role;
--
-- which was wrong. `all functions in schema public` is not "all functions I
-- wrote" — it is every function that happens to live there, including ones the
-- platform puts there. Supabase installs `public.rls_auto_enable()`, a
-- SECURITY DEFINER event-trigger function backing the `ensure_rls` event
-- trigger, and that blanket grant published it at /rest/v1/rpc/rls_auto_enable
-- for any signed-in user. Supabase's own advisor flagged it.
--
-- Calling it over REST would fail — Postgres refuses to invoke an event trigger
-- function directly — so nothing was actually exploitable. The bug is the
-- pattern, not this instance: the next platform function to appear in `public`
-- would have been granted out the same way, silently.
--
-- Replaced with an explicit list. Adding a function now means adding a line
-- here, which is the intended cost.

revoke execute on all functions in schema public from authenticated, service_role;

grant execute on function public.set_updated_at()                              to authenticated, service_role;
grant execute on function public.job_signal_snapshot(uuid)                     to authenticated, service_role;
grant execute on function public.save_job(uuid)                                to authenticated, service_role;
grant execute on function public.dismiss_job(uuid, text, text)                 to authenticated, service_role;
grant execute on function public.create_application(uuid, text)                to authenticated, service_role;
grant execute on function public.set_application_status(uuid, text, text, timestamptz)
                                                                               to authenticated, service_role;
grant execute on function public.log_outreach_sent(
  uuid, text, text, uuid, uuid, text, jsonb, timestamptz
)                                                                              to authenticated, service_role;
