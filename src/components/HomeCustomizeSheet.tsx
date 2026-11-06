import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography } from '@/theme';
import { selectHaptic } from '@/utils/haptics';
import AnimatedSheet from './AnimatedSheet';

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

  return (
    <AnimatedSheet visible={visible} onClose={onClose} style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
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
              onValueChange={(shown) => {
                selectHaptic();
                option.onChange(shown);
              }}
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
    </AnimatedSheet>
  );
}

const styles = StyleSheet.create({
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
