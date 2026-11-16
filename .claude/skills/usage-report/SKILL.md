---
name: usage-report
description: Use when the user asks for usage statistics, a usage report, weekly users, sign-ups, or what people use Parks Pal for. Runs scripts/usage-report.mjs against Supabase and summarizes the aggregate report. Read-only.
---

# Usage report

Produces an aggregate usage report from the Supabase tables the app already writes to. It never changes the database.

## Run it

```bash
npm run usage:report                 # last 8 weeks
npm run usage:report -- --weeks 12   # 2 to 52 weeks
```

Needs `.env` with `EXPO_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY` (see `.env.example`). If either is missing, the script stops with a message: tell the user which value to add and stop. Never ask them to paste the service-role key into the chat.

The script prints the report and saves it to `docs/usage-reports/usage-YYYY-MM-DD.md`. That folder is gitignored, so don't commit reports.

## What's in it

- **At a glance**: total accounts, active this week vs last week, new accounts, sign-ins within 7 and 30 days.
- **Week by week**: new accounts, active accounts, trips logged/planned, photos, trails, wildlife, plants and badges per week (Monday-start, UTC; last row is the week in progress).
- **What people use it for**: share of accounts using each feature, top trip activities, most-logged/visited/wishlisted parks, top trails and badges.
- **Who signs up**: explorer style, goal and units chosen in onboarding.

## Reading it correctly

When you summarize, keep these limits in mind and mention them where they matter:

- **Signed-in accounts only.** Guests browse without an account and their data stays on the device, so they never appear.
- **"Active" means saved something** (trip, photo, trail, sighting, badge or report) that week. Opening the app or just browsing isn't recorded, so it undercounts casual use.
- **Sign-ins** come from each account's most recent sign-in only, and sessions stay signed in, so they show recency, not weekly visits.
- **Small numbers swing a lot.** With few accounts, a change of one or two users can look like a big percentage move.

## Rules

- The report is aggregate counts only. Don't add per-user rows, emails, names, notes, photo captions, or free-text trail/animal names, and don't query them for the summary.
- Don't add analytics SDKs or event tracking to the app to fill gaps. The site promises "No ads or tracking"; raise it with the user instead.
- After running, give the user a short summary (a few lines with the headline numbers and anything notable), then the path to the saved file.
