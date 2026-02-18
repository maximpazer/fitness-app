import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
import '../global.css';

import { WorkoutLoggerOverlay } from '@/components/WorkoutLoggerOverlay';
import { AuthProvider, useAuthContext } from '@/context/AuthContext';
import { NumericKeypadProvider } from '@/context/NumericKeypadContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, loading, profile } = useAuthContext();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onOnboarding = segments[0] === 'onboarding';
    const user = session?.user;

    const isProfileComplete = !!(profile?.fitness_level && profile?.primary_goal && profile?.training_days_per_week);

    if (!user) {
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    // Authenticated — auto-redirect to onboarding if profile is incomplete
    if (!isProfileComplete && !onOnboarding) {
      router.replace('/onboarding');
      return;
    }

    // Let users navigate to onboarding manually (e.g. from settings)
    // so do NOT redirect away from onboarding when profile is complete.

    if (inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, profile]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#000' : '#fff' }}>
          <ActivityIndicator size="large" color={colorScheme === 'dark' ? '#fff' : '#3b82f6'} />
        </View>
      ) : (
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ title: 'Profile', headerBackTitle: 'Back' }} />
          <Stack.Screen name="workout/summary/[id]" options={{ presentation: 'card', headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
      )}
      <StatusBar style="auto" />
      <WorkoutLoggerOverlay />
    </ThemeProvider>
  );
}

import { AIChatProvider } from '@/context/AIChatContext';
import { PlanProvider } from '@/context/PlanContext';
import { WorkoutProvider } from '@/context/WorkoutContext';
import { DialogProvider } from '@/hooks/useConfirmDialog';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

function AppProviders({ children }: { children: React.ReactNode }) {
  const { session } = useAuthContext();
  return (
    <PlanProvider userId={session?.user?.id || null}>
      <AIChatProvider>
        {children}
      </AIChatProvider>
    </PlanProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <WorkoutProvider>
            <DialogProvider>
              <AppProviders>
                <NumericKeypadProvider>
                  <RootLayoutNav />
                </NumericKeypadProvider>
              </AppProviders>
            </DialogProvider>
          </WorkoutProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
