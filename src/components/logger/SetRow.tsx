import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface SetRowProps {
    setNumber: number;
    weight: string;
    reps: string;
    prevWeight?: string;
    prevReps?: string;
    isCompleted: boolean;
    isWarmup: boolean;
    isActiveField?: 'weight' | 'reps' | null;
    onFocus: (field: 'weight' | 'reps') => void;
    onComplete: () => void;
}

export const SetRow: React.FC<SetRowProps> = ({
    setNumber,
    weight,
    reps,
    prevWeight,
    prevReps,
    isCompleted,
    isWarmup,
    isActiveField,
    onFocus,
    onComplete
}) => {
    return (
        <View className={`flex-row items-center py-3 border-b border-gray-800 ${isCompleted ? 'opacity-50' : 'opacity-100'}`}>
            {/* Set Indicator */}
            <View className="w-10 justify-center items-center">
                <Text className={`font-bold ${isWarmup ? 'text-orange-500' : 'text-gray-400'}`}>
                    {setNumber}
                </Text>
            </View>

            {/* Inputs - Spreadsheet Style triggers */}
            <View className="flex-1 flex-row gap-4 px-2">

                {/* Weight Trigger */}
                <TouchableOpacity
                    onPress={() => onFocus('weight')}
                    className={`flex-1 rounded-lg overflow-hidden border p-3 items-center justify-center ${isActiveField === 'weight' ? 'bg-blue-900/20 border-blue-500' : 'bg-gray-900 border-gray-800'}`}
                >
                    {weight ? (
                        <Text className={`font-black text-xl ${isCompleted ? 'text-gray-500' : 'text-white'}`}>{weight}</Text>
                    ) : (
                        <Text className="text-gray-700 font-bold text-xl">{prevWeight || '-'}</Text>
                    )}
                    {!weight && prevWeight && <Text className="text-gray-700 text-[8px] absolute top-1 right-1">PREV</Text>}
                </TouchableOpacity>

                {/* Reps Trigger */}
                <TouchableOpacity
                    onPress={() => onFocus('reps')}
                    className={`flex-1 rounded-lg overflow-hidden border p-3 items-center justify-center ${isActiveField === 'reps' ? 'bg-blue-900/20 border-blue-500' : 'bg-gray-900 border-gray-800'}`}
                >
                    {reps ? (
                        <Text className={`font-medium text-lg ${isCompleted ? 'text-gray-500' : 'text-white'}`}>{reps}</Text>
                    ) : (
                        <Text className="text-gray-700 font-medium text-lg">{prevReps || '-'}</Text>
                    )}
                    {!reps && prevReps && <Text className="text-gray-700 text-[8px] absolute top-1 right-1">PREV</Text>}
                </TouchableOpacity>
            </View>

            {/* Checkbox */}
            <TouchableOpacity
                onPress={onComplete}
                className={`w-12 h-12 items-center justify-center rounded-xl ml-2 ${isCompleted ? 'bg-green-600/20' : 'bg-gray-800'}`}
            >
                <Ionicons
                    name={isCompleted ? "checkmark" : "checkmark-outline"}
                    size={24}
                    color={isCompleted ? "#4ade80" : "#4b5563"}
                />
            </TouchableOpacity>
        </View>
    );
};
