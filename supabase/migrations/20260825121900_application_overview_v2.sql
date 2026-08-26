-- monadic — what the pipeline board needs from an application
--
-- Adds the company identity the card renders (logo tile, name), the job's URL,
-- and days_in_stage.
--
-- days_in_stage rather than a stored is_stale flag: "needs action" is a
-- per-stage judgement, not one global threshold. A job saved six days ago and
-- never applied to needs a nudge; an application in an interview loop for six
-- days is simply in progress. The view supplies the number and the application
-- layer owns the thresholds, so retuning them is a config change rather than a
-- migration.
--
-- is_stale is kept for compatibility but is now the coarse 14-day signal only.

drop view if exists public.application_overview;

create view public.application_overview
with (security_invoker = true)
as
select
  a.id,
  a.user_id,
  a.job_id,
  a.status,
  a.status_changed_at,
  a.applied_at,
  a.next_action,
  a.next_action_at,
  a.source,
  a.created_at,
  a.updated_at,

  j.title             as job_title,
  j.url               as job_url,
  j.location_raw,
  j.remote_policy,
  j.closed_at         as job_closed_at,
  j.comp_min,
  j.comp_max,
  j.comp_currency,
  j.comp_source,

  c.id                as company_id,
  c.name              as company_name,
  c.slug              as company_slug,
  c.logo_url          as company_logo_url,

  ev.last_event_at,
  ev.event_count,

  -- Whole days since the card last moved. The board decides what counts as too
  -- long for each column.
  floor(extract(epoch from (now() - a.status_changed_at)) / 86400)::int
                      as days_in_stage,

  (a.next_action_at is not null and a.next_action_at < current_date)
                      as next_action_overdue,

  (a.status not in ('offer', 'rejected', 'withdrawn')
    and coalesce(ev.last_event_at, a.created_at) < now() - interval '14 days')
                      as is_stale
from public.applications a
join public.jobs j      on j.id = a.job_id
join public.companies c on c.id = j.company_id
left join lateral (
  select max(e.occurred_at) as last_event_at, count(*) as event_count
  from public.application_events e
  where e.application_id = a.id
) ev on true;

comment on view public.application_overview is
  'Applications joined to job and company, with days_in_stage. Per-stage "needs action" thresholds live in the application layer, not here.';
