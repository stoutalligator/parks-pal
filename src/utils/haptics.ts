import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Small wrappers so call sites stay one word. Haptics aren't available on
// web, and a missing haptic engine must never break the action it decorates.
const run = (fn: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
  fn().catch(() => {});
};

/** A light tap: hearts, checkmarks, toggles. */
export const tapHaptic = () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Moving between options: filters, switches. */
export const selectHaptic = () => run(() => Haptics.selectionAsync());

/** Something worth celebrating: trip saved, badge earned, park stamped. */
export const successHaptic = () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
