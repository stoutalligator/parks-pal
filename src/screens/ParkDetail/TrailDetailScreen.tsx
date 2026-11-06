import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Rect, Line, Circle } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ParksStackParamList } from '@/navigation/types';
import { useApp } from '@/context/AppContext';
import { colors, spacing, radius, shadows, typography } from '@/theme';
import { TrailDifficulty } from '@/types';
import ScreenHeader from '@/components/ScreenHeader';
import ElevationProfileChart from '@/components/ElevationProfileChart';
import VerifiedNote from '@/components/VerifiedNote';
import NpsAlertsCard from '@/components/NpsAlertsCard';
import { alertsForTrail } from '@/data/npsAlerts';
import { getParkGuide } from '@/data/parkGuides';
import ReportSheet, { ReportFlagButton } from '@/components/ReportSheet';
import { convertMiles, convertFeet, distanceLabel, elevationLabel } from '@/utils/units';
import { tapHaptic } from '@/utils/haptics';

type Props = NativeStackScreenProps<ParksStackParamList, 'TrailDetail'>;

const DIFFICULTY_COLOR: Record<TrailDifficulty, string> = {
  Easy: colors.sage,
  Moderate: colors.orange,
  Hard: colors.rose,
};

const MASCOT_TIP = require('@/assets/mascot/mascot-tip.png');
const MASCOT_THINKING = require('@/assets/mascot/mascot-thinking.png');

function SeasonIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Rect x={3} y={5} width={18} height={16} rx={3} fill="none" stroke={colors.orange} strokeWidth={2} />
      <Line x1={3} y1={10} x2={21} y2={10} stroke={colors.orange} strokeWidth={2} />
      <Line x1={7.5} y1={2.5} x2={7.5} y2={6.5} stroke={colors.orange} strokeWidth={2} strokeLinecap="round" />
      <Line x1={16.5} y1={2.5} x2={16.5} y2={6.5} stroke={colors.orange} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={8.5} cy={14.5} r={1.4} fill={colors.orange} />
      <Circle cx={12} cy={14.5} r={1.4} fill={colors.orange} />
      <Circle cx={15.5} cy={14.5} r={1.4} fill={colors.orange} />
      <Circle cx={8.5} cy={17.8} r={1.4} fill={colors.orange} />
      <Circle cx={12} cy={17.8} r={1.4} fill={colors.orange} />
    </Svg>
  );
}

