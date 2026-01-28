import { Database } from '@/lib/database.types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Dimensions, FlatList, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ExerciseVideoModal } from './ExerciseVideoModal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type Exercise = Database['public']['Tables']['exercises']['Row'];

interface ExercisePickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (exercise: Exercise) => void;
    allExercises: Exercise[];
}

const FILTER_CATEGORIES = {
    muscles: {
        label: 'Muscle groups',
        options: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs', 'Core', 'Cardio']
    },
    equipment: {
        label: 'Equipment',
        options: ['Barbell', 'Dumbbell', 'Kettlebell', 'Cable', 'Machine', 'Bodyweight', 'Bands', 'Medicine Ball', 'Stability Ball']
    },
    mechanics: {
        label: 'Mechanics',
        options: ['Compound', 'Isolation']
    },
    movement: {
        label: 'Movement Type',
        options: ['Push', 'Pull', 'Squat', 'Hinge', 'Lunge', 'Carry', 'Static']
    }
};

export const ExercisePickerModal: React.FC<ExercisePickerModalProps> = ({
    visible,
    onClose,
    onSelect,
    allExercises
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({
        muscles: [] as string[],
        equipment: [] as string[],
        mechanics: [] as string[],
        movement: [] as string[]
    });
    const [isFilterExpanded, setIsFilterExpanded] = useState(false);
    const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);

    const toggleFilter = (category: keyof typeof filters, value: string) => {
        setFilters(prev => ({
            ...prev,
            [category]: prev[category].includes(value)
                ? prev[category].filter(v => v !== value)
                : [...prev[category], value]
        }));
    };

    const clearAllFilters = () => {
        setFilters({
            muscles: [],
            equipment: [],
            mechanics: [],
            movement: []
        });
        setSearchQuery('');
    };

    const activeFilterCount = Object.values(filters).flat().length;

    const filteredExercises = useMemo(() => {
        return allExercises.filter(ex => {
            // 1. Search Filter
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const matchesSearch = ex.name.toLowerCase().includes(query) ||
                    ex.category?.toLowerCase().includes(query) ||
                    ex.muscle_groups?.some(mg => mg.toLowerCase().includes(query));
                if (!matchesSearch) return false;
            }

            // 2. Muscles Filter (Union within category)
            // 2. Muscles Filter (Union within category)
            if (filters.muscles.length > 0) {
                const matchesMuscle = filters.muscles.some(selected => {
                    const s = selected.toLowerCase();

                    // Check Primary Target Muscle First (if available)
                    if (ex.target_muscle) {
                        const targetLower = ex.target_muscle.toLowerCase();
                        // Handle mappings for different terminology against TARGET muscle
                        if (s === 'abs' && targetLower.includes('abdominal')) return true;
                        if (s === 'quads' && targetLower.includes('quadricep')) return true;
                        if (s === 'chest' && targetLower.includes('pectoralis')) return true;
                        if (s === 'back' && (targetLower.includes('latissimus') || targetLower.includes('trapezius'))) return true;
                        if (s === 'glutes' && targetLower.includes('glute')) return true;
                        if (s === 'hamstrings' && targetLower.includes('hamstring')) return true;
                        if (s === 'calves' && (targetLower.includes('calf') || targetLower.includes('gastrocnemius'))) return true;
                        if (s === 'shoulders' && targetLower.includes('deltoid')) return true;
                        if (s === 'biceps' && targetLower.includes('biceps')) return true;
                        if (s === 'triceps' && targetLower.includes('triceps')) return true;

                        // Direct match
                        if (targetLower.includes(s)) return true;
                    }

                    // Fallback to broader muscle_groups array if target_muscle didn't match (or if you want to include secondary)
                    // Currently using strict logic: if target is defined, we prefer that. 
                    // But if user wants broader search, we can check array too.
                    // Let's check array if target didn't match OR wasn't present.
                    // Actually, to solve user problem, we should be strict if target is available?
                    // "make exercise filtering intuitive and focused"
                    // So if target_muscle is present, we should probably ONLY check that for "Abs".
                    // But for "Full Body", it might be different. 

                    // Let's stick to the overlap logic but prioritize clarity.
                    // If target_muscle exists, we assume that's the "primary" one.
                    if (ex.target_muscle) return false; // If target didn't match above, fail this filter

                    // Old overlap logic as fallback for exercises without new metadata
                    return ex.muscle_groups?.some(mg => {
                        const mgLower = mg.toLowerCase();
                        if (mgLower.includes(s)) return true;
                        if (s === 'abs' && mgLower.includes('abdominal')) return true;
                        if (s === 'quads' && mgLower.includes('quadricep')) return true;
                        if (s === 'core' && (mgLower.includes('abdominal') || mgLower.includes('oblique') || ex.category === 'core')) return true;
                        if (s === 'chest' && mgLower.includes('pectoralis')) return true;
                        if (s === 'back' && (mgLower.includes('latissimus') || mgLower.includes('trapezius') || mgLower.includes('rhomboid'))) return true;
                        if (s === 'legs' && (mgLower.includes('quadricep') || mgLower.includes('hamstring') || mgLower.includes('glute') || mgLower.includes('calf'))) return true;
                        if (s === 'cardio' && ex.category === 'cardio') return true;
                        return false;
                    });
                });

                if (!matchesMuscle) return false;
            }

            // 3. Equipment Filter (Union within category)
            if (filters.equipment.length > 0) {
                const matchesEquip = ex.equipment_needed?.some(eq => {
                    const eqLower = eq.toLowerCase();
                    return filters.equipment.some(selected => {
                        const s = selected.toLowerCase();
                        // Handle 'none' or 'bodyweight' as aliases
                        if (s === 'bodyweight' && (eqLower === 'none' || eqLower.includes('bodyweight'))) return true;
                        return eqLower.includes(s);
                    });
                });
                if (!matchesEquip) return false;
            }

            // 4. Mechanics Filter (Union within category)
            if (filters.mechanics.length > 0) {
                const matchesMech = filters.mechanics.some(m => {
                    const selected = m.toLowerCase();
                    const value = ex.mechanics?.toLowerCase() || '';
                    if (value.includes(selected)) return true;

                    // Fallback to is_compound column
                    if (selected === 'compound' && ex.is_compound) return true;
                    if (selected === 'isolation' && ex.is_compound === false) return true;

                    return false;
                });
                if (!matchesMech) return false;
            }

            // 5. Movement Type Filter (Union within category)
            if (filters.movement.length > 0) {
                const matchesMov = filters.movement.some(m =>
                    ex.movement_type?.toLowerCase().includes(m.toLowerCase())
                );
                if (!matchesMov) return false;
            }

            return true;
        });
    }, [allExercises, filters, searchQuery]);

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity
                    activeOpacity={1}
                    style={styles.backdrop}
                    onPress={onClose}
                />
                <View style={styles.modalContainer}>
                    <View className="flex-row justify-between items-center mb-6">
                        <View>
                            <Text className="text-white font-bold text-2xl tracking-tight">Select Exercise</Text>
                            <Text className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">
                                {filteredExercises.length} results found
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="bg-gray-800 p-2 rounded-full">
                            <Ionicons name="close" size={24} color="#6b7280" />
                        </TouchableOpacity>
                    </View>

                    {/* Search & Filter Header */}
                    <View className="flex-row gap-3 mb-6">
                        <View className="flex-1 bg-gray-800 rounded-2xl flex-row items-center px-4 py-3 border border-gray-700">
                            <Ionicons name="search" size={20} color="#4b5563" />
                            <TextInput
                                className="flex-1 ml-3 text-white font-medium"
                                placeholder="Search exercises..."
                                placeholderTextColor="#4b5563"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                clearButtonMode="while-editing"
                            />
                        </View>
                        <TouchableOpacity
                            onPress={() => setIsFilterExpanded(!isFilterExpanded)}
                            className={`px-4 rounded-2xl border flex-row items-center ${isFilterExpanded || activeFilterCount > 0 ? 'bg-blue-600 border-blue-500' : 'bg-gray-800 border-gray-700'}`}
                        >
                            <Ionicons name="options-outline" size={20} color={isFilterExpanded || activeFilterCount > 0 ? 'white' : '#6b7280'} />
                            {activeFilterCount > 0 && (
                                <View className="ml-2 bg-white rounded-full w-5 h-5 items-center justify-center">
                                    <Text className="text-blue-600 text-[10px] font-black">{activeFilterCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Expandable Filter Section */}
                    {isFilterExpanded && (
                        <View className="mb-6 bg-gray-800/30 rounded-3xl p-4 border border-gray-800">
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Advanced Filters</Text>
                                {activeFilterCount > 0 && (
                                    <TouchableOpacity onPress={clearAllFilters}>
                                        <Text className="text-blue-400 text-xs font-bold">Clear All</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <ScrollView showsVerticalScrollIndicator={false} className="max-h-60">
                                {(Object.entries(FILTER_CATEGORIES) as [keyof typeof filters, typeof FILTER_CATEGORIES.muscles][]).map(([key, category]) => (
                                    <View key={key} className="mb-4">
                                        <Text className="text-gray-500 text-[10px] font-bold uppercase mb-2 ml-1">{category.label}</Text>
                                        <View className="flex-row flex-wrap gap-2">
                                            {category.options.map(option => (
                                                <TouchableOpacity
                                                    key={option}
                                                    onPress={() => toggleFilter(key, option)}
                                                    className={`px-3 py-1.5 rounded-xl border ${filters[key].includes(option)
                                                        ? 'bg-blue-600/20 border-blue-500/50'
                                                        : 'bg-gray-800/50 border-gray-700/50'
                                                        }`}
                                                >
                                                    <Text className={`text-[10px] font-bold ${filters[key].includes(option) ? 'text-blue-400' : 'text-gray-400'}`}>
                                                        {option}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Quick Muscles Row (Horizontal - always visible if not expanded) */}
                    {!isFilterExpanded && (
                        <View className="mb-6">
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-2">
                                <View className="flex-row gap-2 px-2">
                                    {FILTER_CATEGORIES.muscles.options.map(group => (
                                        <TouchableOpacity
                                            key={group}
                                            onPress={() => toggleFilter('muscles', group)}
                                            className={`px-4 py-2 rounded-full border ${filters.muscles.includes(group)
                                                ? 'bg-blue-600 border-blue-500'
                                                : 'bg-gray-800/50 border-gray-700'
                                                }`}
                                        >
                                            <Text className={`font-bold text-xs ${filters.muscles.includes(group) ? 'text-white' : 'text-gray-400'}`}>
                                                {group.toUpperCase()}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>
                    )}

                    <View style={styles.listContainer}>
                        <FlatList
                            data={filteredExercises}
                            keyExtractor={(item) => item.id}
                            style={styles.flatList}
                            contentContainerStyle={styles.listContent}
                            nestedScrollEnabled={true}
                            renderItem={({ item: exercise }: { item: Exercise }) => (
                                <View className="bg-gray-800/40 rounded-[24px] mb-3 border border-gray-800 overflow-hidden">
                                    <TouchableOpacity
                                        className="p-5 active:bg-blue-600/10"
                                        onPress={() => onSelect(exercise)}
                                    >
                                        <View className="flex-row justify-between items-center">
                                            <View className="flex-1 mr-3">
                                                <Text className="text-white font-bold text-lg mb-1.5 leading-tight">{exercise.name}</Text>
                                                <View className="flex-row items-center flex-wrap gap-1.5 opacity-80">
                                                    <Text className="text-blue-400 text-[10px] font-black uppercase tracking-widest">{exercise.target_muscle || exercise.category}</Text>
                                                    <Text className="text-gray-600">•</Text>
                                                    <Text className="text-gray-400 text-[10px] uppercase font-bold">{exercise.mechanics || (exercise.is_compound ? 'Compound' : 'Isolation')}</Text>

                                                    {(exercise.target_muscle || exercise.muscle_groups) && (
                                                        <>
                                                            <Text className="text-gray-600">•</Text>
                                                            <Text className="text-gray-500 text-xs font-medium" numberOfLines={1}>
                                                                {exercise.target_muscle
                                                                    ? (exercise.muscle_groups?.filter(m => !exercise.target_muscle?.includes(m)).join(', ') || 'Primary')
                                                                    : exercise.muscle_groups?.join(', ')}
                                                            </Text>
                                                        </>
                                                    )}
                                                </View>
                                            </View>
                                            <View className="flex-row items-center gap-2">
                                                {/* Info/Preview Button */}
                                                <TouchableOpacity
                                                    className="w-10 h-10 rounded-full bg-gray-700/50 items-center justify-center border border-gray-600/50"
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        setPreviewExercise(exercise);
                                                    }}
                                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                >
                                                    <Ionicons name="information-circle-outline" size={20} color="#9ca3af" />
                                                </TouchableOpacity>
                                                {/* Add Button */}
                                                <View className="w-10 h-10 rounded-full bg-blue-600/20 items-center justify-center border border-blue-600/30">
                                                    <Ionicons name="add" size={24} color="#3b82f6" />
                                                </View>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            )}
                            showsVerticalScrollIndicator={true}
                            initialNumToRender={15}
                            maxToRenderPerBatch={15}
                            windowSize={7}
                            removeClippedSubviews={Platform.OS !== 'web'}
                            ListEmptyComponent={() => (
                                <View className="py-20 items-center opacity-60">
                                    <Ionicons name="search" size={48} color="#9ca3af" />
                                    <Text className="text-gray-400 mt-4 text-center font-medium max-w-[200px]">No exercises found matching your filters</Text>
                                    <TouchableOpacity onPress={clearAllFilters} className="mt-6 bg-gray-800 px-6 py-3 rounded-xl border border-gray-700">
                                        <Text className="text-white font-bold text-sm">Clear Filters</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        />
                    </View>
                </View>
            </View>

            {/* Exercise Preview Modal */}
            <ExerciseVideoModal
                exercise={previewExercise}
                visible={!!previewExercise}
                onClose={() => setPreviewExercise(null)}
            />
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    backdrop: {
        height: SCREEN_HEIGHT * 0.1,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: '#111827',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        padding: 32,
        paddingBottom: 0,
        borderTopWidth: 1,
        borderTopColor: '#1f2937',
    },
    listContainer: {
        flex: 1,
        backgroundColor: 'rgba(17,24,39,0.5)',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(31,41,55,0.5)',
        marginBottom: 32,
    },
    flatList: {
        flex: 1,
    },
    listContent: {
        padding: 8,
        paddingBottom: 40,
    },
});
