import { useAuthContext } from '@/context/AuthContext';
import { Profile } from '@/lib/database.types';
import { profileService } from '@/services/profile.service';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Types ───────────────────────────────────────────────────────────
type StepId = 'goal' | 'frequency' | 'experience' | 'equipment';

type Option = {
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    hint: string;
};

// ─── Data ────────────────────────────────────────────────────────────
const GOALS: Option[] = [
    { key: 'build_muscle', icon: 'barbell', label: 'Build Muscle', hint: 'Hypertrophy & size gains' },
    { key: 'get_stronger', icon: 'trending-up', label: 'Get Stronger', hint: 'Prioritise strength & power' },
    { key: 'lose_fat', icon: 'flame', label: 'Lose Fat', hint: 'Cut weight while preserving muscle' },
    { key: 'improve_fitness', icon: 'heart', label: 'General Fitness', hint: 'Conditioning, health, energy' },
    { key: 'maintain', icon: 'shield-checkmark', label: 'Maintain', hint: 'Keep current level & stay healthy' },
];

const FREQUENCIES: Option[] = [
    { key: '2-3', icon: 'calendar-outline', label: '2\u20133 days', hint: 'Great for starting out' },
    { key: '3-4', icon: 'calendar', label: '3\u20134 days', hint: 'Balanced & sustainable' },
    { key: '4-5', icon: 'calendar-sharp', label: '4\u20135 days', hint: 'Dedicated training split' },
    { key: '5+', icon: 'fitness', label: '5+ days', hint: 'Advanced high-frequency' },
];

const EXPERIENCE: Option[] = [
    { key: 'beginner', icon: 'leaf', label: 'Beginner', hint: 'New or returning to training' },
    { key: 'intermediate', icon: 'flash', label: 'Intermediate', hint: '1\u20133 years consistent training' },
    { key: 'advanced', icon: 'trophy', label: 'Advanced', hint: '3+ years structured lifting' },
];

const EQUIPMENT: Option[] = [
    { key: 'commercial_gym', icon: 'business', label: 'Full Gym', hint: 'Machines, cables, racks, dumbbells' },
    { key: 'home_gym', icon: 'home', label: 'Home Gym', hint: 'Some weights & a bench' },
    { key: 'bodyweight_only', icon: 'body', label: 'Bodyweight Only', hint: 'No equipment needed' },
];

const STEPS: { id: StepId; title: string; subtitle: string; options: Option[] }[] = [
    { id: 'goal', title: "What's your goal?", subtitle: 'Pick the one that matters most right now.', options: GOALS },
    { id: 'frequency', title: 'How often can you train?', subtitle: 'Be realistic \u2014 consistency beats volume.', options: FREQUENCIES },
    { id: 'experience', title: 'Training experience', subtitle: 'This helps us tailor exercise selection.', options: EXPERIENCE },
    { id: 'equipment', title: 'Where do you train?', subtitle: "We'll match exercises to your setup.", options: EQUIPMENT },
];

const TOTAL_STEPS = STEPS.length;

