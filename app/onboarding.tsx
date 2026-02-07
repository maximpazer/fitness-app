import { NumericTextInput } from '@/components/NumericTextInput';
import { useAuthContext } from '@/context/AuthContext';
import { useNumericKeypad } from '@/context/NumericKeypadContext';
import { useAuth } from '@/hooks/useAuth';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Profile } from '@/lib/database.types';
import { profileService } from '@/services/profile.service';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

type OnboardingForm = {
    height_cm: string;
    weight_kg: string;
    age: string;
    gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    fitness_level: 'beginner' | 'intermediate' | 'advanced';
    training_location: 'commercial_gym' | 'home_gym' | 'bodyweight_only';
    primary_goal: 'build_muscle' | 'get_stronger' | 'improve_fitness' | 'maintain';
    training_days_preference: '2-3' | '3-4' | '4-5' | '5+';
};

export default function Onboarding() {
    const { user } = useAuth();
    const { refreshProfile, setProfileLocal, profile } = useAuthContext();
    const router = useRouter();
    const { showDialog } = useConfirmDialog();

    if (!user) return null;
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const totalSteps = 6;
    const heightRef = useRef<TextInput>(null);
    const weightRef = useRef<TextInput>(null);
    const ageRef = useRef<TextInput>(null);
    const scrollRef = useRef<ScrollView>(null);
    const [sexSectionY, setSexSectionY] = useState<number | null>(null);
    const { close: closeKeypad } = useNumericKeypad();

    // React Hook Form setup
    const { control, handleSubmit } = useForm<OnboardingForm>({
        defaultValues: {
            height_cm: '',
            weight_kg: '',
            age: '',
            gender: 'prefer_not_to_say',
            fitness_level: 'beginner',
            training_location: 'commercial_gym',
            primary_goal: 'build_muscle',
            training_days_preference: '3-4'
        }
    });

    const onSubmit = async (formData: OnboardingForm) => {
        if (!user) return;
        setLoading(true);

        console.log('Onboarding form data:', formData);

        try {
            const trainingDaysMap: Record<OnboardingForm['training_days_preference'], number> = {
                '2-3': 3,
                '3-4': 4,
                '4-5': 5,
                '5+': 6
            };
            const goalLabels: Record<OnboardingForm['primary_goal'], string> = {
                build_muscle: 'Build muscle',
                get_stronger: 'Get stronger',
                improve_fitness: 'Improve general fitness',
                maintain: 'Maintain'
            };
            const equipmentLabels: Record<OnboardingForm['training_location'], string[]> = {
                commercial_gym: ['Commercial gym'],
                home_gym: ['Home gym'],
                bodyweight_only: ['Bodyweight only']
            };
            const height = parseFloat(formData.height_cm);
            const weight = parseFloat(formData.weight_kg);
            const ageNum = parseInt(formData.age, 10);

            if (!Number.isFinite(height) || !Number.isFinite(weight) || !Number.isFinite(ageNum)) {
                throw new Error('Please enter valid numbers for height, weight, and age.');
            }

            const currentYear = new Date().getFullYear();
            const birthYear = currentYear - ageNum;
            const birthDate = `${birthYear}-01-01`; // Approximation

            const displayName =
                profile?.display_name ||
                (user?.user_metadata as any)?.full_name ||
                user?.email?.split('@')[0] ||
                'Athlete';

            const { data: updatedProfile, error } = await profileService.updateProfile(user.id, {
                display_name: displayName,
                height_cm: height,
                weight_kg: weight,
                birth_date: birthDate,
                gender: formData.gender,
                fitness_level: formData.fitness_level,
                primary_goal: goalLabels[formData.primary_goal],
                training_days_per_week: trainingDaysMap[formData.training_days_preference],
                available_equipment: equipmentLabels[formData.training_location]
            });

            console.log('Profile update result:', { updatedProfile, error });

            if (error) throw error;

            if (updatedProfile) {
                setProfileLocal(updatedProfile as Profile);
            }
            await refreshProfile();
            router.replace('/(tabs)');

        } catch (e: any) {
            showDialog('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    const nextStep = () => setStep(s => s < 6 ? s + 1 : s);
    const prevStep = () => setStep(s => s > 1 ? s - 1 : s);

    const renderStep = () => {
        switch (step) {
            case 1: // Welcome
                return (
                    <Animated.View entering={FadeInUp} exiting={FadeOutDown} className="flex-1 px-6 justify-center items-center w-full">
                        <View className="items-center w-full max-w-xl">
                            <Text className="text-3xl font-bold text-white text-center mb-2">
                                {profile?.display_name ? `Welcome, ${profile.display_name}` : 'Welcome'}
                            </Text>
                            <Text className="text-gray-400 text-center mb-8">
                                Let’s set up your training plan with a few quick questions.
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={nextStep}
                            className="bg-blue-600 px-6 py-4 rounded-2xl items-center w-full max-w-[320px] self-center shadow-lg shadow-blue-500/20"
                        >
                            <Text className="text-white font-bold text-lg">Let’s Start</Text>
                        </TouchableOpacity>
                    </Animated.View>
                );

            case 2: // Basics
                return (
                    <Animated.View entering={FadeInUp} exiting={FadeOutDown} className="flex-1 p-6">
                        <View className="items-center mb-6">
                            <Text className="text-2xl font-bold text-white text-center mb-1">Quick Basics</Text>
                            <Text className="text-gray-400 text-center">Personalize your plan in a minute.</Text>
                        </View>

                        <View className="flex-row gap-4">
                            <View className="flex-1">
                                <Text className="mb-2 font-medium text-gray-200">Height (cm)</Text>
                                <Controller
                                    control={control}
                                    name="height_cm"
                                    rules={{ required: true }}
                                    render={({ field: { onChange, value } }) => (
                                        <NumericTextInput
                                            ref={heightRef}
                                            className="bg-gray-900 border border-gray-800 p-4 rounded-2xl mb-4 text-white"
                                            placeholder="180"
                                            placeholderTextColor="#6b7280"
                                            value={value}
                                            onChangeText={onChange}
                                            allowDecimal={false}
                                            onNext={() => weightRef.current?.focus()}
                                        />
                                    )}
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="mb-2 font-medium text-gray-200">Weight (kg)</Text>
                                <Controller
                                    control={control}
                                    name="weight_kg"
                                    rules={{ required: true }}
                                    render={({ field: { onChange, value } }) => (
                                        <NumericTextInput
                                            ref={weightRef}
                                            className="bg-gray-900 border border-gray-800 p-4 rounded-2xl mb-4 text-white"
                                            placeholder="75"
                                            placeholderTextColor="#6b7280"
                                            value={value}
                                            onChangeText={onChange}
                                            step={0.5}
                                            onNext={() => ageRef.current?.focus()}
                                        />
                                    )}
                                />
                            </View>
                        </View>

                        <Text className="mb-2 font-medium text-gray-200">Age</Text>
                        <Controller
                            control={control}
                            name="age"
                            rules={{ required: true }}
                            render={({ field: { onChange, value } }) => (
                                <NumericTextInput
                                    ref={ageRef}
                                    className="bg-gray-900 border border-gray-800 p-4 rounded-2xl mb-6 text-white"
                                    placeholder="25"
                                    placeholderTextColor="#6b7280"
                                    value={value}
                                    onChangeText={onChange}
                                    allowDecimal={false}
                                    onNext={() => {
                                        closeKeypad();
                                        if (sexSectionY !== null) {
                                            scrollRef.current?.scrollTo({ y: sexSectionY, animated: true });
                                        }
                                    }}
                                />
                            )}
                        />

                        <View
                            onLayout={(event) => setSexSectionY(event.nativeEvent.layout.y)}
                        >
                            <Text className="mb-3 font-medium text-gray-200">Sex</Text>
                            <Controller
                                control={control}
                                name="gender"
                                rules={{ required: true }}
                                render={({ field: { onChange, value } }) => (
                                    <View className="flex-row flex-wrap gap-3 mb-8">
                                        {[
                                            { key: 'male', label: 'Male' },
                                            { key: 'female', label: 'Female' },
                                            { key: 'other', label: 'Other' },
                                            { key: 'prefer_not_to_say', label: 'Prefer not to say' }
                                        ].map((option) => {
                                            const isSelected = value === option.key;
                                            return (
                                                <TouchableOpacity
                                                    key={option.key}
                                                    onPress={() => onChange(option.key as OnboardingForm['gender'])}
                                                    className={`px-4 py-3 rounded-full border ${isSelected ? 'border-blue-500 bg-blue-900/30' : 'border-gray-800 bg-gray-900'}`}
                                                >
                                                    <Text className={`font-semibold ${isSelected ? 'text-blue-300' : 'text-gray-200'}`}>
                                                        {option.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )}
                            />
                        </View>

                        <TouchableOpacity onPress={handleSubmit(() => nextStep())} className="bg-blue-600 p-4 rounded-2xl items-center shadow-lg shadow-blue-500/20">
                            <Text className="text-white font-bold">Next</Text>
                        </TouchableOpacity>
                    </Animated.View>
                );

            case 3: // Training Experience
                return (
                    <Animated.View entering={FadeInUp} exiting={FadeOutDown} className="flex-1 p-6">
                        <View className="items-center mb-6">
                            <Text className="text-2xl font-bold text-white text-center mb-1">Training Experience</Text>
                            <Text className="text-gray-400 text-center">How long have you been training regularly?</Text>
                        </View>

                        <Controller
                            control={control}
                            name="fitness_level"
                            rules={{ required: true }}
                            render={({ field: { onChange, value } }) => (
                                <>
                                    {[
                                        { key: 'beginner', label: 'New / Beginner', hint: 'Just getting started or returning.' },
                                        { key: 'intermediate', label: 'Intermediate', hint: 'Consistent training, solid foundation.' },
                                        { key: 'advanced', label: 'Advanced', hint: 'Years of structured training.' }
                                    ].map((option) => {
                                        const isSelected = value === option.key;
                                        return (
                                            <TouchableOpacity
                                                key={option.key}
                                                onPress={() => { onChange(option.key as OnboardingForm['fitness_level']); nextStep(); }}
                                                className={`p-5 rounded-2xl mb-4 border ${isSelected ? 'border-blue-500 bg-blue-900/30' : 'border-gray-800 bg-gray-900'}`}
                                            >
                                                <Text className="text-lg font-semibold text-white">{option.label}</Text>
                                                <Text className="text-gray-400 mt-1">{option.hint}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </>
                            )}
                        />

                        <TouchableOpacity onPress={prevStep} className="mt-2 p-4 items-center">
                            <Text className="text-gray-500">Back</Text>
                        </TouchableOpacity>
                    </Animated.View>
                );

            case 4: // Training Location
                return (
                    <Animated.View entering={FadeInUp} exiting={FadeOutDown} className="flex-1 p-6">
                        <View className="items-center mb-6">
                            <Text className="text-2xl font-bold text-white text-center mb-1">Training Location</Text>
                            <Text className="text-gray-400 text-center">Where do you train most often?</Text>
                        </View>

                        <Controller
                            control={control}
                            name="training_location"
                            rules={{ required: true }}
                            render={({ field: { onChange, value } }) => (
                                <>
                                    {[
                                        { key: 'commercial_gym', label: 'Commercial gym', hint: 'Full equipment & machines.' },
                                        { key: 'home_gym', label: 'Home gym', hint: 'Limited equipment at home.' },
                                        { key: 'bodyweight_only', label: 'Bodyweight only', hint: 'Minimal or no equipment.' }
                                    ].map((option) => {
                                        const isSelected = value === option.key;
                                        return (
                                            <TouchableOpacity
                                                key={option.key}
                                                onPress={() => { onChange(option.key as OnboardingForm['training_location']); nextStep(); }}
                                                className={`p-5 rounded-2xl mb-4 border ${isSelected ? 'border-blue-500 bg-blue-900/30' : 'border-gray-800 bg-gray-900'}`}
                                            >
                                                <Text className="text-lg font-semibold text-white">{option.label}</Text>
                                                <Text className="text-gray-400 mt-1">{option.hint}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </>
                            )}
                        />

                        <TouchableOpacity onPress={prevStep} className="mt-2 p-4 items-center">
                            <Text className="text-gray-500">Back</Text>
                        </TouchableOpacity>
                    </Animated.View>
                );

            case 5: // Primary Goal
                return (
                    <Animated.View entering={FadeInUp} exiting={FadeOutDown} className="flex-1 p-6">
                        <View className="items-center mb-6">
                            <Text className="text-2xl font-bold text-white text-center mb-1">Primary Goal</Text>
                            <Text className="text-gray-400 text-center">What’s your main goal right now?</Text>
                        </View>

                        <Controller
                            control={control}
                            name="primary_goal"
                            rules={{ required: true }}
                            render={({ field: { onChange, value } }) => (
                                <>
                                    {[
                                        { key: 'build_muscle', label: 'Build muscle', hint: 'Hypertrophy focus.' },
                                        { key: 'get_stronger', label: 'Get stronger', hint: 'Prioritize strength gains.' },
                                        { key: 'improve_fitness', label: 'Improve general fitness', hint: 'Energy, conditioning, balance.' },
                                        { key: 'maintain', label: 'Maintain', hint: 'Stay consistent and healthy.' }
                                    ].map((option) => {
                                        const isSelected = value === option.key;
                                        return (
                                            <TouchableOpacity
                                                key={option.key}
                                                onPress={() => { onChange(option.key as OnboardingForm['primary_goal']); nextStep(); }}
                                                className={`p-5 rounded-2xl mb-4 border ${isSelected ? 'border-blue-500 bg-blue-900/30' : 'border-gray-800 bg-gray-900'}`}
                                            >
                                                <Text className="text-lg font-semibold text-white">{option.label}</Text>
                                                <Text className="text-gray-400 mt-1">{option.hint}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </>
                            )}
                        />

                        <TouchableOpacity onPress={prevStep} className="mt-2 p-4 items-center">
                            <Text className="text-gray-500">Back</Text>
                        </TouchableOpacity>
                    </Animated.View>
                );

            case 6: // Training Schedule
                return (
                    <Animated.View entering={FadeInUp} exiting={FadeOutDown} className="flex-1 p-6">
                        <View className="items-center mb-6">
                            <Text className="text-2xl font-bold text-white text-center mb-1">Training Schedule</Text>
                            <Text className="text-gray-400 text-center">How many days per week do you want to train?</Text>
                        </View>

                        <Controller
                            control={control}
                            name="training_days_preference"
                            rules={{ required: true }}
                            render={({ field: { onChange, value } }) => (
                                <>
                                    {[
                                        { key: '2-3', label: '2–3 days', hint: 'Light, sustainable routine.' },
                                        { key: '3-4', label: '3–4 days', hint: 'Balanced and flexible.' },
                                        { key: '4-5', label: '4–5 days', hint: 'Higher volume focus.' },
                                        { key: '5+', label: '5+ days', hint: 'Very active schedule.' }
                                    ].map((option) => {
                                        const isSelected = value === option.key;
                                        return (
                                            <TouchableOpacity
                                                key={option.key}
                                                onPress={() => onChange(option.key as OnboardingForm['training_days_preference'])}
                                                className={`p-5 rounded-2xl mb-4 border ${isSelected ? 'border-blue-500 bg-blue-900/30' : 'border-gray-800 bg-gray-900'}`}
                                            >
                                                <Text className="text-lg font-semibold text-white">{option.label}</Text>
                                                <Text className="text-gray-400 mt-1">{option.hint}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </>
                            )}
                        />

                        <TouchableOpacity
                            onPress={handleSubmit(onSubmit)}
                            disabled={loading}
                            className={`w-full bg-blue-600 p-4 rounded-2xl items-center mb-4 shadow-lg shadow-blue-500/20 ${loading ? 'opacity-70' : ''}`}
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
        <SafeAreaView className="flex-1 bg-gray-950">
            <ScrollView ref={scrollRef} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
                <View className="px-6 pt-4">
                    <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-gray-500">Step {step} of {totalSteps}</Text>
                        <View className="flex-row gap-2">
                            {Array.from({ length: totalSteps }).map((_, index) => (
                                <View
                                    key={index}
                                    className={`h-1.5 w-6 rounded-full ${index + 1 <= step ? 'bg-blue-500' : 'bg-gray-800'}`}
                                />
                            ))}
                        </View>
                    </View>
                </View>
                {renderStep()}
            </ScrollView>
        </SafeAreaView>
    );
}
