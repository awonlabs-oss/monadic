-- monadic — seed data
--
-- This file contains controlled vocabulary only. It is configuration, not
-- sample data: there are no fake jobs, companies, or applications anywhere in
-- this project.
--
-- The local user is NOT created here. Creating it needs a password, and this
-- file is tracked. It is created instead by `npm run seed:user`, which reads
-- MONADIC_USER_ID and the local credentials from .env.local.

insert into public.dismissal_reasons (code, label, description, sort_order) values
  ('comp_too_low',        'Comp too low',            'Stated compensation is below my floor.',            10),
  ('comp_not_stated',     'Comp not stated',         'Dismissed for lack of comp transparency.',          20),
  ('wrong_role_type',     'Wrong role type',         'Not the kind of work I am looking for.',            30),
  ('too_senior',          'Too senior',              'Requirements exceed my experience.',                40),
  ('too_junior',          'Too junior',              'Below the level I am targeting.',                   50),
  ('location',            'Location',                'Wrong geography.',                                  60),
  ('remote_policy',       'Remote policy',           'Onsite or hybrid requirement I cannot meet.',       70),
  ('company_stage',       'Company stage',           'Too early or too late for what I want.',            80),
  ('industry',            'Industry',                'Domain I do not want to work in.',                  90),
  ('tech_stack',          'Tech stack',              'Stack I do not want to work in.',                  100),
  ('company_reputation',  'Company reputation',      'Something I know about the company.',              110),
  ('already_applied',     'Already applied',         'Applied to this company recently.',                120),
  ('duplicate',           'Duplicate posting',       'Same role already in the feed.',                    130),
  ('other',               'Other',                   'See the note.',                                    999)
on conflict (code) do update
  set label       = excluded.label,
      description = excluded.description,
      sort_order  = excluded.sort_order;
