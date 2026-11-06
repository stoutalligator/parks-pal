import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { Park } from '@/types';
import { getParkImage } from '@/data/parkImages';
import { successHaptic } from '@/utils/haptics';

// Imperative module-level API, same pattern as BadgeEarnedModal — AppContext
// calls celebrateVisit when a park is checked off, from outside this tree.
let currentShow: ((park: Park) => void) | null = null;

export function celebrateVisit(park: Park) {
  currentShow?.(park);
}

const STAMP_SIZE = 150;
const HOLD_MS = 1100;

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

// A passport stamp that thuds onto the screen when a park is marked visited,
// then fades. It never blocks taps.
export function VisitStampHost() {
  const [park, setPark] = useState<Park | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    currentShow = setPark;
    return () => {
      currentShow = null;
    };
  }, []);

  useEffect(() => {
    if (!park) return;
    progress.setValue(0);
    fade.setValue(1);
    const impact = setTimeout(successHaptic, 160);
    const animation = Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(HOLD_MS),
      Animated.timing(fade, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => {
      if (finished) setPark(null);
    });
    return () => {
      clearTimeout(impact);
      animation.stop();
    };
  }, [park, progress, fade]);

  if (!park) return null;

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1.9, 1] });
  const opacity = Animated.multiply(progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }), fade);

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View style={[styles.stamp, { opacity, transform: [{ scale }, { rotate: '-8deg' }] }]}>
        <View style={styles.ring}>
          <Image source={getParkImage(park.id)} style={styles.image} resizeMode="cover" />
        </View>
        <Text style={styles.visited}>VISITED</Text>
        <Text style={styles.name} numberOfLines={2}>
          {park.name}
        </Text>
        <Text style={styles.date}>{todayLabel()}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  stamp: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: spacing.xl,
    borderWidth: 3,
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  ring: {
    width: STAMP_SIZE,
    height: STAMP_SIZE,
    borderRadius: STAMP_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.primary,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  // Same crop as TripStamp: the badge art sits inset on a white canvas.
  image: { width: '160%', height: '160%' },
  visited: { ...typography.h3, color: colors.primary, letterSpacing: 4, marginTop: spacing.sm },
  name: { ...typography.labelBold, color: colors.textPrimary, textAlign: 'center', maxWidth: STAMP_SIZE + 40 },
  date: { ...typography.caption, color: colors.primary, letterSpacing: 1 },
});
