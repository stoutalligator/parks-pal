# Parks Pal — National Park Tracker

A cozy, illustrated mobile app that lets users track U.S. National Parks they've visited, log trips, save memories and photos, collect digital passport stamps, earn badges, and wishlist future parks. The app should feel like a playful adventure journal crossed with a collectible passport — not a corporate dashboard.

---

## Tech Stack

- **Framework**: React Native + Expo (managed workflow)
- **Language**: TypeScript — strict mode on, no `any`
- **Styling**: NativeWind (Tailwind for RN) — utility classes; shared design tokens in `src/theme/`
- **Navigation**: React Navigation v6 — bottom tab navigator + native stack navigators per tab
- **State**: React Context + local state for v1; architected so Supabase/Firebase can replace mock data later
- **Data**: Local mock data in `src/data/` — all 63 parks stubbed out in v1 so real data can be swapped in without structural changes (plus any pending parks in `UPCOMING_PARKS`, hidden until switched on — see Notes)
- **Fonts**: Fredoka Bold (headings), Nunito Regular (body) — loaded via `expo-font`
- **Icons**: Custom illustrated SVG icons + `@expo/vector-icons` for utility icons
- **Images**: Local illustrated assets in `src/assets/` — no real photography

---

## Commands

```bash
# Install dependencies
npx expo install

# Start dev server
npx expo start

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android

# Type-check
npx tsc --noEmit

# Lint
npx eslint src --ext .ts,.tsx
```

---

## Project Structure

```
src/
  assets/         # Illustrations, mascot images, badge art, map assets
  components/     # Shared UI components (cards, buttons, badges, mascot)
  data/           # Mock park data, trip data, badge definitions
  navigation/     # Tab navigator, stack navigators, linking config
  screens/        # One folder per screen (Login, Home, Explore, ParkDetail, LogTrip, Profile)
  theme/          # Colors, typography, spacing, shadow tokens
  types/          # Shared TypeScript interfaces (Park, Trip, Badge, etc.)
  context/        # AppContext — visited parks, trips, wishlist, badges
docs/
  reference-images/  # Design reference PNGs — the visual source of truth
```

---

## Key Files

| File | Purpose |
|---|---|
| `src/theme/colors.ts` | Single source of truth for the full color palette |
| `src/theme/typography.ts` | Font families, sizes, and weights |
| `src/data/parks.ts` | All 63 national parks in `ALL_PARKS`, plus pending parks in `UPCOMING_PARKS` — every park has a stub entry (id, name, state, region, description placeholder) so no park is missing from the list even before real content is added |
| `src/context/AppContext.tsx` | Global state — visited, wishlist, trips, badges |
| `src/navigation/RootNavigator.tsx` | App-level navigator (onboarding vs main tabs) |
| `src/navigation/TabNavigator.tsx` | Bottom tab bar with floating center + button |

---

## Design Reference

**Always** check `docs/reference-images/` before building or modifying any screen. These are the visual source of truth:

| File | Screen |
|---|---|
| `login-screen.png` | Welcome / landing |
| `explore-screen.png` | Parks tab with illustrated map + progress card |
| `park-view.png` | Park detail sheet |
| `log-trip-screen.png` | Log a Trip modal |
| `profile-screen.png` | Home / Profile dashboard |
| `style-guide.png` | Colors, fonts, button styles, mascot |
| `app-motto.png` | Tagline and four core value icons |

### Color Palette (from style guide)

```ts
forest:   '#2D5016'  // deep forest green — primary buttons, active states
sage:     '#6B8C5A'  // sage green — secondary accents
sky:      '#A8C5D4'  // light sky blue — highlights
background: '#FFFFFF' // white — all screen backgrounds (premium, clean feel)
cream:    '#EAD9B7'  // warm tan-cream — accent card fills, not the base background
tan:      '#C9A96E'  // warm tan — cards, borders
orange:   '#D4845A'  // soft orange — accents, activity icons
rose:     '#C4847A'  // muted rose — hearts, favorites
brown:    '#8B6340'  // earthy brown — mascot details, outlined icons
```

### Typography

- **Headings**: `Fredoka_700Bold` — chunky, friendly, slightly whimsical
- **Body / UI**: `Nunito_400Regular`, `Nunito_600SemiBold`, `Nunito_700Bold`

### UI Rules (match the reference exactly)

