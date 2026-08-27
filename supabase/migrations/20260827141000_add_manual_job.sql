-- monadic — add a posting by hand, without handing the app the service key
--
-- companies and jobs are ingestion-owned globals. The app user is deliberately
-- refused write access to both, check:rls asserts that refusal, and an eslint
-- rule stops the service client being imported outside scripts/. All three are
-- worth keeping: they are what makes "the app cannot invent a job" checkable
-- rather than merely intended.
--
-- Adding a link by hand still has to write those two tables. So it does it the
-- way every other privileged write in this schema does — through one security
-- definer function, where the escalation is a single reviewable surface instead
-- of a key in the request path.
--
-- What the function will and will not do is the whole point of it existing:
--
--   * It inserts a job and, if needed, the company that job belongs to. It
--     cannot update or delete either. A caller cannot use it to rewrite an
--     ingested posting, because ON CONFLICT returns the existing id and touches
--     nothing.
--   * It refuses a source other than 'manual' unless the company for that board
--     already exists. That stops a caller minting a fake Greenhouse company;
--     resolving a real board is the resolver's job, not a form's.
--   * It is granted to authenticated only, and takes no user_id — it writes
--     nothing user-scoped. The application row is created separately by
--     create_application, under RLS, as it is for any other job.

create function public.add_manual_job(
  p_company_name text,
  p_source       public.ats_source,
  p_job          jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug       text;
  v_company_id uuid;
  v_job_id     uuid;
  v_source_id  text := nullif(btrim(p_job ->> 'source_job_id'), '');
  v_title      text := nullif(btrim(p_job ->> 'title'), '');
begin
  if v_source_id is null then
    raise exception 'source_job_id is required';
  end if;
  if v_title is null then
    raise exception 'title is required';
  end if;

  -- Already present wins, always. A link to a posting the feed already carries
  -- must return that row — with its interactions and history — never a copy.
  select id into v_job_id
    from public.jobs
   where source = p_source and source_job_id = v_source_id;
  if v_job_id is not null then
    return v_job_id;
  end if;

  v_slug := left(
    regexp_replace(lower(coalesce(nullif(btrim(p_company_name), ''), 'unknown company')),
                   '[^a-z0-9]+', '-', 'g'),
    60);
  v_slug := btrim(v_slug, '-');
  if v_slug = '' then v_slug := 'unknown-company'; end if;

  select id into v_company_id from public.companies where slug = v_slug;

  if v_company_id is null then
    -- Only a manual posting may bring a new company with it. A board source
    -- naming a company that does not exist here means the resolver has never
    -- seen it, and a form is not the place to decide it has.
    if p_source <> 'manual' then
      raise exception 'no company for board source %; resolve it first', p_source;
    end if;

    insert into public.companies (
      name, slug, ats_source, ats_slug,
      ats_resolution_status, ats_resolution_method, ats_resolved_at
    )
    values (
      coalesce(nullif(btrim(p_company_name), ''), 'Unknown company'), v_slug,
      'manual', v_slug, 'manual', 'manual', now()
    )
    returning id into v_company_id;
  end if;

  insert into public.jobs (
    company_id, source, source_job_id, url, title, department, team,
    employment_type, location_raw, location_cities, location_countries,
    us_eligible, remote_policy, comp_min, comp_max, comp_currency, comp_period,
    comp_source, comp_note, years_min, years_max, years_source,
    description_html, description_text, posted_at, content_hash, raw
  )
  values (
    v_company_id, p_source, v_source_id, p_job ->> 'url', v_title,
    p_job ->> 'department', p_job ->> 'team', p_job ->> 'employment_type',
    p_job ->> 'location_raw',
    coalesce((select array_agg(value) from jsonb_array_elements_text(p_job -> 'location_cities')), '{}'),
    coalesce((select array_agg(value) from jsonb_array_elements_text(p_job -> 'location_countries')), '{}'),
    coalesce((p_job ->> 'us_eligible')::boolean, false),
    p_job ->> 'remote_policy',
    (p_job ->> 'comp_min')::numeric, (p_job ->> 'comp_max')::numeric,
    p_job ->> 'comp_currency', p_job ->> 'comp_period',
    coalesce(p_job ->> 'comp_source', 'none'), p_job ->> 'comp_note',
    (p_job ->> 'years_min')::smallint, (p_job ->> 'years_max')::smallint,
    coalesce(p_job ->> 'years_source', 'none'),
    p_job ->> 'description_html', p_job ->> 'description_text',
    (p_job ->> 'posted_at')::timestamptz,
    p_job ->> 'content_hash',
    coalesce(p_job -> 'raw', '{}'::jsonb)
  )
  -- Two people pasting the same link at once, or a board pull landing between
  -- the lookup above and this insert. Either way the existing row is the answer.
  on conflict (source, source_job_id) do update set source_job_id = excluded.source_job_id
  returning id into v_job_id;

  return v_job_id;
end;
$$;

comment on function public.add_manual_job(text, public.ats_source, jsonb) is
  'Insert a hand-added posting and, for source = manual only, the company it belongs to. Returns an existing job id unchanged when one already matches.';

revoke execute on function public.add_manual_job(text, public.ats_source, jsonb) from public;
grant execute on function public.add_manual_job(text, public.ats_source, jsonb) to authenticated;
