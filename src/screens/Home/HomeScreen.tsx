import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle } from 'react-native-svg';
import { useApp } from '@/context/AppContext';
import { colors, spacing, radius, shadows, typography } from '@/theme';
import ProgressRing from '@/components/ProgressRing';
import UsMap from '@/components/UsMap';
import SegmentedToggle from '@/components/SegmentedToggle';
import EventNoticeCard from '@/components/EventNoticeCard';
import HomeCustomizeSheet, { HomeCardOption } from '@/components/HomeCustomizeSheet';
import PressableScale from '@/components/PressableScale';
import PrimaryButton from '@/components/PrimaryButton';
import { getParkImage } from '@/data/parkImages';
import { daysUntil, dayCountBetween, formatDateRange } from '@/utils/dates';
import { ParkStatus } from '@/types';

type Filter = 'All Parks' | 'Visited' | 'Bucket List' | 'Planned';

const FILTERS: Filter[] = ['All Parks', 'Visited', 'Bucket List', 'Planned'];

// Bucket List filters on the independent `isFavorite` flag, not `status`.
const STATUS_MAP: Partial<Record<Filter, ParkStatus>> = {
  Visited: 'visited',
  Planned: 'planned',
};

const EMPTY_FILTER_COPY: Record<Filter, { title: string; text: string }> = {
  'All Parks': { title: 'No parks to show', text: 'Check your connection and try again.' },
  Visited: { title: 'No visited parks yet', text: 'Tap a pin and check it off, or log a trip to stamp your first park.' },
  'Bucket List': { title: 'Your bucket list is empty', text: 'Tap the heart on any park to save it for later.' },
  Planned: { title: 'No trips planned', text: 'Plan a trip from any park and it shows up here.' },
};

// Which Home cards this device has hidden (the event notice is tracked per
// notice in AppContext instead, so a new notice still shows).
const HIDDEN_CARDS_KEY = 'parkpal.homeHiddenCards';
type HideableCard = 'trip' | 'progress';

function SlidersIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
      <Circle cx="16" cy="7" r="2.2" fill="none" stroke={colors.textPrimary} strokeWidth={2} />
      <Circle cx="10" cy="17" r="2.2" fill="none" stroke={colors.textPrimary} strokeWidth={2} />
    </Svg>
  );
}

