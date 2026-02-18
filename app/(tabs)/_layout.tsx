import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';

import { ActiveWorkoutBanner } from '@/components/ActiveWorkoutBanner';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.dark.tint,
          tabBarInactiveTintColor: Colors.dark.tabIconDefault,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: Platform.select({
            ios: {
              // Use a transparent background on iOS to show the BlurView
              position: 'absolute',
              backgroundColor: '#030712',
              borderTopColor: '#1f2937',
            },
            default: {
              backgroundColor: '#030712',
              borderTopColor: '#1f2937',
            },
          }),
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="planner"
          options={{
            title: 'Planner',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
          }}
        />

        <Tabs.Screen
          name="chat"
          options={{
            title: 'AI Coach',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="message.fill" color={color} />,
          }}
        />
      </Tabs>
      <ActiveWorkoutBanner />
    </View>
  );
}
