import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography } from '@/theme';

export interface HomeCardOption {
  key: string;
  label: string;
  description: string;
  shown: boolean;
  onChange: (shown: boolean) => void;
}

interface Props {
  visible: boolean;
  options: HomeCardOption[];
  onClose: () => void;
}

export default function HomeCustomizeSheet({ visible, options, onClose }: Props) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
        <View style={styles.titleRow}>
          <Image source={require('@/assets/mascot/mascot-tip.png')} style={styles.mascot} resizeMode="contain" />
          <View style={styles.titleText}>
            <Text style={styles.title}>Customize Home</Text>
            <Text style={styles.subtitle}>Hide cards to give the map more room. You can turn them back on here anytime.</Text>
          </View>
        </View>

        {options.map((option) => (
          <View key={option.key} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{option.label}</Text>
              <Text style={styles.rowDescription} numberOfLines={2}>
                {option.description}
              </Text>
            </View>
            <Switch
              value={option.shown}
              onValueChange={option.onChange}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.border}
              accessibilityLabel={`Show ${option.label}`}
            />
          </View>
        ))}

        <TouchableOpacity onPress={onClose} style={styles.done} hitSlop={8}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mascot: { width: 40, height: 46 },
  titleText: { flex: 1, gap: 2 },
  title: { ...typography.h5, color: colors.textPrimary },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...typography.labelBold, color: colors.textPrimary },
  rowDescription: { ...typography.bodySmall, color: colors.textSecondary },

  done: { alignSelf: 'center', paddingVertical: spacing.xs },
  doneText: { ...typography.labelBold, color: colors.primary },
});
