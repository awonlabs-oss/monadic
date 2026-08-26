# monadic — schema notes and build plan

Deliverable for the pre-code review gate. Nothing in `src/` exists yet and nothing
will until this is signed off.

---

## 0. Repo state — three things did not match the brief

**The design files were not in the repo.** The brief lists `design/DESIGN.md` and
`design/tokens.json` as present at root. The repo contained only
`design/references/.gitkeep`; the actual files were sitting in
`~/Downloads/monadic_start/`. I copied both to `design/`, unmodified. Confirm that
is the right pair — if you have newer versions, they win and I will re-read them.

**There was no `.gitignore`.** The brief says it already excludes `*.pdf` and
`*.docx`, which is the guardrail keeping your resume out of commits. It did not
exist, so an early `git add -A` would have committed a resume. I wrote one covering
`*.pdf`, `*.docx`, `.env*`, `.next/`, and Supabase local state. It is the one piece
of non-schema work I did without asking; the alternative was leaving a live hazard
open through the review.

**There is no `README.md`** either. It is on the build order below.

### Blocker: no container runtime

`supabase start` needs Docker, and this machine has no Docker, OrbStack, colima, or
podman, and no local Postgres either. **I have not executed these migrations.** They
are written carefully but they are unverified — nothing below should be read as
"tested." First thing after sign-off is installing a runtime and running
`supabase db reset`, which will shake out anything I got wrong.

---

## 1. The schema

Nine migrations in `supabase/migrations/`, one concern each.

| File | Contents |
|---|---|
| `…120000_shared.sql` | `set_updated_at()` trigger fn, `ats_source` enum |
| `…120100_companies.sql` | `companies`, `tracked_companies` |
| `…120200_jobs.sql` | `jobs`, `ingestion_runs` |
| `…120300_profile.sql` | `profiles`, `profile_experiences`, `profile_skills`, `profile_education`, `search_criteria` |
| `…120400_job_interactions.sql` | `dismissal_reasons`, `job_interactions`, `job_signals` |
| `…120500_contacts.sql` | `contacts` |
| `…120600_applications.sql` | `applications`, `application_contacts`, `application_events` |
| `…120700_outreach.sql` | `outreach_templates`, `outreach_messages` |
| `…120800_functions_and_views.sql` | invariant functions, `job_feed`, `application_overview` |
| `…120900_rls.sql` | every policy, every grant |

`supabase/seed.sql` holds the dismissal-reason vocabulary. No sample jobs, companies,
or applications anywhere.

### The ownership split

Global, ingestion-owned, no `user_id`: `companies`, `jobs`, `ingestion_runs`,
`dismissal_reasons`. "Acme uses Greenhouse under slug `acme`" is a fact about the
world, not about you.

User-scoped, `user_id` referencing `auth.users`, RLS on every one: everything else.

Which companies *you* track is `tracked_companies`, a user-scoped join. That is the
piece that makes the multi-user claim real — without it, a second user would need a
migration to have their own seed list, which is exactly what the brief says must
never happen.

### How the app talks to the database

Three clients, and the split matters:

- **`lib/supabase/server.ts`** — anon key plus a real session for the seeded user.
  Every app route uses this, so **RLS is actually exercised on every request**. A
  broken policy fails loudly during development instead of on the day you add auth.
- **`lib/supabase/client.ts`** — browser, anon key, same session.
- **`lib/supabase/service.ts`** — service role. Imported *only* by `scripts/`, never
  by anything under `src/app`. It writes the global tables, which have no write
  policy at all. I will add a lint rule forbidding the import path from app code.

The alternative — running the whole app on the service role — is less work and would
mean the RLS policies are never executed once. They would be decorative, and would
be wrong by the time you needed them.

### Decisions worth arguing about

**Vocabularies are split three ways, on purpose.**

- *Enum* for `ats_source`. A source only exists if a puller was written for it, so
  adding a value always comes with a code change anyway.
