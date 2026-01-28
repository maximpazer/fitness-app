import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface RestTimerProps {
    timeRemaining: number;
    onSkip: () => void;
    onAddTime: (seconds: number) => void;
}

export const RestTimer: React.FC<RestTimerProps> = ({
    timeRemaining,
    onSkip,
    onAddTime
}) => {
    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <View className="absolute bottom-0 left-0 right-0 bg-gray-950 p-6 border-t border-gray-900 shadow-2xl">
            <View className="flex-row items-center justify-between mb-4">
                <Text className="text-gray-400 font-bold uppercase tracking-widest text-xs">Resting</Text>
                <TouchableOpacity onPress={onSkip}>
                    <Ionicons name="close-circle" size={24} color="#6b7280" />
                </TouchableOpacity>
            </View>

            <View className="flex-row items-center justify-between">
                <View className="items-start">
                    <Text className="text-white text-5xl font-black font-mono leading-tight">
                        {formatTime(timeRemaining)}
                    </Text>
                </View>

                <View className="flex-row gap-3">
                    <TouchableOpacity
                        onPress={() => onAddTime(30)}
                        className="bg-gray-800 px-4 h-12 rounded-xl items-center justify-center border border-gray-700 active:bg-gray-700"
                    >
                        <Text className="text-white font-bold text-sm">+30s</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onSkip}
                        className="bg-blue-600 px-6 h-12 rounded-xl items-center justify-center shadow-lg shadow-blue-500/20 active:bg-blue-700"
                    >
                        <Text className="text-white font-bold text-sm uppercase tracking-wide">Skip</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};
