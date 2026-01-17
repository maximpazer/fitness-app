import { useAuthContext } from '@/context/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { profileService } from '@/services/profile.service';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

type OnboardingForm = {
    height_cm: string;
    weight_kg: string;
    age: string;
    fitness_level: 'beginner' | 'intermediate' | 'advanced';
    primary_goal: string;
    training_days_per_week: number;
};

export default function Onboarding() {
    const { user } = useAuth();
    const { refreshProfile } = useAuthContext();
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // React Hook Form setup
    const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<OnboardingForm>({
        defaultValues: {
            training_days_per_week: 3,
            fitness_level: 'beginner'
        }
    });

    const onSubmit = async (data: OnboardingForm) => {
        if (!user) return;
        setLoading(true);

        try {
            const currentYear = new Date().getFullYear();
            const birthYear = currentYear - parseInt(data.age);
            const birthDate = `${birthYear}-01-01`; // Approximation

            const { error } = await profileService.updateProfile(user.id, {
                height_cm: parseFloat(data.height_cm),
                weight_kg: parseFloat(data.weight_kg),
                birth_date: birthDate,
                fitness_level: data.fitness_level,
                primary_goal: data.primary_goal,
                training_days_per_week: data.training_days_per_week
            });

            if (error) throw error;

            console.log("Profile updated successfully!");
            await refreshProfile();
            router.replace('/(tabs)');

        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    const nextStep = () => setStep(s => s + 1);
    const prevStep = () => setStep(s => s - 1);

    const renderStep = () => {
        switch (step) {
            case 1: // Welcome
                return (
                    <Animated.View entering={FadeInRight} exiting={FadeOutLeft} className="flex-1 justify-center items-center p-6">
                        <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-4 text-center">Welcome!</Text>
                        <Text className="text-lg text-gray-600 dark:text-gray-300 text-center mb-10">
                            Let's tailor your fitness journey. We just need a few details to build your perfect plan.
                        </Text>
                        <TouchableOpacity onPress={nextStep} className="bg-blue-600 w-full p-4 rounded-xl items-center">
                            <Text className="text-white font-bold text-lg">Let's Go</Text>
                        </TouchableOpacity>
                    </Animated.View>
                );

            case 2: // Stats
                return (
                    <Animated.View entering={FadeInRight} exiting={FadeOutLeft} className="flex-1 p-6">
                        <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Physical Stats</Text>
                        <Text className="text-gray-500 mb-8">This helps us calculate your calorie needs.</Text>

                        <Text className="mb-2 font-medium dark:text-white">Height (cm)</Text>
                        <Controller
                            control={control}
                            name="height_cm"
                            rules={{ required: true }}
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl mb-4 text-black dark:text-white"
                                    placeholder="e.g. 180"
                                    keyboardType="numeric"
                                    value={value}
                                    onChangeText={onChange}
                                />
                            )}
                        />

                        <Text className="mb-2 font-medium dark:text-white">Weight (kg)</Text>
                        <Controller
                            control={control}
                            name="weight_kg"
                            rules={{ required: true }}
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl mb-4 text-black dark:text-white"
                                    placeholder="e.g. 75"
                                    keyboardType="numeric"
                                    value={value}
                                    onChangeText={onChange}
                                />
                            )}
                        />

                        <Text className="mb-2 font-medium dark:text-white">Age</Text>
                        <Controller
                            control={control}
                            name="age"
                            rules={{ required: true }}
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl mb-8 text-black dark:text-white"
                                    placeholder="e.g. 25"
                                    keyboardType="numeric"
                                    value={value}
                                    onChangeText={onChange}
                                />
                            )}
                        />

                        <View className="flex-row gap-4">
                            <TouchableOpacity onPress={prevStep} className="bg-gray-200 dark:bg-gray-700 p-4 rounded-xl flex-1 items-center">
                                <Text className="font-bold dark:text-white">Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSubmit(() => nextStep())} className="bg-blue-600 p-4 rounded-xl flex-1 items-center">
                                <Text className="text-white font-bold">Next</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                );

            case 3: // Fitness Level
                return (
                    <Animated.View entering={FadeInRight} exiting={FadeOutLeft} className="flex-1 p-6">
                        <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Fitness Level</Text>
                        <Text className="text-gray-500 mb-8">Be honest! We'll start at your pace.</Text>

                        {['beginner', 'intermediate', 'advanced'].map((level) => (
                            <TouchableOpacity
                                key={level}
                                onPress={() => { setValue('fitness_level', level as any); nextStep(); }}
                                className={`p-6 rounded-xl mb-4 border-2 ${watch('fitness_level') === level ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-800'}`}
                            >
                                <Text className="text-lg font-bold capitalize dark:text-white">{level}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity onPress={prevStep} className="mt-4 p-4 items-center">
                            <Text className="text-gray-500">Back</Text>
                        </TouchableOpacity>
                    </Animated.View>
                );

            case 4: // Primary Goal
                return (
                    <Animated.View entering={FadeInRight} exiting={FadeOutLeft} className="flex-1 p-6">
                        <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Primary Goal</Text>
                        <Text className="text-gray-500 mb-8">What do you want to achieve?</Text>

                        <Controller
                            control={control}
                            name="primary_goal"
                            rules={{ required: true }}
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl mb-8 text-black dark:text-white text-lg"
                                    placeholder="e.g. Build muscle, Lose weight..."
                                    value={value}
                                    onChangeText={onChange}
                                    autoFocus
                                />
                            )}
                        />

                        <View className="flex-row gap-4">
                            <TouchableOpacity onPress={prevStep} className="bg-gray-200 dark:bg-gray-700 p-4 rounded-xl flex-1 items-center">
                                <Text className="font-bold dark:text-white">Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSubmit(() => nextStep())} className="bg-blue-600 p-4 rounded-xl flex-1 items-center">
                                <Text className="text-white font-bold">Next</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                );

            case 5: // Training Schedule
                return (
                    <Animated.View entering={FadeInRight} exiting={FadeOutLeft} className="flex-1 p-6">
                        <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Schedule</Text>
                        <Text className="text-gray-500 mb-8">Days per week you can commit to.</Text>

                        <View className="items-center mb-10">
                            <Text className="text-6xl font-bold text-blue-600 mb-4">{watch('training_days_per_week')}</Text>
                            <Text className="text-gray-500">Days / Week</Text>
                        </View>

                        <View className="flex-row justify-between mb-8">
                            {[1, 2, 3, 4, 5, 6, 7].map(num => (
                                <TouchableOpacity
                                    key={num}
                                    onPress={() => setValue('training_days_per_week', num)}
                                    className={`w-10 h-10 rounded-full items-center justify-center ${watch('training_days_per_week') === num ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-800'}`}
                                >
                                    <Text className={`font-bold ${watch('training_days_per_week') === num ? 'text-white' : 'text-gray-900 dark:text-gray-400'}`}>{num}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            onPress={handleSubmit(onSubmit)}
                            disabled={loading}
                            className={`w-full bg-green-600 p-4 rounded-xl items-center mb-4 ${loading ? 'opacity-70' : ''}`}
                        >
                            {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Finish Setup</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={prevStep} className="p-4 items-center">
                            <Text className="text-gray-500">Back</Text>
                        </TouchableOpacity>
                    </Animated.View>
                );

            default:
                return null;
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white dark:bg-black">
            {renderStep()}
        </SafeAreaView>
    );
}
