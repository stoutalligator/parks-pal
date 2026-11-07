#!/usr/bin/env node
// Seeds the `parks`, `badges`, `trails`, `animals`, `trail_details`,
// `animal_details`, `plants` and `plant_details` reference tables in Supabase from the existing local mock
// data files and docs/compendium-research/*.json, so they stay the single
// source of truth instead of being retyped in SQL.
//
// Usage:
//   node --env-file=.env scripts/seed-supabase.mjs
// (requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — see .env.example)

import path from 'node:path';
import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';
import { ROOT, extractArrayLiteral, buildContentRows, buildPlantRows } from './lib/content-rows.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars. See .env.example.');
  process.exit(1);
}

// supabase-js always spins up a Realtime sub-client, which needs a global
// WebSocket — Node 20 (unlike Node 22+ or React Native) doesn't have one
// built in, even though this script never uses realtime features.
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
});

async function seedParks() {
  // Upcoming parks are seeded too: their trails/animals reference parks.id,
  // and the app decides visibility from app_config, not from this table.
  const parks = [
    ...extractArrayLiteral(path.join(ROOT, 'src/data/parks.ts'), 'ALL_PARKS'),
    ...extractArrayLiteral(path.join(ROOT, 'src/data/parks.ts'), 'UPCOMING_PARKS'),
  ];
  const rows = parks.map((p) => ({
    id: p.id,
    name: p.name,
    state: p.state,
    region: p.region,
    description: p.description,
    established_year: p.establishedYear,
    acres: p.acres,
    lat: p.lat,
    lng: p.lng,
  }));
  const { error } = await supabase.from('parks').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Seeding parks failed: ${error.message}`);
  console.log(`Seeded ${rows.length} parks.`);
}

async function seedBadges() {
  const badges = extractArrayLiteral(path.join(ROOT, 'src/data/badges.ts'), 'ALL_BADGES');
  const rows = badges.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    category: b.category,
    goal: b.goal ?? null,
  }));
  const { error } = await supabase.from('badges').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Seeding badges failed: ${error.message}`);
  console.log(`Seeded ${rows.length} badges.`);
}

async function seedContent(table, rows) {
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Seeding ${table} failed: ${error.message}`);
  console.log(`Seeded ${rows.length} ${table}.`);
}

async function main() {
  await seedParks();
  await seedBadges();
  // Detail tables FK-reference trails.id/animals.id, so they must be seeded
  // after the base tables — buildContentRows() returns them in that order.
  const rows = buildContentRows();
  await seedContent('trails', rows.trails);
  await seedContent('animals', rows.animals);
  await seedContent('trail_details', rows.trail_details);
  await seedContent('animal_details', rows.animal_details);
  // Last, and only once the Field Guide migration has created the plant tables.
  const plantRows = buildPlantRows();
  await seedContent('plants', plantRows.plants);
  await seedContent('plant_details', plantRows.plant_details);
  console.log('Seed complete.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
