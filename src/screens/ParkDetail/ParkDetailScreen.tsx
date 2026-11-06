import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Polygon, Path, Circle } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ParksStackParamList } from '@/navigation/types';
import { useApp } from '@/context/AppContext';
import { colors, spacing, radius, shadows, typography } from '@/theme';
import { getParkScene } from '@/data/parkImages';
import { getParkGuide } from '@/data/parkGuides';
import { alertsForPark } from '@/data/npsAlerts';
import NpsAlertsCard from '@/components/NpsAlertsCard';
import StatusBadge from '@/components/StatusBadge';
import TripCard from '@/components/TripCard';
import PrimaryButton from '@/components/PrimaryButton';
import SecondaryButton from '@/components/SecondaryButton';

type Props = NativeStackScreenProps<ParksStackParamList, 'ParkDetail'>;

function TrailIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2 20 8 8l3 6 2-3 9 9" fill="none" stroke={colors.sage} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="20" cy="5" r="2.2" fill={colors.orange} />
    </Svg>
  );
}

function PawIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="16" r="5" fill={colors.orange} />
      <Circle cx="5" cy="9" r="2.6" fill={colors.orange} />
      <Circle cx="11" cy="5" r="2.6" fill={colors.orange} />
      <Circle cx="17.5" cy="6.5" r="2.6" fill={colors.orange} />
      <Circle cx="21.5" cy="12" r="2.4" fill={colors.orange} />
    </Svg>
  );
}

function SummaryCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactElement;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.summaryCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.summaryIconBox}>{icon}</View>
      <View style={styles.summaryContent}>
        <Text style={styles.summaryTitle}>{title}</Text>
        <Text style={styles.summarySubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>{'›'}</Text>
    </TouchableOpacity>
  );
}

function BackArrowIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Polyline
        points="10,2 4,8 10,14"
        fill="none"
        stroke={colors.textPrimary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 12 12">
      <Polyline points="2,6 5,9 10,3" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function TreeIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Polygon points="10,2 4,10 7,10 3,15 8,15 8,18 12,18 12,15 17,15 13,10 16,10" fill={colors.sage} />
    </Svg>
  );
}

