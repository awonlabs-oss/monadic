-- monadic — invariant-preserving functions and read views
--
-- Every function here is SECURITY INVOKER. They exist to make a multi-table
-- invariant atomic, not to escape RLS — the caller's policies still apply to
-- every statement inside them.
--
-- The rule: any operation that must write two tables or none goes here. Any
-- operation that touches one table stays a plain query in the data layer.

-- ---------------------------------------------------------------------------
-- Saving and dismissing: job_interactions + job_signals must move together.
-- ---------------------------------------------------------------------------

-- Snapshot of the facts a future scoring model would want to have known at the
-- moment of the signal, taken before re-ingestion can change them.
create or replace function public.job_signal_snapshot(p_job_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'title',         j.title,
    'company_id',    j.company_id,
    'role_type',     j.role_type,
    'seniority',     j.seniority,
    'remote_policy', j.remote_policy,
    'location_raw',  j.location_raw,
    'comp_min',      j.comp_min,
    'comp_max',      j.comp_max,
    'comp_source',   j.comp_source,
    'years_min',     j.years_min,
    'years_source',  j.years_source,
    'first_seen_at', j.first_seen_at
  )
  from public.jobs j
  where j.id = p_job_id;
$$;

create or replace function public.save_job(p_job_id uuid)
returns public.job_interactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row     public.job_interactions;
begin
  if v_user_id is null then
    raise exception 'save_job requires an authenticated session';
  end if;

  insert into public.job_interactions (user_id, job_id, state, saved_at)
  values (v_user_id, p_job_id, 'saved', now())
  on conflict (user_id, job_id) do update
    set state                 = 'saved',
        saved_at              = now(),
        dismissal_reason_code = null,
        dismissal_note        = null,
        dismissed_at          = null
  returning * into v_row;

  insert into public.job_signals (user_id, job_id, signal, job_snapshot)
  select v_user_id, p_job_id, 'saved', public.job_signal_snapshot(p_job_id);

  return v_row;
end;
$$;

create or replace function public.dismiss_job(
  p_job_id      uuid,
  p_reason_code text,
  p_note        text default null
)
returns public.job_interactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row     public.job_interactions;
begin
  if v_user_id is null then
    raise exception 'dismiss_job requires an authenticated session';
  end if;

  insert into public.job_interactions (
    user_id, job_id, state, dismissal_reason_code, dismissal_note, dismissed_at
  )
  values (v_user_id, p_job_id, 'dismissed', p_reason_code, p_note, now())
  on conflict (user_id, job_id) do update
    set state                 = 'dismissed',
        dismissal_reason_code = excluded.dismissal_reason_code,
        dismissal_note        = excluded.dismissal_note,
        dismissed_at          = now(),
        saved_at              = null
  returning * into v_row;

  insert into public.job_signals (user_id, job_id, signal, reason_code, reason_note, job_snapshot)
  select v_user_id, p_job_id, 'dismissed', p_reason_code, p_note,
         public.job_signal_snapshot(p_job_id);

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Applications: status and timeline must move together.
-- ---------------------------------------------------------------------------

create or replace function public.create_application(
  p_job_id uuid,
  p_source text default 'job_feed'
)
returns public.applications
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_app     public.applications;
begin
  if v_user_id is null then
    raise exception 'create_application requires an authenticated session';
  end if;

  insert into public.applications (user_id, job_id, status, status_changed_at, source)
  values (v_user_id, p_job_id, 'shortlisted', now(), p_source)
  returning * into v_app;

  insert into public.application_events (
    user_id, application_id, event_type, occurred_at, to_status, title
  )
  values (
    v_user_id, v_app.id, 'created', now(), 'shortlisted', 'Application created'
  );

  return v_app;
end;
$$;

create or replace function public.set_application_status(
  p_application_id uuid,
  p_status         text,
  p_note           text default null,
  p_occurred_at    timestamptz default now()
)
returns public.applications
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_from    text;
  v_app     public.applications;
begin
  if v_user_id is null then
    raise exception 'set_application_status requires an authenticated session';
  end if;

  select status into v_from
  from public.applications
  where id = p_application_id
  for update;

  if v_from is null then
    raise exception 'application % not found or not visible', p_application_id;
  end if;

  update public.applications
     set status            = p_status,
         status_changed_at = p_occurred_at,
         applied_at        = case
                               when p_status = 'applied' and applied_at is null then p_occurred_at
                               else applied_at
                             end
   where id = p_application_id
  returning * into v_app;

  insert into public.application_events (
    user_id, application_id, event_type, occurred_at, from_status, to_status, body
  )
  values (
    v_user_id, p_application_id, 'status_change', p_occurred_at, v_from, p_status, p_note
  );

  return v_app;
end;
$$;

-- ---------------------------------------------------------------------------
-- Outreach: a sent message must land on the application timeline.
-- ---------------------------------------------------------------------------

create or replace function public.log_outreach_sent(
  p_contact_id     uuid,
  p_body           text,
  p_subject        text default null,
  p_application_id uuid default null,
  p_template_id    uuid default null,
  p_channel        text default 'email',
  p_variables      jsonb default '{}'::jsonb,
  p_sent_at        timestamptz default now()
)
returns public.outreach_messages
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_msg     public.outreach_messages;
  v_name    text;
begin
  if v_user_id is null then
    raise exception 'log_outreach_sent requires an authenticated session';
  end if;

  insert into public.outreach_messages (
    user_id, contact_id, application_id, template_id,
    channel, subject, body, variables_snapshot, sent_at
  )
  values (
    v_user_id, p_contact_id, p_application_id, p_template_id,
    p_channel, p_subject, p_body, p_variables, p_sent_at
  )
  returning * into v_msg;

  if p_application_id is not null then
    select full_name into v_name from public.contacts where id = p_contact_id;

    insert into public.application_events (
      user_id, application_id, event_type, occurred_at,
      title, body, contact_id, outreach_message_id
    )
    values (
      v_user_id, p_application_id, 'message_sent', p_sent_at,
      coalesce('Outreach sent to ' || v_name, 'Outreach sent'),
      coalesce(p_subject, left(p_body, 200)),
      p_contact_id, v_msg.id
    );
  end if;

  return v_msg;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read views
-- ---------------------------------------------------------------------------
-- security_invoker so the caller's RLS applies. Without it a view would run as
-- its owner and quietly become a hole straight through every policy below.

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

comment on view public.job_feed is
  'Jobs joined to the current user''s interaction and application state. Read-only; writes go to the underlying tables.';

-- Staleness depends on now(), so it cannot be a stored generated column. It is
-- computed here so the definition of "stale" lives in exactly one place.
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
  j.closed_at         as job_closed_at,
  j.comp_min,
  j.comp_max,
  j.comp_currency,
  c.id                as company_id,
  c.name              as company_name,
  ev.last_event_at,
  (a.next_action_at is not null and a.next_action_at < current_date)
                      as next_action_overdue,
  (a.status not in ('offer', 'rejected', 'withdrawn')
    and coalesce(ev.last_event_at, a.created_at) < now() - interval '14 days')
                      as is_stale
from public.applications a
join public.jobs j      on j.id = a.job_id
join public.companies c on c.id = j.company_id
left join lateral (
  select max(e.occurred_at) as last_event_at
  from public.application_events e
  where e.application_id = a.id
) ev on true;

comment on view public.application_overview is
  'Applications joined to job and company, with staleness computed. The 14-day stale threshold is defined here and nowhere else.';