// ─── Component ───────────────────────────────────────────────────────
export default function Onboarding() {
    const { user, profile, refreshProfile, setProfileLocal } = useAuthContext();
    const router = useRouter();

    const [step, setStep] = useState(0);
    const [answers, setAnswers] = useState<Record<StepId, string>>({
        goal: profile?.primary_goal?.includes('muscle') ? 'build_muscle'
            : profile?.primary_goal?.includes('strong') ? 'get_stronger'
            : profile?.primary_goal?.includes('fat') ? 'lose_fat'
            : profile?.primary_goal?.includes('fitness') ? 'improve_fitness'
            : profile?.primary_goal?.includes('Maintain') ? 'maintain'
            : '',
        frequency: profile?.training_days_per_week
            ? profile.training_days_per_week <= 3 ? '2-3'
            : profile.training_days_per_week <= 4 ? '3-4'
            : profile.training_days_per_week <= 5 ? '4-5'
            : '5+'
            : '',
        experience: profile?.fitness_level || '',
        equipment: profile?.available_equipment?.[0]?.toLowerCase().includes('commercial') ? 'commercial_gym'
            : profile?.available_equipment?.[0]?.toLowerCase().includes('home') ? 'home_gym'
            : profile?.available_equipment?.[0]?.toLowerCase().includes('body') ? 'bodyweight_only'
            : '',
    });
    const [saving, setSaving] = useState(false);

    if (!user) return null;

    const currentStep = STEPS[step];
    const isLastStep = step === TOTAL_STEPS - 1;
    const canAdvance = !!answers[currentStep.id];

    // ── Handlers ──────────────────────────────────────────────────────
    const selectOption = (key: string) => {
        setAnswers(prev => ({ ...prev, [currentStep.id]: key }));
        // Auto-advance after a short delay unless last step
        if (!isLastStep) {
            setTimeout(() => setStep(s => s + 1), 300);
        }
    };

    const goBack = () => {
        if (step > 0) setStep(s => s - 1);
    };

    const finish = async () => {
        if (saving) return;
        setSaving(true);

        const goalLabels: Record<string, string> = {
            build_muscle: 'Build muscle',
            get_stronger: 'Get stronger',
            lose_fat: 'Lose fat',
            improve_fitness: 'Improve general fitness',
            maintain: 'Maintain',
        };
        const trainingDaysMap: Record<string, number> = {
            '2-3': 3, '3-4': 4, '4-5': 5, '5+': 6,
        };
        const equipmentLabels: Record<string, string[]> = {
            commercial_gym: ['Commercial gym'],
            home_gym: ['Home gym'],
            bodyweight_only: ['Bodyweight only'],
        };

        const displayName =
            profile?.display_name ||
            (user?.user_metadata as any)?.full_name ||
            user?.email?.split('@')[0] ||
            'Athlete';

        try {
            const { data: updatedProfile, error } = await profileService.updateProfile(user.id, {
                display_name: displayName,
                fitness_level: answers.experience as Profile['fitness_level'],
                primary_goal: goalLabels[answers.goal] || answers.goal,
                training_days_per_week: trainingDaysMap[answers.frequency] || 4,
                available_equipment: equipmentLabels[answers.equipment] || ['Commercial gym'],
            });

            if (error) throw error;
            if (updatedProfile) setProfileLocal(updatedProfile as Profile);
            await refreshProfile();
            router.replace('/(tabs)');
        } catch (e: any) {
            console.error('Onboarding save error:', e);
            // still navigate — better than getting stuck
            router.replace('/(tabs)');
        } finally {
            setSaving(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────
    return (
        <SafeAreaView className="flex-1 bg-gray-950">
            {/* Progress bar */}
            <View className="px-6 pt-4 pb-2">
                <View className="flex-row items-center justify-between mb-3">
                    {step > 0 ? (
                        <TouchableOpacity onPress={goBack} hitSlop={12} className="flex-row items-center">
                            <Ionicons name="chevron-back" size={20} color="#9ca3af" />
                            <Text className="text-gray-400 text-sm ml-1">Back</Text>
                        </TouchableOpacity>
                    ) : (
                        <View />
                    )}
                    <Text className="text-gray-500 text-xs font-medium">
                        {step + 1} / {TOTAL_STEPS}
                    </Text>
                </View>
                <View className="flex-row gap-2">
                    {STEPS.map((_, i) => (
                        <View
                            key={i}
                            className={`flex-1 h-1 rounded-full ${i <= step ? 'bg-blue-500' : 'bg-gray-800'}`}
                        />
                    ))}
                </View>
            </View>

            {/* Step content */}
            <Animated.View
                key={currentStep.id}
                entering={FadeInDown.duration(350)}
                className="flex-1 px-6 pt-8"
            >
                {/* Title */}
                <View className="mb-8">
                    <Text className="text-3xl font-bold text-white mb-2">
                        {currentStep.title}
                    </Text>
                    <Text className="text-gray-400 text-base leading-6">
                        {currentStep.subtitle}
                    </Text>
                </View>

                {/* Options */}
                <View className="gap-3">
                    {currentStep.options.map((option, idx) => {
                        const isSelected = answers[currentStep.id] === option.key;
                        return (
                            <Animated.View
                                key={option.key}
                                entering={FadeInDown.delay(idx * 60).duration(300)}
                            >
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => selectOption(option.key)}
                                    className={`flex-row items-center p-4 rounded-2xl border ${
                                        isSelected
                                            ? 'border-blue-500 bg-blue-600/15'
                                            : 'border-gray-800 bg-gray-900'
                                    }`}
                                >
                                    <View
                                        className={`w-11 h-11 rounded-xl items-center justify-center mr-4 ${
                                            isSelected ? 'bg-blue-600/30' : 'bg-gray-800'
                                        }`}
                                    >
                                        <Ionicons
                                            name={option.icon}
                                            size={22}
                                            color={isSelected ? '#60a5fa' : '#9ca3af'}
                                        />
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`text-base font-semibold ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                                            {option.label}
                                        </Text>
                                        <Text className="text-gray-500 text-sm mt-0.5">
                                            {option.hint}
                                        </Text>
                                    </View>
                                    {isSelected && (
                                        <View className="w-6 h-6 rounded-full bg-blue-600 items-center justify-center">
                                            <Ionicons name="checkmark" size={16} color="white" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </Animated.View>
                        );
                    })}
                </View>
            </Animated.View>

            {/* Bottom CTA — only on last step */}
            {isLastStep && canAdvance && (
                <Animated.View entering={FadeInUp.duration(300)} className="px-6 pb-4">
                    <TouchableOpacity
                        onPress={finish}
                        disabled={saving}
                        activeOpacity={0.8}
                        className={`bg-blue-600 py-4 rounded-2xl items-center shadow-lg shadow-blue-500/30 ${saving ? 'opacity-70' : ''}`}
                    >
                        {saving ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-bold text-lg">Get Started</Text>
                        )}
                    </TouchableOpacity>
                </Animated.View>
            )}
        </SafeAreaView>
    );
}
