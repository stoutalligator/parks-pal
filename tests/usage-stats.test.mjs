import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUsageStats, renderUsageMarkdown, weekStart } from '../scripts/lib/usage-stats.mjs';
import { renderUsageHtml } from '../scripts/lib/usage-html.mjs';

const now = new Date('2026-11-18T12:00:00Z'); // a Wednesday

const empty = {
  profiles: [], authUsers: [], parkStatus: [], trips: [], photos: [], trailCompletions: [],
  animalSightings: [], plantSightings: [], badges: [], reports: [],
};

const fixture = {
  ...empty,
  profiles: [
    { user_id: 'a', created_at: '2026-11-02T09:00:00Z', onboarding_complete: true, explorer_style: 'hiker', goal: 'all', units: 'mi' },
    { user_id: 'b', created_at: '2026-11-16T09:00:00Z', onboarding_complete: false, explorer_style: null, goal: null, units: 'km' },
    { user_id: 'c', created_at: '2025-01-01T09:00:00Z', onboarding_complete: true, explorer_style: 'hiker', goal: 'all', units: 'mi' },
  ],
  authUsers: [{ last_sign_in_at: '2026-11-17T00:00:00Z' }, { last_sign_in_at: '2026-10-25T00:00:00Z' }, { last_sign_in_at: null }],
  parkStatus: [
    { user_id: 'a', park_id: 'zion', status: 'visited', is_favorite: false },
    { user_id: 'a', park_id: 'acadia', status: 'notVisited', is_favorite: true },
    { user_id: 'b', park_id: 'zion', status: 'visited', is_favorite: true },
  ],
  trips: [
    { user_id: 'a', park_id: 'zion', trip_type: 'logged', activities: ['hiking', 'photography'], created_at: '2026-11-17T10:00:00Z' },
    { user_id: 'b', park_id: 'zion', trip_type: 'logged', activities: ['hiking'], created_at: '2026-11-10T10:00:00Z' },
    { user_id: 'a', park_id: 'acadia', trip_type: 'planned', activities: [], created_at: '2026-11-11T10:00:00Z' },
    { user_id: 'c', park_id: 'acadia', trip_type: 'logged', activities: ['kayaking'], created_at: '2025-06-01T10:00:00Z' },
  ],
  trailCompletions: [
    { user_id: 'a', trail_id: 'angels-landing', completed_at: '2026-11-17T10:00:00Z' },
    { user_id: 'a', trail_id: null, completed_at: '2026-11-17T10:00:00Z' },
  ],
  badges: [
    { user_id: 'a', badge_id: 'first-park', earned: true, earned_date: '2026-11-17T10:00:00Z' },
    { user_id: 'b', badge_id: 'hiker', earned: false, earned_date: null },
  ],
};

test('weekStart snaps to Monday UTC', () => {
  assert.equal(weekStart(now).toISOString(), '2026-11-16T00:00:00.000Z');
  assert.equal(weekStart(new Date('2026-11-16T00:00:00Z')).toISOString(), '2026-11-16T00:00:00.000Z');
  assert.equal(weekStart(new Date('2026-11-22T23:59:00Z')).toISOString(), '2026-11-16T00:00:00.000Z');
});

