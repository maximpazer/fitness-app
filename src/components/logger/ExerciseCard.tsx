import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SetRow } from './SetRow';

interface ExerciseCardProps {
    exercise: any;
    isExpanded: boolean;
    historySets?: any[];
    activeFieldId?: string;
    localInputValue?: string;
    onFocusField: (setIdx: number, field: 'weight' | 'reps') => void;
    onCompleteSet: (setIdx: number) => void;
    onAddSet: () => void;
    onRemoveSet: (setIdx: number) => void;
    onShowInfo: () => void;
    onToggleExpand: () => void;
    onStopResting?: () => void;
}


const ExerciseCardComponent: React.FC<ExerciseCardProps> = ({
    exercise,
    isExpanded,
    historySets,
    activeFieldId,
    localInputValue,
    onFocusField,
    onCompleteSet,
    onAddSet,
    onRemoveSet,
    onShowInfo,
    onToggleExpand,
    onStopResting
}) => {
    // Calculate summary stats
    const totalSets = exercise.sets.length;
    const completedSets = exercise.sets.filter((s: any) => s.completed).length;
    const isAllCompleted = totalSets > 0 && totalSets === completedSets;

    // Calculate total volume or max weight for summary
    const maxWeight = exercise.sets.reduce((max: number, s: any) => {
        const w = parseFloat(s.weight) || 0;
        return w > max ? w : max;
    }, 0);

    const totalReps = exercise.sets.reduce((sum: number, s: any) => {
        return sum + (parseInt(s.reps) || 0);
    }, 0);

    const renderRightActions = (setIdx: number) => {
        return (
            <TouchableOpacity
                onPress={() => onRemoveSet(setIdx)}
                className="bg-red-500/90 justify-center items-center w-20 rounded-xl my-1 ml-2"
                activeOpacity={0.7}
            >
                <Ionicons name="trash-outline" size={24} color="white" />
                <Text className="text-white text-[10px] font-bold uppercase mt-1">Delete</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View className={`bg-gray-800 mb-4 rounded-2xl overflow-hidden border ${isExpanded ? 'border-blue-500/30' : 'border-gray-700'} shadow-lg`}>

            {/* Header - Always Visible / Toggleable */}
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onToggleExpand}
                className={`p-4 flex-row justify-between items-center ${isExpanded ? 'border-b border-gray-700 bg-gray-750' : 'bg-gray-800'}`}
            >
                <View className="flex-1">
                    {/* Top Row: Title and Metadata/Actions */}
                    <View className="flex-row justify-between items-start mb-2">
                        <Text className="font-bold text-lg leading-tight text-white flex-1 mr-4" numberOfLines={2}>
                            {exercise.name}
                        </Text>
                        <View className="flex-row items-center">
                            {isExpanded && (
                                <TouchableOpacity onPress={(e) => { e.stopPropagation(); onShowInfo(); }} className="p-1.5 bg-gray-700 rounded-full mr-2">
                                    <Ionicons name="information-circle-outline" size={18} color="#9ca3af" />
                                </TouchableOpacity>
                            )}
                            <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#6b7280" />
                        </View>
                    </View>

                    {/* Progress Bar Row */}
                    <View className="flex-row items-center mb-2">
                        <View className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden mr-3" style={{ backgroundColor: '#2a2a2a' }}>
                            <View
                                style={{
                                    width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%`,
                                    height: '100%',
                                    backgroundColor: '#4CAF50'
                                }}
                            />
                        </View>
                        <Text className="text-gray-500 text-xs font-semibold">{completedSets}/{totalSets} sets</Text>
                    </View>

                    <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-wide">
                        <Text className="text-blue-400">{exercise.target_muscle || 'Target'}</Text> • {totalReps} Reps
                    </Text>
                </View>
            </TouchableOpacity>

            {/* Expanded Content */}
            {isExpanded && (
                <>
                    {/* Column Headers */}
                    <View className="flex-row px-4 py-3 bg-gray-700/50">
                        <Text className="w-10 text-center text-gray-400 text-[10px] font-bold uppercase">Set</Text>
                        <View className="flex-1 flex-row gap-4 px-2">
                            <Text className="flex-1 text-center text-gray-400 text-[10px] font-bold uppercase">Weight</Text>
                            <Text className="flex-1 text-center text-gray-400 text-[10px] font-bold uppercase">Reps</Text>
                        </View>
                        <Text className="w-12 text-center text-gray-400 text-[10px] font-bold uppercase">Done</Text>
                    </View>

                    {/* Sets List */}
                    <View className="px-2 pb-2">
                        {exercise.sets.map((set: any, idx: number) => {
                            const prevSet = historySets && historySets[idx];
                            const isWeightActive = activeFieldId === `${exercise.exerciseId}-${idx}-weight`;
                            const isRepsActive = activeFieldId === `${exercise.exerciseId}-${idx}-reps`;


                            return (
                                <Swipeable
                                    key={`${exercise.exerciseId}-${idx}`}
                                    renderRightActions={() => renderRightActions(idx)}
                                    friction={2}
                                    rightThreshold={40}
                                >
                                    <SetRow
                                        setNumber={set.setNumber}
                                        weight={isWeightActive && localInputValue !== undefined ? localInputValue : set.weight}
                                        reps={isRepsActive && localInputValue !== undefined ? localInputValue : set.reps}
                                        prevWeight={prevSet?.weight_kg?.toString()}
                                        prevReps={prevSet?.reps?.toString()}
                                        isCompleted={set.completed}
                                        isWarmup={set.isWarmup}
                                        isActiveField={isWeightActive ? 'weight' : isRepsActive ? 'reps' : null}
                                        onFocus={(field: 'weight' | 'reps') => onFocusField(idx, field)}
                                        onComplete={() => onCompleteSet(idx)}
                                    />
                                </Swipeable>
                            );
                        })}
                    </View>

                    {/* Footer - Add Set */}
                    <TouchableOpacity
                        onPress={onAddSet}
                        className="py-3 items-center border-t border-gray-800/50 active:bg-gray-900/50"
                    >
                        <View className="flex-row items-center opacity-60">
                            <Ionicons name="add" size={16} color="#3b82f6" />
                            <Text className="text-blue-500 text-xs font-bold ml-2 uppercase tracking-wide">Add Set</Text>
                        </View>
                    </TouchableOpacity>
                </>
            )}
        </View>
    );
};

// Memoize to prevent unnecessary re-renders during input
export const ExerciseCard = memo(ExerciseCardComponent);
