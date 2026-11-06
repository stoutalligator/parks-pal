import React, { useState, useMemo } from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '@/context/AppContext';
import { colors, spacing, radius, shadows, typography } from '@/theme';
import FilterPill from '@/components/FilterPill';
import ParkCard from '@/components/ParkCard';
import { ParkStatus } from '@/types';
import { usePullToRefresh } from '@/components/PullToRefresh';

type Filter = 'All Parks' | 'Visited' | 'Bucket List' | 'Planned' | 'Not Visited';

const FILTERS: Filter[] = ['All Parks', 'Visited', 'Bucket List', 'Planned', 'Not Visited'];

// Bucket List filters on the independent `isFavorite` flag, not `status` —
// every other filter maps straight to a ParkStatus value.
const STATUS_MAP: Partial<Record<Filter, ParkStatus>> = {
  'Visited': 'visited',
  'Planned': 'planned',
  'Not Visited': 'notVisited',
};

export default function ExploreScreen() {
  const { parks, stats, toggleFavorite, updateParkStatus } = useApp();
  const refreshControl = usePullToRefresh();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<Filter>('All Parks');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = parks;
    if (filter === 'Bucket List') {
      list = list.filter((p) => p.isFavorite);
    } else {
      const status = STATUS_MAP[filter];
      if (status) list = list.filter((p) => p.status === status);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.state.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [parks, filter, search]);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Parks</Text>
        <Text style={styles.subtitle}>{stats.totalVisited} / {stats.totalParks} visited</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search parks..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillsScroll}
        contentContainerStyle={styles.pills}
      >
        {FILTERS.map((f) => (
          <FilterPill key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />
        ))}
      </ScrollView>

      {/* Park list */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
      >
        {filtered.map((park) => (
          <ParkCard
            key={park.id}
            park={park}
            onPress={() => navigation.navigate('ParkDetail', { parkId: park.id })}
            onFavorite={() => toggleFavorite(park.id)}
            onToggleVisited={() => updateParkStatus(park.id, park.status === 'visited' ? 'notVisited' : 'visited')}
          />
        ))}
        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Image source={require('@/assets/mascot/mascot-thinking.png')} style={styles.emptyIcon} resizeMode="contain" />
            <Text style={styles.emptyText}>No parks found. Try a different filter!</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing['2xl'], paddingBottom: spacing.sm, gap: 2 },
  title: { ...typography.h3, color: colors.textPrimary },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary },

  searchRow: { paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md, ...shadows.sm },
  searchInput: { flex: 1, height: 44, ...typography.body, color: colors.textPrimary },

  pillsScroll: { flexGrow: 0, flexShrink: 0 },
  pills: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md, alignItems: 'flex-start' },

  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing['5xl'] },
  empty: { alignItems: 'center', paddingTop: spacing['3xl'], gap: spacing.md },
  emptyIcon: { width: 72, height: 72 },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