- *CHECK constraint* for settled sets: application status, `comp_source`,
  `remote_policy`. You enumerated the pipeline statuses explicitly, so they are
  settled.
- *Lookup table* for `dismissal_reasons`. This vocabulary will churn as you learn
  what you actually reject things for, and it is the one vocabulary that gets
  trained on later — so it needs referential integrity *and* needs to grow by
  `INSERT` rather than by migration. A CHECK constraint would force a migration
  every time you invent a reason.
- *Unconstrained text* for `role_type` and `seniority` on jobs, because they are
  derived by heuristics whose vocabulary is not settled at all. See decision 4.

**Compensation and years carry provenance, not just values.** `comp_source` is
`none | structured | description`, and a CHECK refuses a comp figure that does not
say where it came from. This is what lets the UI distinguish "not listed" from "we
read it out of prose and might be wrong" — those are different empty states and
DESIGN.md §7 will need to design both. Same shape for `years_source`.

**`jobs.raw` is the source of truth; typed columns are a projection.** Every typed
field except company, source, source id, and title is nullable. There is a GIN index
on `raw`, so filtering on a field I have not extracted yet is a query, not a
migration. When one earns a column, it is an `ALTER` plus a backfill from `raw` —
never a re-ingestion.

**Closure detection is gated by a database constraint, not by ingestion code.**
`ingestion_runs.closure_applied` may only be `true` when `status = 'success'`. A
failed, partial, or 304 run physically cannot be recorded as having closed anything.
The rule you care about is enforced one level below the code that could forget it.

**History is append-only by absence of policy.** `application_events` and
`job_signals` have SELECT and INSERT policies and no UPDATE or DELETE policy
anywhere in the schema. There is no way to edit history through the API. That is
stronger than a convention and it is why `applications.status` is explicitly
documented as a cache of the latest `status_change` event.

> **Caveat found while verifying this against the live database.** RLS does not
> raise on a blocked UPDATE or DELETE — it filters the row set, so the statement
> succeeds having affected zero rows. Confirmed against real rows: an `update
> application_events` as the owning user returns `row_count = 0` rather than an
> error. So `src/lib/data/` must never expose an event update or delete; if one
> were written it would appear to work and silently do nothing, which is worse
> than an error. Anything that looks like editing an event is a new compensating
> event.

**Multi-table invariants live in SQL functions, all `SECURITY INVOKER`.**
`save_job`, `dismiss_job`, `create_application`, `set_application_status`,
`log_outreach_sent`. Each one writes two tables that must move together. They are
invoker-rights, so they are not an RLS bypass — your policies still apply to every
statement inside them. I chose functions over triggers because the coupling is then
visible at the call site instead of firing invisibly.

**`job_signals` snapshots the job at signal time.** Jobs mutate on re-ingestion — a
posting gains a comp range next Tuesday. Without a snapshot, a dismissal you made
for `comp_not_stated` would later appear to have been made against a posting that
did state comp. That silently poisons the training data the reasons exist for.

**`applications.job_id` is `ON DELETE RESTRICT`.** Jobs are closed, never deleted, so
this should never fire. It is there to guarantee ingestion can never destroy an
application.

**Staleness lives in a view, not a column.** It depends on `now()`, so it cannot be
a stored generated column. `application_overview` defines it once — currently
14 days since the last event, plus a separate `next_action_overdue` flag. Both
thresholds are in one place so you can retune them without hunting through queries.

---

## 2. Decisions — resolved

All answered. Recorded here so the reasoning survives the conversation.

| # | Decision | Chosen |
|---|---|---|
| 1 | Resume parsing | **LLM structured output**, Anthropic, server-side only |
| 2 | Overloaded `saved` | **Renamed** the first application status to `shortlisted` |
| 3 | `role_type` / `seniority` | **Keyword rules over the title**, config-driven, backfillable |
| 4 | Clean 200 with zero jobs | **Never closes on one empty pull** |
| 5 | `/` route | **Redirect to `/jobs`** until frontpage mockups land |
| 6 | Tailwind | **v4**, CSS-first `@theme` |

