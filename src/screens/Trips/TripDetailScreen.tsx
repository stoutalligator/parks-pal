import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Polygon } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TripsStackParamList } from '@/navigation/types';
import { useApp } from '@/context/AppContext';
import { colors, spacing, radius, shadows, typography } from '@/theme';
import { getParkById } from '@/data/parks';
import { getParkScene } from '@/data/parkImages';
import { convertMiles, convertFeet, distanceLabel, elevationLabel } from '@/utils/units';
import { parseLocalDate, daysUntilLabel } from '@/utils/dates';
import PrimaryButton from '@/components/PrimaryButton';
import RecapPreview from '@/components/RecapPreview';
import NpsAlertsCard from '@/components/NpsAlertsCard';
import { alertsForPark, isTripInAlertWindow } from '@/data/npsAlerts';
import { getParkGuide } from '@/data/parkGuides';
import Polaroid, { tapeColorForIndex } from '@/components/Polaroid';
import {
  WeatherSunnyIcon,
  WeatherPartlyCloudyIcon,
  WeatherCloudyIcon,
  WeatherRainyIcon,
  WeatherStormyIcon,
  WeatherSnowyIcon,
  WeatherFlashFloodIcon,
  WeatherExtremeHeatIcon,
  WeatherFoggyIcon,
  WeatherWindyIcon,
} from '@/screens/LogTrip/LogTripScreen';
import { WeatherType } from '@/types';

type Props = NativeStackScreenProps<TripsStackParamList, 'TripDetail'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_GAP = spacing.md;
const PHOTO_SIZE = (SCREEN_WIDTH - spacing.xl * 2 - PHOTO_GAP * 2) / 3;

