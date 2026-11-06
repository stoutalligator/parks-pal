import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius, spacing, typography, fontFamilies } from '@/theme';
import { selectHaptic } from '@/utils/haptics';

interface Props<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}

export default function SegmentedToggle<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.track}>
      {options.map((option) => {
        const active = option === value;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.segment, active && styles.segmentActive]}
            activeOpacity={0.8}
            onPress={() => {
              if (!active) selectHaptic();
              onChange(option);
            }}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  label: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.textInverse,
    fontFamily: fontFamilies.bodyBold,
  },
});