- Screen backgrounds: always white `#FFFFFF` (`colors.background`)
- Buttons: pill-shaped (`borderRadius: 999`), forest green fill for primary, outlined for secondary
- Cards: `borderRadius: 16`, white fill, soft shadow (`elevation: 3` / iOS shadow) — since cards and background are both white, shadow is what separates them
- Tab bar: white background, forest green active icon + label, unselected in tan/gray
- Center FAB (`+`): forest green circle, larger than tabs, slight elevation
- Map pins: circular park photo thumbnails with a checkmark badge overlay for visited parks
- Badges: sticker-style, circular or shield-shaped, illustrated
- Bear mascot: appears on welcome, profile hero, log-trip header, and empty states

---

## Working in This Codebase

All color and typography values must come from `src/theme/` — never hardcode hex values or font names inline. Every screen uses the white background (`colors.background`); deviating from this will break the visual cohesion. The illustrated bear mascot is a first-class UI element, not an afterthought — if a screen feels empty without it, add it.

---

## Agent Behavior Rules

### Always
- Check `docs/reference-images/` before building or modifying a screen
- Use theme tokens from `src/theme/` — never hardcode colors or font names
- Prefer editing existing files over creating new ones
- Read a file before editing it
- Keep changes scoped to what was asked — don't refactor surrounding code
- Run `npx tsc --noEmit` before declaring a task done

### Never
- Use neon colors, harsh dark themes, Material UI components, or corporate-looking UI
- Add real photography — all visuals are illustrated assets
- Introduce a new npm dependency without explaining what it replaces and why
- Add comments to self-evident code
- Create files "just in case" or for future use not yet specified
- Add error handling for impossible scenarios

### Check in with the human before
- Adding any new npm/Expo dependency
- Creating a new shared component or utility that doesn't exist yet
- Changing the navigation structure
- Modifying `AppContext` data shapes (breaks mock data compatibility)
- Touching more than 3–4 files for something that wasn't explicitly requested
- Adding any backend integration (v1 is local mock data only)

---

## Deferred (not v1 — but the architecture must not block these)

These features are not being built yet. However, the code must be structured so they can be added without rewrites. See notes below each.

- **Backend / user accounts** — `AppContext` data shapes must map cleanly to a future Supabase or Firebase schema; no logic should be hardcoded that assumes data never persists
- **Real API calls (NPS API, maps API)** — `src/data/parks.ts` acts as a drop-in data layer; the shape of a `Park` object must be stable so swapping mock for live data is a single-file change
- **Cloud photo storage** — photo fields on `Trip` should exist as optional `uri` strings now; don't assume local-only
- **Push notifications** — don't architect anything that would conflict with adding Expo Notifications later
- **Social / sharing features** — no blockers; just not in v1
- **Offline sync** — state management choice (Context now, could become Zustand + MMKV) should not be deeply coupled to screens
- **App Store submission / production builds** — use Expo managed workflow so this stays straightforward
- **Dark mode** — theme tokens in `src/theme/colors.ts` should be keyed semantically (e.g. `background`, `primary`) not by color name, so a dark theme variant can be added by swapping the token map
- **Accessibility (a11y)** — don't actively break it; just not doing a full audit in v1

---

## Notes

- The app is named **Parks Pal** but the display title on the welcome screen reads **"National Park Tracker"** — match the reference image exactly.
- The motto is: **"COLLECT. EXPLORE. REMEMBER."** — used in onboarding/marketing surfaces.
- There are **64 U.S. National Parks**. **Chiricahua (#64)** became official in Nov 2026; it still lives in `UPCOMING_PARKS` and is shown because its id is in the Supabase `app_config` row `enabled_upcoming_parks` (switched on 2026-11-06 — see `supabase/migrations/2026-10-13-app-config.sql`). Never hardcode the count — use `stats.totalParks` / `parks.length`, which follow the switch.
- Guests can browse without an account (Welcome → "Browse Without an Account") — required by App Store guideline 5.1.1(v). Anything that saves to the account goes through `requireAccount()` from `AppContext`, which prompts guests to sign up.
- The bottom tab center button is a `+` FAB for "Log a Trip" — it is NOT a standard tab; it opens a modal stack.
- Onboarding (explorer style + goal selection) is skippable and should not block access to the app — and neither should sign-in (see guest browsing above).
