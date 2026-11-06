import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ParksStackParamList } from '@/navigation/types';
import { useApp } from '@/context/AppContext';
import { colors, spacing, radius, shadows, typography } from '@/theme';
import { Trail, TrailDifficulty, Units } from '@/types';
import ScreenHeader from '@/components/ScreenHeader';
import { alertsForTrail } from '@/data/npsAlerts';
import { convertMiles, convertFeet, distanceLabel, elevationLabel } from '@/utils/units';
import { tapHaptic } from '@/utils/haptics';

type Props = NativeStackScreenProps<ParksStackParamList, 'ParkTrails'>;

const DIFFICULTY_COLOR: Record<TrailDifficulty, string> = {
  Easy: colors.sage,
  Moderate: colors.orange,
  Hard: colors.rose,
};

const DIFFICULTY_FILTERS: ('All' | TrailDifficulty)[] = ['All', 'Easy', 'Moderate', 'Hard'];
const DIFFICULTY_RANK: Record<TrailDifficulty, number> = { Easy: 0, Moderate: 1, Hard: 2 };

function CompletionToggle({ completed, onToggle }: { completed: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      hitSlop={10}
      activeOpacity={0.7}
      style={[styles.checkBadge, completed && styles.checkBadgeCompleted]}
    >
      {completed && (
        <Svg width={10} height={10} viewBox="0 0 12 12">
          <Polyline points="2,6 5,9 10,3" fill="none" stroke={colors.textInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </TouchableOpacity>
  );
}

function TrailListCard({ trail, completed, units, hasAlert, onToggleCompleted, onPress }: { trail: Trail; completed: boolean; units: Units; hasAlert: boolean; onToggleCompleted: () => void; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.itemTitleRow}>
        <Text style={[styles.itemName, styles.itemNameFlex]}>{trail.name}</Text>
        <CompletionToggle completed={completed} onToggle={onToggleCompleted} />
      </View>
      <Text style={styles.itemDescription}>{trail.description}</Text>
      <View style={styles.itemMetaRow}>
        <Text style={styles.itemMeta}>{convertMiles(trail.miles, units).toFixed(1)} {distanceLabel(units)}</Text>
        <Text style={styles.itemMeta}>{Math.round(convertFeet(trail.elevationGainFt, units)).toLocaleString()} {elevationLabel(units)} gain</Text>
        <View style={[styles.pill, { backgroundColor: DIFFICULTY_COLOR[trail.difficulty] }]}>
          <Text style={styles.pillText}>{trail.difficulty}</Text>
        </View>
        {hasAlert && (
          <View style={styles.alertTag}>
            <Text style={styles.alertTagText}>NPS alert</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ParkTrailsScreen({ route, navigation }: Props) {
  const { parkId } = route.params;
  const { parks, trails, trailDetails, isTrailCompleted, markTrailCompleted, unmarkTrailCompleted, userProfile, parkAlerts } = useApp();
  const units = userProfile.units;
  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | TrailDifficulty>('All');

  const park = parks.find((p) => p.id === parkId);
  const allTrails = trails.filter((t) => t.parkId === parkId);
  const completedCount = allTrails.filter((t) => isTrailCompleted(t.id)).length;

  const filteredTrails = allTrails
    .filter((t) => {
      const matchesSearch = t.name.toLowerCase().includes(search.trim().toLowerCase());
      const matchesDifficulty = difficultyFilter === 'All' || t.difficulty === difficultyFilter;
      return matchesSearch && matchesDifficulty;
    })
    .sort((a, b) => DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader title={park ? `${park.name} Trails` : 'Trails'} onBack={() => navigation.goBack()} />
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search trails..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <View style={styles.filterRow}>
        {DIFFICULTY_FILTERS.map((d) => {
          const active = difficultyFilter === d;
          return (
            <TouchableOpacity
              key={d}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setDifficultyFilter(d)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{d}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.progressText}>{completedCount} of {allTrails.length} completed</Text>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {filteredTrails.map((trail) => (
          <TrailListCard
            key={trail.id}
            trail={trail}
            completed={isTrailCompleted(trail.id)}
            units={units}
            hasAlert={alertsForTrail(parkAlerts, trail, trailDetails[trail.id]?.alertKeywords).length > 0}
            onToggleCompleted={() => {
              tapHaptic();
              if (isTrailCompleted(trail.id)) unmarkTrailCompleted(trail.id);
              else markTrailCompleted(trail.id, trail.parkId, trail.name);
            }}
            onPress={() => navigation.navigate('TrailDetail', { trailId: trail.id })}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing['5xl'] },

  searchWrap: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  searchInput: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...typography.body, color: colors.textPrimary, ...shadows.sm },

  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterChipText: { ...typography.labelSmall, color: colors.textSecondary },
  filterChipTextActive: { color: colors.textInverse },

  progressText: { ...typography.labelSemiBold, color: colors.textSecondary, paddingHorizontal: spacing.xl, marginBottom: spacing.md },

  itemCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, gap: 4, ...shadows.sm },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemName: { ...typography.labelBold, color: colors.textPrimary },
  itemNameFlex: { flex: 1 },
  itemDescription: { ...typography.bodySmall, color: colors.textSecondary },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 },
  itemMeta: { ...typography.caption, color: colors.textMuted },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  pillText: { ...typography.labelSmall, fontSize: 10, color: colors.textInverse },
  alertTag: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1, borderColor: colors.orange },
  alertTagText: { ...typography.labelSmall, fontSize: 10, color: colors.orange },
  checkBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surfaceWarm, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkBadgeCompleted: { backgroundColor: colors.primary, borderColor: colors.primary },
});
