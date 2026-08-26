-- monadic — parsed location, so the feed can be scoped to the US and filtered by city
--
-- location_city / region / country existed from the first migration and were
-- never populated: ATS location strings are free text and the shapes vary too
-- much to parse casually. Measured across 2,380 real postings they use four
-- different separators and commas serve as both the city/state delimiter and
-- the between-locations delimiter.
--
-- Arrays rather than single values because a posting routinely names several
-- places — "San Francisco, CA | New York City, NY | Seattle, WA" is one job you
-- can take in any of three cities, and a single city column would have to throw
-- two of them away and then answer the city filter wrongly.
--
-- us_eligible is stored rather than derived on read because "could a US-based
-- person take this" is a judgement combining country, remote policy and the
-- absence of a stated country, and it belongs in one place.

alter table public.jobs
  add column if not exists location_cities    text[] not null default '{}',
  add column if not exists location_countries text[] not null default '{}',
  add column if not exists us_eligible        boolean not null default false;

comment on column public.jobs.location_cities is
  'Canonical city names parsed from location_raw. Several per job is normal.';
comment on column public.jobs.us_eligible is
  'True when a US-based person could plausibly take the role, including postings that say only "Remote" with no country named.';

create index if not exists jobs_location_cities_idx
  on public.jobs using gin (location_cities);
create index if not exists jobs_us_eligible_idx
  on public.jobs (us_eligible) where closed_at is null;
