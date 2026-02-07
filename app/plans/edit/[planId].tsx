import { ExercisePickerModal } from '@/components/ExercisePickerModal';
import { useAuthContext } from '@/context/AuthContext';
import { Database } from '@/lib/database.types';
import { exerciseService } from '@/services/exercise.service';
import { CreatePlanDTO, plannerService } from '@/services/planner.service';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NumericTextInput } from '@/components/NumericTextInput';

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
        setShowExercisePicker(true);
    };

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
                    <NumericTextInput
                        className="bg-gray-900 text-white p-4 rounded-lg border border-gray-800"
                        value={durationWeeks}
                        onChangeText={setDurationWeeks}
                        allowDecimal={false}
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
            <ExercisePickerModal
                visible={showExercisePicker}
                onClose={() => setShowExercisePicker(false)}
                onSelect={addExerciseToDay}
                allExercises={allExercises}
            />
        </SafeAreaView>
    );
}
