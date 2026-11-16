#!/usr/bin/env node
// Weekly usage report: active accounts, sign-ups, and which features people
// use, aggregated from the existing Supabase tables. Read-only.
//
// Usage:
//   npm run usage:report                # last 8 weeks
//   npm run usage:report -- --weeks 12
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).
// Writes docs/usage-reports/usage-YYYY-MM-DD.html (themed, open in a browser)
// and a matching .md (gitignored), and prints the Markdown.

import fs from 'node:fs';
import path from 'node:path';
import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';
import { ROOT, extractArrayLiteral } from './lib/content-rows.mjs';
import { buildUsageStats, renderUsageMarkdown } from './lib/usage-stats.mjs';
import { renderUsageHtml } from './lib/usage-html.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const weeksArg = process.argv.indexOf('--weeks');
const WEEKS = weeksArg === -1 ? 8 : Number(process.argv[weeksArg + 1]);
if (!Number.isInteger(WEEKS) || WEEKS < 2 || WEEKS > 52) {
  console.error('--weeks must be a whole number from 2 to 52.');
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars. See .env.example.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
});

// Only the columns the aggregation needs — never trip notes, captions, names or
// emails. content_reports.note is read because it describes the flagged entry.
async function fetchAll(table, columns) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) throw new Error(`Reading ${table} failed: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

async function fetchAuthUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Listing auth users failed: ${error.message}`);
    users.push(...data.users.map((u) => ({ last_sign_in_at: u.last_sign_in_at })));
    if (data.users.length < 1000) return users;
  }
}

function nameMap(file, exportName) {
  const rows = extractArrayLiteral(path.join(ROOT, file), exportName);
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

async function main() {
  const [profiles, authUsers, parkStatus, trips, photos, trailCompletions, animalSightings, plantSightings, badges, reports] =
    await Promise.all([
      fetchAll('profiles', 'id, created_at, onboarding_complete, explorer_style, goal, units'),
      fetchAuthUsers(),
      fetchAll('user_park_status', 'user_id, park_id, status, is_favorite'),
      fetchAll('trips', 'user_id, park_id, trip_type, activities, created_at'),
      fetchAll('trip_photos', 'user_id, created_at'),
      fetchAll('user_trail_completions', 'user_id, trail_id, completed_at'),
      fetchAll('user_animal_sightings', 'user_id, spotted_at'),
      fetchAll('user_plant_sightings', 'user_id, spotted_at'),
      fetchAll('user_badges', 'user_id, badge_id, earned, earned_date'),
      fetchAll('content_reports', 'user_id, entry_type, entry_id, entry_name, park_id, reason, note, status, created_at'),
    ]);

  const names = {
    parks: { ...nameMap('src/data/parks.ts', 'ALL_PARKS'), ...nameMap('src/data/parks.ts', 'UPCOMING_PARKS') },
    badges: nameMap('src/data/badges.ts', 'ALL_BADGES'),
    trails: nameMap('src/data/trails.ts', 'ALL_TRAILS'),
  };

  const stats = buildUsageStats(
    {
      profiles: profiles.map((p) => ({ ...p, user_id: p.id })),
      authUsers,
      parkStatus,
      trips,
      photos,
      trailCompletions,
      animalSightings,
      plantSightings,
      badges,
      reports,
    },
    { weeks: WEEKS, names },
  );

  const markdown = renderUsageMarkdown(stats);
  const mascot = fs.readFileSync(path.join(ROOT, 'src/assets/mascot/mascot-happy.png')).toString('base64');
  const html = renderUsageHtml(stats, { mascotDataUri: `data:image/png;base64,${mascot}` });

  const dir = path.join(ROOT, 'docs/usage-reports');
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, `usage-${stats.generatedAt.slice(0, 10)}`);
  fs.writeFileSync(`${base}.md`, markdown);
  fs.writeFileSync(`${base}.html`, html);
  console.log(markdown);
  console.log(`\nSaved ${path.relative(ROOT, base)}.html (open in a browser) and .md`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
