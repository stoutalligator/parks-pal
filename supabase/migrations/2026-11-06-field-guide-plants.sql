-- Field Guide: plants alongside animals (already folded into schema.sql for
-- fresh setups). Run once in the Supabase SQL editor.
--
-- Additive only: three new tables and one widened check. Nothing existing is
-- altered, so app builds from before the Field Guide keep working unchanged —
-- they never query these tables. Plant content is seeded from
-- src/data/plants.ts + plantDetails.ts via scripts/seed-supabase.mjs.

create table if not exists public.plants (
  id text primary key,
  park_id text not null references public.parks(id) on delete cascade,
  name text not null,
  description text not null default '',
  rarity text not null check (rarity in ('Common', 'Uncommon', 'Rare')),
  type text not null check (type in ('Wildflower', 'Tree', 'Shrub', 'Cactus', 'Succulent', 'Fern', 'Grass', 'Vine')),
  -- Months it blooms, 1 = January; empty for plants grown for leaves or cones.
  bloom_months smallint[] not null default '{}'
);

create table if not exists public.plant_details (
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

-- Same shape and rules as user_animal_sightings: one row per discovery,
-- trip_id null for a manual "Mark as found".
create table if not exists public.user_plant_sightings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plant_id text references public.plants(id) on delete set null,
  trip_id uuid references public.trips(id) on delete cascade,
  park_id text not null references public.parks(id) on delete cascade,
  name text not null,
  day_number smallint,
  spotted_at timestamptz not null default now()
);

alter table public.plants enable row level security;
alter table public.plant_details enable row level security;
alter table public.user_plant_sightings enable row level security;

create policy "plants are publicly readable" on public.plants
  for select using (true);
create policy "plant details are publicly readable" on public.plant_details
  for select using (true);
create policy "users manage their own plant sightings" on public.user_plant_sightings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.plants to anon, authenticated;
grant select on public.plant_details to anon, authenticated;
grant select, insert, update, delete on public.user_plant_sightings to authenticated;
grant all on public.plants, public.plant_details, public.user_plant_sightings to service_role;

-- "This looks wrong" reports can now be about a plant too. Widening the
-- allowed values doesn't affect reports older builds send.
alter table public.content_reports drop constraint if exists content_reports_entry_type_check;
alter table public.content_reports
  add constraint content_reports_entry_type_check check (entry_type in ('trail', 'animal', 'plant'));