export default function ParkDetailScreen({ route, navigation }: Props) {
  const { parkId } = route.params;
  const { parks, trips, trails, animals, toggleFavorite, updateParkStatus, isTrailCompleted, isAnimalSpotted, parkAlerts, alertsSyncedAt, requireAccount } = useApp();
  const insets = useSafeAreaInsets();
  const park = parks.find((p) => p.id === parkId);
  const parkTrips = trips.filter((t) => t.parkId === parkId);
  const parkTrails = trails.filter((t) => t.parkId === parkId);
  const parkAnimals = animals.filter((a) => a.parkId === parkId);
  const trailsCompletedCount = parkTrails.filter((t) => isTrailCompleted(t.id)).length;
  const animalsSpottedCount = parkAnimals.filter((a) => isAnimalSpotted(a.id)).length;
  const guide = getParkGuide(parkId);
  const alerts = alertsForPark(parkAlerts, parkId);

  if (!park) return null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <Image source={getParkScene(park.id)} style={styles.heroImage} resizeMode="cover" />
          <TouchableOpacity style={[styles.backBtn, { top: insets.top + 16 }]} onPress={() => navigation.goBack()}>
            <BackArrowIcon />
          </TouchableOpacity>
          <View style={[styles.heroActions, { top: insets.top + 16 }]}>
            <TouchableOpacity
              style={[styles.heroActionBtn, park.status === 'visited' && styles.heroActionBtnVisitedActive]}
              onPress={() => updateParkStatus(park.id, park.status === 'visited' ? 'notVisited' : 'visited')}
            >
              <CheckIcon color={park.status === 'visited' ? colors.textInverse : colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroActionBtn} onPress={() => toggleFavorite(park.id)}>
              <Image
                source={require('@/assets/icons/icon-favorites.png')}
                style={[styles.heartIcon, !park.isFavorite && styles.heartIconInactive]}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info */}
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.parkName}>{park.name}</Text>
              <Text style={styles.parkType}>National Park</Text>
            </View>
            <StatusBadge status={park.status} detail />
          </View>

          <NpsAlertsCard alerts={alerts} syncedAt={alertsSyncedAt} npsCode={guide?.npsCode} />

          <Text style={styles.description}>{park.description}</Text>

          {/* Facts */}
          <View style={styles.factsRow}>
            <View style={styles.fact}>
              <Image source={require('@/assets/icons/icon-calendar.png')} style={styles.factIcon} resizeMode="contain" />
              <Text style={styles.factLabel}>Est. {park.establishedYear}</Text>
            </View>
            <View style={styles.factDivider} />
            <View style={styles.fact}>
              <Image source={require('@/assets/icons/icon-map.png')} style={styles.factIcon} resizeMode="contain" />
              <Text style={styles.factLabel}>{park.state}</Text>
            </View>
            <View style={styles.factDivider} />
            <View style={styles.fact}>
              <TreeIcon size={26} />
              <Text style={styles.factLabel}>{park.acres.toLocaleString()} Acres</Text>
            </View>
          </View>

          {/* Trails & Animal Compendium summary cards */}
          {(parkTrails.length > 0 || parkAnimals.length > 0) && (
            <View style={styles.section}>
              {parkTrails.length > 0 && (
                <SummaryCard
                  icon={<TrailIcon />}
                  title="Trails"
                  subtitle={`${trailsCompletedCount} of ${parkTrails.length} completed`}
                  onPress={() => navigation.navigate('ParkTrails', { parkId: park.id })}
                />
              )}
              {parkAnimals.length > 0 && (
                <SummaryCard
                  icon={<PawIcon />}
                  title="Animal Compendium"
                  subtitle={`${animalsSpottedCount} of ${parkAnimals.length} spotted`}
                  onPress={() => navigation.navigate('ParkAnimals', { parkId: park.id })}
                />
              )}
            </View>
          )}

          {guide && (
            <View style={styles.dayPlanCard}>
              <View style={styles.dayPlanHeader}>
                <Image source={require('@/assets/mascot/mascot-tip.png')} style={styles.dayPlanMascot} resizeMode="contain" />
                <View style={styles.dayPlanHeaderText}>
                  <Text style={styles.sectionTitle}>Only Have a Day?</Text>
                  <Text style={styles.dayPlanSubtitle}>Try this out</Text>
                </View>
              </View>
              {guide.oneDay.map((stop, i) => (
                <View key={stop.when} style={styles.dayPlanStop}>
                  <View style={styles.dayPlanRail}>
                    <View style={styles.dayPlanDot} />
                    {i < guide.oneDay.length - 1 && <View style={styles.dayPlanLine} />}
                  </View>
                  <View style={styles.dayPlanStopBody}>
                    <Text style={styles.dayPlanWhen}>{stop.when}</Text>
                    <Text style={styles.dayPlanText}>{stop.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Memories */}
          {parkTrips.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your Memories</Text>
                <Text style={styles.viewAll}>View All</Text>
              </View>
              {parkTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onPress={() =>
                    (navigation as any).navigate('TripDetail', { tripId: trip.id })
                  }
                />
              ))}
            </View>
          )}

          <View style={styles.sourceNote}>
            <Text style={styles.sourceTitle}>About this info</Text>
            <Text style={styles.sourceText}>
              Parks Pal is an independent app and isn't affiliated with or endorsed by the National Park
              Service. Park info is gathered from NPS.gov and other public sources and written in our own
              words, and suggestions come from our own trips plus those of fellow users and pals. Cards marked
              NPS Alerts are the exception: they come live from the National Park Service, word for word. Hours,
              roads, permits, and conditions change, so check the official NPS site before you go.
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(guide ? `https://www.nps.gov/${guide.npsCode}` : 'https://www.nps.gov')}
              hitSlop={8}
            >
              <Text style={styles.sourceLink}>
                {guide ? `Visit nps.gov/${guide.npsCode}` : 'Visit nps.gov'} {'›'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <PrimaryButton
          label={park.status === 'visited' ? 'LOG ANOTHER TRIP' : 'LOG A TRIP'}
          onPress={() =>
            requireAccount() && (navigation as any).navigate('LogTripForm', { parkId: park.id, initialTripType: 'logged' })
          }
          style={styles.ctaBtn}
        />
        <SecondaryButton
          label="PLAN A TRIP"
          onPress={() =>
            requireAccount() && (navigation as any).navigate('LogTripForm', { parkId: park.id, initialTripType: 'planned' })
          }
          style={styles.ctaBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 160 },

  hero: { height: 320, position: 'relative', backgroundColor: colors.surfaceWarm },
  heroImage: { width: '100%', height: '100%' },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', ...shadows.md },
  heroActions: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', gap: spacing.sm },
  heroActionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', ...shadows.md },
  heroActionBtnVisitedActive: { backgroundColor: colors.visited },
  heartIcon: { width: 18, height: 18 },
  heartIconInactive: { opacity: 0.3 },

  content: {
    padding: spacing.xl,
    gap: spacing.xl,
    marginTop: -28,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleBlock: { flex: 1, gap: 4 },
  parkName: { ...typography.h2, color: colors.textPrimary },
  parkType: { ...typography.body, color: colors.textSecondary },

  description: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },

  factsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  fact: { gap: 6, alignItems: 'center', paddingHorizontal: spacing.lg },
  factDivider: { width: 1, height: 34, backgroundColor: colors.divider },
  factIcon: { width: 26, height: 26 },
  factLabel: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },

  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { ...typography.h5, color: colors.textPrimary },
  viewAll: { ...typography.labelSmall, color: colors.sage },

  summaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, gap: spacing.md, ...shadows.sm },
  summaryIconBox: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceWarm, alignItems: 'center', justifyContent: 'center' },
  summaryContent: { flex: 1, gap: 2 },
  summaryTitle: { ...typography.labelBold, color: colors.textPrimary },
  summarySubtitle: { ...typography.bodySmall, color: colors.textSecondary },
  chevron: { fontSize: 22, color: colors.textMuted },

  dayPlanCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, ...shadows.sm },
  dayPlanHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
  dayPlanMascot: { width: 48, height: 48 },
  dayPlanHeaderText: { flex: 1 },
  dayPlanSubtitle: { ...typography.bodySmall, color: colors.textSecondary },
  dayPlanStop: { flexDirection: 'row', gap: spacing.md },
  dayPlanRail: { width: 12, alignItems: 'center', paddingTop: 5 },
  dayPlanDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.sage },
  dayPlanLine: { flex: 1, width: 2, backgroundColor: colors.divider, marginTop: 4 },
  dayPlanStopBody: { flex: 1, paddingBottom: spacing.sm, gap: 2 },
  dayPlanWhen: { ...typography.labelBold, color: colors.primary },
  dayPlanText: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },

  sourceNote: { backgroundColor: colors.surfaceWarm, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  sourceTitle: { ...typography.labelBold, color: colors.textPrimary },
  sourceText: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  sourceLink: { ...typography.labelSemiBold, color: colors.primary, marginTop: spacing.xs },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.background },
  ctaBtn: { width: '100%' },
});
