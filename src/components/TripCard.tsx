import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Svg, { Rect, Circle, Path } from 'react-native-svg';
import { colors, radius, spacing, shadows, typography } from '@/theme';
import { Trip } from '@/types';
import { getParkById } from '@/data/parks';
import { getParkImage } from '@/data/parkImages';
import { formatDateRange, daysUntilLabel } from '@/utils/dates';
import { useApp } from '@/context/AppContext';
import { tripHeadsUpAlerts } from '@/data/npsAlerts';
import PressableScale from './PressableScale';

interface Props {
  trip: Trip;
  onPress: () => void;
}

function PhotoIcon({ size = 18, color = colors.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={2.5} y={5.5} width={19} height={14} rx={2.5} fill="none" stroke={color} strokeWidth={1.8} />
      <Circle cx={12} cy={12.5} r={3.4} fill="none" stroke={color} strokeWidth={1.8} />
      <Rect x={8.5} y={3} width={7} height={3} rx={1} fill={color} />
    </Svg>
  );
}

// Cloud-with-arrow — signals "saved on this device, not uploaded yet" for a
// trip still waiting to sync, so a user isn't left wondering if it was lost.
function PendingSyncIcon({ size = 18, color = colors.textMuted }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M7 18a4.5 4.5 0 0 1-.6-8.96A5.5 5.5 0 0 1 17.4 9.1 4 4 0 0 1 17 18H7Z"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Path d="M12 12v6M9.5 15.5 12 13l2.5 2.5" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function TripCard({ trip, onPress }: Props) {
  const { isTripPending, parkAlerts } = useApp();
  const park = getParkById(trip.parkId);
  const planned = trip.tripType === 'planned';
  const hasPhotos = trip.photos.length > 0;
  const pending = isTripPending(trip.id);
  const headsUp = tripHeadsUpAlerts(parkAlerts, trip);

  return (
    <PressableScale onPress={onPress} style={[styles.card, planned && styles.cardPlanned]} accessibilityLabel={park?.name}>
      <View style={styles.imageBox}>
        <Image source={getParkImage(trip.parkId)} style={styles.parkIcon} resizeMode="cover" />
      </View>
      <View style={styles.content}>
        <Text style={styles.parkName} numberOfLines={1}>{park?.name ?? 'Unknown Park'}</Text>
        <Text style={styles.dates}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
        {planned ? (
          <>
            <Text style={styles.daysUntil}>{daysUntilLabel(trip.startDate)}</Text>
            {headsUp.length > 0 && (
              <Text style={styles.headsUp} numberOfLines={1}>
                {headsUp.length === 1 ? `NPS alert: ${headsUp[0].title}` : `${headsUp.length} NPS alerts for this park`}
              </Text>
            )}
          </>
        ) : trip.notes ? (
          <Text style={styles.notes} numberOfLines={1}>{trip.notes}</Text>
        ) : null}
      </View>
      <View style={styles.iconStack}>
        {pending && <PendingSyncIcon />}
        {hasPhotos && <PhotoIcon />}
      </View>
      <Text style={styles.chevron}>›</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  cardPlanned: {
    borderLeftWidth: 3,
    borderLeftColor: colors.sky,
  },
  imageBox: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  parkIcon: {
    width: 56,
    height: 56,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  parkName: {
    ...typography.labelBold,
    color: colors.textPrimary,
  },
  dates: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  notes: {
    ...typography.caption,
    color: colors.textMuted,
  },
  daysUntil: {
    ...typography.labelSmall,
    color: colors.sky,
  },
  headsUp: {
    ...typography.labelSmall,
    color: colors.orange,
    marginTop: 2,
  },
  iconStack: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chevron: {
    fontSize: 22,
    color: colors.textMuted,
  },
});
