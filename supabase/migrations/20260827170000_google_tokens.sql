-- monadic — somewhere to keep a Google refresh token
--
-- Connecting Gmail means holding a credential that can act as the user
-- indefinitely. That is a different class of secret from anything else in this
-- schema, so it gets its own table and its own reasoning:
--
--   * One row per user, enforced by a unique constraint rather than by
--     convention. Reconnecting updates the row; it does not accumulate stale
--     grants nobody can tell apart.
--   * RLS on, owner-only, like every other user-scoped table. The app reads it
--     as the signed-in user through the same client as everything else.
--   * The access token is stored with its expiry so it can be reused until it
--     lapses. The refresh token is the durable one and is what disconnecting
--     removes.
--   * scope is recorded as granted, not as requested. Google may return less
--     than was asked for, and a feature that assumed otherwise would fail at
--     the point of use with an opaque 403 rather than at connect time.
--
-- Deliberately no encryption column. The row is protected by RLS and by the
-- database's own access controls, which is the same protection the rest of the
-- user's data has; encrypting one column with a key that sits in the same
-- environment would be ceremony rather than defence.

create table public.google_accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,

  -- Which mailbox this grant is for, so the UI can say whose it is.
  email          text not null,

  access_token   text not null,
  refresh_token  text not null,
  -- When the access token lapses. Refreshed lazily, at the point of use.
  expires_at     timestamptz not null,
  scope          text not null default '',

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint google_accounts_one_per_user unique (user_id)
);

alter table public.google_accounts enable row level security;

create policy google_accounts_owner on public.google_accounts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.google_accounts is
  'One Google OAuth grant per user, for creating Gmail drafts. Never used to send.';
