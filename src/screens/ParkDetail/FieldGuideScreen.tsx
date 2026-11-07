import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FieldGuideTab, ParksStackParamList } from '@/navigation/types';
import { useApp } from '@/context/AppContext';
import { colors, spacing, radius, shadows, typography } from '@/theme';
import { Animal, AnimalRarity, Plant } from '@/types';
import ScreenHeader from '@/components/ScreenHeader';
import { FlowerIcon, TrailSignIcon } from '@/components/FieldGuideIcons';
import { MONTH_ABBR, bloomRange, currentMonth, isInBloom } from '@/utils/bloom';

type Props = NativeStackScreenProps<ParksStackParamList, 'FieldGuide'>;

const RARITY_COLOR: Record<AnimalRarity, string> = {
  Common: colors.sage,
  Uncommon: colors.orange,
  Rare: colors.rose,
};

const RARITY_FILTERS: ('All' | AnimalRarity)[] = ['All', 'Common', 'Uncommon', 'Rare'];
const RARITY_RANK: Record<AnimalRarity, number> = { Common: 0, Uncommon: 1, Rare: 2 };

type FloraFilter = 'All' | 'bloom' | 'trail' | AnimalRarity;

function CheckBadge({ completed }: { completed: boolean }) {
  return (
    <View style={[styles.checkBadge, completed && styles.checkBadgeCompleted]}>
      {completed && (
        <Svg width={10} height={10} viewBox="0 0 12 12">
          <Polyline points="2,6 5,9 10,3" fill="none" stroke={colors.textInverse} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}

function AnimalListCard({ animal, spotted, onPress }: { animal: Animal; spotted: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.itemTitleRow}>
        <Text style={[styles.itemName, styles.itemNameFlex]}>{animal.name}</Text>
        <CheckBadge completed={spotted} />
      </View>
      <Text style={styles.itemDescription}>{animal.description}</Text>
      <View style={styles.itemMetaRow}>
        <View style={[styles.pill, { backgroundColor: RARITY_COLOR[animal.rarity] }]}>
          <Text style={styles.pillText}>{animal.rarity}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function PlantListCard({
  plant,
  scientificName,
  onTrail,
  found,
  onPress,
}: {
  plant: Plant;
  scientificName?: string;
  onTrail: boolean;
  found: boolean;
  onPress: () => void;
}) {
  const range = bloomRange(plant);
  return (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.itemTitleRow}>
        <Text style={[styles.itemName, styles.itemNameFlex]}>{plant.name}</Text>
        <CheckBadge completed={found} />
      </View>
      <Text style={styles.scientific}>{scientificName ? `${scientificName} · ${plant.type}` : plant.type}</Text>
      <Text style={styles.itemDescription}>{plant.description}</Text>
      <View style={styles.itemMetaRow}>
        <View style={[styles.pill, { backgroundColor: RARITY_COLOR[plant.rarity] }]}>
          <Text style={styles.pillText}>{plant.rarity}</Text>
        </View>
        {isInBloom(plant) ? (
          <View style={[styles.pill, styles.bloomPill]}>
            <FlowerIcon size={10} />
            <Text style={styles.bloomPillText}>In bloom</Text>
          </View>
        ) : range ? (
          <View style={[styles.pill, styles.softPill]}>
            <Text style={styles.softPillText}>Blooms {range}</Text>
          </View>
        ) : null}
        {onTrail && (
          <View style={[styles.pill, styles.trailPill]}>
            <TrailSignIcon size={10} />
            <Text style={styles.softPillText}>Nature trail</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function FieldGuideScreen({ route, navigation }: Props) {
  const { parkId } = route.params;
  const { parks, animals, plants, plantDetails, isAnimalSpotted, isPlantFound } = useApp();
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<'All' | AnimalRarity>('All');
  const [floraFilter, setFloraFilter] = useState<FloraFilter>('All');

  const park = parks.find((p) => p.id === parkId);
  const allAnimals = animals.filter((a) => a.parkId === parkId);
  const allPlants = plants.filter((p) => p.parkId === parkId);
  const hasFlora = allPlants.length > 0;
  const [tab, setTab] = useState<FieldGuideTab>(route.params.tab === 'flora' && hasFlora ? 'flora' : 'fauna');

  const query = search.trim().toLowerCase();
  const month = currentMonth();
  const spottedCount = allAnimals.filter((a) => isAnimalSpotted(a.id)).length;
  const foundCount = allPlants.filter((p) => isPlantFound(p.id)).length;
  const bloomingCount = allPlants.filter((p) => isInBloom(p, month)).length;
  const hasTrailPlants = allPlants.some((p) => !!plantDetails[p.id]?.natureTrail);

  const filteredAnimals = allAnimals
    .filter((a) => a.name.toLowerCase().includes(query) && (rarityFilter === 'All' || a.rarity === rarityFilter))
    .sort((a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity]);

  const floraFilters: { key: FloraFilter; label: string }[] = [
    { key: 'All', label: 'All' },
    ...(allPlants.some((p) => p.bloomMonths.length) ? [{ key: 'bloom' as const, label: 'In bloom' }] : []),
    ...(hasTrailPlants ? [{ key: 'trail' as const, label: 'Nature trail' }] : []),
    { key: 'Common', label: 'Common' },
    { key: 'Uncommon', label: 'Uncommon' },
    { key: 'Rare', label: 'Rare' },
  ];

  const filteredPlants = allPlants
    .filter((p) => {
      if (!p.name.toLowerCase().includes(query)) return false;
      if (floraFilter === 'bloom') return isInBloom(p, month);
      if (floraFilter === 'trail') return !!plantDetails[p.id]?.natureTrail;
      return floraFilter === 'All' || p.rarity === floraFilter;
    })
    .sort(
      (a, b) =>
        Number(isInBloom(b, month)) - Number(isInBloom(a, month)) || RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity]
    );

  const parkName = park?.name ?? '';
  const title = hasFlora ? `${parkName} Field Guide`.trim() : park ? `${park.name} Animals` : 'Field Guide';

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      {hasFlora && (
        <View style={styles.segment}>
          {(['fauna', 'flora'] as FieldGuideTab[]).map((t) => {
            const active = tab === t;
            const count = t === 'fauna' ? `${spottedCount}/${allAnimals.length}` : `${foundCount}/${allPlants.length}`;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                onPress={() => setTab(t)}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t === 'fauna' ? 'Fauna' : 'Flora'}</Text>
                <Text style={styles.segmentCount}>{count}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder={tab === 'flora' ? 'Search plants...' : 'Search animals...'}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      {tab === 'fauna' ? (
        <>
          <View style={styles.filterRow}>
            {RARITY_FILTERS.map((r) => {
              const active = rarityFilter === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setRarityFilter(r)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{r}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.progressText}>{spottedCount} of {allAnimals.length} spotted</Text>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {filteredAnimals.map((animal) => (
              <AnimalListCard
                key={animal.id}
                animal={animal}
                spotted={isAnimalSpotted(animal.id)}
                onPress={() => navigation.navigate('AnimalDetail', { animalId: animal.id })}
              />
            ))}
          </ScrollView>
        </>
      ) : (
        <>
          <View style={styles.filterScroll}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, styles.filterScrollRow]}>
            {floraFilters.map(({ key, label }) => {
              const active = floraFilter === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.filterChip, styles.filterChipIcon, active && styles.filterChipActive]}
                  onPress={() => setFloraFilter(key)}
                  activeOpacity={0.8}
                >
                  {key === 'bloom' && <FlowerIcon size={11} color={active ? colors.textInverse : colors.rose} />}
                  {key === 'trail' && <TrailSignIcon size={11} color={active ? colors.textInverse : colors.brown} />}
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          </View>
          <Text style={styles.progressText}>
            {foundCount} of {allPlants.length} found · {bloomingCount} in bloom in {MONTH_ABBR[month - 1]}
          </Text>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {filteredPlants.length ? (
              filteredPlants.map((plant) => (
                <PlantListCard
                  key={plant.id}
                  plant={plant}
                  scientificName={plantDetails[plant.id]?.scientificName}
                  onTrail={!!plantDetails[plant.id]?.natureTrail}
                  found={isPlantFound(plant.id)}
                  onPress={() => navigation.navigate('PlantDetail', { plantId: plant.id })}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>
                {floraFilter === 'bloom' ? `Nothing here is in bloom in ${MONTH_ABBR[month - 1]}.` : 'No plants match.'}
              </Text>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing['5xl'] },

  segment: { flexDirection: 'row', marginHorizontal: spacing.xl, marginBottom: spacing.md, padding: 4, gap: 4, borderRadius: radius.full, backgroundColor: colors.surfaceWarm },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm, borderRadius: radius.full },
  segmentBtnActive: { backgroundColor: colors.surface, ...shadows.sm },
  segmentText: { ...typography.labelBold, color: colors.textSecondary },
  segmentTextActive: { color: colors.primary },
  segmentCount: { ...typography.caption, color: colors.textMuted },

  searchWrap: { paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  searchInput: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, ...typography.body, color: colors.textPrimary, ...shadows.sm },

  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filterScrollRow: { alignItems: 'center', paddingBottom: spacing.md },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  filterChipIcon: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterChipText: { ...typography.labelSmall, color: colors.textSecondary },
  filterChipTextActive: { color: colors.textInverse },

  progressText: { ...typography.labelSemiBold, color: colors.textSecondary, paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  emptyText: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },

  itemCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, gap: 4, ...shadows.sm },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  itemName: { ...typography.labelBold, color: colors.textPrimary },
  itemNameFlex: { flex: 1 },
  scientific: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  itemDescription: { ...typography.bodySmall, color: colors.textSecondary },
  itemMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  pillText: { ...typography.labelSmall, fontSize: 10, color: colors.textInverse },
  bloomPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.roseTint },
  bloomPillText: { ...typography.labelSmall, fontSize: 10, color: colors.roseDark },
  softPill: { backgroundColor: colors.cream },
  trailPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceWarm },
  softPillText: { ...typography.labelSmall, fontSize: 10, color: colors.brownDark },
  checkBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surfaceWarm, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkBadgeCompleted: { backgroundColor: colors.primary, borderColor: colors.primary },
});