test('weekly rows count new accounts, activity and distinct active accounts', () => {
  const s = buildUsageStats(fixture, { now, weeks: 4, names: { parks: { zion: 'Zion' } } });
  assert.deepEqual(s.weekly.map((w) => w.week), ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16']);
  const [, w2, w3, w4] = s.weekly;
  assert.equal(w2.newAccounts, 1);
  assert.equal(w2.activeAccounts, 0);
  assert.equal(w3.activeAccounts, 2);
  assert.equal(w3.tripsPlanned, 1);
  assert.equal(w4.newAccounts, 1);
  assert.equal(w4.activeAccounts, 1);
  assert.equal(w4.tripsLogged, 1);
  assert.equal(w4.trailsCompleted, 2);
  assert.equal(w4.badgesEarned, 1);
});

test('adoption, rankings and sign-in counts', () => {
  const s = buildUsageStats(fixture, { now, weeks: 4, names: { parks: { zion: 'Zion' }, trails: { 'angels-landing': 'Angels Landing' } } });
  assert.equal(s.accounts.total, 3);
  assert.equal(s.accounts.signedIn7d, 1);
  assert.equal(s.accounts.signedIn30d, 2);
  assert.equal(s.adoption.find((a) => a.label === 'Logged a trip').users, 3);
  assert.equal(s.adoption.find((a) => a.label === 'Earned a badge').users, 1);
  assert.deepEqual(s.topActivities.window.map((i) => [i.key, i.count]), [['hiking', 2], ['photography', 1]]);
  assert.equal(s.topActivities.allTime.length, 3);
  assert.deepEqual(s.topParksLogged.window.map((i) => [i.label, i.count]), [['Zion', 2]]);
  assert.deepEqual(s.topTrails.map((i) => i.label), ['Angels Landing']);
  assert.equal(s.avgParksVisited, 0.7);
});

test('renders markdown without crashing on an empty database', () => {
  const md = renderUsageMarkdown(buildUsageStats(empty, { now, weeks: 8 }));
  assert.match(md, /# Parks Pal usage — 2026-11-18/);
  assert.match(md, /\*\*0\*\* accounts/);
  assert.match(md, /_None yet._/);
});

const reports = [
  { user_id: 'a', entry_type: 'trail', entry_id: 'angels-landing', entry_name: 'Angels Landing', park_id: 'zion', reason: 'closed_or_permit', note: '  Permit   lottery\n now required  ', status: 'new', created_at: '2026-11-17T10:00:00Z' },
  { user_id: 'b', entry_type: 'trail', entry_id: 'angels-landing', entry_name: 'Angels Landing', park_id: 'zion', reason: 'difficulty', note: null, status: 'new', created_at: '2026-11-12T10:00:00Z' },
  { user_id: 'b', entry_type: 'animal', entry_id: 'puffin', entry_name: '<script>Puffin</script>', park_id: 'acadia', reason: 'rarity', note: 'x'.repeat(400), status: 'new', created_at: '2026-11-13T10:00:00Z' },
  { user_id: 'c', entry_type: 'plant', entry_id: 'lupine', entry_name: 'Lupine', park_id: 'zion', reason: 'other', note: 'old', status: 'resolved', created_at: '2025-05-01T10:00:00Z' },
];

test('flags summarize open reports, priority first, with cleaned notes', () => {
  const f = buildUsageStats({ ...empty, reports }, { now, weeks: 4, names: { parks: { zion: 'Zion' } } }).flags;
  assert.equal(f.total, 4);
  assert.equal(f.open, 3);
  assert.equal(f.inWindow, 3);
  assert.equal(f.priorityOpen, 1);
  assert.equal(f.topEntries[0].name, 'Angels Landing');
  assert.equal(f.topEntries[0].count, 2);
  assert.equal(f.topEntries[0].priority, true);
  assert.equal(f.recent[0].note, 'Permit lottery now required');
  assert.equal(f.recent[0].park, 'Zion');
  assert.equal(f.recent[1].note.length, 300);
  assert.ok(!f.recent.some((r) => 'user_id' in r));
});

test('HTML escapes user-typed text and renders with and without flags', () => {
  const html = renderUsageHtml(buildUsageStats({ ...fixture, reports }, { now, weeks: 4 }));
  assert.ok(!html.includes('<script>Puffin'));
  assert.match(html, /&lt;script&gt;Puffin/);
  assert.match(html, /What people flagged/);
  assert.match(renderUsageHtml(buildUsageStats(empty, { now, weeks: 8 })), /Nothing open right now/);
  assert.match(renderUsageMarkdown(buildUsageStats({ ...empty, reports }, { now, weeks: 4 })), /Most-flagged entries/);
});
