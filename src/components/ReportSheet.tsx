import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useApp } from '@/context/AppContext';
import { colors, spacing, radius, shadows, typography } from '@/theme';
import { ContentEntryType, ContentReportReason } from '@/types';
import PrimaryButton from '@/components/PrimaryButton';
import AnimatedSheet from '@/components/AnimatedSheet';
import { showToast } from '@/components/Toast';

const MASCOT_THINKING = require('@/assets/mascot/mascot-thinking.png');

const NOTE_MAX = 500;
const OTHER_NOTE_MIN = 5;

const REASONS: Record<ContentEntryType, { value: ContentReportReason; label: string }[]> = {
  trail: [
    { value: 'distance_elevation', label: 'Distance or elevation' },
    { value: 'closed_or_permit', label: 'Closed or permit info' },
    { value: 'difficulty', label: 'Difficulty' },
    { value: 'wrong_park', label: 'Wrong park' },
    { value: 'other', label: 'Something else' },
  ],
  animal: [
    { value: 'not_found_here', label: 'Not found here' },
    { value: 'rarity', label: 'Rarity feels off' },
    { value: 'tip_wrong', label: 'Tip is unsafe or wrong' },
    { value: 'other', label: 'Something else' },
  ],
};

export function ReportFlagButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.flagBtn}
      onPress={onPress}
      hitSlop={10}
      accessibilityLabel="Report a problem with this page"
    >
      <Svg width={16} height={16} viewBox="0 0 16 16">
        <Path
          d="M4 14V2.5M4 3h8.2l-1.7 2.6 1.7 2.6H4"
          fill="none"
          stroke={colors.textPrimary}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </TouchableOpacity>
  );
}

interface Props {
  visible: boolean;
  onClose: () => void;
  entryType: ContentEntryType;
  entryId: string;
  entryName: string;
  parkId: string;
}

export default function ReportSheet({ visible, onClose, entryType, entryId, entryName, parkId }: Props) {
  const { submitContentReport } = useApp();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ContentReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) {
      setReason(null);
      setNote('');
      setSending(false);
    }
  }, [visible]);

  const needsNote = reason === 'other';
  const canSend = !!reason && !sending && (!needsNote || note.trim().length >= OTHER_NOTE_MIN);

  const send = async () => {
    if (!reason) return;
    setSending(true);
    const ok = await submitContentReport({ entryType, entryId, entryName, parkId, reason, note });
    if (ok) {
      showToast("Thanks, we'll check it out.", 'success');
      onClose();
    } else {
      setSending(false);
    }
  };

  return (
    <AnimatedSheet visible={visible} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
          <View style={styles.titleRow}>
            <Image source={MASCOT_THINKING} style={styles.mascot} resizeMode="contain" />
            <View style={styles.titleText}>
              <Text style={styles.title}>Spot something off?</Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                Tell the rangers what looks wrong about {entryName}. Reports are reviewed every week.
              </Text>
            </View>
          </View>

          <View style={styles.chipRow}>
            {REASONS[entryType].map((option) => {
              const selected = option.value === reason;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.chip, selected && styles.chipSelected]}
                  activeOpacity={0.8}
                  onPress={() => setReason(option.value)}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            value={note}
            onChangeText={setNote}
            placeholder={needsNote ? 'What did you notice?' : 'What did you notice? (optional)'}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={NOTE_MAX}
            textAlignVertical="top"
          />
          <Text style={styles.counter}>
            {note.length}/{NOTE_MAX}
          </Text>

          <PrimaryButton label={sending ? 'Sending...' : 'Send to the rangers'} onPress={send} disabled={!canSend} />
          <TouchableOpacity onPress={onClose} style={styles.cancel} hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </AnimatedSheet>
  );
}

const styles = StyleSheet.create({
  flagBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
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

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.labelSemiBold, color: colors.brownDark },
  chipTextSelected: { color: colors.textInverse },

  input: {
    minHeight: 84,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  counter: { ...typography.caption, color: colors.textMuted, textAlign: 'right', marginTop: -spacing.sm },

  cancel: { alignSelf: 'center', paddingVertical: spacing.xs },
  cancelText: { ...typography.labelSemiBold, color: colors.textSecondary },
});
