-- monadic — a hand-added company needs a website and a logo like any other
--
-- The first version of add_manual_job took a name and nothing else, so a
-- company created from a pasted link had website_url null. That is not a
-- cosmetic gap: scripts/logos.ts and the logo step in ingest both select on
-- `website_url is not null`, so such a company was permanently invisible to
-- logo resolution and its cards showed a monogram forever. There was no run
-- that would ever fix it.
--
-- Passing the resolved logo in rather than resolving it here is deliberate.
-- Postgres should not be making outbound HTTP requests, and the resolver that
-- measures candidate icons already exists in src/ingest/logo.ts and is used by
-- both other callers. This function stores what that resolver found.
--
-- Dropped and recreated because the signature changes; CREATE OR REPLACE
-- cannot add parameters.

drop function if exists public.add_manual_job(text, public.ats_source, jsonb);

create function public.add_manual_job(
  p_company_name    text,
  p_source          public.ats_source,
  p_job             jsonb,
  p_company_website text default null,
  p_company_logo    text default null
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
    if p_source <> 'manual' then
      raise exception 'no company for board source %; resolve it first', p_source;
    end if;

    insert into public.companies (
      name, slug, website_url, logo_url, ats_source, ats_slug,
      ats_resolution_status, ats_resolution_method, ats_resolved_at
    )
    values (
      coalesce(nullif(btrim(p_company_name), ''), 'Unknown company'), v_slug,
      nullif(btrim(p_company_website), ''), nullif(btrim(p_company_logo), ''),
      'manual', v_slug, 'manual', 'manual', now()
    )
    returning id into v_company_id;
  else
    -- An existing company keeps its name — it was seeded or resolved and is not
    -- up for revision by a link. But a gap can be filled: a company that has
    -- never had a website or a logo takes one when a paste happens to carry it,
    -- which is also what makes it visible to logo resolution from then on.
    update public.companies
       set website_url = coalesce(website_url, nullif(btrim(p_company_website), '')),
           logo_url    = coalesce(logo_url, nullif(btrim(p_company_logo), ''))
     where id = v_company_id
       and (website_url is null or logo_url is null);
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
  on conflict (source, source_job_id) do update set source_job_id = excluded.source_job_id
  returning id into v_job_id;

  return v_job_id;
end;
$$;

comment on function public.add_manual_job(text, public.ats_source, jsonb, text, text) is
  'Insert a hand-added posting and, for source = manual only, the company it belongs to. Fills a missing website or logo on an existing company; never renames one. Returns an existing job id unchanged when one already matches.';

revoke execute on function public.add_manual_job(text, public.ats_source, jsonb, text, text) from public;
grant execute on function public.add_manual_job(text, public.ats_source, jsonb, text, text) to authenticated;
