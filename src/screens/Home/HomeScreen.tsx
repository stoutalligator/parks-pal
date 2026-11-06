import React, { useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '@/context/AppContext';
import { colors, spacing, radius, shadows, typography } from '@/theme';
import ProgressRing from '@/components/ProgressRing';
import UsMap from '@/components/UsMap';
import SegmentedToggle from '@/components/SegmentedToggle';
import EventNoticeCard from '@/components/EventNoticeCard';
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

export default function HomeScreen() {
  const { parks, stats, trips, isGuest, eventNotice, dismissEventNotice } = useApp();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<Filter>('All Parks');

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

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
      </View>

      {eventNotice && (
        <View style={styles.noticeRow}>
          <EventNoticeCard
            notice={eventNotice}
            onOpenPark={goToPark}
            onDismiss={() => dismissEventNotice(eventNotice.id)}
          />
        </View>
      )}

      <View style={styles.toggleRow}>
        <SegmentedToggle options={FILTERS} value={filter} onChange={setFilter} />
      </View>

      <UsMap parks={filteredParks} onPressPark={goToPark} />

      {nextTrip && nextTripPark && (
        <TouchableOpacity
          style={styles.countdownCard}
          activeOpacity={0.85}
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
        </TouchableOpacity>
      )}

      {isGuest ? (
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
            style={styles.mascotPeek}
            resizeMode="contain"
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.md,
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
});
