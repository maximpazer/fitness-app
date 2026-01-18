import { useAuthContext } from '@/context/AuthContext';
import { PlanDay, plannerService } from '@/services/planner.service';
import { workoutService } from '@/services/workout.service';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type WorkoutSetState = {
    setNumber: number;
    prevWeight?: string;
    weight: string;
    reps: string;
    completed: boolean;
};

type ExerciseState = {
    exerciseId: string;
    name: string;
    sets: WorkoutSetState[];
};

export default function WorkoutSession() {
    const { dayId } = useLocalSearchParams();
    const { user } = useAuthContext();
    const router = useRouter();

    // Timer State
    const [seconds, setSeconds] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Rest Timer State
    const [restTimerVisible, setRestTimerVisible] = useState(false);
    const [restTimeRemaining, setRestTimeRemaining] = useState(0);

    // Data State
    const [loading, setLoading] = useState(true);
    const [planDay, setPlanDay] = useState<PlanDay | null>(null);
    const [exercises, setExercises] = useState<ExerciseState[]>([]);

    // Derived State
    const totalVolume = exercises.reduce((acc, ex) => {
        return acc + ex.sets.reduce((sAcc, set) => {
            if (set.completed && set.weight && set.reps) {
                return sAcc + (parseFloat(set.weight) * parseFloat(set.reps));
            }
            return sAcc;
        }, 0);
    }, 0);

    // Rest Timer Countdown
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (restTimerVisible && restTimeRemaining > 0) {
            interval = setInterval(() => {
                setRestTimeRemaining((prev) => {
                    if (prev <= 1) {
                        setRestTimerVisible(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [restTimerVisible, restTimeRemaining]);

    useEffect(() => {
        if (!user || !dayId) return;

        const init = async () => {
            try {
                // 1. Fetch Plan Details
                const day = await plannerService.getPlanDay(dayId as string);
                setPlanDay(day);

                // 2. Initialize Exercises with History
                const initialExercises: ExerciseState[] = [];

                for (const ex of day.exercises) {
                    const history = await workoutService.getExerciseHistory(ex.exercise_id, user.id);
                    const numSets = ex.target_sets || 3;
                    const sets: WorkoutSetState[] = [];

                    for (let i = 0; i < numSets; i++) {
                        let prevWeight = '-';
                        let defaultWeight = '';
                        let defaultReps = '';

                        // Try to find matching set in history
                        if (history && history.sets && history.sets[i]) {
                            prevWeight = history.sets[i].weight_kg?.toString() || '-';
                            defaultWeight = history.sets[i].weight_kg?.toString() || '';
                            defaultReps = history.sets[i].reps?.toString() || '';
                        }

                        sets.push({
                            setNumber: i + 1,
                            prevWeight,
                            weight: defaultWeight,
                            reps: defaultReps || (ex.target_reps_min ? ex.target_reps_min.toString() : ''),
                            completed: false
                        });
                    }

                    initialExercises.push({
                        exerciseId: ex.exercise_id,
                        name: ex.exercise?.name || 'Unknown Exercise',
                        sets
                    });
                }

                setExercises(initialExercises);
            } catch (error) {
                console.error(error);
                Alert.alert("Error", "Failed to load workout");
            } finally {
                setLoading(false);
                // Start Workout Timer
                timerRef.current = setInterval(() => {
                    setSeconds(s => s + 1);
                }, 1000);
            }
        };

        init();

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [user, dayId]);

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleSetChange = (exIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) => {
        const newExercises = [...exercises];
        newExercises[exIndex].sets[setIndex][field] = value;
        setExercises(newExercises);
    };

    const toggleSetComplete = (exIndex: number, setIndex: number) => {
        const newExercises = [...exercises];
        const set = newExercises[exIndex].sets[setIndex];
        const wasCompleted = set.completed;

        // Toggle
        set.completed = !wasCompleted;
        setExercises(newExercises);

        // If we just completed it, start rest timer
        if (!wasCompleted) {
            startRestTimer();
        }
    };

    const startRestTimer = () => {
        setRestTimeRemaining(90); // Default 90s rest
        setRestTimerVisible(true);
    };

    const addSet = (exIndex: number) => {
        const newExercises = [...exercises];
        const currentSets = newExercises[exIndex].sets;
        const lastSet = currentSets[currentSets.length - 1];

        currentSets.push({
            setNumber: currentSets.length + 1,
            prevWeight: '-',
            weight: lastSet ? lastSet.weight : '',
            reps: lastSet ? lastSet.reps : '',
            completed: false
        });

        setExercises(newExercises);
    };

    const finishWorkout = async () => {
        // Log to debug if function is triggering
        console.log("Finish Workout Clicked");

        if (!user || !planDay) {
            console.warn("User or PlanDay missing");
            return;
        }

        Alert.alert(
            "Finish Workout",
            "Are you sure you want to finish this session?",
            [
                { text: "Resume", style: "cancel", onPress: () => console.log("Resume clicked") },
                {
                    text: "Finish Workout",
                    style: "destructive", // Make it red to be distinct
                    onPress: async () => {
                        console.log("Confirm Finish Clicked");
                        try {
                            setLoading(true);
                            await workoutService.saveWorkout({
                                userId: user.id,
                                planDayId: planDay.id,
                                name: planDay.day_name || `Workout`,
                                durationMinutes: Math.ceil(seconds / 60),
                                exercises: exercises.map(ex => ({
                                    exercise_id: ex.exerciseId,
                                    sets: ex.sets.map(s => ({
                                        reps: parseFloat(s.reps) || 0,
                                        weight_kg: parseFloat(s.weight) || 0,
                                        is_completed: s.completed
                                    }))
                                }))
                            });

                            router.back();
                            // Short delay to ensure navigation happens before alert 
                            setTimeout(() => {
                                Alert.alert("Great Job!", "Workout saved successfully.");
                            }, 500);
                        } catch (error) {
                            console.error("Error saving workout:", error);
                            Alert.alert("Error", "Failed to save workout");
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading && !planDay) {
        return (
            <View className="flex-1 bg-gray-950 justify-center items-center">
                <Stack.Screen options={{ headerShown: false }} />
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text className="text-gray-400 mt-4">Preparing your session...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-950" edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="px-4 py-3 bg-gray-900 border-b border-gray-800 flex-row justify-between items-center">
                <TouchableOpacity
                    onPress={() => {
                        Alert.alert(
                            "Exit Workout",
                            "Are you sure you want to exit? Your progress for this session will be lost.",
                            [
                                { text: "Resume", style: "cancel" },
                                { text: "Exit", style: "destructive", onPress: () => router.back() }
                            ]
                        );
                    }}
                    className="w-10 h-10 items-center justify-center -ml-2"
                >
                    <Ionicons name="close" size={28} color="#9ca3af" />
                </TouchableOpacity>
                <View className="flex-1 px-2">
                    <Text className="text-white font-bold text-lg" numberOfLines={1}>{planDay?.day_name || 'Workout'}</Text>
                    <Text className="text-gray-400 text-xs">{format(new Date(), 'MMM d, yyyy')}</Text>
                </View>
                <View className="items-end">
                    <Text className="text-white font-mono text-xl font-bold">{formatTime(seconds)}</Text>
                    <Text className="text-gray-500 text-xs">{totalVolume.toFixed(0)} kg vol</Text>
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ScrollView className="flex-1 px-4 py-4">
                    {exercises.map((ex, exIndex) => (
                        <View key={ex.exerciseId} className="mb-6">
                            <Text className="text-blue-400 font-bold text-lg mb-2">{ex.name}</Text>

                            {/* Table Header */}
                            <View className="flex-row bg-gray-800 py-2 px-2 rounded-t-lg mb-1">
                                <Text className="w-8 text-center text-gray-400 text-xs font-bold">SET</Text>
                                <Text className="w-16 text-center text-gray-400 text-xs font-bold">PREV</Text>
                                <Text className="flex-1 text-center text-gray-400 text-xs font-bold">KG</Text>
                                <Text className="flex-1 text-center text-gray-400 text-xs font-bold">REPS</Text>
                                <Text className="w-10 text-center text-gray-400 text-xs font-bold">✓</Text>
                            </View>

                            {/* Sets */}
                            {ex.sets.map((set, setIndex) => (
                                <View
                                    key={setIndex}
                                    className={`flex-row items-center py-2 px-2 mb-1 rounded-lg ${set.completed ? 'bg-green-900/20' : 'bg-gray-900'}`}
                                >
                                    <Text className="w-8 text-center text-gray-500 font-bold">{set.setNumber}</Text>
                                    <Text className="w-16 text-center text-gray-500">{set.prevWeight}</Text>

                                    <View className="flex-1 px-1">
                                        <TextInput
                                            className="bg-gray-800/80 text-white text-center py-2 rounded-md font-bold text-lg border border-transparent focus:border-blue-500/50"
                                            keyboardType="numeric"
                                            value={set.weight}
                                            onChangeText={(v) => handleSetChange(exIndex, setIndex, 'weight', v)}
                                            maxLength={5}
                                            selectTextOnFocus
                                            placeholder="0"
                                            placeholderTextColor="#4b5563"
                                            returnKeyType="next"
                                        />
                                    </View>

                                    <View className="flex-1 px-1">
                                        <TextInput
                                            className="bg-gray-800/80 text-white text-center py-2 rounded-md font-bold text-lg border border-transparent focus:border-blue-500/50"
                                            keyboardType="numeric"
                                            value={set.reps}
                                            onChangeText={(v) => handleSetChange(exIndex, setIndex, 'reps', v)}
                                            maxLength={3}
                                            selectTextOnFocus
                                            placeholder="0"
                                            placeholderTextColor="#4b5563"
                                            returnKeyType="done"
                                        />
                                    </View>

                                    <TouchableOpacity
                                        className={`w-10 h-8 items-center justify-center rounded-md ${set.completed ? 'bg-green-500' : 'bg-gray-700'}`}
                                        onPress={() => toggleSetComplete(exIndex, setIndex)}
                                    >
                                        {set.completed && <Ionicons name="checkmark" size={20} color="white" />}
                                    </TouchableOpacity>
                                </View>
                            ))}

                            <TouchableOpacity
                                className="mt-2 bg-gray-800 py-3 rounded-lg items-center"
                                onPress={() => addSet(exIndex)}
                            >
                                <Text className="text-blue-400 font-bold text-sm">+ Add Set</Text>
                            </TouchableOpacity>
                        </View>
                    ))}

                    {/* Bottom Padding for scroll */}
                    <View className="h-24" />
                </ScrollView>

                {/* Sticky Finish Button */}
                <View className="p-4 bg-gray-900 border-t border-gray-800 absolute bottom-0 left-0 right-0">
                    <TouchableOpacity
                        className="bg-blue-600 w-full py-4 rounded-full items-center shadow-lg"
                        onPress={finishWorkout}
                    >
                        <Text className="text-white font-bold text-xl uppercase tracking-wider">Finish Workout</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Rest Timer Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={restTimerVisible}
                onRequestClose={() => setRestTimerVisible(false)}
            >
                <View className="flex-1 justify-end bg-black/50">
                    <View className="bg-gray-900 border-t border-gray-800 p-6 rounded-t-3xl pb-10">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-gray-400 font-bold">Rest Timer</Text>
                            <TouchableOpacity onPress={() => setRestTimerVisible(false)}>
                                <Ionicons name="close-circle" size={28} color="#6b7280" />
                            </TouchableOpacity>
                        </View>

                        <Text className="text-white text-center text-6xl font-bold mb-2 font-mono">
                            {formatTime(restTimeRemaining)}
                        </Text>
                        <Text className="text-blue-400 text-center mb-8 font-medium">Resting...</Text>

                        <View className="flex-row gap-4 justify-center">
                            <TouchableOpacity
                                onPress={() => setRestTimeRemaining(t => t - 10 > 0 ? t - 10 : 0)}
                                className="bg-gray-800 h-16 w-16 rounded-full items-center justify-center"
                            >
                                <Text className="text-white font-bold">-10</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setRestTimerVisible(false)}
                                className="bg-blue-600 px-8 h-16 rounded-full items-center justify-center flex-1"
                            >
                                <Text className="text-white font-bold text-lg">Skip Rest</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setRestTimeRemaining(t => t + 30)}
                                className="bg-gray-800 h-16 w-16 rounded-full items-center justify-center"
                            >
                                <Text className="text-white font-bold">+30</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
