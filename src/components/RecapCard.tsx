import React, { forwardRef, useRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { Trip, Units } from '@/types';
import { getParkById } from '@/data/parks';
import { getParkScene } from '@/data/parkImages';
import { formatDateRange, dayCountBetween } from '@/utils/dates';
import { convertMiles, convertFeet, distanceLabel, elevationLabel } from '@/utils/units';
import Polaroid, { tapeColorForIndex } from '@/components/Polaroid';
import TripStamp, { STAMP_INK_COLORS } from '@/components/TripStamp';

// A fixed-size layout (4:5) rather than one that flexes with the screen, so
// the picture that gets shared looks identical on every phone. It's captured
// at 3x, i.e. 1080x1350.
export const RECAP_CARD_WIDTH = 360;
export const RECAP_CARD_HEIGHT = 450;

const TEXTURE = require('@/assets/textures/texture-cream.png');
const MASCOT = require('@/assets/mascot/mascot-happy.png');

const PHOTO_AREA_HEIGHT = 188;
const TEXTURE_BLEED = 40;
const MAX_PHOTOS = 3;
const MAX_CHIP_CHARS = 44;

const NUMBER_WORDS = ['', 'A', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

function titleFor(days: number, parkName: string): string {
  if (days === 1) return `A day in ${parkName}`;
  const count = days < NUMBER_WORDS.length ? NUMBER_WORDS[days] : String(days);
  return `${count} days in ${parkName}`;
}

interface Layout {
  size: number;
  variant: 'stack' | 'page';
  slots: { left: number; top: number; rotate: number }[];
}

// Where the polaroids sit, by how many photos the trip has. A trip with no
// photos shows the park's own scene as a single "photo".
function layoutFor(count: number): Layout {
  if (count <= 1) return { size: 146, variant: 'page', slots: [{ left: 107, top: 2, rotate: -2 }] };
  if (count === 2) {
    return {
      size: 126,
      variant: 'stack',
      slots: [
        { left: 40, top: 6, rotate: -5 },
        { left: 194, top: 20, rotate: 4 },
      ],
    };
  }
  return {
    size: 112,
    variant: 'stack',
    slots: [
      { left: 12, top: 20, rotate: -5 },
      { left: 124, top: 6, rotate: 2 },
      { left: 236, top: 24, rotate: 5 },
    ],
  };
}

interface Props {
  trip: Trip;
  units: Units;
  // Called once every photo on the card has loaded, so the caller knows it is
  // safe to capture the card as an image.
  onPhotosLoaded?: () => void;
}

const RecapCard = forwardRef<View, Props>(function RecapCard({ trip, units, onPhotosLoaded }, ref) {
  const park = getParkById(trip.parkId);
  const notifiedRef = useRef(false);
  const loadedRef = useRef(0);

  const photos = trip.photos.slice(0, MAX_PHOTOS);
  const captions = trip.photoCaptions ?? [];
  const hasCaptions = photos.some((_, i) => !!captions[i]);
  const expectedLoads = Math.max(1, photos.length);

  const handleLoaded = () => {
    loadedRef.current += 1;
    if (!notifiedRef.current && loadedRef.current >= expectedLoads) {
      notifiedRef.current = true;
      onPhotosLoaded?.();
    }
  };

  if (!park) return null;

  const days = dayCountBetween(trip.startDate, trip.endDate);
  const layout = layoutFor(photos.length);

  const animals = Array.from(new Set(trip.wildlifeSightings ?? []));
  const chips: string[] = [];
  let chars = 0;
  for (const name of animals) {
    if (chips.length >= 3 || chars + name.length > MAX_CHIP_CHARS) break;
    chips.push(name);
    chars += name.length;
  }
  const hiddenAnimals = animals.length - chips.length;

  const stats: { value: string; label: string }[] = [{ value: String(days), label: days === 1 ? 'Day' : 'Days' }];
  if (trip.milesHiked && trip.milesHiked > 0) {
    stats.push({ value: convertMiles(trip.milesHiked, units).toFixed(1), label: units === 'mi' ? 'Miles' : 'Km' });
  }
  if (trip.elevationGainFt && trip.elevationGainFt > 0) {
    stats.push({
      value: Math.round(convertFeet(trip.elevationGainFt, units)).toLocaleString(),
      label: `Elev ${elevationLabel(units)}`,
    });
  }
  if (animals.length > 0) stats.push({ value: String(animals.length), label: 'Animals' });
  const plantCount = new Set(trip.floraSightings ?? []).size;
  if (plantCount > 0 && stats.length < 5) stats.push({ value: String(plantCount), label: 'Plants' });

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <Image source={TEXTURE} style={styles.texture} resizeMode="cover" />
      <View pointerEvents="none" style={styles.frame} />

      <Text style={styles.kicker}>TRIP RECAP</Text>
      <Text style={styles.title} numberOfLines={2}>
        {titleFor(days, park.name)}
      </Text>
      <Text style={styles.dates}>{formatDateRange(trip.startDate, trip.endDate)}</Text>

      <View style={styles.photoArea}>
        {photos.length === 0 ? (
          <View style={[styles.slot, { left: layout.slots[0].left, top: layout.slots[0].top }]}>
            <Polaroid
              source={getParkScene(park.id)}
              size={layout.size}
              variant={layout.variant}
              rotate={layout.slots[0].rotate}
              tapeColor={tapeColorForIndex(0)}
              onLoad={handleLoaded}
            />
          </View>
        ) : (
          photos.map((uri, i) => (
            <View key={uri} style={[styles.slot, { left: layout.slots[i].left, top: layout.slots[i].top }]}>
              <Polaroid
                uri={uri}
                size={layout.size}
                variant={layout.variant}
                rotate={layout.slots[i].rotate}
                tapeColor={tapeColorForIndex(i)}
                caption={captions[i]}
                roomForCaption={hasCaptions}
                onLoad={handleLoaded}
              />
            </View>
          ))
        )}
        <View style={styles.stampWrap}>
          <TripStamp trip={trip} ink={STAMP_INK_COLORS[1]} size={54} hideName />
        </View>
      </View>

      <View style={styles.statsRow}>
        {stats.map((stat, i) => (
          <View key={stat.label} style={[styles.stat, i > 0 && styles.statDivider]}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.chipRow}>
        {chips.map((name) => (
          <View key={name} style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>
              {name}
            </Text>
          </View>
        ))}
        {hiddenAnimals > 0 && (
          <View style={styles.chip}>
            <Text style={styles.chipText}>+{hiddenAnimals} more</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Image source={MASCOT} style={styles.mascot} resizeMode="contain" />
        <Text style={styles.brand}>Parks Pal</Text>
        <Text style={styles.motto}>COLLECT. EXPLORE. REMEMBER.</Text>
      </View>
    </View>
  );
});

export default RecapCard;

const styles = StyleSheet.create({
  card: {
    width: RECAP_CARD_WIDTH,
    height: RECAP_CARD_HEIGHT,
    backgroundColor: colors.surfaceWarm,
    overflow: 'hidden',
    paddingTop: 20,
    paddingHorizontal: 22,
  },
  // The texture PNG has its own rounded frame baked in ~10px from its edges,
  // which `cover` crops on the sides but not top/bottom, leaving a stray line
  // just off the card's real frame. Oversizing the image pushes every baked
  // edge outside the card's overflow:hidden bounds.
  // Explicit width/height (not just insets) because react-native-web renders
  // an Image without them at the PNG's tiny intrinsic size.
  texture: {
    position: 'absolute',
    top: -TEXTURE_BLEED,
    left: -TEXTURE_BLEED,
    width: RECAP_CARD_WIDTH + TEXTURE_BLEED * 2,
    height: RECAP_CARD_HEIGHT + TEXTURE_BLEED * 2,
    opacity: 0.55,
  },
  frame: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderWidth: 1.5,
    borderColor: colors.tan,
    borderRadius: radius.md,
  },

  kicker: { ...typography.labelSmall, color: colors.brown, letterSpacing: 2, fontSize: 10 },
  title: { ...typography.h3, color: colors.textPrimary, fontSize: 24, lineHeight: 28, marginTop: 2 },
  dates: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },

  // Slots are positioned against the full card width, so the photo area
  // stretches past the card's horizontal padding.
  photoArea: { height: PHOTO_AREA_HEIGHT, marginHorizontal: -22, marginTop: spacing.sm },
  slot: { position: 'absolute' },
  stampWrap: { position: 'absolute', right: 14, bottom: -6, width: 82, zIndex: 5 },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: `${colors.surface}CC`,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { borderLeftWidth: 1, borderLeftColor: colors.divider },
  statValue: { ...typography.h4, color: colors.primary, fontSize: 20, lineHeight: 24 },
  statLabel: { ...typography.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 9 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm, minHeight: 22 },
  chip: { backgroundColor: colors.cream, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  chipText: { ...typography.labelSmall, color: colors.brownDark, fontSize: 10 },

  footer: {
    position: 'absolute',
    left: 22,
    right: 22,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mascot: { width: 22, height: 27 },
  brand: { ...typography.labelSemiBold, color: colors.brownDark, fontSize: 11, flex: 1 },
  motto: { ...typography.caption, color: colors.textMuted, fontSize: 7.5, letterSpacing: 0.8 },
});
