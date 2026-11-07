import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Polyline } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ParksStackParamList } from '@/navigation/types';
import { useApp } from '@/context/AppContext';
import { colors, spacing, radius, shadows, typography } from '@/theme';
import { PlantRarity } from '@/types';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import VerifiedNote from '@/components/VerifiedNote';
import ReportSheet, { ReportFlagButton } from '@/components/ReportSheet';
import { FlowerIcon, TrailSignIcon } from '@/components/FieldGuideIcons';
import { MONTH_ABBR, bloomRange, currentMonth, isInBloom } from '@/utils/bloom';
import { tapHaptic } from '@/utils/haptics';

type Props = NativeStackScreenProps<ParksStackParamList, 'PlantDetail'>;

const RARITY_COLOR: Record<PlantRarity, string> = {
  Common: colors.sage,
  Uncommon: colors.orange,
  Rare: colors.rose,
};

// Plant-specific art is still to come; the rarity scenes stand in for now.
const RARITY_HERO: Record<PlantRarity, ReturnType<typeof require>> = {
  Common: require('@/assets/animals/rarity-common.png'),
  Uncommon: require('@/assets/animals/rarity-uncommon.png'),
  Rare: require('@/assets/animals/rarity-rare.png'),
};

const MASCOT_TIP = require('@/assets/mascot/mascot-tip.png');
const MASCOT_THINKING = require('@/assets/mascot/mascot-thinking.png');

