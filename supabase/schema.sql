-- Park Pal — Supabase schema
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query),
-- then run `node scripts/seed-supabase.mjs` to populate parks/badges.
--
-- If you already ran this against an existing project, apply new columns
-- incrementally instead of re-running the whole file, e.g.:
--   alter table public.profiles add column if not exists units text not null default 'mi' check (units in ('mi', 'km'));

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Reference data (seeded via scripts/seed-supabase.mjs, read-only to clients)
-- ---------------------------------------------------------------------------

create table public.parks (
  id text primary key,
  name text not null,
  state text not null,
  region text not null,
  description text not null default '',
  established_year int,
  acres int,
  lat numeric not null,
  lng numeric not null
);

create table public.badges (
  id text primary key,
  name text not null,
  description text not null default '',
  category text not null,
  goal int
);

-- ---------------------------------------------------------------------------
-- Per-user data
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Explorer',
  explorer_style text,
  goal text,
  onboarding_complete boolean not null default false,
  profile_background text not null default 'mountain-lake',
  avatar text not null default 'hiking',
  units text not null default 'mi' check (units in ('mi', 'km')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.user_park_status (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  park_id text not null references public.parks(id) on delete cascade,
  -- Bucket List lives on is_favorite instead — it's an independent wishlist
  -- flag, not a status, so a park can be favorited at any status.
  status text not null default 'notVisited'
    check (status in ('visited', 'planned', 'notVisited')),
  is_favorite boolean not null default false,
  primary key (user_id, park_id)
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  park_id text not null references public.parks(id) on delete restrict,
  -- 'planned' trips only have park/dates/activities/notes; completing one
  -- (AppContext.completeTrip) flips this to 'logged' and fills in
  -- photos/trails/wildlife/rating in the same row rather than a new insert.
  trip_type text not null default 'logged' check (trip_type in ('planned', 'logged')),
  start_date date not null,
  end_date date not null,
  activities text[] not null default '{}',
  notes text not null default '',
  weather text,
  favorite_trail text,
  wildlife_sightings text[],
  rating smallint check (rating between 1 and 5),
  miles_hiked numeric,
  elevation_gain_ft numeric,
  created_at timestamptz not null default now()
);

-- Photos are capped at 3 per trip *structurally*: slot only accepts 0-2 and
-- (trip_id, slot) is unique, so a 4th photo has nowhere valid to insert.
create table public.trip_photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  storage_path text not null,
  slot smallint not null check (slot between 0 and 2),
  -- Optional short line written under the photo in the album (empty = null).
  caption text check (char_length(caption) <= 80),
  created_at timestamptz not null default now(),
  unique (trip_id, slot)
);

create table public.user_badges (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  badge_id text not null references public.badges(id) on delete cascade,
  earned boolean not null default false,
  earned_date timestamptz,
  progress int not null default 0,
  primary key (user_id, badge_id)
);

-- Reference data: popular trails and animals per park (seeded via
-- scripts/seed-supabase.mjs, read-only to clients). Not every park has
-- entries yet — content is filled in incrementally.
create table public.trails (
  id text primary key,
  park_id text not null references public.parks(id) on delete cascade,
  name text not null,
  description text not null default '',
  miles numeric not null,
  elevation_gain_ft int not null,
  difficulty text not null check (difficulty in ('Easy', 'Moderate', 'Hard'))
);

create table public.animals (
  id text primary key,
  park_id text not null references public.parks(id) on delete cascade,
  name text not null,
  description text not null default '',
  rarity text not null check (rarity in ('Common', 'Uncommon', 'Rare'))
);

create table public.plants (
  id text primary key,
  park_id text not null references public.parks(id) on delete cascade,
  name text not null,
  description text not null default '',
  rarity text not null check (rarity in ('Common', 'Uncommon', 'Rare')),
  type text not null check (type in ('Wildflower', 'Tree', 'Shrub', 'Cactus', 'Succulent', 'Fern', 'Grass', 'Vine')),
  -- Months it blooms, 1 = January; empty for plants grown for leaves or cones.
  bloom_months smallint[] not null default '{}'
);

