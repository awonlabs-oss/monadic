-- monadic — expose employment_type on the job feed
--
-- The JobCard's tag row shows employment type ("Full-time") as its first tag,
-- but job_feed never selected the column, so the card had no way to read it.
--
-- Worth knowing while looking at this: Greenhouse returns no employment type at
-- all, so roughly 1,375 of the current postings will render without that tag.
-- The card handles it by omitting the tag rather than substituting copy —
-- unlike years-required, where DESIGN.md section 7 explicitly requires
-- "Yrs not stated" so an absent tag cannot be misread as "checked, and fine".

-- Dropped and recreated rather than CREATE OR REPLACE: Postgres only allows
-- replace to append columns, and employment_type belongs beside the other job
-- attributes rather than tacked on the end. Views hold no data, so this is free.
drop view if exists public.job_feed;

create view public.job_feed
with (security_invoker = true)
as
select
  j.id,
  j.company_id,
  c.name              as company_name,
  c.slug              as company_slug,
  j.source,
  j.title,
  j.url,
  j.department,
  j.team,
  j.employment_type,
  j.location_raw,
  j.location_city,
  j.location_region,
  j.location_country,
  j.remote_policy,
  j.role_type,
  j.seniority,
  j.comp_min,
  j.comp_max,
  j.comp_currency,
  j.comp_period,
  j.comp_source,
  j.comp_note,
  j.years_min,
  j.years_max,
  j.years_source,
  j.posted_at,
  j.first_seen_at,
  j.last_seen_at,
  j.closed_at,
  j.is_open,
  coalesce(ji.state, 'none') as interaction_state,
  ji.dismissal_reason_code,
  a.id                       as application_id,
  a.status                   as application_status
from public.jobs j
join public.companies c on c.id = j.company_id
left join public.job_interactions ji
  on ji.job_id = j.id and ji.user_id = (select auth.uid())
left join public.applications a
  on a.job_id = j.id and a.user_id = (select auth.uid());