function CompletionToggle({ completed, onToggle }: { completed: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      hitSlop={10}
      activeOpacity={0.7}
      style={[styles.checkBadge, completed && styles.checkBadgeCompleted]}
    >
      {completed && (
        <Svg width={14} height={14} viewBox="0 0 12 12">
          <Polyline points="2,6 5,9 10,3" fill="none" stroke={colors.textInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </TouchableOpacity>
  );
}

export default function TrailDetailScreen({ route, navigation }: Props) {
  const { trailId } = route.params;
  const { parks, trails, trailDetails, isTrailCompleted, markTrailCompleted, unmarkTrailCompleted, userProfile, parkAlerts, alertsSyncedAt } = useApp();
  const units = userProfile.units;
  const [reportVisible, setReportVisible] = useState(false);

  const trail = trails.find((t) => t.id === trailId);
  const detail = trailDetails[trailId];
  const park = trail ? parks.find((p) => p.id === trail.parkId) : undefined;

  if (!trail) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <ScreenHeader title="Trail" onBack={() => navigation.goBack()} />
        <Text style={styles.notFound}>Trail not found.</Text>
      </SafeAreaView>
    );
  }

  const completed = isTrailCompleted(trail.id);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader
        title={trail.name}
        onBack={() => navigation.goBack()}
        right={<ReportFlagButton onPress={() => setReportVisible(true)} />}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View style={styles.titleTextWrap}>
            <Text style={styles.parkName}>{park?.name ?? 'National Park'}</Text>
            <Text style={styles.trailName}>{trail.name}</Text>
          </View>
          <CompletionToggle
            completed={completed}
            onToggle={() =>
              (tapHaptic(), completed ? unmarkTrailCompleted(trail.id) : markTrailCompleted(trail.id, trail.parkId, trail.name))
            }
          />
        </View>

        {detail ? (
          <ElevationProfileChart profile={detail.elevationProfile} units={units} />
        ) : null}

        <View style={styles.statRow}>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{convertMiles(trail.miles, units).toFixed(1)} {distanceLabel(units)}</Text>
            <Text style={styles.statKey}>Round trip</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue}>{Math.round(convertFeet(trail.elevationGainFt, units)).toLocaleString()} {elevationLabel(units)}</Text>
            <Text style={styles.statKey}>Elevation</Text>
          </View>
          {detail ? (
            <View style={styles.statChip}>
              <Text style={styles.statValue}>{detail.estimatedTime}</Text>
              <Text style={styles.statKey}>Time</Text>
            </View>
          ) : (
            <View style={styles.statChip}>
              <Text style={[styles.statValue, { color: DIFFICULTY_COLOR[trail.difficulty] }]}>{trail.difficulty}</Text>
              <Text style={styles.statKey}>Difficulty</Text>
            </View>
          )}
        </View>

        {detail && detail.bestSeason ? (
          <View style={styles.seasonBubble}>
            <SeasonIcon />
            <Text style={styles.seasonBubbleText}>Best season: <Text style={styles.seasonBubbleValue}>{detail.bestSeason}</Text></Text>
          </View>
        ) : null}

        {detail && (
          <View style={styles.tagRow}>
            <View style={[styles.difficultyTag, { backgroundColor: DIFFICULTY_COLOR[trail.difficulty] }]}>
              <Text style={styles.difficultyTagText}>{trail.difficulty}</Text>
            </View>
            {detail.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.description}>{trail.description}</Text>

        <NpsAlertsCard
          alerts={alertsForTrail(parkAlerts, trail, detail?.alertKeywords)}
          syncedAt={alertsSyncedAt}
          npsCode={getParkGuide(trail.parkId)?.npsCode}
          title="NPS alerts mentioning this trail"
        />

        {detail && (
          <>
            <View style={[styles.callout, styles.calloutTip]}>
              <Image source={MASCOT_TIP} style={styles.calloutMascot} resizeMode="contain" />
              <View style={styles.calloutTextWrap}>
                <Text style={styles.calloutLabelTip}>TRAIL TIP</Text>
                <Text style={styles.calloutTextTip}>{detail.trailTip}</Text>
              </View>
            </View>
            <View style={[styles.callout, styles.calloutFact]}>
              <Image source={MASCOT_THINKING} style={styles.calloutMascot} resizeMode="contain" />
              <View style={styles.calloutTextWrap}>
                <Text style={styles.calloutLabelFact}>DID YOU KNOW</Text>
                <Text style={styles.calloutTextFact}>{detail.didYouKnow}</Text>
              </View>
            </View>
            <VerifiedNote lastVerified={detail.lastVerified} tags={detail.tags} />
          </>
        )}
      </ScrollView>
      <ReportSheet
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        entryType="trail"
        entryId={trail.id}
        entryName={trail.name}
        parkId={trail.parkId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing['5xl'], gap: spacing.md },
  notFound: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleTextWrap: { flex: 1 },
  parkName: { ...typography.labelSmall, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  trailName: { ...typography.h3, color: colors.textPrimary },

  statRow: { flexDirection: 'row', gap: spacing.sm },
  statChip: { flex: 1, backgroundColor: colors.surfaceWarm, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center', gap: 2 },
  statValue: { ...typography.labelBold, color: colors.primary, fontSize: 14 },
  statKey: { ...typography.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 9 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  difficultyTag: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  difficultyTagText: { ...typography.labelSmall, color: colors.textInverse, fontSize: 10 },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.cream },
  tagText: { ...typography.labelSmall, color: colors.brownDark, fontSize: 10 },

  description: { ...typography.body, color: colors.textSecondary, lineHeight: 21 },

  callout: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.md, padding: spacing.md, ...shadows.sm },
  calloutMascot: { width: 40, height: 46, marginTop: -4 },
  calloutTextWrap: { flex: 1, gap: 4 },
  calloutTip: { backgroundColor: colors.cream },
  calloutFact: { backgroundColor: colors.surfaceWarm },
  calloutLabelTip: { ...typography.labelSmall, color: colors.orange, fontSize: 10, letterSpacing: 0.4 },
  calloutLabelFact: { ...typography.labelSmall, color: colors.sage, fontSize: 10, letterSpacing: 0.4 },
  calloutTextTip: { ...typography.bodySmall, color: colors.brownDark, lineHeight: 19 },
  calloutTextFact: { ...typography.bodySmall, color: colors.textPrimary, lineHeight: 19 },

  seasonBubble: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.cream, borderRadius: radius.full, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, alignSelf: 'center' },
  seasonBubbleText: { ...typography.bodySmall, color: colors.brownDark },
  seasonBubbleValue: { ...typography.labelBold, color: colors.brownDark, fontSize: 13 },

  checkBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceWarm, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  checkBadgeCompleted: { backgroundColor: colors.primary, borderColor: colors.primary },
});
