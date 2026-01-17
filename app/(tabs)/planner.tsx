import { generateGeminiContent } from '@/lib/gemini';
import { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Planner() {
    const [goal, setGoal] = useState('');
    const [loading, setLoading] = useState(false);
    const [plan, setPlan] = useState('');

    const generatePlan = async () => {
        if (!goal.trim()) {
            Alert.alert("Input Required", "Please enter a fitness goal.");
            return;
        }
        setLoading(true);
        try {
            const prompt = `My goal is: ${goal}. Generate a brief daily workout plan based on this goal. Keep it concise.`;
            const text = await generateGeminiContent(prompt, "You are an expert fitness trainer.");
            setPlan(text);
        } catch (e: any) {
            console.error(e);
            setPlan('Error generating plan.\n\n' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-100 dark:bg-black" edges={['top']}>
            <ScrollView className="flex-1 p-4">
                <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-6 pt-4">AI Planner</Text>

                <View className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-sm mb-6">
                    <Text className="mb-2 font-medium text-gray-700 dark:text-gray-300">What is your goal?</Text>
                    <TextInput
                        className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 rounded-xl mb-4 text-gray-900 dark:text-white"
                        placeholder="e.g. Build muscle, Run a 5k, Lose 5 lbs"
                        placeholderTextColor="#9ca3af"
                        value={goal}
                        onChangeText={setGoal}
                        multiline
                    />
                    <TouchableOpacity
                        className={`bg-blue-600 p-4 rounded-xl items-center ${loading ? 'opacity-70' : ''}`}
                        onPress={generatePlan}
                        disabled={loading}
                    >
                        <Text className="text-white font-bold text-lg">{loading ? 'Designing Plan...' : 'Generate Plan'}</Text>
                    </TouchableOpacity>
                </View>

                {plan ? (
                    <View className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm mb-10">
                        <Text className="text-lg font-bold text-gray-900 dark:text-white mb-4">Your Custom Plan</Text>
                        <Text className="text-gray-700 dark:text-gray-300 leading-6">{plan}</Text>
                    </View>
                ) : (
                    <View className="items-center py-10 opacity-50">
                        <Text className="text-6xl mb-2">📅</Text>
                        <Text className="text-gray-500">Enter a goal to get started</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
