import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors, spacing, radius, shadows, typography } from '@/theme';
import { getParkImage } from '@/data/parkImages';
import { EventNotice, EventNoticeKind } from '@/types';

const KIND_STYLES: Record<EventNoticeKind, { background: string; eyebrow: string }> = {
  park: { background: colors.surface, eyebrow: colors.orangeDark },
  event: { background: colors.skyTint, eyebrow: colors.skyDark },
  info: { background: colors.surfaceWarm, eyebrow: colors.brownDark },
};

function CalendarIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Rect x="3.5" y="5" width="17" height="15" rx="2.5" fill="none" stroke={colors.textPrimary} strokeWidth={1.7} />
      <Path d="M3.5 10h17M8 3v4M16 3v4" stroke={colors.textPrimary} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

function CloseIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14">
      <Path d="M3 3l8 8M11 3l-8 8" stroke={colors.textSecondary} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

interface Props {
  notice: EventNotice;
  onOpenPark: (parkId: string) => void;
  onDismiss: () => void;
}

export default function EventNoticeCard({ notice, onOpenPark, onDismiss }: Props) {
  const kindStyle = KIND_STYLES[notice.kind];
  const parkId = notice.parkId;

  const icon =
    notice.kind === 'park' && parkId ? (
      <Image source={getParkImage(parkId)} style={styles.parkIcon} />
    ) : notice.kind === 'event' ? (
      <View style={styles.eventIcon}>
        <CalendarIcon />
      </View>
    ) : (
      <Image source={require('@/assets/mascot/mascot-tip.png')} style={styles.mascotIcon} resizeMode="contain" />
    );

  return (
    <View style={[styles.card, { backgroundColor: kindStyle.background }]}>
      {icon}
      <View style={styles.text}>
        {!!notice.eyebrow && <Text style={[styles.eyebrow, { color: kindStyle.eyebrow }]}>{notice.eyebrow}</Text>}
        <Text style={styles.title}>{notice.title}</Text>
        {!!notice.body && <Text style={styles.body}>{notice.body}</Text>}
        {!!parkId && (
          <TouchableOpacity onPress={() => onOpenPark(parkId)} hitSlop={8}>
            <Text style={styles.link}>{notice.linkLabel ?? 'See the park'} {'›'}</Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity style={styles.close} onPress={onDismiss} hitSlop={8} accessibilityLabel="Dismiss notice">
        <CloseIcon />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  parkIcon: { width: 48, height: 48, borderRadius: 24 },
  eventIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mascotIcon: { width: 48, height: 48 },
  text: { flex: 1, gap: 2, paddingRight: spacing.xl },
  eyebrow: { ...typography.labelBold, fontSize: 11, letterSpacing: 1 },
  title: { ...typography.h5, color: colors.textPrimary, lineHeight: 20 },
  body: { ...typography.bodySmall, color: colors.textSecondary },
  link: { ...typography.labelBold, fontSize: 13, color: colors.primary },
  close: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
