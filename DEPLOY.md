# Deploying monadic

The web app runs on Vercel. Ingestion does not — it runs on a GitHub Actions
cron. That split is not a preference; it is the only arrangement that works.
A full sweep of 254 boards takes about fifteen minutes, and a Vercel function
is capped at 300 seconds on Hobby and 800 on Pro. A GitHub runner has six
hours.

---

## Before the first deploy

**monadic has no accounts.** The app signs in to Supabase as one fixed user
from the environment, so whoever loads the URL *is* that user — your parsed
resume, your pipeline, and a delete button. Vercel's own Deployment Protection
does not close this on the free plan: Hobby leaves production domains publicly
accessible, and Password Protection is an Enterprise feature or a paid Pro
add-on.

That is what `MONADIC_APP_PASSWORD` and the `/login` page are for. The gate
lives in middleware, so it covers `/api/*` as well as pages — the routes that
save, apply, change status and delete are all reachable directly, and a gate
that only guarded pages would be decorative.

**It fails closed.** With no `MONADIC_APP_PASSWORD` set, every route answers
503 with an explanation. A deploy that forgets the variable is broken rather
than exposed. Verified, not assumed.

---

## Environment variables

Two destinations, and the split matters.

### Vercel — Settings → Environment Variables

Set these for **Production** (and Preview, if you use preview deploys). They
must exist before the first build, not just at runtime: the root layout reads
the database, so the build itself signs in.

| Variable | Why the app needs it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Which project to talk to |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe key; RLS applies |
| `MONADIC_USER_ID` | Asserted against the account that signs in |
| `MONADIC_USER_EMAIL` | The single local account |
| `MONADIC_USER_PASSWORD` | The single local account |
| `MONADIC_APP_PASSWORD` | **The gate.** Anything long. Not the Supabase password |
| `ANTHROPIC_API_KEY` | Reading a pasted job link that is not on a known board |
| `INGEST_USER_AGENT` | Sent when fetching a pasted page or a company logo |
| `GOOGLE_CLIENT_ID` | Optional. Gmail drafts — see below |
| `GOOGLE_CLIENT_SECRET` | Optional. Gmail drafts — see below |

### GitHub — Settings → Secrets and variables → Actions

| Secret | Why ingestion needs it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Same project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Required by the env validator |
| `SUPABASE_SECRET_KEY` | Writes `companies` and `jobs`, bypassing RLS |
| `INGEST_USER_AGENT` | Identifies you to every ATS you poll |

### `SUPABASE_SECRET_KEY` does not go to Vercel

It bypasses RLS entirely. Nothing the web app does needs it — an eslint rule
forbids importing the service client anywhere under `src/`, and the one
privileged write the app performs goes through the `add_manual_job` SQL
function instead. Putting the key in Vercel would hand the public-facing half
of the system a capability it has no code to use, in exchange for nothing.

Ingestion needs it and runs somewhere else. Keep it there.

Ingestion also does **not** need `MONADIC_USER_*`. It never signs in as the
user; `npm run ingest` and `npm run resolve` both use the service client.

---

## Gmail drafts (optional)

Leave `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` unset and everything else
still works — the compose panel falls back to opening your mail client. The
profile page says so rather than showing a button that cannot work.

Setting it up needs a Google Cloud project, which only you can create:

1. [console.cloud.google.com](https://console.cloud.google.com) → new project.
2. **APIs & Services → Library** → enable **Gmail API**.
3. **OAuth consent screen** → External → add yourself as a Test user. It never
   needs verification or publishing while you are the only user.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   Add both redirect URIs:
   - `http://localhost:3000/api/google/callback`
   - `https://YOUR-DOMAIN/api/google/callback`
5. Put the client ID and secret in Vercel, and in `.env.local` for local use.
6. Profile → **Connect Gmail**.

### What it can do

The scope requested is `gmail.compose`, which Google documents as "manage drafts
and send emails" — it covers both. `gmail.send` is not requested on top of it
because it would add nothing.

So monadic can send as you, and the thing that stops an unread email going out
is the interface, not the grant: every send passes a review screen that names
the from address, the recipient and their address, the subject, and the whole
body, and sends only on a second, deliberate press. Saving to Gmail drafts is
still there for when you would rather finish in Gmail.

An earlier version of this file claimed the app "has no permission to send".
That was wrong about the scope, though true of the code at the time, which only
ever created drafts. It is recorded here because a security claim that quietly
changes is worse than one that was never made.

Disconnecting removes monadic's copy of the grant. It does not revoke it at
Google — do that from your Google account's security settings.

If a reconnect ever fails with "Google returned no refresh token", revoke
monadic's access in your Google account first. Google issues the durable token
on a fresh grant only.

---

## Deploying

```bash
npm i -g vercel        # if you do not have it
vercel login
vercel                 # first run: links the project, then deploys a preview
vercel --prod          # production
```

Or connect the GitHub repo in the Vercel dashboard, which deploys `main` on
every push. Either way, set the environment variables first.

`npm run build` runs `npm run tokens` beforehand, which regenerates
`src/styles/tokens.generated.css` from `design/tokens.json`. That file is
gitignored on purpose — the build makes it, so nothing needs doing.

---

## After deploying, check these four things

1. **The gate refuses you.** Open the production URL in a private window. You
   should land on `/login`, not on a feed.
2. **The password works**, and you arrive where you were headed.
3. **An API route refuses an anonymous caller.** From a terminal:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST \
     -H 'content-type: application/json' -d '{}' \
     https://YOUR-DOMAIN/api/jobs/save
   ```
   Expect `401`. Anything else means the middleware matcher is not covering it.
4. **Ingestion runs.** GitHub → Actions → *Ingest job boards* → *Run workflow*.
   It takes about fifteen minutes. Then check `/settings/runs` in the app.

---

## Running continuously

The workflow is scheduled for 06:00 UTC daily and can be run by hand from the
Actions tab. It resolves any newly seeded companies first, so adding a line to
`src/ingest/companies.config.ts` and pushing is enough to start ingesting a new
board — no second step.

Two things worth knowing about how it reports:

- **A company that fails does not fail the job.** That was deliberate: one bad
  board used to discard the whole sweep. The consequence is that a green tick
  does not mean everything succeeded. The run summary says so, and
  `/settings/runs` has the per-company history.
- **Runs cannot overlap.** A `concurrency` group holds a second run rather than
  letting two sweeps race on the closure diff.

### Costs

- Vercel Hobby: free, and this is well inside it.
- GitHub Actions: free for 2,000 minutes a month on private repos. A daily
  fifteen-minute run is roughly 450.
- Supabase free tier: fine at 17,000 job rows, though the free tier pauses a
  project after a week with no activity. The daily ingest counts as activity.
- Anthropic: only on a pasted link that is not on a known board. Effectively
  zero unless you use that feature a lot.

---

## If you come back to this later

The single-user shim is `src/lib/supabase/server.ts`, and its own comment
describes what replacing it looks like: swap the password sign-in for a
cookie-backed session via `@supabase/ssr`. RLS is already written and already
enforced per-user, so that change is a login page and a client — not a
migration.

`MONADIC_APP_PASSWORD` is the thing to remove on the day that lands.