function formatDate(d: string) {
  return parseLocalDate(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDayDate(d: string) {
  return parseLocalDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const WEATHER_ICONS: Record<WeatherType, (color: string) => React.ReactElement> = {
  Sunny: (c) => <WeatherSunnyIcon color={c} size={18} />,
  PartlyCloudy: (c) => <WeatherPartlyCloudyIcon color={c} size={18} />,
  Cloudy: (c) => <WeatherCloudyIcon color={c} size={18} />,
  Rainy: (c) => <WeatherRainyIcon color={c} size={18} />,
  Stormy: (c) => <WeatherStormyIcon color={c} size={18} />,
  Snowy: (c) => <WeatherSnowyIcon color={c} size={18} />,
  FlashFlood: (c) => <WeatherFlashFloodIcon color={c} size={18} />,
  ExtremeHeat: (c) => <WeatherExtremeHeatIcon color={c} size={18} />,
  Foggy: (c) => <WeatherFoggyIcon color={c} size={18} />,
  Windy: (c) => <WeatherWindyIcon color={c} size={18} />,
};

const WEATHER_LABELS: Record<WeatherType, string> = {
  Sunny: 'Sunny',
  PartlyCloudy: 'Partly Cloudy',
  Cloudy: 'Cloudy',
  Rainy: 'Rainy',
  Stormy: 'Stormy',
  Snowy: 'Snowy',
  FlashFlood: 'Flash Flood',
  ExtremeHeat: 'Extreme Heat',
  Foggy: 'Foggy / Smoky',
  Windy: 'Windy',
};

function BackArrowIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16">
      <Path d="M10 2 4 8l6 6" fill="none" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function EditIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M4 20h4l11-11a2.12 2.12 0 0 0-3-3L5 17v3Z"
        fill="none"
        stroke={colors.textPrimary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ShareIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"
        fill="none"
        stroke={colors.textPrimary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrashIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M4 7h16M9 7V4h6v3m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"
        fill="none"
        stroke={colors.rose}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function StarIcon({ filled, size = 16 }: { filled: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon
        points="12,2 14.9,9 22.5,9.3 16.4,14 18.5,21.3 12,17.1 5.5,21.3 7.6,14 1.5,9.3 9.1,9"
        fill={filled ? colors.orange : colors.divider}
      />
    </Svg>
  );
}

export default function TripDetailScreen({ route, navigation }: Props) {
  const { tripId } = route.params;
  const { trips, deleteTrip, isTripPending, userProfile, parkAlerts, alertsSyncedAt } = useApp();
  const units = userProfile.units;
  const insets = useSafeAreaInsets();
  const [recapVisible, setRecapVisible] = useState(false);
  const trip = trips.find((t) => t.id === tripId);
  const park = trip ? getParkById(trip.parkId) : null;

  if (!trip || !park) return null;

  const planned = trip.tripType === 'planned';
  // A trip saved on this device that hasn't reached the server yet can still
  // be edited, completed or deleted — those changes just join what's waiting.
  const pending = isTripPending(trip.id);
  const hasPhotoCaptions = !!trip.photoCaptions?.some((c) => !!c);

  const confirmDelete = () => {
    const remove = () => {
      deleteTrip(trip.id);
      navigation.goBack();
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this trip? This cannot be undone.')) remove();
      return;
    }
    Alert.alert('Delete Trip', 'Delete this trip? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: remove },
    ]);
  };

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
            {!planned && (
              <TouchableOpacity
                style={styles.heroActionBtn}
                onPress={() => setRecapVisible(true)}
                accessibilityLabel="Share trip recap"
              >
                <ShareIcon />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.heroActionBtn}
              onPress={() => (navigation as any).navigate('LogTripForm', { tripId: trip.id })}
            >
              <EditIcon />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroActionBtn} onPress={confirmDelete}>
              <TrashIcon />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.parkName}>{park.name}</Text>
          <Text style={styles.dates}>{formatDate(trip.startDate)} – {formatDate(trip.endDate)}</Text>
          {pending && <Text style={styles.pendingNote}>Saved on this device — will sync once you're back online.</Text>}

          {planned && (
            <View style={styles.plannedBlock}>
              <Text style={styles.plannedDaysUntil}>{daysUntilLabel(trip.startDate)}</Text>
              <PrimaryButton
                label="MARK AS COMPLETED"
                onPress={() => (navigation as any).navigate('LogTripForm', { completeTripId: trip.id })}
              />
            </View>
          )}

          {isTripInAlertWindow(trip) && (
            <NpsAlertsCard
              alerts={alertsForPark(parkAlerts, trip.parkId)}
              syncedAt={alertsSyncedAt}
              npsCode={getParkGuide(trip.parkId)?.npsCode}
              title="Before you go: NPS alerts"
            />
          )}

          {/* Activities — legacy trips only; day-by-day trips show activities
              per-day below instead. */}
          {!trip.days?.length && trip.activities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{planned ? 'Planned Activities' : 'Activities'}</Text>
              <View style={styles.tagRow}>
                {trip.activities.map((a) => (
                  <View key={a} style={styles.tag}>
                    <Text style={styles.tagText}>{a}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Journal */}
          {trip.notes ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{planned ? 'Notes' : 'Journal'}</Text>
              <View style={styles.journalCard}>
                <Text style={styles.journalText}>{trip.notes}</Text>
              </View>
            </View>
          ) : null}

          {/* Photos */}
          {trip.photos.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Photos</Text>
              <View style={styles.photoGrid}>
                {trip.photos.map((uri, i) => (
                  <TouchableOpacity
                    key={uri}
                    activeOpacity={0.85}
                    onPress={() => (navigation as any).navigate('TripPhotoAlbum', { tripId: trip.id })}
                  >
                    <Polaroid
                      uri={uri}
                      size={PHOTO_SIZE}
                      variant="stack"
                      tapeColor={tapeColorForIndex(i)}
                      rotate={i % 2 === 0 ? -4 : 4}
                      caption={trip.photoCaptions?.[i]}
                      roomForCaption={hasPhotoCaptions}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {trip.days?.length ? (
            /* Day-by-day breakdown — trips saved through the new per-day
               flow show one section per day instead of the flat
               activities/trails/wildlife rows above. */
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Day by Day</Text>
              {trip.days.map((day) => (
                <View key={day.dayNumber} style={styles.dayCard}>
                  <View style={styles.dayCardHeader}>
                    <Text style={styles.dayCardTitle}>Day {day.dayNumber} · {formatDayDate(day.date)}</Text>
                    {day.weather && (
                      <View style={styles.dayWeather}>
                        {WEATHER_ICONS[day.weather](colors.textSecondary)}
                        <Text style={styles.dayWeatherLabel}>{WEATHER_LABELS[day.weather]}</Text>
                      </View>
                    )}
                  </View>

                  {day.activities.length > 0 && (
                    <View style={styles.tagRow}>
                      {day.activities.map((a) => (
                        <View key={a.activity} style={styles.tag}>
                          <Text style={styles.tagText}>{a.activity}</Text>
                          {a.viewpoint ? <Text style={styles.tagCaption}>{a.viewpoint}</Text> : null}
                        </View>
                      ))}
                    </View>
                  )}

                  {day.trailsHiked.length > 0 && (
                    <View style={[styles.tagRow, styles.dayCardRowSpaced]}>
                      {day.trailsHiked.map((t) => (
                        <View key={t.trailId ?? t.name} style={styles.tag}>
                          <Text style={styles.tagText}>
                            {t.name} · {convertMiles(t.miles, units).toFixed(1)} {distanceLabel(units)}
                            {t.elevationGainFt ? ` · ${Math.round(convertFeet(t.elevationGainFt, units)).toLocaleString()} ${elevationLabel(units)} gain` : ''}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {day.wildlifeSightings.length > 0 && (
                    <View style={[styles.tagRow, styles.dayCardRowSpaced]}>
                      {day.wildlifeSightings.map((w) => (
                        <View key={w} style={[styles.tag, styles.tagWildlife]}>
                          <Text style={[styles.tagText, styles.tagTextWildlife]}>{w}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {(day.floraSightings?.length ?? 0) > 0 && (
                    <View style={[styles.tagRow, styles.dayCardRowSpaced]}>
                      {day.floraSightings?.map((f) => (
                        <View key={f} style={[styles.tag, styles.tagFlora]}>
                          <Text style={[styles.tagText, styles.tagTextFlora]}>{f}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <>
              {/* Trails Hiked */}
              {trip.trailsHiked && trip.trailsHiked.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Trails Hiked</Text>
                  <View style={styles.tagRow}>
                    {trip.trailsHiked.map((t) => (
                      <View key={t.trailId ?? t.name} style={styles.tag}>
                        <Text style={styles.tagText}>
                          {t.name} · {convertMiles(t.miles, units).toFixed(1)} {distanceLabel(units)}
                          {t.elevationGainFt ? ` · ${Math.round(convertFeet(t.elevationGainFt, units)).toLocaleString()} ${elevationLabel(units)} gain` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Wildlife */}
              {trip.wildlifeSightings && trip.wildlifeSightings.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Wildlife Spotted</Text>
                  <View style={styles.tagRow}>
                    {trip.wildlifeSightings.map((w) => (
                      <View key={w} style={[styles.tag, styles.tagWildlife]}>
                        <Text style={[styles.tagText, styles.tagTextWildlife]}>{w}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            {trip.milesHiked ? (
              <View style={styles.statChip}><Text style={styles.statNum}>{convertMiles(trip.milesHiked, units).toFixed(1)}</Text><Text style={styles.statLabel}>{distanceLabel(units) === 'mi' ? 'Miles' : 'Kilometers'}</Text></View>
            ) : null}
            {trip.elevationGainFt ? (
              <View style={styles.statChip}><Text style={styles.statNum}>{Math.round(convertFeet(trip.elevationGainFt, units)).toLocaleString()}</Text><Text style={styles.statLabel}>Elev. Gain ({elevationLabel(units)})</Text></View>
            ) : null}
            {trip.rating ? (
              <View style={styles.statChip}>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <StarIcon key={i} filled={i <= (trip.rating ?? 0)} />
                  ))}
                </View>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            ) : null}
            {trip.weather ? (
              <View style={styles.statChip}><Text style={styles.statNum}>{trip.weather}</Text><Text style={styles.statLabel}>Weather</Text></View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <RecapPreview visible={recapVisible} trip={trip} onClose={() => setRecapVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing['5xl'] },
  hero: { height: 320, position: 'relative', backgroundColor: colors.surfaceWarm },
  heroImage: { width: '100%', height: '100%' },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', ...shadows.md },
  heroActions: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', gap: spacing.sm },
  heroActionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', ...shadows.md },
  content: {
    padding: spacing.xl,
    gap: spacing.xl,
    marginTop: -28,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
  },
  parkName: { ...typography.h2, color: colors.textPrimary },
  dates: { ...typography.body, color: colors.textSecondary },
  pendingNote: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  plannedBlock: {
    backgroundColor: colors.surfaceWarm,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  plannedDaysUntil: { ...typography.labelBold, color: colors.sky, textAlign: 'center' },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.h5, color: colors.textPrimary },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { backgroundColor: colors.surfaceWarm, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  tagWildlife: { backgroundColor: colors.surfaceWarm },
  tagFlora: { backgroundColor: colors.roseTint },
  tagTextFlora: { color: colors.roseDark },
  tagText: { ...typography.labelSmall, color: colors.primary },
  tagTextWildlife: { color: colors.orange },
  tagCaption: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
    ...shadows.sm,
  },
  dayCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayCardTitle: { ...typography.labelBold, color: colors.textPrimary },
  dayCardRowSpaced: { marginTop: spacing.xs },
  dayWeather: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dayWeatherLabel: { ...typography.caption, color: colors.textSecondary },
  journalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, ...shadows.sm },
  journalText: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: PHOTO_GAP, marginTop: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  statChip: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', minWidth: 80, ...shadows.sm },
  statNum: { ...typography.h5, color: colors.textPrimary },
  statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  starRow: { flexDirection: 'row', gap: 2 },
});
