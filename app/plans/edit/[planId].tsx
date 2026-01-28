import { useAuthContext } from '@/context/AuthContext';
import { Database } from '@/lib/database.types';
import { exerciseService } from '@/services/exercise.service';
import { CreatePlanDTO, plannerService } from '@/services/planner.service';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Exercise = Database['public']['Tables']['exercises']['Row'];

export default function EditPlan() {
    const { planId } = useLocalSearchParams();
    const { user } = useAuthContext();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [durationWeeks, setDurationWeeks] = useState('4');
    const [days, setDays] = useState<CreatePlanDTO['days']>([]);

    // Exercise Picker State
    const [allExercises, setAllExercises] = useState<Exercise[]>([]);
    const [showExercisePicker, setShowExercisePicker] = useState(false);
    const [currentPickingDayIndex, setCurrentPickingDayIndex] = useState<number | null>(null);
    const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>([]);

    // Available muscle groups for filtering
    const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core', 'Cardio'];

    useEffect(() => {
        loadData();
    }, [planId]);

    const loadData = async () => {
        if (!user || !planId) return;
        try {
            // Fetch Plan
            const plan = await plannerService.getPlanById(planId as string);
            if (!plan) {
                Alert.alert("Error", "Plan not found");
                router.back();
                return;
            }

            // Pre-fill form
            setName(plan.name);
            setDescription(plan.description || '');
            setDurationWeeks(plan.duration_weeks.toString());

            // Transform days to editable format
            const editableDays: CreatePlanDTO['days'] = plan.days.map(day => ({
                day_number: day.day_number,
                day_name: day.day_name || '',
                day_type: day.day_type,
                notes: day.notes || '',
                exercises: day.exercises.map((ex, idx) => ({
                    exercise_id: ex.exercise_id,
                    order_in_workout: idx + 1,
                    target_sets: ex.target_sets,
                    target_reps_min: ex.target_reps_min || undefined,
                    target_reps_max: ex.target_reps_max || undefined,
                    target_rpe: ex.target_rpe || undefined,
                    rest_seconds: ex.rest_seconds || undefined,
                    notes: ex.notes || ''
                }))
            }));

            setDays(editableDays);

            // Fetch all exercises for picker
            const exercises = await exerciseService.getExercises();
            setAllExercises(exercises);
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to load plan");
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        // Validation
        if (!name.trim()) {
            Alert.alert("Validation Error", "Plan name is required");
            return;
        }

        if (days.length === 0) {
            Alert.alert("Validation Error", "Add at least one day");
            return;
        }

        const hasExercises = days.some(d => d.exercises && d.exercises.length > 0);
        if (!hasExercises) {
            Alert.alert("Validation Error", "Add at least one exercise");
            return;
        }

        setSaving(true);
        try {
            await plannerService.updatePlan(planId as string, {
                name: name.trim(),
                description: description.trim(),
                duration_weeks: parseInt(durationWeeks),
                days
            });

            Alert.alert("Success", "Plan updated successfully");
            router.back();
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to save plan");
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        // TODO: Check for unsaved changes
        router.back();
    };

    const addDay = () => {
        const newDayNumber = days.length + 1;
        setDays([...days, {
            day_number: newDayNumber,
            day_name: `Day ${newDayNumber}`,
            day_type: 'training',
            exercises: []
        }]);
    };

    const removeDay = (index: number) => {
        Alert.alert(
            "Remove Day",
            "Are you sure you want to remove this day?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => {
                        const newDays = days.filter((_, i) => i !== index);
                        // Re-number days
                        newDays.forEach((day, i) => {
                            day.day_number = i + 1;
                        });
                        setDays(newDays);
                    }
                }
            ]
        );
    };

    const updateDayField = (index: number, field: keyof CreatePlanDTO['days'][0], value: any) => {
        const newDays = [...days];
        (newDays[index] as any)[field] = value;
        setDays(newDays);
    };

    const openExercisePicker = (dayIndex: number) => {
        setCurrentPickingDayIndex(dayIndex);
        setSelectedMuscleGroups([]); // Reset filters when opening picker
        setShowExercisePicker(true);
    };

    const toggleMuscleGroup = (muscleGroup: string) => {
        setSelectedMuscleGroups(prev =>
            prev.includes(muscleGroup)
                ? prev.filter(mg => mg !== muscleGroup)
                : [...prev, muscleGroup]
        );
    };

    // Filter exercises based on selected muscle groups (exact word matching)
    const filteredExercises = selectedMuscleGroups.length > 0
        ? allExercises.filter(exercise =>
            exercise.muscle_groups?.some(mg => {
                const mgLower = mg.toLowerCase();
                return selectedMuscleGroups.some(selected => {
                    const selectedLower = selected.toLowerCase();
                    // Match if the muscle group contains the selected word as a whole word
                    return mgLower === selectedLower ||
                        mgLower.includes(selectedLower + ' ') ||
                        mgLower.includes(' ' + selectedLower) ||
                        mgLower.startsWith(selectedLower + '_') ||
                        mgLower.endsWith('_' + selectedLower);
                });
            })
        )
        : allExercises;

    const addExerciseToDay = (exercise: Exercise) => {
        if (currentPickingDayIndex === null) return;

        const newDays = [...days];
        const day = newDays[currentPickingDayIndex];

        day.exercises.push({
            exercise_id: exercise.id,
            order_in_workout: day.exercises.length + 1,
            target_sets: 3,
            target_reps_min: 8,
            target_reps_max: 12,
            rest_seconds: 90
        });

        setDays(newDays);
        setShowExercisePicker(false);
        setCurrentPickingDayIndex(null);
    };

    const removeExercise = (dayIndex: number, exIndex: number) => {
        const newDays = [...days];
        newDays[dayIndex].exercises.splice(exIndex, 1);
        // Re-order
        newDays[dayIndex].exercises.forEach((ex, i) => {
            ex.order_in_workout = i + 1;
        });
        setDays(newDays);
    };

    const handleDeletePlan = () => {
        Alert.alert(
            "Delete Plan",
            "Are you sure you want to delete this plan? If you have completed workouts, the plan will be deactivated instead to preserve your history.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await plannerService.deletePlan(planId as string);
                            Alert.alert("Success", "Plan removed successfully");
                            router.back();
                        } catch (error) {
                            console.error(error);
                            Alert.alert("Error", "Failed to delete plan");
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View className="flex-1 bg-gray-950 justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text className="text-gray-400 mt-4">Loading plan...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-950" edges={['top']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: "Edit Plan",
                    headerStyle: { backgroundColor: '#030712' },
                    headerTintColor: '#fff',
                    headerLeft: () => (
                        <TouchableOpacity onPress={handleCancel}>
                            <Text className="text-blue-400 text-base">Cancel</Text>
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <TouchableOpacity onPress={handleSave} disabled={saving}>
                            {saving ? (
                                <ActivityIndicator color="#3b82f6" />
                            ) : (
                                <Text className="text-blue-400 text-base font-bold">Save</Text>
                            )}
                        </TouchableOpacity>
                    )
                }}
            />

            <ScrollView className="flex-1 px-4 py-4">
                {/* Plan Name */}
                <View className="mb-6">
                    <Text className="text-white font-bold mb-2">Plan Name</Text>
                    <TextInput
                        className="bg-gray-900 text-white p-4 rounded-lg border border-gray-800"
                        value={name}
                        onChangeText={setName}
                        placeholder="e.g., Push Pull Legs"
                        placeholderTextColor="#6b7280"
                    />
                </View>

                {/* Duration */}
                <View className="mb-6">
                    <Text className="text-white font-bold mb-2">Duration (weeks)</Text>
                    <TextInput
                        className="bg-gray-900 text-white p-4 rounded-lg border border-gray-800"
                        value={durationWeeks}
                        onChangeText={setDurationWeeks}
                        keyboardType="numeric"
                        placeholder="4"
                        placeholderTextColor="#6b7280"
                    />
                </View>

                {/* Description */}
                <View className="mb-6">
                    <Text className="text-white font-bold mb-2">Description (Optional)</Text>
                    <TextInput
                        className="bg-gray-900 text-white p-4 rounded-lg border border-gray-800"
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Plan details..."
                        placeholderTextColor="#6b7280"
                        multiline
                        numberOfLines={3}
                    />
                </View>

                {/* Days */}
                <Text className="text-white font-bold text-lg mb-4">Training Days</Text>

                {days.map((day, dayIndex) => (
                    <View key={dayIndex} className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800">
                        <View className="flex-row justify-between items-center mb-3">
                            <Text className="text-blue-400 font-bold">Day {day.day_number}</Text>
                            <TouchableOpacity onPress={() => removeDay(dayIndex)}>
                                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            className="bg-gray-800 text-white p-3 rounded-lg mb-3"
                            value={day.day_name}
                            onChangeText={(v) => updateDayField(dayIndex, 'day_name', v)}
                            placeholder="Day name"
                            placeholderTextColor="#6b7280"
                        />

                        {/* Day Type Selector */}
                        <View className="flex-row gap-2 mb-3">
                            {(['training', 'cardio', 'rest', 'active_recovery'] as const).map(type => (
                                <TouchableOpacity
                                    key={type}
                                    className={`flex-1 py-2 rounded-lg ${day.day_type === type ? 'bg-blue-600' : 'bg-gray-800'}`}
                                    onPress={() => updateDayField(dayIndex, 'day_type', type)}
                                >
                                    <Text className={`text-center text-xs font-bold ${day.day_type === type ? 'text-white' : 'text-gray-400'}`}>
                                        {type.replace('_', ' ').toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Exercises */}
                        {day.exercises.map((ex, exIndex) => {
                            const exercise = allExercises.find(e => e.id === ex.exercise_id);
                            return (
                                <View key={exIndex} className="bg-gray-800 p-3 rounded-lg mb-2 flex-row justify-between items-center">
                                    <View className="flex-1">
                                        <Text className="text-white font-medium">{exercise?.name || 'Exercise'}</Text>
                                        <Text className="text-gray-400 text-xs mt-1">
                                            {ex.target_sets} sets × {ex.target_reps_min}-{ex.target_reps_max} reps
                                            {ex.rest_seconds ? ` • ${ex.rest_seconds}s rest` : ''}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => removeExercise(dayIndex, exIndex)}>
                                        <Ionicons name="close-circle" size={24} color="#ef4444" />
                                    </TouchableOpacity>
                                </View>
                            );
                        })}

                        <TouchableOpacity
                            className="bg-blue-600/20 py-3 rounded-lg items-center border border-blue-600/30 mt-2"
                            onPress={() => openExercisePicker(dayIndex)}
                        >
                            <Text className="text-blue-400 font-bold">+ Add Exercise</Text>
                        </TouchableOpacity>
                    </View>
                ))}

                <TouchableOpacity
                    className="bg-gray-800 py-4 rounded-lg items-center mb-6 border border-gray-700"
                    onPress={addDay}
                >
                    <Text className="text-white font-bold">+ Add Day</Text>
                </TouchableOpacity>

                {/* Delete Plan Button */}
                <TouchableOpacity
                    className="bg-red-600/20 py-4 rounded-lg items-center mb-20 border border-red-600/30"
                    onPress={handleDeletePlan}
                >
                    <Text className="text-red-500 font-bold">Delete Plan</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Exercise Picker Modal */}
            <Modal visible={showExercisePicker} animationType="slide" transparent={true}>
                <View className="flex-1 bg-black/50 justify-end">
                    <View className="bg-gray-900 rounded-t-3xl p-6 max-h-[70%]">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white font-bold text-lg">Select Exercise</Text>
                            <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
                                <Ionicons name="close" size={28} color="#6b7280" />
                            </TouchableOpacity>
                        </View>

                        {/* Muscle Group Filter */}
                        <View className="mb-4">
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="text-gray-400 font-bold text-xs uppercase tracking-wider">Filter by Muscle Group</Text>
                                {selectedMuscleGroups.length > 0 && (
                                    <TouchableOpacity onPress={() => setSelectedMuscleGroups([])}>
                                        <Text className="text-blue-400 text-xs font-bold">Clear All</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-2">
                                <View className="flex-row gap-2 px-2">
                                    {MUSCLE_GROUPS.map(group => (
                                        <TouchableOpacity
                                            key={group}
                                            onPress={() => toggleMuscleGroup(group)}
                                            className={`px-4 py-2 rounded-full border ${selectedMuscleGroups.includes(group)
                                                ? 'bg-blue-600 border-blue-500'
                                                : 'bg-gray-800/50 border-gray-700'
                                                }`}
                                        >
                                            <Text className={`font-bold text-sm ${selectedMuscleGroups.includes(group) ? 'text-white' : 'text-gray-400'
                                                }`}>
                                                {group}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>

                        <ScrollView>
                            {filteredExercises.map(exercise => (
                                <TouchableOpacity
                                    key={exercise.id}
                                    className="bg-gray-800 p-4 rounded-lg mb-2"
                                    onPress={() => addExerciseToDay(exercise)}
                                >
                                    <Text className="text-white font-medium">{exercise.name}</Text>
                                    <Text className="text-gray-400 text-sm">{exercise.category}</Text>
                                    {exercise.muscle_groups && exercise.muscle_groups.length > 0 && (
                                        <Text className="text-gray-500 text-xs mt-0.5">{exercise.muscle_groups.join(', ')}</Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
