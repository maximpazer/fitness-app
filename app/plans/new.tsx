import { ExercisePickerModal } from '@/components/ExercisePickerModal';
import { useAuthContext } from '@/context/AuthContext';
import { Database } from '@/lib/database.types';
import { exerciseService } from '@/services/exercise.service';
import { CreatePlanDTO, plannerService } from '@/services/planner.service';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NumericTextInput } from '@/components/NumericTextInput';

type Exercise = Database['public']['Tables']['exercises']['Row'];

const NewPlan = () => {
    const { user } = useAuthContext();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [durationWeeks, setDurationWeeks] = useState('8');
    const [days, setDays] = useState<CreatePlanDTO['days']>([
        { day_number: 1, day_name: 'Day 1', day_type: 'training', exercises: [] }
    ]);

    const [allExercises, setAllExercises] = useState<Exercise[]>([]);
    const [showExercisePicker, setShowExercisePicker] = useState(false);
    const [currentPickingDayIndex, setCurrentPickingDayIndex] = useState<number | null>(null);

    useEffect(() => {
        loadExercises();
    }, []);

    const loadExercises = async () => {
        try {
            const exercises = await exerciseService.getExercises();
            setAllExercises(exercises);
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to load exercises");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;

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
            await plannerService.createPlan(user.id, {
                name: name.trim(),
                description: description.trim(),
                duration_weeks: parseInt(durationWeeks) || 8,
                days
            });

            Alert.alert("Success", "Plan created successfully");
            router.replace('/planner');
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to create plan");
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
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
        if (days.length === 1) {
            Alert.alert("Warning", "A plan must have at least one day.");
            return;
        }
        const newDays = days.filter((_, i) => i !== index);
        newDays.forEach((day, i) => {
            day.day_number = i + 1;
        });
        setDays(newDays);
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
        newDays[dayIndex].exercises.forEach((ex, i) => {
            ex.order_in_workout = i + 1;
        });
        setDays(newDays);
    };

    if (loading) {
        return (
            <View className="flex-1 bg-gray-950 justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text className="text-gray-400 mt-4">Loading exercises...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-950" edges={['top']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: "Create Custom Plan",
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
                                <Text className="text-blue-400 text-base font-bold">Create</Text>
                            )}
                        </TouchableOpacity>
                    )
                }}
            />

            <ScrollView className="flex-1 px-4 py-4">
                <View className="mb-6">
                    <Text className="text-white font-bold mb-2 uppercase text-xs tracking-widest text-gray-500">Plan Name</Text>
                    <TextInput
                        className="bg-gray-900 text-white p-4 rounded-2xl border border-gray-800"
                        value={name}
                        onChangeText={setName}
                        placeholder="e.g., Summer Body Split"
                        placeholderTextColor="#4b5563"
                    />
                </View>

                <View className="mb-6">
                    <Text className="text-white font-bold mb-2 uppercase text-xs tracking-widest text-gray-500">Duration (weeks)</Text>
                    <NumericTextInput
                        className="bg-gray-900 text-white p-4 rounded-2xl border border-gray-800"
                        value={durationWeeks}
                        onChangeText={setDurationWeeks}
                        allowDecimal={false}
                        placeholder="8"
                        placeholderTextColor="#4b5563"
                    />
                </View>

                <View className="mb-8">
                    <Text className="text-white font-bold mb-2 uppercase text-xs tracking-widest text-gray-500">Description (Optional)</Text>
                    <TextInput
                        className="bg-gray-900 text-white p-4 rounded-2xl border border-gray-800"
                        value={description}
                        onChangeText={setDescription}
                        placeholder="What's this plan about?"
                        placeholderTextColor="#4b5563"
                        multiline
                        numberOfLines={2}
                    />
                </View>

                <Text className="text-white font-bold text-lg mb-4">Training Days</Text>

                {days.map((day, dayIndex) => (
                    <View key={dayIndex} className="bg-gray-900 rounded-3xl p-5 mb-6 border border-gray-800 shadow-sm shadow-black">
                        <View className="flex-row justify-between items-center mb-4">
                            <View className="bg-blue-600/10 px-3 py-1 rounded-full border border-blue-600/20">
                                <Text className="text-blue-400 font-bold text-xs">DAY {day.day_number}</Text>
                            </View>
                            {days.length > 1 && (
                                <TouchableOpacity onPress={() => removeDay(dayIndex)} className="p-1">
                                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <TextInput
                            className="bg-gray-800/50 text-white p-4 rounded-2xl mb-4 border border-gray-800"
                            value={day.day_name}
                            onChangeText={(v) => updateDayField(dayIndex, 'day_name', v)}
                            placeholder="Day name (e.g. Upper Body)"
                            placeholderTextColor="#4b5563"
                        />

                        <View className="flex-row gap-2 mb-6">
                            {(['training', 'cardio', 'rest', 'active_recovery'] as const).map(type => (
                                <TouchableOpacity
                                    key={type}
                                    className={`flex-1 py-2.5 rounded-xl ${day.day_type === type ? 'bg-blue-600' : 'bg-gray-800/50 border border-gray-800'}`}
                                    onPress={() => updateDayField(dayIndex, 'day_type', type)}
                                >
                                    <Text className={`text-center text-[10px] font-bold ${day.day_type === type ? 'text-white' : 'text-gray-500'}`}>
                                        {type.replace('_', ' ').toUpperCase()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View className="mb-2">
                            {day.exercises.map((ex, exIndex) => {
                                const exercise = allExercises.find(e => e.id === ex.exercise_id);
                                return (
                                    <View key={exIndex} className="bg-gray-800/80 p-4 rounded-2xl mb-3 flex-row justify-between items-center border border-gray-700">
                                        <View className="flex-1">
                                            <Text className="text-white font-semibold text-base">{exercise?.name || 'Exercise'}</Text>
                                            <Text className="text-gray-400 text-xs mt-1 font-medium">
                                                {ex.target_sets} sets • {ex.target_reps_min}-{ex.target_reps_max} reps
                                            </Text>
                                        </View>
                                        <TouchableOpacity onPress={() => removeExercise(dayIndex, exIndex)} className="ml-4">
                                            <Ionicons name="remove-circle" size={24} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </View>

                        {!['rest', 'active_recovery'].includes(day.day_type) && (
                            <TouchableOpacity
                                className="bg-gray-800 border-2 border-dashed border-gray-700 py-4 rounded-2xl items-center mt-2 flex-row justify-center"
                                onPress={() => openExercisePicker(dayIndex)}
                            >
                                <Ionicons name="add-circle" size={20} color="#3b82f6" />
                                <Text className="text-blue-500 font-bold ml-2">Add Exercise</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ))}

                <TouchableOpacity
                    className="bg-gray-900 py-5 rounded-3xl items-center mb-24 border border-gray-800 border-dashed"
                    onPress={addDay}
                >
                    <View className="flex-row items-center">
                        <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                        <Text className="text-gray-400 font-bold ml-3 text-base">Add Another Day</Text>
                    </View>
                </TouchableOpacity>
            </ScrollView>

            <ExercisePickerModal
                visible={showExercisePicker}
                onClose={() => setShowExercisePicker(false)}
                onSelect={addExerciseToDay}
                allExercises={allExercises}
            />
        </SafeAreaView>
    );
};

export default NewPlan;
