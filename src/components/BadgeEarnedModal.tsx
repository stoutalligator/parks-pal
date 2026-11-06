import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadows, spacing, typography } from '@/theme';
import { Badge } from '@/types';
import { getBadgeImage } from '@/data/badgeImages';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import { navigationRef } from '@/navigation/navigationRef';
import { successHaptic } from '@/utils/haptics';

// Imperative module-level API, same pattern as components/Toast.tsx — lets
// AppContext's badge-detection effect trigger the celebration without being
// inside this component's provider tree.
let currentSetter: ((updater: (prev: Badge[]) => Badge[]) => void) | null = null;

export function celebrateBadges(badges: Badge[]) {
  if (badges.length === 0) return;
  successHaptic();
  currentSetter?.((prev) => {
    const existingIds = new Set(prev.map((b) => b.id));
    return [...prev, ...badges.filter((b) => !existingIds.has(b.id))];
  });
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - spacing['2xl'] * 2, 320);

export function BadgeEarnedModalHost() {
  const [queue, setQueue] = useState<Badge[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const scale = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    currentSetter = setQueue;
    return () => {
      currentSetter = null;
    };
  }, []);

  const playEntrance = useCallback(() => {
    scale.setValue(0);
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 55, useNativeDriver: true }).start();
  }, [scale]);

  useEffect(() => {
    if (queue.length > 0) {
      setPageIndex(0);
      scrollRef.current?.scrollTo({ x: 0, animated: false });
      playEntrance();
    }
  }, [queue.length > 0, playEntrance]);

  const handleScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
    setPageIndex(index);
    playEntrance();
  }, [playEntrance]);

  const dismiss = useCallback(() => setQueue([]), []);

  const exploreBadges = useCallback(() => {
    setQueue([]);
    if (navigationRef.isReady()) {
      navigationRef.navigate('Main', { screen: 'ProfileTab', params: { screen: 'Collection' } } as never);
    }
  }, []);

  if (queue.length === 0) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>{queue.length > 1 ? 'Badges Earned!' : 'Badge Earned!'}</Text>

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
            style={styles.pager}
          >
            {queue.map((badge) => (
              <View key={badge.id} style={styles.page}>
                <Animated.Image
                  source={getBadgeImage(badge.id)}
                  style={[styles.badgeImage, { transform: [{ scale }] }]}
                  resizeMode="contain"
                />
                <Text style={styles.badgeName}>{badge.name}</Text>
                <Text style={styles.badgeDescription}>{badge.description}</Text>
              </View>
            ))}
          </ScrollView>

          {queue.length > 1 && (
            <View style={styles.dots}>
              {queue.map((_, i) => (
                <View key={i} style={[styles.dot, i === pageIndex && styles.dotActive]} />
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <SecondaryButton label="Explore Badges" onPress={exploreBadges} style={styles.actionBtn} />
            <PrimaryButton label="Awesome!" onPress={dismiss} style={styles.actionBtn} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  card: {
    width: '100%',
    maxWidth: CARD_WIDTH + spacing['2xl'] * 2,
    backgroundColor: colors.background,
    borderRadius: radius['2xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.xl,
    alignItems: 'center',
    ...shadows.lg,
  },
  eyebrow: {
    ...typography.labelBold,
    color: colors.sage,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  pager: {
    width: CARD_WIDTH,
  },
  page: {
    width: CARD_WIDTH,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  badgeImage: {
    width: 140,
    height: 140,
    marginBottom: spacing.lg,
  },
  badgeName: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  badgeDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing['2xl'],
    paddingHorizontal: spacing.xl,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
});