function FoundToggle({ found, onToggle }: { found: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      hitSlop={10}
      activeOpacity={0.7}
      style={[styles.checkBadge, found && styles.checkBadgeCompleted]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: found }}
      accessibilityLabel="Found"
    >
      {found && (
        <Svg width={14} height={14} viewBox="0 0 12 12">
          <Polyline points="2,6 5,9 10,3" fill="none" stroke={colors.textInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </TouchableOpacity>
  );
}

export default function PlantDetailScreen({ route, navigation }: Props) {
  const { plantId } = route.params;
  const { parks, plants, plantDetails, isPlantFound, markPlantFound, unmarkPlantFound } = useApp();
  const [reportVisible, setReportVisible] = useState(false);

  const plant = plants.find((p) => p.id === plantId);
  const detail = plantDetails[plantId];
  const park = plant ? parks.find((p) => p.id === plant.parkId) : undefined;

  if (!plant) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <ScreenHeader title="Plant" onBack={() => navigation.goBack()} />
        <Text style={styles.notFound}>Plant not found.</Text>
      </SafeAreaView>
    );
  }

  const found = isPlantFound(plant.id);
  const month = currentMonth();
  const blooming = isInBloom(plant, month);
  const range = bloomRange(plant);
  const toggleFound = () => {
    tapHaptic();
    if (found) unmarkPlantFound(plant.id);
    else markPlantFound(plant.id, plant.parkId, plant.name);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader
        title={plant.name}
        onBack={() => navigation.goBack()}
        right={<ReportFlagButton onPress={() => setReportVisible(true)} />}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image source={RARITY_HERO[plant.rarity]} style={styles.heroImage} resizeMode="cover" />
          {blooming && (
            <View style={styles.heroBloom}>
              <FlowerIcon size={11} />
              <Text style={styles.bloomPillText}>In bloom now</Text>
            </View>
          )}
        </View>

        <View style={styles.titleRow}>
          <View style={styles.titleTextWrap}>
            <Text style={styles.parkName}>{park?.name ?? 'National Park'}</Text>
            <Text style={styles.plantName}>{plant.name}</Text>
            {detail ? <Text style={styles.scientificName}>{detail.scientificName}</Text> : null}
          </View>
          <FoundToggle found={found} onToggle={toggleFound} />
        </View>

        <View style={styles.statRow}>
          <View style={styles.statChip}>
            <Text style={styles.statValue} numberOfLines={1}>{range ?? 'No flowers'}</Text>
            <Text style={styles.statKey}>Bloom season</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statValue} numberOfLines={1}>{plant.type}</Text>
            <Text style={styles.statKey}>Type</Text>
          </View>
        </View>

        {range && (
          <View style={styles.calendar}>
            <View style={styles.calendarHeader}>
              <Text style={styles.sectionLabel}>BLOOM CALENDAR</Text>
              <Text style={[styles.calendarStatus, blooming && styles.calendarStatusOn]}>
                {blooming ? `Blooming in ${MONTH_ABBR[month - 1]}` : `Not in bloom in ${MONTH_ABBR[month - 1]}`}
              </Text>
            </View>
            <View style={styles.calendarRow}>
              {MONTH_ABBR.map((m, i) => {
                const on = plant.bloomMonths.includes(i + 1);
                const isNow = month === i + 1;
                return (
                  <View key={m} style={styles.calendarCell}>
                    <View style={[styles.calendarBar, on && styles.calendarBarOn, isNow && styles.calendarBarNow]} />
                    <Text style={[styles.calendarLetter, isNow && styles.calendarLetterNow]}>{m[0]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {detail?.natureTrail && (
          <View style={styles.trailBox}>
            <TrailSignIcon size={14} />
            <View style={styles.flexText}>
              <Text style={styles.trailLabel}>ON A NATURE TRAIL</Text>
              <Text style={styles.trailText}>{detail.natureTrail}</Text>
            </View>
          </View>
        )}

        {detail && (
          <View style={styles.whereRow}>
            <Text style={styles.sectionLabel}>WHERE TO LOOK</Text>
            <Text style={styles.whereText}>{detail.whereToLook}</Text>
          </View>
        )}

        <View style={styles.tagRow}>
          <View style={[styles.rarityTag, { backgroundColor: RARITY_COLOR[plant.rarity] }]}>
            <Text style={styles.rarityTagText}>{plant.rarity}</Text>
          </View>
          {detail?.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.description}>{plant.description}</Text>

        {detail && (
          <>
            <View style={[styles.callout, styles.calloutTip]}>
              <Image source={MASCOT_TIP} style={styles.calloutMascot} resizeMode="contain" />
              <View style={styles.flexText}>
                <Text style={styles.calloutLabelTip}>HOW TO SPOT IT</Text>
                <Text style={styles.calloutTextTip}>{detail.idTip}</Text>
              </View>
            </View>
            <View style={[styles.callout, styles.calloutFact]}>
              <Image source={MASCOT_THINKING} style={styles.calloutMascot} resizeMode="contain" />
              <View style={styles.flexText}>
                <Text style={styles.calloutLabelFact}>DID YOU KNOW</Text>
                <Text style={styles.calloutTextFact}>{detail.didYouKnow}</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.leaveNote}>
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path d="M12 21c-5-3-8-7-8-11a8 8 0 0 1 16 0c0 4-3 8-8 11z" fill="none" stroke={colors.primary} strokeWidth={2} />
            <Path d="M12 7v7" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" />
          </Svg>
          <Text style={styles.leaveText}>{detail?.caution ?? 'Leave it where it grows for the next visitor to find.'}</Text>
        </View>

        {!found && <PrimaryButton label="Mark as found" onPress={toggleFound} />}

        {detail && <VerifiedNote lastVerified={detail.lastVerified} tags={detail.tags} />}
      </ScrollView>
      <ReportSheet
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        entryType="plant"
        entryId={plant.id}
        entryName={plant.name}
        parkId={plant.parkId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing['5xl'], gap: spacing.md },
  notFound: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
  flexText: { flex: 1, gap: 4 },

  hero: { height: 150, borderRadius: radius.lg, overflow: 'hidden', ...shadows.sm },
  heroImage: { width: '100%', height: '100%' },
  heroBloom: { position: 'absolute', top: spacing.sm, right: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.roseTint },
  bloomPillText: { ...typography.labelSmall, fontSize: 10, color: colors.roseDark },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  titleTextWrap: { flex: 1 },
  parkName: { ...typography.labelSmall, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  plantName: { ...typography.h3, color: colors.textPrimary },
  scientificName: { ...typography.bodySmall, color: colors.textSecondary, fontStyle: 'italic' },

  statRow: { flexDirection: 'row', gap: spacing.sm },
  statChip: { flex: 1, backgroundColor: colors.surfaceWarm, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, alignItems: 'center', gap: 2 },
  statValue: { ...typography.labelBold, color: colors.primary, fontSize: 13 },
  statKey: { ...typography.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, fontSize: 9 },

  calendar: { backgroundColor: colors.surfaceWarm, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { ...typography.labelSmall, color: colors.textMuted, fontSize: 10, letterSpacing: 0.4 },
  calendarStatus: { ...typography.labelSmall, fontSize: 10, color: colors.textMuted },
  calendarStatusOn: { color: colors.roseDark },
  calendarRow: { flexDirection: 'row', gap: 3 },
  calendarCell: { flex: 1, alignItems: 'center', gap: 3 },
  calendarBar: { alignSelf: 'stretch', height: 16, borderRadius: 5, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  calendarBarOn: { backgroundColor: colors.rose, borderColor: colors.rose },
  calendarBarNow: { borderWidth: 2, borderColor: colors.primary },
  calendarLetter: { ...typography.caption, fontSize: 9, color: colors.textMuted },
  calendarLetterNow: { color: colors.textPrimary, fontFamily: typography.labelBold.fontFamily },

  trailBox: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.surfaceWarm, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.tan, padding: spacing.md },
  trailLabel: { ...typography.labelSmall, color: colors.brown, fontSize: 10, letterSpacing: 0.4 },
  trailText: { ...typography.bodySmall, color: colors.brownDark },

  whereRow: { backgroundColor: colors.surfaceWarm, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  whereText: { ...typography.bodySmall, color: colors.textPrimary },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  rarityTag: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full },
  rarityTagText: { ...typography.labelSmall, color: colors.textInverse, fontSize: 10 },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full, backgroundColor: colors.cream },
  tagText: { ...typography.labelSmall, color: colors.brownDark, fontSize: 10 },

  description: { ...typography.body, color: colors.textSecondary, lineHeight: 21 },

  callout: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.md, padding: spacing.md, ...shadows.sm },
  calloutMascot: { width: 40, height: 46, marginTop: -4 },
  calloutTip: { backgroundColor: colors.cream },
  calloutFact: { backgroundColor: colors.surfaceWarm },
  calloutLabelTip: { ...typography.labelSmall, color: colors.orange, fontSize: 10, letterSpacing: 0.4 },
  calloutLabelFact: { ...typography.labelSmall, color: colors.sage, fontSize: 10, letterSpacing: 0.4 },
  calloutTextTip: { ...typography.bodySmall, color: colors.brownDark, lineHeight: 19 },
  calloutTextFact: { ...typography.bodySmall, color: colors.textPrimary, lineHeight: 19 },

  leaveNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md },
  leaveText: { ...typography.bodySmall, color: colors.primary, flex: 1 },

  checkBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceWarm, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs },
  checkBadgeCompleted: { backgroundColor: colors.primary, borderColor: colors.primary },
});
