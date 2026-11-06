import React from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '@/context/AppContext';
import { Trip } from '@/types';
import { colors, spacing, radius, shadows, typography } from '@/theme';
import TripCard from '@/components/TripCard';
import EmptyState from '@/components/EmptyState';
import { usePullToRefresh } from '@/components/PullToRefresh';

function AddTripButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.addBtn} onPress={onPress} hitSlop={10} activeOpacity={0.8}>
      <Text style={styles.addBtnIcon}>+</Text>
    </TouchableOpacity>
  );
}

export default function TripsScreen() {
  const { trips } = useApp();
  const refreshControl = usePullToRefresh();
  const navigation = useNavigation<any>();
  const openChooser = () => navigation.navigate('LogTrip', { screen: 'TripChooser' });

  if (trips.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Trips</Text>
          <AddTripButton onPress={openChooser} />
        </View>
        <EmptyState
          title="No adventures logged yet."
          subtitle="Ready to save your first trail memory?"
          actionLabel="Log First Trip"
          onAction={openChooser}
        />
      </SafeAreaView>
    );
  }

  const plannedTrips = trips
    .filter((t) => t.tripType === 'planned')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const loggedTrips = trips
    .filter((t) => t.tripType === 'logged')
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const sections: { title: string; data: Trip[] }[] = [
    ...(plannedTrips.length ? [{ title: 'Planned Trips', data: plannedTrips }] : []),
    ...(loggedTrips.length ? [{ title: 'Logged Trips', data: loggedTrips }] : []),
  ];

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trips</Text>
        <AddTripButton onPress={openChooser} />
      </View>
      <SectionList
        refreshControl={refreshControl}
        sections={sections}
        keyExtractor={(trip) => trip.id}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            onPress={() => navigation.navigate('TripDetail', { tripId: item.id })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.sm,
  },
  title: { ...typography.h3, color: colors.textPrimary },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  addBtnIcon: { fontSize: 20, lineHeight: 22, color: colors.textInverse },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing['5xl'] },
  sectionTitle: {
    ...typography.labelBold,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
