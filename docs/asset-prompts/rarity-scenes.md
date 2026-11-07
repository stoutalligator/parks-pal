# Animal rarity hero scenes (Compendium upgrade placeholder)

Part of the planned Animal Compendium detail-page upgrade (currently just a concept — nothing in the app references these files yet). Instead of a bespoke illustration per animal (516 entries, not realistic to hand-draw individually), each animal detail page's hero banner falls back to one of **3 shared scene images**, chosen by the animal's existing `rarity` field (`Common` | `Uncommon` | `Rare` — see `AnimalRarity` in `src/types/index.ts`). The scene should telegraph "how special this sighting is" through mood/lighting rather than depicting any specific species, since one image has to sit behind dozens of different animals.

These reuse the same rarity accent colors already live in the app's UI (`RARITY_COLOR` in `FieldGuideScreen.tsx`): sage for Common, orange for Uncommon, rose for Rare.

**Spec:** 1024x480px (wide banner, ~2.13:1), **opaque background** (this is a full-bleed banner behind a name/stat overlay, not a floating character — no transparency needed). No animal, no character, no text — just an illustrated landscape/atmosphere scene.

**Base style block — paste into every prompt below, unedited:**

> Illustrated landscape scene in a hand-drawn field-journal / vintage-national-park-poster style. Flat color fills only, no gradients, no photorealism, no photographic texture. Palette limited to: forest #2D5016, sage #6B8C5A, sky #A8C5D4, tan #C9A96E, orange #D4845A, rose #C4847A, brown #8B6340, cream #F5F0E8, dark brown #5C4028. Wide landscape banner, 1024x480, fully opaque background filling the entire frame edge to edge. No animals, no people, no text, no logos — atmosphere and scenery only, generic enough to sit behind any park's wildlife.

**Common → `rarity-common.png`** (sage-toned, everyday/easygoing mood):

> [base style block] + A calm, sunlit meadow at midday: rolling grassy hills, a few scattered wildflowers, a light scattering of trees at the horizon, soft even daylight. Dominant color family: sage green and cream, with tan accents. Approachable and ordinary — the kind of place you'd casually spot common wildlife.

**Uncommon → `rarity-uncommon.png`** (orange-toned, golden-hour mood):

> [base style block] + A golden-hour hillside or ridge at sunset: warm orange sky, long soft shadows, a tree line silhouetted against the glow. Dominant color family: orange and tan, with touches of brown. A little more dramatic and specific in timing than the Common scene — the kind of moment you'd have to be in the right place at the right time to catch.

**Rare → `rarity-rare.png`** (rose-toned, dusk/night mood):

> [base style block] + A dusk or nighttime wilderness scene: a deep rose-and-purple sky, a few stars or a crescent moon, misty mountain silhouettes layered in the distance. Dominant color family: rose and dark brown, with small hints of sky blue. The most atmospheric and moody of the three — reserved, elusive, worth the wait.

## Usage once ready

Save all three to a new `src/assets/animals/` folder (opaque scene art, matching the `src/assets/textures/` and `src/assets/maps/` convention of not needing transparency). Nothing wires these in automatically — flag when they're ready and they'll get connected to the animal detail screen via the existing `rarity` field, once that screen exists.
