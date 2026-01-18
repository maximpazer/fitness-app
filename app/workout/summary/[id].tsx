import { workoutService } from '@/services/workout.service';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WorkoutSummary() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [workout, setWorkout] = useState<any>(null);

    useEffect(() => {
        if (!id) return;
        const fetchSummary = async () => {
            try {
                const data = await workoutService.getWorkoutSummary(id as string);
                setWorkout(data);
            } catch (error) {
                console.error('Error fetching workout summary:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSummary();
    }, [id]);

    if (loading) {
        return (
            <View className="flex-1 bg-gray-950 justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    if (!workout) {
        return (
            <View className="flex-1 bg-gray-950 justify-center items-center p-6">
                <Text className="text-white text-lg text-center mb-4">Workout not found</Text>
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="bg-blue-600 px-6 py-3 rounded-full"
                >
                    <Text className="text-white font-bold">Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const totalVolume = workout.workout_exercises?.reduce((acc: number, ex: any) => {
        return acc + ex.workout_sets?.reduce((sAcc: number, set: any) => {
            return sAcc + (set.weight_kg * set.reps);
        }, 0);
    }, 0) || 0;

    const totalReps = workout.workout_exercises?.reduce((acc: number, ex: any) => {
        return acc + ex.workout_sets?.reduce((sAcc: number, set: any) => sAcc + set.reps, 0);
    }, 0) || 0;

    return (
        <SafeAreaView className="flex-1 bg-gray-950" edges={['top']}>
            <Stack.Screen options={{
                title: 'Workout Summary',
                headerShown: true,
                headerStyle: { backgroundColor: '#030712' },
                headerTintColor: '#fff',
                headerLeft: () => (
                    <TouchableOpacity onPress={() => router.back()} className="mr-4">
                        <Ionicons name="chevron-back" size={28} color="white" />
                    </TouchableOpacity>
                )
            }} />

            <ScrollView className="flex-1 px-6">
                <View className="py-6">
                    <Text className="text-3xl font-bold text-white mb-2">{workout.workout_name}</Text>
                    <Text className="text-gray-400 text-lg mb-8">
                        {format(new Date(workout.completed_at), 'EEEE, MMMM d, yyyy')}
                    </Text>

                    {/* Stats Row */}
                    <View className="flex-row justify-between mb-8">
                        <View className="items-center flex-1">
                            <Text className="text-gray-500 text-xs uppercase tracking-widest mb-1">Duration</Text>
                            <Text className="text-2xl font-bold text-white">{workout.duration_minutes}m</Text>
                        </View>
                        <View className="items-center flex-1 border-x border-gray-800">
                            <Text className="text-gray-500 text-xs uppercase tracking-widest mb-1">Volume</Text>
                            <Text className="text-2xl font-bold text-white">{totalVolume.toFixed(0)}kg</Text>
                        </View>
                        <View className="items-center flex-1">
                            <Text className="text-gray-500 text-xs uppercase tracking-widest mb-1">Sets</Text>
                            <Text className="text-2xl font-bold text-white">
                                {workout.workout_exercises?.reduce((acc: number, ex: any) => acc + (ex.workout_sets?.length || 0), 0)}
                            </Text>
                        </View>
                    </View>

                    {/* Exercises List */}
                    <Text className="text-gray-400 font-bold mb-4 uppercase text-xs tracking-widest">Exercises</Text>
                    {workout.workout_exercises?.map((ex: any, i: number) => (
                        <View key={i} className="bg-gray-900 rounded-2xl p-5 mb-4 border border-gray-800">
                            <Text className="text-xl font-bold text-blue-400 mb-3">{ex.exercise?.name}</Text>

                            <View className="space-y-2">
                                {ex.workout_sets?.map((set: any, si: number) => (
                                    <View key={si} className="flex-row justify-between items-center py-1">
                                        <Text className="text-gray-500 font-medium w-8">Set {set.set_number}</Text>
                                        <Text className="text-gray-200 font-bold flex-1 text-center">
                                            {set.weight_kg} kg × {set.reps}
                                        </Text>
                                        <Text className="text-gray-500 w-16 text-right">
                                            {(set.weight_kg * set.reps).toFixed(0)} kg
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="bg-gray-900 border border-gray-800 py-4 rounded-2xl mt-4"
                    >
                        <Text className="text-white text-center font-bold text-lg">Close</Text>
                    </TouchableOpacity>

                    <View className="h-10" />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
