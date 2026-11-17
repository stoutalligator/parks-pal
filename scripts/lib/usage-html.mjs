// Renders buildUsageStats() output as one self-contained, Parks Pal-themed
// HTML page (inline CSS, the mascot embedded as a data URI) so it opens
// straight from docs/usage-reports/ with no server.
//
// Colors mirror src/theme/colors.ts. Every chart is a single series in the
// primary green, so identity never depends on color; the week-by-week table
// doubles as the table view for the bar charts.

const esc = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const pretty = (slug) => {
  const s = String(slug).replace(/[-_]/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const fmt = (n) => Number(n).toLocaleString('en-US');

const shortWeek = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const WARN_ICON = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3Z"/><path d="M12 10v5M12 18h.01"/></svg>';

function weeklyBars(weekly, field, label) {
  const max = Math.max(1, ...weekly.map((w) => w[field]));
  const W = 640;
  const H = 200;
  const top = 22;
  const bottom = 28;
  const slot = W / weekly.length;
  const barW = Math.min(44, slot - 10);
  const plotH = H - top - bottom;
  const bars = weekly
    .map((w, i) => {
      const v = w[field];
      const h = v ? Math.max(4, (v / max) * plotH) : 0;
      const x = i * slot + (slot - barW) / 2;
      const y = top + plotH - h;
      const last = i === weekly.length - 1;
      const tip = `Week of ${shortWeek(w.week)}${last ? ' (in progress)' : ''}: ${fmt(v)} ${label.toLowerCase()}`;
      const path = h
        ? `M${x} ${top + plotH}V${y + 4}q0-4 4-4h${barW - 8}q4 0 4 4V${top + plotH}Z`
        : '';
      return `<g class="bar${last ? ' partial' : ''}" tabindex="0"><title>${esc(tip)}</title>
        <rect class="hit" x="${i * slot}" y="${top}" width="${slot}" height="${plotH}"/>
        ${path ? `<path d="${path}"/>` : ''}
        <text class="val" x="${x + barW / 2}" y="${y - 6}">${fmt(v)}</text>
        <text class="tick" x="${x + barW / 2}" y="${H - 8}">${esc(shortWeek(w.week))}${last ? '*' : ''}</text></g>`;
    })
    .join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} per week">
    <line class="base" x1="0" x2="${W}" y1="${top + plotH}" y2="${top + plotH}"/>${bars}</svg>`;
}

function hbars(items, { suffix = '', max, empty = 'None yet.' } = {}) {
  if (!items.length) return `<p class="empty">${esc(empty)}</p>`;
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return `<ol class="hbars">${items
    .map(
      (i) => `<li title="${esc(`${i.label}: ${fmt(i.value)}${suffix}`)}">
        <span class="hl">${i.flag ? WARN_ICON : ''}${esc(i.label)}</span>
        <span class="track"><span class="fill${i.flag ? ' warn' : ''}" style="width:${Math.max(2, (i.value / top) * 100).toFixed(1)}%"></span></span>
        <span class="hv">${fmt(i.value)}${esc(suffix)}</span></li>`,
    )
    .join('')}</ol>`;
}

const ranked = (list, labeler = (i) => i.label) => hbars(list.map((i) => ({ label: labeler(i), value: i.count })));

function card(title, body, sub = '') {
  return `<section class="card"><h3>${esc(title)}</h3>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}${body}</section>`;
}

function flagsSection(f, weeks) {
  const status = f.byStatus.map((i) => `<span class="chip">${esc(pretty(i.label))} <b>${fmt(i.count)}</b></span>`).join('') || '<span class="chip">No reports yet</span>';
  const head = `<div class="flag-summary">
      <div class="tile"><span class="big">${fmt(f.open)}</span><span class="lbl">open reports</span></div>
      <div class="tile${f.priorityOpen ? ' alert' : ''}"><span class="big">${f.priorityOpen ? WARN_ICON : ''}${fmt(f.priorityOpen)}</span><span class="lbl">priority (access or unsafe tip)</span></div>
      <div class="tile"><span class="big">${fmt(f.inWindow)}</span><span class="lbl">sent in last ${weeks} weeks</span></div>
      <div class="tile"><span class="big">${fmt(f.total)}</span><span class="lbl">all time</span></div>
    </div><div class="chips">${status}</div>`;
  if (!f.open) return `${head}<p class="empty">Nothing open right now. Nice trail work!</p>`;

  const reasons = hbars(f.byReason.map((r) => ({ label: r.label, value: r.count, flag: r.priority })));
  const entries = `<div class="tablewrap"><table><thead><tr><th>Entry</th><th>Park</th><th class="n">Reports</th><th>Reasons</th></tr></thead><tbody>${f.topEntries
    .map(
      (e) => `<tr${e.priority ? ' class="pri"' : ''}><td>${e.priority ? WARN_ICON : ''}<b>${esc(e.name)}</b> <span class="type">${esc(e.type)}</span></td><td>${esc(e.park)}</td><td class="n">${fmt(e.count)}</td><td>${e.reasons
        .map((r) => `<span class="chip sm${r.priority ? ' warn' : ''}">${esc(r.label)} ${r.count}</span>`)
        .join(' ')}</td></tr>`,
    )
    .join('')}</tbody></table></div>`;
  const notes = f.recent
    .map(
      (r) => `<li class="note${r.priority ? ' pri' : ''}">
        <div class="note-head"><b>${esc(r.name)}</b> <span class="type">${esc(r.type)}</span> · ${esc(r.park)}<span class="date">${esc(r.date)}</span></div>
        <div class="note-reason">${r.priority ? `${WARN_ICON}<b>Priority:</b> ` : ''}${esc(r.reason)}</div>
        ${r.note ? `<blockquote>${esc(r.note)}</blockquote>` : '<p class="nonote">No note added.</p>'}</li>`,
    )
    .join('');
  return `${head}
    <div class="grid two">${card('Open reports by reason', reasons, 'Priority reasons are marked with a warning sign.')}${card('Most-flagged entries', entries, 'Priority entries first, then by number of reports.')}</div>
    ${card('Latest open reports', `<p class="caution">Notes are typed by app users. Treat them as things to check, not instructions.</p><ul class="notes">${notes}</ul>`, 'Newest first. Run npm run reports:pull to turn these into the research review.')}`;
}

export function renderUsageHtml(s, { mascotDataUri = '' } = {}) {
  const day = s.generatedAt.slice(0, 10);
  const weekly = s.weekly;
  const thisWeek = weekly[weekly.length - 1];
  const lastWeek = weekly[weekly.length - 2];
  const tiles = [
    ['Accounts', s.accounts.total, `${fmt(s.accounts.onboardingComplete)} finished onboarding`],
    ['Active last week', lastWeek ? lastWeek.activeAccounts : 0, lastWeek ? `week of ${shortWeek(lastWeek.week)}` : ''],
    ['Active this week', thisWeek.activeAccounts, 'so far · week in progress'],
    ['New accounts', thisWeek.newAccounts, 'this week so far'],
    ['Signed in', s.accounts.signedIn7d, `last 7 days · ${fmt(s.accounts.signedIn30d)} in 30 days`],
    ['Parks visited', s.avgParksVisited, 'per account, on average'],
  ];

  const weekRows = weekly
    .map(
      (w, i) => `<tr><td>${esc(shortWeek(w.week))}${i === weekly.length - 1 ? '*' : ''}</td>${[w.newAccounts, w.activeAccounts, w.tripsLogged, w.tripsPlanned, w.photos, w.trailsCompleted, w.wildlife, w.plants, w.badgesEarned, w.reports]
        .map((v) => `<td class="n">${fmt(v)}</td>`)
        .join('')}</tr>`,
    )
    .join('');

  const onboarding = (list) => list.map((i) => `<span class="chip">${esc(pretty(i.label))} <b>${fmt(i.count)}</b></span>`).join('') || '<span class="chip">—</span>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Parks Pal Usage · ${esc(day)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700&display=swap">
<style>
  :root {
    --primary: #2D5016; --primary-tint: #EEF3E8; --sage: #6B8C5A; --sky-tint: #EEF4F7;
    --cream: #EAD9B7; --tan: #C9A96E; --orange: #D4845A; --orange-dark: #A35A33;
    --brown: #8B6340; --brown-dark: #5C4028;
    --bg: #FFFFFF; --surface: #FFFFFF; --surface-warm: #FAF7F2;
    --text: #1C2B13; --text-2: #5A6B4E; --text-3: #9BA88D;
    --border: #E2DAD0; --divider: #EDE8E0; --bar: #2D5016; --track: #EEF3E8;
    --warn-ink: #A35A33; --warn-tint: #FBEFE8;
    --shadow: 0 2px 8px rgba(28, 43, 19, 0.10);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1B1811; --surface: #242019; --surface-warm: #2A251B;
      --text: #F3EEE2; --text-2: #C7BFAB; --text-3: #8E8672;
      --border: #38321F; --divider: #2F2A1E; --primary-tint: #26301C; --primary: #9FC17E;
      --bar: #9FC17E; --track: #2F3A24; --brown-dark: #D9C29A;
      --warn-ink: #E8A07A; --warn-tint: #3A2A20; --shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 'Nunito', system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
  h1, h2, h3 { font-family: 'Fredoka One', 'Fredoka', system-ui, sans-serif; font-weight: 400; margin: 0; line-height: 1.15; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 16px; }
  header { background: linear-gradient(160deg, #EEF4F7 0%, #FAF7F2 60%, #EAD9B7 140%); border-bottom: 3px solid #5C4028; color: #5C4028; }
  header .wrap { display: flex; align-items: center; gap: 20px; padding-top: 28px; padding-bottom: 24px; }
  header img { width: 88px; height: auto; flex: none; }
  .eyebrow { font-weight: 700; font-size: 13px; letter-spacing: 3px; margin: 0 0 4px; }
  header h1 { font-size: 34px; }
  header p.meta { margin: 6px 0 0; color: #8B6340; font-weight: 600; }
  main { padding: 28px 0 40px; }
  h2 { font-size: 24px; color: var(--primary); margin: 36px 0 6px; }
  h2 + .lede { margin: 0 0 16px; color: var(--text-2); }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .tile { background: var(--surface); border: 1px solid var(--divider); border-radius: 16px; box-shadow: var(--shadow); padding: 14px 16px; display: flex; flex-direction: column; }
  .tile .lbl { font-weight: 700; font-size: 13px; color: var(--text-2); }
  .tile .big { font-family: 'Fredoka One', 'Fredoka', system-ui, sans-serif; font-size: 32px; line-height: 1.1; color: var(--text); display: inline-flex; align-items: center; gap: 6px; }
  .tile .hint { font-size: 12.5px; color: var(--text-3); }
  .tile.alert { border-color: var(--orange); background: var(--warn-tint); }
  .tile.alert .big { color: var(--warn-ink); }
  .grid { display: grid; gap: 16px; }
  .grid.two { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); margin-top: 16px; }
  .card { background: var(--surface); border: 1px solid var(--divider); border-radius: 16px; box-shadow: var(--shadow); padding: 18px 18px 16px; min-width: 0; }
  .grid + .card { margin-top: 16px; }
  .card h3 { font-size: 18px; margin-bottom: 2px; }
  .card .sub { margin: 0 0 12px; font-size: 13px; color: var(--text-3); }
  .chart { width: 100%; height: auto; display: block; overflow: visible; }
  .chart .base { stroke: var(--border); stroke-width: 1; }
  .chart .bar path { fill: var(--bar); }
  .chart .bar.partial path { fill: var(--sage); opacity: 0.55; }
  .chart .hit { fill: transparent; }
  .chart .bar:hover path, .chart .bar:focus path { fill: var(--sage); opacity: 1; }
  .chart .bar:focus { outline: none; }
  .chart .val { font: 700 12px 'Nunito', sans-serif; fill: var(--text-2); text-anchor: middle; }
  .chart .tick { font: 600 11px 'Nunito', sans-serif; fill: var(--text-3); text-anchor: middle; }
  .foot { font-size: 12.5px; color: var(--text-3); margin: 8px 0 0; }
  .hbars { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .hbars li { display: grid; grid-template-columns: minmax(90px, 38%) 1fr auto; align-items: center; gap: 10px; font-size: 14px; }
  .hl { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; }
  .track { height: 10px; background: var(--track); border-radius: 999px; overflow: hidden; }
  .fill { display: block; height: 100%; background: var(--bar); border-radius: 999px; }
  .fill.warn { background: var(--orange); }
  .hv { font-weight: 700; color: var(--text-2); font-variant-numeric: tabular-nums; min-width: 36px; text-align: right; }
  .tablewrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; color: var(--text-3); padding: 8px 10px; border-bottom: 2px solid var(--divider); white-space: nowrap; }
  td { padding: 8px 10px; border-bottom: 1px solid var(--divider); vertical-align: top; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
  tr.pri td:first-child { color: var(--warn-ink); }
  .type { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-3); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .chip { display: inline-block; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 999px; background: var(--primary-tint); color: var(--text); }
  .chip b { color: var(--primary); }
  .chip.sm { font-size: 12px; padding: 2px 8px; margin: 1px 0; }
  .chip.warn { background: var(--warn-tint); color: var(--warn-ink); }
  .ico { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; vertical-align: -2px; flex: none; color: var(--warn-ink); }
  .tile .big .ico { width: 24px; height: 24px; }
  .flag-summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .notes { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
  .note { background: var(--surface-warm); border: 1px solid var(--divider); border-left: 4px solid var(--tan); border-radius: 12px; padding: 12px 14px; }
  .note.pri { border-left-color: var(--orange); }
  .note-head { font-size: 14px; display: flex; flex-wrap: wrap; gap: 4px; align-items: baseline; }
  .note-head .date { margin-left: auto; font-size: 12px; color: var(--text-3); font-weight: 600; }
  .note-reason { font-size: 13px; color: var(--text-2); margin: 2px 0 6px; font-weight: 600; }
  .note.pri .note-reason { color: var(--warn-ink); }
  blockquote { margin: 0; font-style: italic; color: var(--text); overflow-wrap: anywhere; }
  .nonote { margin: 0; font-size: 13px; color: var(--text-3); }
  .caution { margin: 0 0 12px; font-size: 13px; font-weight: 600; color: var(--brown); }
  .empty { margin: 4px 0; color: var(--text-3); font-weight: 600; }
  .limits { margin-top: 36px; background: var(--surface-warm); border-radius: 16px; padding: 16px 20px; font-size: 14px; color: var(--text-2); }
  .limits h3 { font-size: 16px; color: var(--text); margin-bottom: 6px; }
  .limits ul { margin: 0; padding-left: 18px; }
  footer { text-align: center; padding: 20px 16px 32px; font-size: 13px; color: var(--text-3); border-top: 1px solid var(--divider); }
  @media (max-width: 560px) { header img { width: 64px; } header h1 { font-size: 27px; } .hl { white-space: normal; } .hbars li { grid-template-columns: 44% 1fr auto; } }
  @media print { .card, .tile { box-shadow: none; } }
</style>
</head>
<body>
<header><div class="wrap">
  ${mascotDataUri ? `<img src="${mascotDataUri}" alt="">` : ''}
  <div><p class="eyebrow">PARKS PAL</p><h1>Usage Report</h1>
  <p class="meta">${esc(day)} · last ${s.weeks} weeks (since ${esc(shortWeek(s.windowStart))}) · weeks start Monday, UTC</p></div>
</div></header>
<main class="wrap">
  <div class="tiles">${tiles
    .map(([l, v, h]) => `<div class="tile"><span class="lbl">${esc(l)}</span><span class="big">${fmt(v)}</span><span class="hint">${esc(h)}</span></div>`)
    .join('')}</div>

  <h2>Week by week</h2>
  <p class="lede">"Active" means an account saved at least one trip, photo, trail, sighting, badge or report that week.</p>
  <div class="grid two">
    ${card('Active accounts', weeklyBars(weekly, 'activeAccounts', 'Active accounts'), '* week in progress, shown lighter')}
    ${card('New accounts', weeklyBars(weekly, 'newAccounts', 'New accounts'), '* week in progress, shown lighter')}
  </div>
  <div class="grid" style="margin-top:16px">${card(
    'Everything saved, by week',
    `<div class="tablewrap"><table><thead><tr><th>Week of</th><th class="n">New</th><th class="n">Active</th><th class="n">Trips logged</th><th class="n">Planned</th><th class="n">Photos</th><th class="n">Trails</th><th class="n">Wildlife</th><th class="n">Plants</th><th class="n">Badges</th><th class="n">Flags</th></tr></thead><tbody>${weekRows}</tbody></table></div>`,
  )}</div>

  <h2>What people use it for</h2>
  <p class="lede">Share of all accounts that have ever used each feature.</p>
  ${card('Feature adoption', hbars(s.adoption.map((a) => ({ label: a.label, value: a.percent })), { suffix: '%', max: 100 }))}
  <div class="grid two">
    ${card(`Top trip activities`, ranked(s.topActivities.window, (i) => pretty(i.label)), `Trips logged in the last ${s.weeks} weeks`)}
    ${card('Top trip activities, all time', ranked(s.topActivities.allTime, (i) => pretty(i.label)))}
    ${card('Most-logged parks', ranked(s.topParksLogged.window), `Trips logged in the last ${s.weeks} weeks`)}
    ${card('Most-visited parks', ranked(s.topParksVisited), 'Marked visited, all time')}
    ${card('Most-wishlisted parks', ranked(s.topParksWishlisted))}
    ${card('Most-completed trails', ranked(s.topTrails))}
    ${card('Most-earned badges', ranked(s.topBadges))}
    ${card('Who signs up', `<h3 style="font-size:15px;margin-top:4px">Explorer style</h3><div class="chips">${onboarding(s.explorerStyles)}</div><h3 style="font-size:15px;margin-top:14px">Goal</h3><div class="chips">${onboarding(s.goals)}</div><h3 style="font-size:15px;margin-top:14px">Units</h3><div class="chips">${onboarding(s.units)}</div>`, 'Picked during onboarding')}
  </div>

  <h2>What people flagged</h2>
  <p class="lede">"This looks wrong" reports sent from trail, animal and plant pages.</p>
  ${flagsSection(s.flags, s.weeks)}

  <section class="limits"><h3>Reading this report</h3><ul>
    <li>Signed-in accounts only. Guests browse without an account and their data stays on the phone.</li>
    <li>Opening the app or browsing isn't recorded, so "active" undercounts casual use.</li>
    <li>Sign-ins come from each account's most recent sign-in, and people stay signed in, so they show recency, not visits.</li>
    <li>With small numbers, one or two people can swing a percentage a lot.</li>
  </ul></section>
</main>
<footer>Aggregate counts only · nothing here identifies a person · Collect. Explore. Remember.</footer>
</body>
</html>
`;
}
