-- monadic — your writing, as input to the drafter
--
-- The drafter already gets the facts: the parsed resume, the job, the contact.
-- What it cannot infer is how you write — how long, how formal, whether you
-- open with the company or with yourself, whether you sign off with a question.
-- A model asked to guess that produces competent, anonymous email.
--
-- Two things fix it, and they are different in kind, which is why this is one
-- table with two columns rather than a settings blob:
--
--   guidelines  Rules you state. "Never say 'I'd love to'." "Two paragraphs."
--               Instructions, and they go in the system prompt.
--   examples    Emails you actually wrote. These are worth more than any
--               description of your voice, because voice is mostly the things
--               a person cannot articulate about their own writing. They go in
--               as few-shot examples, not as rules.
--
-- Examples live in outreach_templates, which already exists and is exactly
-- this shape (name, subject, body) — a template *is* an example email. This
-- table holds the part that had nowhere to go.
--
-- One row per user, enforced rather than assumed.

create table public.outreach_voice (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  -- Free text, given to the model verbatim. Deliberately not a set of toggles:
  -- the useful instructions here are specific and idiosyncratic, and a fixed
  -- vocabulary of "formal / casual / brief" would throw away exactly the
  -- specificity that makes them work.
  guidelines text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint outreach_voice_one_per_user unique (user_id)
);

alter table public.outreach_voice enable row level security;

create policy outreach_voice_owner on public.outreach_voice
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.outreach_voice is
  'Stated writing rules. Worked examples live in outreach_templates.';
