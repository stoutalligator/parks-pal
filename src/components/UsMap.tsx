import React, { useMemo, useState } from 'react';
import { View, Image, TouchableOpacity, ScrollView, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Polyline, Polygon } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadows } from '@/theme';
import { Park, ParkStatus } from '@/types';
import { IMAGE_HEIGHT, CROP_TOP, CROPPED_WIDTH, CROPPED_HEIGHT, projectPark, resolveOverlaps } from '@/utils/mapProjection';
import { getParkImage } from '@/data/parkImages';

const PIN_SIZE = 26;
const BADGE_SIZE = 14;

const STAR_POINTS = '6,1 7.2,4.4 10.8,4.5 7.9,6.6 8.9,10.1 6,8 3.1,10.1 4.1,6.6 1.2,4.5 4.8,4.4';

const STATUS_BADGE: Record<ParkStatus, { bg: string; icon: 'check' | 'star' | 'none' }> = {
  visited: { bg: colors.visited, icon: 'check' },
  planned: { bg: colors.planned, icon: 'none' },
  notVisited: { bg: colors.notVisited, icon: 'none' },
};
// Bucket List is the independent `isFavorite` flag, not a status — a
// not-yet-visited park (planned or not) that's favorited still gets the
// star pin, same as the old 'bucketList' status used to render.
const FAVORITE_BADGE = { bg: colors.bucketList, icon: 'star' as const };

function StatusIcon({ icon }: { icon: 'check' | 'star' | 'none' }) {
  if (icon === 'check') {
    return (
      <Svg width={BADGE_SIZE * 0.6} height={BADGE_SIZE * 0.6} viewBox="0 0 12 12">
        <Polyline
          points="2,6 5,9 10,3"
          fill="none"
          stroke={colors.textInverse}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  if (icon === 'star') {
    return (
      <Svg width={BADGE_SIZE * 0.6} height={BADGE_SIZE * 0.6} viewBox="0 0 12 12">
        <Polygon points={STAR_POINTS} fill={colors.textInverse} />
      </Svg>
    );
  }
  return null;
}

interface PinProps {
  park: Park;
  x: number;
  y: number;
  onPress: () => void;
}

function Pin({ park, x, y, onPress }: PinProps) {
  const badge = park.isFavorite && park.status !== 'visited' ? FAVORITE_BADGE : STATUS_BADGE[park.status];
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={8}
      style={[styles.pin, { left: x - PIN_SIZE / 2, top: y - PIN_SIZE / 2 }]}
    >
      <View style={styles.pinImageClip}>
        <Image
          source={getParkImage(park.id)}
          style={styles.pinImage}
          resizeMode="cover"
        />
      </View>
      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
        <StatusIcon icon={badge.icon} />
      </View>
    </TouchableOpacity>
  );
}

interface Props {
  parks: Park[];
  onPressPark: (parkId: string) => void;
}

export default function UsMap({ parks, onPressPark }: Props) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ width, height });
  };

  // Scale so the map covers the whole viewport with no blank edges: fill the
  // height and pan horizontally (Alaska/the islands sit at its edges), or —
  // when cards above and below leave a short, wide space — fill the width
  // and pan vertically instead. Only one axis ever overflows.
  // Pinch-to-zoom is handled by the ScrollView's own native zoom (iOS only —
  // that's the platform this ships to the store on; Android/web just keep
  // the existing pan-only behavior, no regression there either) rather than
  // a hand-rolled gesture-handler reimplementation, since a custom Pan
  // gesture over the pins ended up swallowing taps meant for them.
  const viewportHeight = viewport.height;
  const scale =
    viewport.height > 0 ? Math.max(viewport.height / CROPPED_HEIGHT, viewport.width / CROPPED_WIDTH) : 0;
  const panHorizontally = CROPPED_WIDTH * scale > viewport.width + 1;
  const displayWidth = CROPPED_WIDTH * scale;
  const displayHeight = CROPPED_HEIGHT * scale;
  const imageDisplayHeight = IMAGE_HEIGHT * scale;
  const imageTopOffset = -(CROP_TOP * scale);

  const pins = useMemo(() => {
    const raw = parks.map((park) => {
      const { x, y } = projectPark(park.id, park.lat, park.lng, park.state);
      return { park, x: x * scale, y: y * scale };
    });
    return resolveOverlaps(raw, PIN_SIZE + 6);
  }, [parks, scale]);

  return (
    <View style={styles.viewport} onLayout={onLayout}>
      {scale > 0 && (
        <ScrollView
          key={panHorizontally ? 'h' : 'v'}
          horizontal={panHorizontally}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={{ width: displayWidth, height: displayHeight }}
          // Panning vertically, start on the lower 48 rather than Alaska.
          contentOffset={panHorizontally ? undefined : { x: 0, y: (displayHeight - viewportHeight) / 2 }}
          minimumZoomScale={1}
          maximumZoomScale={3}
          bouncesZoom
        >
          <View style={{ width: displayWidth, height: displayHeight, overflow: 'hidden' }}>
            <Image
              source={require('@/assets/maps/us-map.png')}
              style={{ width: displayWidth, height: imageDisplayHeight, marginTop: imageTopOffset }}
              resizeMode="stretch"
            />
            {pins.map(({ park, x, y }) => (
              <Pin key={park.id} park={park} x={x} y={y} onPress={() => onPressPark(park.id)} />
            ))}
          </View>
        </ScrollView>
      )}
      <LinearGradient
        pointerEvents="none"
        colors={[colors.background, `${colors.background}00`]}
        style={styles.fadeTop}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[`${colors.background}00`, colors.background]}
        style={styles.fadeBottom}
      />
    </View>
  );
}

const FADE_HEIGHT = 28;

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    position: 'relative',
  },
  scroll: {
    flex: 1,
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FADE_HEIGHT,
  },
  pin: {
    position: 'absolute',
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  pinImageClip: {
    width: PIN_SIZE - 4,
    height: PIN_SIZE - 4,
    borderRadius: (PIN_SIZE - 4) / 2,
    overflow: 'hidden',
  },
  pinImage: {
    width: PIN_SIZE - 4,
    height: PIN_SIZE - 4,
    // Source park-icon art is a circular badge that only fills ~66% of its
    // square canvas (measured directly from the art); scale up so the badge
    // itself fills this circular clip edge-to-edge instead of leaving a
    // visible ring of the canvas background.
    transform: [{ scale: 1.55 }],
  },
  badge: {
    position: 'absolute',
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    bottom: -3,
    right: -3,
    borderWidth: 1.5,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