### 1. Resume parsing — LLM, server-side

One structured-output call against a schema, from a route handler so the key never
reaches the browser. Behind a `ResumeParser` interface, so swapping it later touches
one file. The env var goes in `.env.example` empty.

This also removes a dependency: the Anthropic API accepts PDFs directly as document
input, so **no PDF text extractor is needed** — the file goes to the model as-is.
DOCX still needs an extractor, since it cannot be sent natively. I will confirm
current model, pricing, and the document-input contract against live reference before
writing the call rather than working from memory.

### 2. `saved` → `shortlisted`

A job saved in the feed is `job_interactions.state = 'saved'` — a bookmark. An
application is a tracked pipeline entry, and its first status is now `shortlisted`.
Applied to the migrations: the CHECK constraint, the column default, and
`create_application()`. `job_interactions` and `job_signals` keep `saved`, which is
now unambiguous.

### 3. Classification — keyword rules over the title

Vocabulary lives in a config file under `src/lib/domain/`, shared by the app and the
ingestion scripts so it cannot drift. Stored on the job row, recomputed by
`scripts/reclassify.ts` without re-fetching any board. Crude and inspectable by
design: you can always read why a posting got the label it got. Signed off as not
constituting the out-of-scope "automated scoring."

### 4. Empty pulls never close on their own

A 200 returning zero jobs for a company that previously had open jobs is recorded as
`status = 'empty_suspect'`, closes nothing, and surfaces on `/settings/runs`. Closure
requires a non-empty successful pull, or two consecutive empty ones. Already encoded:
`ingestion_runs.closure_applied` is constrained to `status = 'success'`, so a suspect
run physically cannot record a closure.

### 5. `/` redirects to `/jobs`

One line, no component, no design surface. Deleted and replaced when frontpage
mockups arrive.

### 6. Tailwind v4

`tokens.json` generates one CSS file; every token becomes a utility automatically.
No second JS theme object to drift out of sync. A token with no corresponding utility
becomes impossible by construction, which is what makes the no-raw-values rule
enforceable by grep rather than by discipline.

### Dependencies

Approved by the above: `@anthropic-ai/sdk`.

Still needed, and not yet explicitly approved — flagging rather than assuming:

- **`zod`** — validating LLM parser output and filter query params before either
  reaches the database. The parser case is the load-bearing one: a model returning a
  malformed profile object should fail at the boundary, not halfway through an insert.
- **A DOCX text extractor** (`mammoth` or equivalent) — unavoidable for `.docx`
  resumes given PDFs now go to the model directly. Skippable only if you are willing
  to convert DOCX to PDF by hand before uploading.

Nothing else beyond what the stack implies.

---

## 3. Decisions I made unilaterally — reviewed, all kept

Offered for override, none changed:

- **A failed resolution is cached like a successful one.** "Never run twice for the
  same company" taken literally includes failures, otherwise every run retries every
  broken company forever. Clearing `ats_resolved_at` is the deliberate retry, and
  `npm run resolve -- --force <slug>` will do it.
- **Domains folded into `profile_skills` as `category = 'domain'`** rather than their
  own table. They behave identically and scoring will match them the same way.
- **The resume file itself is never stored** — only the structured parse, the raw
  parser output, and a file hash. Nothing to leak, nothing to gitignore.
- **Contacts link to applications through a join table**, because the same recruiter
  reappears on the next role at the same company.
- **Sent/opened/replied are three nullable timestamps**, not a status enum. They are
  not mutually exclusive and two are frequently unknowable — a null `opened_at`
  means "no idea," which is the honest default and is what the UI must render.
- **The `anon` role is revoked outright.** There is no unauthenticated surface here
  and there should not accidentally become one.

---

## 4. What the schema anticipates but does not build

Flagged per the brief's instruction to mention rather than scaffold:

