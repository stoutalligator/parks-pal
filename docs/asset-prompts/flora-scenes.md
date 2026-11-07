# Flora hero scenes (Field Guide plant pages)

Plant pages in the Field Guide (`PlantDetailScreen.tsx`) open with a hero banner, like animal pages. Same approach as [rarity-scenes.md](rarity-scenes.md): rather than one illustration per plant, each plant page uses one of **3 shared scenes** chosen by the plant's `rarity` (`Common` | `Uncommon` | `Rare`). Until these exist, plant pages borrow the animal rarity scenes, which look fine but aren't plant-focused.

The scenes should feel botanical: close-up plants and blooms in the foreground, landscape behind. Keep them generic enough to sit behind any park's plant, desert or forest.

**Spec:** 1024x480px (wide banner, ~2.13:1), **opaque background**. No animals, no people, no text.

**Base style block — paste into every prompt below, unedited:**

> Illustrated landscape scene in a hand-drawn field-journal / vintage-national-park-poster style. Flat color fills only, no gradients, no photorealism, no photographic texture. Palette limited to: forest #2D5016, sage #6B8C5A, sky #A8C5D4, tan #C9A96E, orange #D4845A, rose #C4847A, brown #8B6340, cream #F5F0E8, dark brown #5C4028. Wide landscape banner, 1024x480, fully opaque background filling the entire frame edge to edge. Foreground filled with generic wildflowers, leaves and grasses drawn large and close, landscape softly behind. No animals, no people, no text, no logos.

**Common → `flora-common.png`** (sage-toned, everyday):

> [base style block] + A sunny trailside in late morning: a loose cluster of simple white and yellow wildflowers and broad green leaves up close, a soft meadow and a few trees behind. Dominant color family: sage green and cream. Easygoing and familiar.

**Uncommon → `flora-uncommon.png`** (orange-toned, in-season):

> [base style block] + A hillside in full bloom at golden hour: tall flower spikes and flowering shrubs in orange and rose up close, warm low light, long soft shadows across the slope. Dominant color family: orange and tan. A little more special, like catching the bloom at its peak.

**Rare → `flora-rare.png`** (rose-toned, elusive):

> [base style block] + A single striking flower in a quiet, misty glade at dusk: a large rose-colored bloom in sharp focus up close, ferns and mossy rocks around it, layered blue-grey ridgelines fading behind. Dominant color family: rose and dark brown, with hints of sky blue. Rare and worth the search.

## Usage once ready

Save all three to `src/assets/plants/`, then flag it: the swap is one lookup (`RARITY_HERO` in `PlantDetailScreen.tsx`) from the `src/assets/animals/rarity-*.png` files to these.
