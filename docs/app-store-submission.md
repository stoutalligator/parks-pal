# App Store / Play Store Submission Reference

Copy-paste source for store listings and the privacy questionnaires. Not app documentation — working content for App Store Connect / Google Play Console.

## iOS Submission Status

**Submitted for App Review on 2026-10-14** (v1.0.0). Google Play has not been submitted yet.

App Store Connect settings as submitted, beyond the listing copy below:

- **Availability:** United States and Canada only. The EU is excluded, so the Digital Services Act trader/non-trader declaration was skipped (its "Set Up" banner stays visible but doesn't block anything). To add the EU later: declare non-trader while the app is free; trader status requires publishing a verified address/phone/email on the EU product page.
- **Price:** Free ($0.00, US base country). No in-app purchases or subscriptions, so App Store Server Notifications URLs are left blank.
- **Age rating:** 4+, override set to "Not Applicable" — see section 2.
- **App Privacy:** seven data types declared, as in section 3.
- **Encryption documentation:** not needed — `ITSAppUsesNonExemptEncryption: false` in `app.json`; HTTPS and `expo-crypto` both use iOS's built-in encryption.
- **Accessibility Nutrition Labels:** left blank (optional, and no VoiceOver/Larger Text audit has been done).
- **Not applicable:** Vietnam Game License, Regulated Medical Devices, Game Center, Promo Codes.

While in review: keep the demo account's password and trips unchanged, and don't push Supabase migrations that could break the live app.

---

## Closed Beta Plan (retired)

The app previously gated sign-up behind a shared Beta Key (`supabase/functions/beta-signup`) while it was friends-and-family only. That gate has been removed — `AuthScreen.tsx` now calls `supabase.auth.signUp()` directly and the `beta-signup` Edge Function has been deleted. If a `BETA_SIGNUP_KEY` secret is still set on the Supabase project, it's inert and can be removed with `npx supabase secrets unset BETA_SIGNUP_KEY`.

**Status: "Confirm email" is now ON** (turned on in the Supabase dashboard to prevent a flood of unconfirmed/fake signups). New users get a confirmation email before they can log in — the app already handles this (`confirmEmailSent` in `AuthScreen.tsx`), showing a "Check Your Email" screen instead of logging them straight in.

**Required Supabase dashboard config (Authentication → URL Configuration):**
- **Site URL**: `https://parks-pal.com` — done.
- **Redirect URLs allowlist** must include both hosted pages the app links out to, or Supabase will reject the redirect and the link will silently fail:
  - `https://parks-pal.com/reset-password` (password reset — should already be added)
  - `https://parks-pal.com/confirmed` (signup email confirmation — new, add this one)

The confirmation page itself (`site/confirmed/index.html`) is a static page matching the reset-password page's style — it just reads the redirect params GoTrue appends after verifying the link server-side and shows a success or expired-link message. No form, no API calls; the actual account confirmation already happened before the browser lands there.

**Web-app browser access — also retired.** During the closed-beta / pre-Apple-Developer-access period, `npx expo export --platform web`'s output (`dist/`) was deployed to a separate Cloudflare Pages project ("park-pal-app") so the app could be used in a browser without a real iOS build. Now that builds go through EAS + a real Apple Developer account (TestFlight-bound), that workaround is unnecessary — the "park-pal-app" Cloudflare Pages project has been taken down. This is a **separate** project from "park-pal" (which serves `site/` — the homepage, privacy, support, terms, reset-password, and confirmed pages) — removing it doesn't affect any of those required URLs. The local `dist/` folder was also deleted from the repo; it was untracked build output and its ~230MB was bloating the EAS build archive for no reason once native builds took over.

---

## 0. Full Path From Here to Live (ordered)

**Accounts (do these first — they gate everything else)**
1. Enroll in the **Apple Developer Program** — developer.apple.com/programs, $99/year, needs a real name + address, approval can take a few hours to a day or two.
2. Create a **Google Play Console** account — play.google.com/console, one-time $25 fee, approval is usually fast (sometimes instant, sometimes ~1 day for identity verification).

**iOS: get a build onto your phone**
3. `npx eas login` (or `eas login`) — link the project to your Expo account if not already.
4. `npx eas-cli build --platform ios --profile production` — first run will prompt to create/link iOS credentials (signing certificate + provisioning profile); let EAS manage these automatically unless you already have your own. Use `production`, not `preview`: the iOS `preview` profile is internal (ad-hoc) distribution, which can't be uploaded to TestFlight. Build numbers auto-increment (`autoIncrement` + remote version source).
5. `npx eas-cli submit --platform ios --latest` — uploads that build to App Store Connect / TestFlight. (Or add `--auto-submit` to step 4 to do both in one go.)
6. Install **TestFlight** from the App Store on your phone, accept the invite, install the build, actually use the app end to end on real hardware (not just launch it) — this is where you'd catch anything Expo Go's sandbox hid, like the Sentry native module.

**Android: get a build onto your phone (optional but cheap to do in parallel)**
7. `eas build --platform android --profile preview` — produces an installable `.apk` directly (per your `eas.json` preview profile), no store account needed yet — EAS gives you a download link/QR code you can install straight onto an Android phone for testing.
8. Once happy, `eas build --platform android --profile production` (`.aab`) + `eas submit --platform android --latest` to get it into Play Console's internal testing track.

**Store listing setup (can happen anytime after accounts exist, in parallel with testing)**
9. In App Store Connect: create the app record (bundle ID `com.parks-pal.app` — matches `app.json`'s `ios.bundleIdentifier`), fill in listing copy, keywords, category, age rating, and the App Privacy questionnaire — all drafted in sections 1–4 below.
10. In Play Console: create the app, fill in the Data Safety form and content rating questionnaire, store listing text — also drafted below.
11. Take the actual screenshots and upload them to both consoles (iOS done; Android still to do).
12. Set Support URL → `https://parks-pal.com/support` and Privacy Policy URL → `https://parks-pal.com/privacy` in both consoles.

**Final checks before hitting submit**
13. ~~Confirm the Supabase SQL migrations in `supabase/schema.sql` have actually been run against the live project~~ — **confirmed live.** `delete_own_account` verified working for real (deleted a test account, confirmed it's gone from Authentication → Users in the dashboard).
14. Walk the account-deletion flow once for real on the TestFlight build, since Apple reviewers specifically test this.
15. **Sentry auth token — decided: deferred.** The first `eas build` failed because `@sentry/react-native`'s Xcode build phase tries to auto-upload source maps/dSYMs and has no auth token to do it with. Fix applied: set `SENTRY_DISABLE_AUTO_UPLOAD=true` as an EAS environment variable (both `preview` and `production`) to skip that step. Crash reporting itself still works — you just won't get symbolicated stack traces in Sentry until a real `SENTRY_AUTH_TOKEN` is set up later. Custom SMTP (for branded auth emails) — **decided: not needed right now.** Supabase's default email sending works fine for the current volume; revisit only if branding the auth emails becomes a priority later or default sending's rate limits become a real problem.

**Submit**
16. **Done — submitted 2026-10-14.** In App Store Connect, select the TestFlight-tested build, complete the submission questionnaire (export compliance — already answered via `ITSAppUsesNonExemptEncryption: false` in `app.json`), and submit for review. Typical review time: 1–3 days.
17. In Play Console, promote the tested build from internal testing to production (or go through Google's closed/open testing track first if you want more real-world testers before a full release). Review time: usually a few hours to 1 day.

**Demo account (App Store Connect → "Sign-In Required" / TestFlight Beta App Review → Sign-In Information):**
A pre-confirmed reviewer account exists so reviewers can skip the email-confirmation step entirely, filled with example trips so every screen has content. **The credentials are not stored in this repo** (it's public): the email and password are in the local `.env` (`DEMO_ACCOUNT_EMAIL` / `DEMO_ACCOUNT_PASSWORD`) and get pasted straight into App Store Connect's Sign-In Information fields.

**App Review notes (paste into App Store Connect → App Review Information → Notes):**
> A demo account is provided (see Sign-In Information) that's already confirmed and ready to log in with — no email confirmation step needed for it. If you'd rather create your own account instead, note that new sign-ups do require confirming an email address before you can log in, since that's a standard part of the app's account flow.
>
> No account is needed to browse: tap "Browse Without an Account" on the welcome screen to explore every park, trail, and animal. An account is only asked for when saving something to it — marking parks visited, bucket-listing, logging or planning trips, and the Trips and Profile tabs.

**Guideline 5.1.1(v) rejection (review of 1.0.0 (9), 2026-11-04):** the app required sign-in before browsing parks. Fixed by adding guest browsing (the welcome-screen link above); saving actions prompt to sign up instead of blocking the whole app.

**TestFlight external testing — Beta App Review fields:**

Beta App Description ("What to Test"):
```
Parks Pal is a national park tracker — log trips, track which of the 64 U.S. National Parks you've visited, collect postcards from every trip, and earn badges.

Please test:
- Signing up for an account (requires confirming your email)
- Marking parks as visited/planned on the map
- Logging or planning a trip, including adding trail hikes and wildlife sightings
- Viewing your Profile (badges, avatar picker, stats)
- Deleting your account from Settings

A demo account is provided below if you'd rather skip the signup/email-confirmation step.
```

Feedback Email: `parkpal.support@gmail.com`

Contact Information: developer's real name, phone, and email (this is Apple's private way to reach the developer — separate from the public-facing Feedback Email above).

---

## 1. Listing Copy

### App name
**Parks Pal - Park Tracker** (App Store Connect's "Name" field, 30-char limit — "Parks Pal" alone was already taken by another developer, so this tweak clears that collision). This is the App Store listing name only; the internal bundle identifiers (`com.parks-pal.app` iOS, `com.parkspal.app` Android) aren't user-visible and don't need to match, and the in-app/home-screen display name stays "Parks Pal" (`app.json`'s `expo.name` is separate from the store listing name and doesn't need to change).

### iOS Subtitle (30 char limit)
`Your National Park Tracker`

### iOS Promotional Text (170 char limit, editable without a new build)
`Track every U.S. National Park you visit. Plan trips with daily itineraries, log memories and photos, collect postcards, and earn badges along the way.`

### iOS Keywords (100 char limit, comma-separated, no spaces needed after commas)
`national park,hiking,trip planner,travel journal,postcards,badges,camping,outdoors,nature,trail log`

### Google Play Short Description (80 char limit)
`Track, plan, and log your visits to all 64 U.S. National Parks.`

### Full Description (works for both stores, ~1650 chars — well under either 4000-char cap)
Avoids the park count ("every" instead of a number) because the description can only change with a new app version.
```
Parks Pal is your cozy companion for exploring America's National Parks.

Whether you're checking parks off your bucket list or reliving trips you've already taken, Parks Pal helps you track it all:

COLLECT
Mark every park you've visited and watch your illustrated map fill in as you work toward every U.S. National Park. Each trip you log becomes a postcard in your collection.

EXPLORE
Discover what makes each park special, from the Fruita orchards at Capitol Reef to the hoodoos of Bryce Canyon. Short on time? Every park has an "Only Have a Day?" plan to make the most of it. Browse trail guides with elevation charts, best seasons, and tips, plus a wildlife compendium of the animals you might spot.

REMEMBER
Plan trips with daily itineraries or log the ones you've taken, day by day: activities, viewpoints, trails hiked, wildlife sightings, weather, notes, and photos. Then share a beautiful trip recap with friends and family.

Along the way, earn badges for milestones like your first hike, your first camping trip, or reaching a new region. Some badges are secret, hidden in specific parks, and a few unlock new animal pals for your profile.

Parks Pal keeps your data private and synced to your own account, and it works even when you're out of signal: your trips save on your phone and sync once you're back in range. No ads, no tracking, no selling your data. Just a simple, illustrated way to keep your park adventures organized.

Parks Pal is an independent app and isn't affiliated with or endorsed by the National Park Service. Conditions, closures, and permits change, so always check NPS.gov before you go.

COLLECT. EXPLORE. REMEMBER.
```

### Category
Primary: **Travel**. Secondary (iOS only, optional): **Lifestyle**

### Marketing URL (optional)
`https://parks-pal.com` — the homepage; fine to leave blank instead since it's currently just a links page.

### Version
`1.0.0` — keep in sync with `app.json`'s `expo.version`.

### Copyright
`2026 John Fiester` — Apple's convention is `[year] [legal name]`; since the account is enrolled as an Individual, this is the developer's own legal name, not "Parks Pal."

---

## 2. Age Rating

**Apple (App Information → Age Rating):** No objectionable content in any category (violence, mature themes, gambling, etc. all "None") → resolves to **4+**. Answers to the 2025 questions: Health or Wellness Topics, Medical or Treatment Information, Unrestricted Web Access (links open in Safari), User-Generated Content (trip content is private to the account), Messaging, Advertising, and Parental Controls/Age Assurance are all **No**.

Age Categories and Override: **Not Applicable**. Not "Made for Kids" (Kids category rules would apply, and the Terms say the app isn't directed at children under 13), and no higher override is needed because the Terms set no minimum age. If the Terms ever add a 13+ minimum, override to 13+.

**Google Play (Content rating questionnaire, via IARC):** Answer "No" to every mature-content question (violence, sexual content, drugs, gambling, user-generated text shared publicly — trip notes are private to the account, not public/social) → resolves to **Everyone**.

---

## 3. Apple "App Privacy" (Data Collection) answers

Go to App Store Connect → App Privacy → and declare:

| Category | Data type | Collected? | Linked to identity? | Used for tracking? | Purpose |
|---|---|---|---|---|---|
| Contact Info | Name | Yes | Yes | No | App Functionality (profile display name, stored in `profiles.name`) |
| Contact Info | Email Address | Yes | Yes | No | App Functionality (account login) |
| User Content | Photos or Videos | Yes | Yes | No | App Functionality (trip photos) |
| User Content | Other User Content | Yes | Yes | No | App Functionality (trip notes, activities, trail/wildlife logs) |
| Identifiers | User ID | Yes | Yes | No | App Functionality (account/session) |
| Diagnostics | Crash Data | Yes | **No** | No | App Functionality (Sentry crash reporting — no email/user ID attached, see note below) |
| Diagnostics | Performance Data | Yes | **No** | No | App Functionality (Sentry performance tracing, `tracesSampleRate: 0.2`, plus session tracking — same no-identity note) |

Everything else (Location, Financial Info, Health & Fitness, Contacts, Browsing History, Search History, Usage Data, Purchases, Messages) → **not collected**.

"Other User Content" also covers the trail/animal problem reports users can submit (reason + optional note, linked to the account, deleted with it).

**Note on Diagnostics / Sentry:** the code never calls `Sentry.setUser()`, so crash reports carry device/OS info but no email or account identifier — that's why Diagnostics is "not linked to identity." If a `setUser` call is ever added later, this answer needs to flip to "linked."

**"Data Used to Track You"**: answer **No** across the board — nothing is used for cross-app/cross-site tracking, no ad networks, no data brokers. This also means no App Tracking Transparency (ATT) prompt is needed.

---

## 4. Google Play "Data Safety" answers

| Section | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | Yes |
| Data types collected | Personal info → Name, Email address · Photos and videos → Photos · App activity → App interactions (trip/park data) · App info and performance → Crash logs |
| Is all collected data encrypted in transit? | Yes (HTTPS/TLS to Supabase) |
| Do you provide a way for users to request data deletion? | Yes — in-app (Settings → Delete Account), immediate and permanent |
| Is data shared with third parties? | No |
| Is data collection optional for any of these types? | No — email is required to create an account; photos are optional (user chooses whether to attach them) |

Privacy Policy URL for both stores: **https://parks-pal.com/privacy**
Support URL for both stores: **https://parks-pal.com/support**
Terms of Service URL: **https://parks-pal.com/terms** (Settings → Privacy Policy / Terms of Service and About → links all open these web pages; there is no in-app copy of the text)

**App Store Connect EULA field:** optional — leave blank to use Apple's standard EULA, or paste the Terms of Service page's text in if you want Parks Pal's own terms (covering the "as-is"/liability-limitation language and the trail-info disclaimer) to be the actual binding agreement instead of Apple's default. Not required for submission either way.

---

## 5. iOS Privacy Manifest

No manual `PrivacyInfo.xcprivacy` file is needed in this project. The only dependency that touches an Apple "required reason" API is `@react-native-async-storage/async-storage`, and it already ships its own manifest (`node_modules/@react-native-async-storage/async-storage/ios/PrivacyInfo.xcprivacy`), which Xcode auto-merges at build time via EAS Build. No other dependency (Supabase, Sentry, expo-image-picker) touches a required-reason API directly. Nothing to author here — just confirm App Store Connect doesn't flag a missing manifest after the first build upload, since new SDK versions occasionally add new required-reason usage.

---

## 6. Screenshots

**iOS: done** — uploaded to App Store Connect for the 2026-10-14 submission. Android screenshots still needed. Required sizes:

- iOS: 6.9" display (iPhone 16 Pro Max class, 1320×2868 or 2868×1320) — **required**. 6.5" and 5.5" are optional now that Apple auto-scales, but including them avoids relying on that.
- Android: phone screenshots, minimum 320px, recommended 1080×1920 or similar 16:9/9:16.

Recommended shots (5–6, in this order): Explore/map screen, a Park Detail sheet, Log/Plan a Trip, Trip Detail with photos, Profile/Postcard Collection screen. Since there's no real device farm set up, the fastest path is running the iOS Simulator (6.9" class device) and Android Emulator locally and capturing each screen with the demo account populated with a few trips so the screens don't look empty.
