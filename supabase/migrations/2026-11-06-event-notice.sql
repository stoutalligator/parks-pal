-- Adds the `event_notice` remote switch: the card at the top of Home (already
-- folded into schema.sql for fresh setups). Run once in the Supabase SQL editor.
--
-- The value is one notice object, or null for none:
--   id         required. Change it for each new notice — a dismissed id stays
--              hidden on that device, so reusing one won't show again.
--   kind       required. 'park' (park icon), 'event' (calendar, blue),
--              or 'info' (moose, plain heads-up).
--   title      required.
--   eyebrow    small caps line above the title, e.g. 'NEW PARK'.
--   body       optional second line.
--   parkId     optional. Adds a link to that park; hidden if the park isn't shown.
--   linkLabel  optional link text (default 'See the park').
--   startsAt / endsAt   optional inclusive 'YYYY-MM-DD' window.
--
-- To post a new notice:
--   update public.app_config
--     set value = '{"id": "fee-free-2027-01", "kind": "event", "eyebrow": "FEE-FREE DAY", "title": "Free entry at every national park", "startsAt": "2027-01-10", "endsAt": "2027-01-19"}'::jsonb,
--         updated_at = now()
--     where key = 'event_notice';
--
-- To remove it:
--   update public.app_config set value = 'null'::jsonb, updated_at = now() where key = 'event_notice';

insert into public.app_config (key, value) values (
  'event_notice',
  '{"id": "chiricahua-64", "kind": "park", "eyebrow": "NEW PARK", "title": "Chiricahua is America''s 64th national park", "parkId": "chiricahua", "endsAt": "2026-12-31"}'::jsonb
);
