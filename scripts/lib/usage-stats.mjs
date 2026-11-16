// Pure aggregation for scripts/usage-report.mjs, kept free of Supabase calls so
// tests/usage-stats.test.mjs can feed it fixture rows.
//
// Only counts leave this file: no emails, display names, notes, captions,
// viewpoints or free-text trail/animal names ever reach the report.

const DAY_MS = 24 * 60 * 60 * 1000;

// Weeks run Monday 00:00 UTC to the next Monday.
export function weekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const offset = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - offset * DAY_MS);
}

const isoDay = (d) => d.toISOString().slice(0, 10);

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (key == null) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function top(counts, n, label = (k) => k) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, n)
    .map(([key, count]) => ({ key, label: label(key), count }));
}

const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0);

// data: { profiles, authUsers, parkStatus, trips, photos, trailCompletions,
//         animalSightings, plantSightings, badges, reports }
// names: { parks, badges, trails } — id -> display name maps from src/data.
export function buildUsageStats(data, { now = new Date(), weeks = 8, names = {} } = {}) {
  const currentWeek = weekStart(now);
  const firstWeek = new Date(currentWeek.getTime() - (weeks - 1) * 7 * DAY_MS);
  const weekKeys = Array.from({ length: weeks }, (_, i) => isoDay(new Date(firstWeek.getTime() + i * 7 * DAY_MS)));
  const weekOf = (ts) => {
    if (!ts) return null;
    const key = isoDay(weekStart(new Date(ts)));
    return weekKeys.includes(key) ? key : null;
  };
  const inWindow = (ts) => weekOf(ts) !== null;

  const loggedTrips = data.trips.filter((t) => t.trip_type === 'logged');
  const plannedTrips = data.trips.filter((t) => t.trip_type === 'planned');
  const earnedBadges = data.badges.filter((b) => b.earned);

  // Each source: rows, their timestamp column, and the weekly column it feeds.
  const sources = [
    ['newAccounts', data.profiles, 'created_at'],
    ['tripsLogged', loggedTrips, 'created_at'],
    ['tripsPlanned', plannedTrips, 'created_at'],
    ['photos', data.photos, 'created_at'],
    ['trailsCompleted', data.trailCompletions, 'completed_at'],
    ['wildlife', data.animalSightings, 'spotted_at'],
    ['plants', data.plantSightings, 'spotted_at'],
    ['badgesEarned', earnedBadges, 'earned_date'],
    ['reports', data.reports, 'created_at'],
  ];

  const weekly = new Map(weekKeys.map((k) => [k, { week: k, activeAccounts: new Set() }]));
  for (const [column, rows, tsField] of sources) {
    for (const w of weekly.values()) w[column] = 0;
    for (const row of rows) {
      const key = weekOf(row[tsField]);
      if (!key) continue;
      const w = weekly.get(key);
      w[column] += 1;
      // A new account alone isn't activity; saving something is.
      if (column !== 'newAccounts') w.activeAccounts.add(row.user_id);
    }
  }

  const totalAccounts = data.profiles.length;
  const usersWith = (rows) => new Set(rows.map((r) => r.user_id)).size;
  const visitedRows = data.parkStatus.filter((r) => r.status === 'visited');
  const wishlistRows = data.parkStatus.filter((r) => r.is_favorite);

  const signedInWithin = (days) =>
    data.authUsers.filter((u) => u.last_sign_in_at && now.getTime() - new Date(u.last_sign_in_at).getTime() <= days * DAY_MS).length;

  const parkName = (id) => names.parks?.[id] ?? id;
  const recentLogged = loggedTrips.filter((t) => inWindow(t.created_at));

  return {
    generatedAt: now.toISOString(),
    weeks: weekKeys.length,
    windowStart: weekKeys[0],
    accounts: {
      total: totalAccounts,
      onboardingComplete: data.profiles.filter((p) => p.onboarding_complete).length,
      signedIn7d: signedInWithin(7),
      signedIn30d: signedInWithin(30),
    },
    weekly: [...weekly.values()].map((w) => ({ ...w, activeAccounts: w.activeAccounts.size })),
    adoption: [
      ['Marked a park visited', usersWith(visitedRows)],
      ['Wishlisted a park', usersWith(wishlistRows)],
      ['Logged a trip', usersWith(loggedTrips)],
      ['Planned a trip', usersWith(plannedTrips)],
      ['Added trip photos', usersWith(data.photos)],
      ['Logged a trail', usersWith(data.trailCompletions)],
      ['Logged wildlife', usersWith(data.animalSightings)],
      ['Logged a plant', usersWith(data.plantSightings)],
      ['Earned a badge', usersWith(earnedBadges)],
      ['Sent a content report', usersWith(data.reports)],
    ].map(([label, users]) => ({ label, users, percent: pct(users, totalAccounts) })),
    avgParksVisited: totalAccounts ? +(visitedRows.length / totalAccounts).toFixed(1) : 0,
    topActivities: {
      window: top(countBy(recentLogged.flatMap((t) => t.activities ?? []), (a) => a), 10),
      allTime: top(countBy(loggedTrips.flatMap((t) => t.activities ?? []), (a) => a), 10),
    },
    topParksLogged: {
      window: top(countBy(recentLogged, (t) => t.park_id), 10, parkName),
      allTime: top(countBy(loggedTrips, (t) => t.park_id), 10, parkName),
    },
    topParksVisited: top(countBy(visitedRows, (r) => r.park_id), 10, parkName),
    topParksWishlisted: top(countBy(wishlistRows, (r) => r.park_id), 10, parkName),
    // Catalog trails only (trail_id set) so custom free-text names stay out.
    topTrails: top(countBy(data.trailCompletions, (r) => r.trail_id), 10, (id) => names.trails?.[id] ?? id),
    topBadges: top(countBy(earnedBadges, (b) => b.badge_id), 10, (id) => names.badges?.[id] ?? id),
    explorerStyles: top(countBy(data.profiles, (p) => p.explorer_style ?? '(skipped)'), 20),
    goals: top(countBy(data.profiles, (p) => p.goal ?? '(skipped)'), 20),
    units: top(countBy(data.profiles, (p) => p.units), 5),
  };
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map((_, i) => (i === 0 ? '---' : '---:')).join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
}