export default function HomeScreen() {
  const { parks, stats, trips, isGuest, eventNotice, liveEventNotice, setEventNoticeHidden } = useApp();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<Filter>('All Parks');
  const [customizing, setCustomizing] = useState(false);
  const [hiddenCards, setHiddenCards] = useState<HideableCard[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(HIDDEN_CARDS_KEY)
      .then((raw) => {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) setHiddenCards(parsed.filter((c): c is HideableCard => c === 'trip' || c === 'progress'));
      })
      .catch(() => {});
  }, []);

  const setCardShown = (card: HideableCard, shown: boolean) => {
    setHiddenCards((prev) => {
      const next = shown ? prev.filter((c) => c !== card) : [...prev.filter((c) => c !== card), card];
      AsyncStorage.setItem(HIDDEN_CARDS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  const showTrip = !hiddenCards.includes('trip');
  const showProgress = !hiddenCards.includes('progress');

  // The soonest planned trip that hasn't started yet (today counts).
  const nextTrip = useMemo(
    () =>
      trips
        .filter((t) => t.tripType === 'planned' && daysUntil(t.startDate) >= 0)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0],
    [trips]
  );
  const nextTripPark = nextTrip && parks.find((p) => p.id === nextTrip.parkId);
  const nextTripDays = nextTrip ? daysUntil(nextTrip.startDate) : 0;

  const filteredParks = useMemo(() => {
    if (filter === 'Bucket List') return parks.filter((p) => p.isFavorite);
    const status = STATUS_MAP[filter];
    return status ? parks.filter((p) => p.status === status) : parks;
  }, [parks, filter]);

  const goToPark = (parkId: string) => {
    navigation.navigate('ParkDetail', { parkId });
  };

  const cardOptions: HomeCardOption[] = [
    ...(liveEventNotice
      ? [{
          key: 'notice',
          label: 'Event notice',
          description: liveEventNotice.title,
          shown: !!eventNotice,
          onChange: (shown: boolean) => setEventNoticeHidden(liveEventNotice.id, !shown),
        }]
      : []),
    ...(isGuest
      ? []
      : [{
          key: 'trip',
          label: 'Upcoming trip',
          description: 'Countdown to your next planned trip',
          shown: showTrip,
          onChange: (shown: boolean) => setCardShown('trip', shown),
        }]),
    {
      key: 'progress',
      label: isGuest ? 'Sign-up card' : 'Your progress',
      description: isGuest ? 'Create a free account to start tracking' : 'Parks visited and your progress ring',
      shown: showProgress,
      onChange: (shown: boolean) => setCardShown('progress', shown),
    },
  ];

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
        <TouchableOpacity
          style={styles.customizeBtn}
          onPress={() => setCustomizing(true)}
          hitSlop={8}
          accessibilityLabel="Customize Home"
        >
          <SlidersIcon />
        </TouchableOpacity>
      </View>

      {eventNotice && (
        <View style={styles.noticeRow}>
          <EventNoticeCard
            notice={eventNotice}
            onOpenPark={goToPark}
            onDismiss={() => setEventNoticeHidden(eventNotice.id, true)}
          />
        </View>
      )}

      <View style={styles.toggleRow}>
        <SegmentedToggle options={FILTERS} value={filter} onChange={setFilter} />
      </View>

      <View style={styles.mapArea}>
        <UsMap parks={filteredParks} onPressPark={goToPark} />
        {filteredParks.length === 0 && (
          <View style={styles.mapEmpty} pointerEvents="none">
            <Image source={require('@/assets/mascot/mascot-thinking.png')} style={styles.mapEmptyMascot} resizeMode="contain" />
            <Text style={styles.mapEmptyTitle}>{EMPTY_FILTER_COPY[filter].title}</Text>
            <Text style={styles.mapEmptyText}>{EMPTY_FILTER_COPY[filter].text}</Text>
          </View>
        )}
      </View>

      {showTrip && nextTrip && nextTripPark && (
        <PressableScale
          style={styles.countdownCard}
          onPress={() => navigation.navigate('TripDetail', { tripId: nextTrip.id })}
        >
          <Image source={getParkImage(nextTripPark.id)} style={styles.countdownIcon} />
          <View style={styles.countdownText}>
            <Text style={styles.countdownTitle} numberOfLines={1}>
              {nextTripDays === 0 ? (
                <>Your <Text style={styles.countdownDays}>{nextTripPark.name}</Text> trip starts today</>
              ) : (
                <>
                  <Text style={styles.countdownDays}>
                    {nextTripDays === 1 ? '1 day' : `${nextTripDays} days`}
                  </Text>
                  {' '}until {nextTripPark.name}
                </>
              )}
            </Text>
            <Text style={styles.countdownSub} numberOfLines={1}>
              {formatDateRange(nextTrip.startDate, nextTrip.endDate)} · {dayCountBetween(nextTrip.startDate, nextTrip.endDate)}-day trip planned
            </Text>
          </View>
          <Text style={styles.chevron}>{'›'}</Text>
        </PressableScale>
      )}

      {showProgress && (isGuest ? (
        <View style={[styles.progressCard, styles.nudgeCard]}>
          <View style={styles.nudgeText}>
            <Text style={styles.nudgeTitle}>Start your park passport</Text>
            <Text style={styles.nudgeBody}>
              Create a free account to check off all {stats.totalParks} parks, plan trips, and earn badges.
            </Text>
          </View>
          <PrimaryButton label="Create Free Account" onPress={() => navigation.navigate('Auth', { mode: 'Sign Up' })} />
          <TouchableOpacity onPress={() => navigation.navigate('Auth', { mode: 'Log In' })} hitSlop={8}>
            <Text style={styles.nudgeLogin}>Already have one? Log in</Text>
          </TouchableOpacity>
          <Image source={require('@/assets/mascot/mascot-happy.png')} style={styles.mascotPeek} resizeMode="contain" />
        </View>
      ) : (
        <View style={styles.progressCard}>
          <View style={styles.progressLeft}>
            <Text style={styles.progressTitle}>Your Progress</Text>
            <Text style={styles.progressCount}>
              {stats.totalVisited} / {stats.totalParks}
            </Text>
            <Text style={styles.progressSub}>National Parks Visited</Text>
          </View>
          <ProgressRing percentage={stats.completionPercentage} size={64} />
          <Image
            source={require('@/assets/mascot/mascot-excited.png')}
            style={[styles.mascotPeek, styles.mascotBesideRing]}
            resizeMode="contain"
          />
        </View>
      ))}

      <HomeCustomizeSheet visible={customizing} options={cardOptions} onClose={() => setCustomizing(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.md,
  },
  customizeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  title: { ...typography.h3, color: colors.textPrimary },

  noticeRow: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },

  toggleRow: { paddingHorizontal: spacing.xl, marginBottom: spacing.lg },

  countdownCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.lg,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  countdownIcon: { width: 44, height: 44, borderRadius: 22 },
  countdownText: { flex: 1 },
  countdownTitle: { ...typography.h5, color: colors.textPrimary },
  countdownDays: { color: colors.primary },
  countdownSub: { ...typography.bodySmall, color: colors.textSecondary },
  chevron: { ...typography.h4, color: colors.textSecondary },

  nudgeCard: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.md },
  nudgeText: { gap: spacing.xs, paddingRight: 56 },
  nudgeTitle: { ...typography.h4, color: colors.textPrimary },
  nudgeBody: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  nudgeLogin: { ...typography.labelBold, fontSize: 13, color: colors.primary, textAlign: 'center' },

  progressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  progressLeft: { gap: spacing.xs, flex: 1 },
  progressTitle: { ...typography.labelBold, color: colors.textPrimary },
  progressCount: { ...typography.h3, color: colors.textPrimary },
  progressSub: { ...typography.bodySmall, color: colors.textSecondary },
  mascotPeek: {
    position: 'absolute',
    width: 56,
    height: 56,
    right: spacing.md,
    top: -28,
  },
  // Just left of the 64px progress ring so it peeks over the card without covering it.
  mascotBesideRing: { right: spacing.xl + 64 + spacing.sm },

  mapArea: { flex: 1 },
  mapEmpty: {
    position: 'absolute',
    left: spacing['3xl'],
    right: spacing['3xl'],
    top: '30%',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  mapEmptyMascot: { width: 52, height: 52 },
  mapEmptyTitle: { ...typography.h5, color: colors.textPrimary, textAlign: 'center' },
  mapEmptyText: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
});
