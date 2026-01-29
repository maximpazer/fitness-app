import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SessionHeaderProps {
    workoutName: string;
    durationSeconds: number;
    volumeKg: number;
    onExit: () => void;
}

export const SessionHeader: React.FC<SessionHeaderProps> = ({
    workoutName,
    durationSeconds,
    volumeKg,
    onExit
}) => {
    const insets = useSafeAreaInsets();

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <View style={{ paddingTop: insets.top }} className="bg-gray-800 border-b border-gray-700">
            {/* Drag Handle Area (Visual only, pan gesture handles logic) */}
            <View className="items-center py-2">
                <View className="w-12 h-1.5 bg-gray-600 rounded-full" />
            </View>

            <View className="px-4 pb-3 flex-row justify-between items-center">
                {/* Left: Info & Exit */}
                <View className="flex-row items-center flex-1 mr-4">
                    <TouchableOpacity
                        onPress={onExit}
                        className="w-10 h-10 items-center justify-center -ml-2 rounded-full bg-gray-700/50 active:bg-gray-700"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="close" size={28} color="#d1d5db" />
                    </TouchableOpacity>
                    <View className="flex-1 px-2">
                        <Text className="text-white font-bold text-lg leading-tight" numberOfLines={1}>
                            {workoutName}
                        </Text>
                        <Text className="text-gray-400 text-xs font-medium">
                            {format(new Date(), 'MMM d, yyyy')}
                        </Text>
                    </View>
                </View>

                {/* Right: Stats & Actions */}
                <View className="flex-row items-center">
                    <View className="items-end bg-gray-700/30 px-3 py-2 rounded-xl">
                        <Text className="text-white font-mono text-xl font-black tracking-tight">
                            {formatTime(durationSeconds)}
                        </Text>
                        <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                            {volumeKg.toLocaleString()} kg
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
};
