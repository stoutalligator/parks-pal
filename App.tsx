import React from 'react';
import { View, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, FredokaOne_400Regular } from '@expo-google-fonts/fredoka-one';
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { AppProvider } from '@/context/AppContext';
import RootNavigator from '@/navigation/RootNavigator';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ToastHost } from '@/components/Toast';
import SyncBanner from '@/components/SyncBanner';
import { BadgeEarnedModalHost } from '@/components/BadgeEarnedModal';
import { VisitStampHost } from '@/components/VisitStamp';
import { navigationRef } from '@/navigation/navigationRef';
import { colors, radius, shadows } from '@/theme';
import { initSentry } from '@/lib/sentry';

// Keep the native splash (splash-icon.png) up until fonts, the session and
// the user's data are ready — RootNavigator hides it — instead of it
// auto-hiding on JS bundle load and flashing a blank frame and then a
// spinner. SplashScreen.hideAsync() is a no-op on web.
SplashScreen.preventAutoHideAsync().catch(() => {});
initSentry();

export default function App() {
  const [fontsLoaded] = useFonts({
    FredokaOne_400Regular,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const app = (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AppProvider>
            <NavigationContainer ref={navigationRef}>
              <RootNavigator />
            </NavigationContainer>
            <SyncBanner />
            <ToastHost />
            <BadgeEarnedModalHost />
            <VisitStampHost />
          </AppProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );

  if (Platform.OS !== 'web') {
    return app;
  }

  // ?screenshot=1 skips the rounded phone-frame chrome below — used only to
  // capture edge-to-edge store screenshots from the web preview, where a
  // baked-in bezel/rounded-corner artifact would misrepresent the real
  // native screen.
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('screenshot') === '1') {
    return app;
  }

  // Constrain to a phone-sized frame on web so the layout isn't stretched full-width.
  return (
    <View style={styles.webBackdrop}>
      <View style={styles.webFrame}>{app}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  webBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
  },
  webFrame: {
    width: '100%',
    maxWidth: 430,
    height: '100%',
    maxHeight: 932,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    ...shadows.lg,
  },
});
