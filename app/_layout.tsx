import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';

import { WorkoutLoggerOverlay } from '@/components/WorkoutLoggerOverlay';
import { AuthProvider, useAuthContext } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
    const user = session?.user;
    const isProfileComplete = profile?.fitness_level; // Simple check

    if (!user && !inAuthGroup) {
      // Redirect to the sign-in page.
      router.replace('/(auth)/login');
    } else if (user) {
      if (!isProfileComplete) {
        // Force onboarding if profile is incomplete
        if (segments[0] !== 'onboarding') {
          router.replace('/onboarding');
        }
      } else if (inAuthGroup || segments[0] === 'onboarding') {
        // Redirect away from auth/onboarding if profile is complete
        router.replace('/(tabs)');
      }
    }
  }, [session, loading, segments, profile]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {!loading && (
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
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

import { PlanProvider } from '@/context/PlanContext';
import { WorkoutProvider } from '@/context/WorkoutContext';
import { DialogProvider } from '@/hooks/useConfirmDialog';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

function AppProviders({ children }: { children: React.ReactNode }) {
  const { session } = useAuthContext();
  return (
    <PlanProvider userId={session?.user?.id || null}>
      {children}
    </PlanProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <WorkoutProvider>
          <DialogProvider>
            <AppProviders>
              <RootLayoutNav />
            </AppProviders>
          </DialogProvider>
        </WorkoutProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