-- Researched enrichment data, keyed 1:1 to a trail/animal id — kept as
-- separate tables (rather than jsonb columns on trails/animals) so the base
-- "how many cards to render" queries stay small, and so a trail/animal with
-- no research yet just has no matching row here. Seeded from
-- docs/compendium-research/*.json via scripts/seed-supabase.mjs. Not every
-- trail/animal has a row yet — content is filled in incrementally.
create table public.trail_details (
  id text primary key references public.trails(id) on delete cascade,
  estimated_time text not null,
  best_season text not null,
  tags jsonb not null default '[]',
  trail_tip text not null,
  did_you_know text not null,
  elevation_profile jsonb not null default '[]',
  last_verified text,
  -- Extra place names that tie a live NPS alert to this trail (see npsAlerts.ts).
  alert_keywords jsonb not null default '[]'
);

create table public.animal_details (
  id text primary key references public.animals(id) on delete cascade,
  scientific_name text not null,
  best_time_of_day text not null,
  best_season text not null,
  where_to_look text not null,
  tags jsonb not null default '[]',
  viewing_tip text not null,
  did_you_know text not null,
  last_verified text
);

create table public.plant_details (
  id text primary key references public.plants(id) on delete cascade,
  scientific_name text not null,
  where_to_look text not null,
  -- A named nature trail or exhibit where the park features this plant.
  nature_trail text,
  tags jsonb not null default '[]',
  id_tip text not null,
  did_you_know text not null,
  caution text,
  last_verified text
);

-- One row per completion/sighting event (not upserted) — repeat hikes of the
-- same trail across different trips each add a row, so sum(miles) correctly
-- accumulates, while "has this ever been done" is just "a row exists".
-- trail_id/animal_id are nullable to support custom entries the user typed
-- in that aren't in the trails/animals catalog.
-- trip_id links a completion back to the trip it happened on (cascades on
-- trip delete, unlike trail_id/animal_id which orphan-not-destroy so catalog
-- edits never wipe a user's history).
create table public.user_trail_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  trail_id text references public.trails(id) on delete set null,
  trip_id uuid references public.trips(id) on delete cascade,
  park_id text not null references public.parks(id) on delete cascade,
  name text not null,
  miles numeric not null,
  elevation_gain_ft int not null default 0,
  -- Which day of the trip this happened on (1-indexed from trip.start_date).
  -- Nullable so older rows, logged before per-day tracking existed, stay valid.
  day_number smallint,
  completed_at timestamptz not null default now()
);

create table public.user_animal_sightings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  animal_id text references public.animals(id) on delete set null,
  trip_id uuid references public.trips(id) on delete cascade,
  park_id text not null references public.parks(id) on delete cascade,
  name text not null,
  day_number smallint,
  spotted_at timestamptz not null default now()
);

create table public.user_plant_sightings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plant_id text references public.plants(id) on delete set null,
  trip_id uuid references public.trips(id) on delete cascade,
  park_id text not null references public.parks(id) on delete cascade,
  name text not null,
  day_number smallint,
  spotted_at timestamptz not null default now()
);

-- Activities are per-day (unlike the legacy `trips.activities` text[], which
-- is still written as a flattened aggregate for backward compatibility with
-- badge rules) so each one can carry its own optional free-text viewpoint —
-- "watched sunset from Clingmans Dome" rather than just "Sunset".
create table public.trip_day_activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day_number smallint not null,
  activity text not null,
  viewpoint text
);

create table public.trip_day_weather (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day_number smallint not null,
  weather text not null,
  primary key (trip_id, day_number)
);

-- "This looks wrong" reports on a trail or animal, submitted from the detail
-- screens and pulled weekly (scripts/pull-reports.mjs) to feed the research
-- review. Users can only insert; nobody but service_role can read them back.
-- entry_id is deliberately not a foreign key: a report about an entry should
-- survive that entry being renamed or removed from the catalog.
create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('trail', 'animal', 'plant')),
  entry_id text not null,
  entry_name text not null,
  park_id text not null references public.parks(id) on delete cascade,
  reason text not null check (reason in (
    'distance_elevation', 'closed_or_permit', 'difficulty', 'wrong_park',
    'not_found_here', 'rarity', 'tip_wrong', 'other'
  )),
  note text check (char_length(note) <= 500),
  platform text,
  status text not null default 'new' check (status in ('new', 'triaged', 'confirmed', 'dismissed', 'resolved')),
  created_at timestamptz not null default now()
);

-- One open report per user, entry and reason — repeat taps can't spam the queue.
create unique index content_reports_one_open_per_reason
  on public.content_reports (user_id, entry_type, entry_id, reason)
  where status = 'new';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- Remote switches the app reads at launch (see src/data/appConfig.ts), so a
-- change like turning on a newly designated park reaches everyone without an
-- app update. Readable by anyone; changed only from the dashboard/service role.
--   enabled_upcoming_parks: JSON array of UPCOMING_PARKS ids to show, e.g. ["chiricahua"]
--   event_notice: the Home-screen notice card, or null (fields: migrations/2026-11-06-event-notice.sql)
create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_config (key, value) values ('enabled_upcoming_parks', '[]'::jsonb);
insert into public.app_config (key, value) values ('nps_alerts_synced_at', 'null'::jsonb);
insert into public.app_config (key, value) values ('event_notice', 'null'::jsonb);

-- Live NPS alerts, copied verbatim from the NPS API every 30 minutes by the
-- sync-nps-alerts Edge Function (scheduled with pg_cron — see
-- supabase/migrations/2026-10-13-nps-alerts.sql). Read-only to clients.
create table public.park_alerts (
  id text primary key,
  park_code text not null,
  category text not null,
  title text not null,
  description text not null default '',
  url text,
  last_indexed_date timestamptz,
  fetched_at timestamptz not null default now()
);

create index park_alerts_park_code on public.park_alerts (park_code);

alter table public.park_alerts enable row level security;

alter table public.app_config enable row level security;
alter table public.parks enable row level security;
alter table public.badges enable row level security;
alter table public.profiles enable row level security;
alter table public.user_park_status enable row level security;
alter table public.trips enable row level security;
alter table public.trip_photos enable row level security;
alter table public.user_badges enable row level security;
alter table public.trails enable row level security;
alter table public.animals enable row level security;
alter table public.trail_details enable row level security;
alter table public.animal_details enable row level security;
alter table public.user_trail_completions enable row level security;
alter table public.user_animal_sightings enable row level security;
alter table public.plants enable row level security;
alter table public.plant_details enable row level security;
alter table public.user_plant_sightings enable row level security;
alter table public.trip_day_activities enable row level security;
alter table public.trip_day_weather enable row level security;
alter table public.content_reports enable row level security;

-- Reference data: readable by anyone, no client writes (seeded via SQL only).
create policy "app config is publicly readable" on public.app_config
  for select using (true);
create policy "park alerts are publicly readable" on public.park_alerts
  for select using (true);
create policy "parks are publicly readable" on public.parks
  for select using (true);
create policy "badges are publicly readable" on public.badges
  for select using (true);
create policy "trails are publicly readable" on public.trails
  for select using (true);
create policy "animals are publicly readable" on public.animals
  for select using (true);
create policy "trail details are publicly readable" on public.trail_details
  for select using (true);
create policy "animal details are publicly readable" on public.animal_details
  for select using (true);
create policy "plants are publicly readable" on public.plants
  for select using (true);
create policy "plant details are publicly readable" on public.plant_details
  for select using (true);

create policy "users manage their own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "users manage their own park status" on public.user_park_status
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own trips" on public.trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Also verifies the parent trip belongs to the same user, not just the photo row.
create policy "users manage their own trip photos" on public.trip_photos
  for all using (
    auth.uid() = user_id
    and exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.trips t where t.id = trip_id and t.user_id = auth.uid())
  );

create policy "users manage their own badges" on public.user_badges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own trail completions" on public.user_trail_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own animal sightings" on public.user_animal_sightings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own plant sightings" on public.user_plant_sightings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own trip day activities" on public.trip_day_activities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage their own trip day weather" on public.trip_day_weather
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Insert-only: no select/update/delete policy, so reports can't be read back by users.
create policy "users can submit content reports" on public.content_reports
  for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Base privileges
--
-- Required because "Automatically expose new tables" is off (Project
-- Settings > API) — that toggle is what would otherwise auto-grant these.
-- RLS policies above control *which rows*; these grants control whether the
-- role can attempt the operation at all. Both layers are needed.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

grant select on public.app_config to anon, authenticated;
grant select on public.park_alerts to anon, authenticated;
grant select on public.parks to anon, authenticated;
grant select on public.badges to anon, authenticated;
grant select on public.trails to anon, authenticated;
grant select on public.animals to anon, authenticated;
grant select on public.trail_details to anon, authenticated;
grant select on public.animal_details to anon, authenticated;
grant select on public.plants to anon, authenticated;
grant select on public.plant_details to anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_park_status to authenticated;
grant select, insert, update, delete on public.trips to authenticated;
grant select, insert, update, delete on public.trip_photos to authenticated;
grant select, insert, update, delete on public.user_badges to authenticated;
grant select, insert, update, delete on public.user_trail_completions to authenticated;
grant select, insert, update, delete on public.user_animal_sightings to authenticated;
grant select, insert, update, delete on public.user_plant_sightings to authenticated;
grant select, insert, update, delete on public.trip_day_activities to authenticated;
grant select, insert, update, delete on public.trip_day_weather to authenticated;
grant insert on public.content_reports to authenticated;

-- service_role is the trusted backend/admin key (used only by scripts/*.mjs,
-- never shipped to the app) — it should have unrestricted access to
-- everything, same as it would if "Automatically expose new tables" were on.
grant all on all tables in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Storage: trip photos bucket
-- ---------------------------------------------------------------------------

-- Private (not public) — trip photos are personal, so they're served
-- through short-lived signed URLs the owning user generates on demand
-- (src/context/AppContext.tsx), never a permanent public link.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-photos',
  'trip-photos',
  false,
  20971520, -- 20MB: full-resolution phone camera photos often exceed 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Path convention: {user_id}/{trip_id}/{timestamp}-{random}.jpg — policies
-- match the first path segment against the requesting user's id.
create policy "users upload their own trip photos"
  on storage.objects for insert
  with check (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users manage their own trip photo files"
  on storage.objects for update using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete their own trip photo files"
  on storage.objects for delete using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only the owning user can read their own trip photos (needed both to view
-- them and to generate a signed URL for them) — no public/unauthenticated read.
create policy "users view their own trip photo files"
  on storage.objects for select using (
    bucket_id = 'trip-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Account deletion (App Store / Play Store guideline 5.1.1(v))
-- ---------------------------------------------------------------------------

-- Lets a signed-in user permanently delete their own account. security
-- definer so it can remove the auth.users row (which every table above
-- cascades from) even though authenticated clients have no direct grant on
-- auth.users; it only ever targets auth.uid(), never an arbitrary id, so it's
-- safe to grant execute to every authenticated user.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