const rankList = (items, empty = '_None yet._') =>
  items.length ? items.map((i, n) => `${n + 1}. ${i.label} — ${i.count}`).join('\n') : empty;

export function renderUsageMarkdown(s) {
  const day = s.generatedAt.slice(0, 10);
  const thisWeek = s.weekly[s.weekly.length - 1];
  const lastWeek = s.weekly[s.weekly.length - 2];

  return [
    `# Parks Pal usage — ${day}`,
    '',
    `Covers signed-in accounts only (guest browsing stays on the device and is never sent anywhere). Weeks start Monday, UTC; the last row is the week in progress.`,
    '',
    '## At a glance',
    '',
    `- **${s.accounts.total}** accounts (${s.accounts.onboardingComplete} finished onboarding)`,
    ...(lastWeek ? [`- **${lastWeek.activeAccounts}** active accounts last full week (week of ${lastWeek.week})`] : []),
    `- **${thisWeek.activeAccounts}** active so far this week (in progress)`,
    `- **${thisWeek.newAccounts}** new accounts this week`,
    `- **${s.accounts.signedIn7d}** signed in within 7 days, **${s.accounts.signedIn30d}** within 30 days`,
    `- **${s.avgParksVisited}** parks marked visited per account on average`,
    '',
    '## Week by week',
    '',
    '"Active" = saved at least one trip, photo, trail, sighting, badge or report that week. Just opening the app or browsing isn\'t recorded, so this undercounts casual use.',
    '',
    table(
      ['Week of', 'New accounts', 'Active', 'Trips logged', 'Trips planned', 'Photos', 'Trails', 'Wildlife', 'Plants', 'Badges'],
      s.weekly.map((w) => [w.week, w.newAccounts, w.activeAccounts, w.tripsLogged, w.tripsPlanned, w.photos, w.trailsCompleted, w.wildlife, w.plants, w.badgesEarned]),
    ),
    '',
    '## What people use it for',
    '',
    'Share of all accounts that have ever done each:',
    '',
    table(['Feature', 'Accounts', '%'], s.adoption.map((a) => [a.label, a.users, `${a.percent}%`])),
    '',
    `### Top trip activities — last ${s.weeks} weeks`,
    '',
    rankList(s.topActivities.window),
    '',
    '### Top trip activities — all time',
    '',
    rankList(s.topActivities.allTime),
    '',
    `### Most-logged parks — last ${s.weeks} weeks`,
    '',
    rankList(s.topParksLogged.window),
    '',
    '### Most-visited parks — all time',
    '',
    rankList(s.topParksVisited),
    '',
    '### Most-wishlisted parks',
    '',
    rankList(s.topParksWishlisted),
    '',
    '### Most-completed trails',
    '',
    rankList(s.topTrails),
    '',
    '### Most-earned badges',
    '',
    rankList(s.topBadges),
    '',
    '## Who signs up',
    '',
    `Explorer style: ${s.explorerStyles.map((i) => `${i.label} ${i.count}`).join(' · ') || '—'}`,
    '',
    `Goal: ${s.goals.map((i) => `${i.label} ${i.count}`).join(' · ') || '—'}`,
    '',
    `Units: ${s.units.map((i) => `${i.label} ${i.count}`).join(' · ') || '—'}`,
    '',
  ].join('\n');
}
