import { useWorkout } from '@/context/WorkoutContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const ActiveWorkoutBanner = () => {
    const { activeWorkout, duration, isMaximized, setIsMaximized } = useWorkout();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    if (!activeWorkout || isMaximized) return null;

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setIsMaximized(true)}
            style={{ top: insets.top + 8 }}
            className="absolute left-4 right-4 bg-blue-600 rounded-2xl flex-row items-center p-4 shadow-xl shadow-blue-500/30 z-50"
        >
            <View className="bg-white/20 p-2 rounded-full mr-3">
                <Ionicons name="fitness" size={20} color="white" />
            </View>
            <View className="flex-1">
                <Text className="text-white font-bold text-sm">{activeWorkout.name}</Text>
                <Text className="text-blue-100 text-xs">{activeWorkout.exercises.length} exercises • {formatTime(duration)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="white" />
        </TouchableOpacity>
    );
};