- **Scoring** — `job_signals` with reasons and job snapshots is the training set.
  No score column, no ranking, nothing computed.
- **Company discovery** — `companies` is separate from `tracked_companies`, so a
  discovery source could populate the former without touching your list. No
  discovery code.
- **Email sending** — `outreach_messages.sent_at` is recorded by hand. No provider,
  no webhook, no sending.
- **Multi-user** — every user-scoped table already carries `user_id` with a real
  policy. Adding auth is a login screen and nothing else.

Nothing in the schema anticipates autofill, resume tailoring, paid enrichment, or
scheduled ingestion.

---

## 5. File tree

```
monadic/
├── design/                              # yours. I only touch tokens.json, on a Figma export
│   ├── DESIGN.md
│   ├── tokens.json
│   └── references/
├── docs/
│   └── BUILD_PLAN.md
├── supabase/
│   ├── config.toml                      # generated by `supabase init`
│   ├── migrations/                      # the nine files above
│   └── seed.sql                         # dismissal vocabulary only
├── scripts/
│   ├── build-tokens.ts                  # tokens.json -> CSS. Runs on prebuild and predev
│   ├── seed-user.ts                     # creates the local auth user from .env.local
│   ├── resolve.ts                       # npm run resolve
│   ├── ingest.ts                        # npm run ingest
│   └── reclassify.ts                    # backfill role_type/seniority without re-fetching
├── src/
│   ├── app/
│   │   ├── layout.tsx                   # nav landmark, skip link, token stylesheet
│   │   ├── page.tsx                     # redirect to /jobs; deleted when the frontpage lands
│   │   ├── jobs/{page.tsx,[id]/page.tsx}
│   │   ├── applications/{page.tsx,[id]/page.tsx}
│   │   ├── contacts/page.tsx
│   │   ├── templates/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── settings/companies/page.tsx
│   │   ├── settings/runs/page.tsx
│   │   └── api/profile/parse/route.ts   # upload endpoint; parsing is not a server action
│   ├── components/
│   │   ├── ui/                          # shadcn primitives, restyled through tokens
│   │   └── <feature components per DESIGN.md §5, as designs land>
│   ├── styles/
│   │   ├── globals.css
│   │   └── tokens.generated.css         # build output. Never hand-edited, gitignored
│   ├── lib/
│   │   ├── env.ts                       # parsed and validated at boot, fails fast
│   │   ├── supabase/{client,server,service,types}.ts
│   │   ├── domain/                      # zod schemas + shared vocabularies
│   │   └── data/                        # jobs.ts, applications.ts, contacts.ts, …
│   ├── ingest/
│   │   ├── types.ts                     # JobSource interface, NormalizedJob
│   │   ├── http.ts                      # UA, backoff, conditional requests, concurrency gate
│   │   ├── companies.config.ts          # the ~20 companies
│   │   ├── resolver/{index,probe,fingerprint}.ts
│   │   ├── sources/{greenhouse,ashby,lever}.ts
│   │   ├── normalize/{comp,years,location,classify}.ts
│   │   └── persist.ts                   # upsert, closure, run logging
│   ├── profile/
│   │   ├── types.ts
│   │   ├── extract.ts                   # docx -> text. PDFs go to the model as-is
│   │   └── parse/{index,anthropic}.ts   # behind ResumeParser
│   ├── contacts/
│   │   ├── provider.ts                  # ContactProvider interface
│   │   └── manual.ts                    # the only implementation
│   └── outreach/
│       └── render.ts                    # {{job.*}} {{company.*}} {{profile.*}} substitution
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

## 6. What each module owns

**`src/lib/data/`** is the only place in the app that issues a Supabase query. Routes
and components call it; they never build queries themselves. This is what keeps the
RLS story checkable — there is one layer to audit.

**`src/lib/domain/`** holds zod schemas and the vocabularies (role types, seniority
levels, template variables) shared between the app and the ingestion scripts. Both
import from here so a vocabulary cannot drift between the two.

**`src/ingest/http.ts`** owns every outbound request: the real User-Agent, the
concurrency gate, exponential backoff on 429 and 5xx honouring `Retry-After`, and
conditional requests via stored ETag. No source file calls `fetch` directly, so
"respect the sources" is enforced in one file rather than remembered in three.

**`src/ingest/sources/*`** each implement one `JobSource` interface: fetch the board,
return `NormalizedJob[]` plus the untouched raw payload. They know their ATS's shape
and nothing about the database.

**`src/ingest/persist.ts`** owns the database side: upsert by `(source,
source_job_id)`, bump `last_seen_at`, apply closure only after a genuine success, and
write the `ingestion_runs` row. Sources cannot write; persist cannot fetch.

**`src/contacts/provider.ts`** defines `ContactProvider`. `manual.ts` is the only
implementation. Calling code depends on the interface, so a paid provider is a new
file and a config line.

**`scripts/build-tokens.ts`** reads `design/tokens.json` and emits
`src/styles/tokens.generated.css`. It runs on `predev` and `prebuild`, so a token
change cannot fail to propagate. The output is gitignored — `tokens.json` is the
only tracked source of design values, which is what makes "no raw values in
component code" auditable by grep.

### On the ATS endpoints

The pullers target `boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`,
`api.lever.co/v0/postings/{slug}?mode=json`, and
`api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true`. I am
reasonably confident in those shapes but I have not called them in this session —
step 5 below starts by hitting one real board and reading the actual response before
writing the normalizer, rather than trusting my recollection of the field names.

Structured compensation availability differs by source: Ashby returns it when asked,
Lever sometimes has `salaryRange`, Greenhouse mostly does not. This is why
`comp_source` exists.

## 7. Build order

Each step is one commit. Steps 1–4 produce no UI.

1. **Repo hygiene** — `.gitignore`, design files in place, this document.
2. **Schema** — the nine migrations and `seed.sql`. *(this deliverable)*
3. **Scaffold** — Next.js + TypeScript + Tailwind into the existing root, the token
   build script, `.env.example`. No components. Verify a token change reaches a
   utility class before anything is built on top.
4. **Supabase wiring** — the three clients, `env.ts`, generated types,
   `seed-user.ts`. Ends with a script that proves RLS works: read as the seeded user,
   fail to read as a different one.
5. **Ingestion core** — `http.ts`, `types.ts`, the resolver, `companies.config.ts`.
   `npm run resolve` resolves the 20 companies and caches the result.
6. **First puller end to end** — Greenhouse + `persist.ts` + run logging + closure.
   `npm run ingest` puts real jobs in the database. This is the first point where the
   project is worth anything.
7. **Ashby and Lever** — same interface, no changes to persist.
8. **Normalizers** — comp, years, location, classify, plus `reclassify.ts`.
9. **App shell + `/settings/runs`** — semantic layout, nav landmark, and the
   ingestion health table. Deliberately first: it is the least design-dependent
   surface, and it is the one that tells you whether ingestion is rotting.
10. **`/jobs` + `/jobs/[id]`** — list, filters, detail, save and dismiss.
11. **`/profile`** — upload, parse, edit, search criteria.
12. **`/applications` + `/applications/[id]`** — pipeline and timeline.
13. **`/contacts`** — the manual `ContactProvider`.
14. **`/templates` + outreach logging.**
15. **`/settings/companies`.**
16. **README** — Supabase CLI setup, migrations, env vars, seeding, ingestion.

Every UI step, 9 onward, is structure and tokens only. DESIGN.md marks §9
Accessibility DECIDED and §2 Tokens DRAFT; everything else is OPEN, so those screens
will be plain semantic HTML and will stay that way until frames land. One thing I
will need before step 9: DESIGN.md §4 Layout is OPEN, and a navigation shell of some
kind is required to reach any route. I intend a plain `<nav>` with a list of links,
no styling beyond tokens, and will ask before doing anything more than that.
