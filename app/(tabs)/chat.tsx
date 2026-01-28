import { useAuthContext } from '@/context/AuthContext';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ChatMessage, generateGeminiContent } from '@/lib/gemini';
import { dashboardService } from '@/services/dashboard.service';
import { exerciseService } from '@/services/exercise.service';
import { metricsService } from '@/services/metrics.service';
import { plannerService } from '@/services/planner.service';
import { workoutService } from '@/services/workout.service';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Message = {
    role: 'user' | 'model';
    content: string;
    proposal?: any;
    hasSuggestions?: boolean; // AI mentioned changes but no valid JSON
}

// Simple Markdown-ish parser for React Native
const MarkdownText = ({ text, style, isUser }: { text: string, style: any, isUser: boolean }) => {
    // Split into lines to handle bullets
    const lines = text.split('\n');

    return (
        <View>
            {lines.map((line, i) => {
                const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
                const cleanLine = isBullet ? line.trim().substring(2) : line;

                // Simple regex for bold **text**
                const parts = cleanLine.split(/(\*\*.*?\*\*)/g);

                return (
                    <View key={i} className={`flex-row flex-wrap ${isBullet ? 'pl-2 mb-1' : 'mb-1'}`}>
                        {isBullet && <Text className={isUser ? "text-white mr-2" : "text-blue-500 mr-2"}>•</Text>}
                        <Text style={style}>
                            {parts.map((part, j) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                    return (
                                        <Text key={j} className="font-bold">
                                            {part.substring(2, part.length - 2)}
                                        </Text>
                                    );
                                }
                                return <Text key={j}>{part}</Text>;
                            })}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
};

export default function Chat() {
    const { user, profile } = useAuthContext();
    const { showDialog } = useConfirmDialog();
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: 'Hi! I\'m your AI fitness coach. I have access to your profile and workout history. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [metadata, setMetadata] = useState<any>(null);
    const flatListRef = useRef<FlatList>(null);
    const { mode } = useLocalSearchParams();

    // Shared helpers
    const cleanJson = (str: string) => {
        return str
            .replace(/\/\/.*$/gm, '') // Remove single line comments
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
            .trim();
    };

    const mapProposalExercises = (p: any) => {
        if (!p || !p.days) return p;
        const exercises = metadata?.exercises || [];
        return {
            ...p,
            days: p.days.map((day: any) => ({
                ...day,
                exercises: day.exercises.map((ex: any) => {
                    if (ex.exercise_id && ex.exercise_id.length > 20) return ex; // Already a UUID
                    const name = ex.exercise_name || ex.name;
                    const found = exercises.find((e: any) => e.name.toLowerCase() === name?.toLowerCase())
                        || exercises.find((e: any) => e.name.toLowerCase().includes(name?.toLowerCase() || ''));
                    return {
                        ...ex,
                        exercise_id: found?.id || ex.exercise_id
                    };
                }).filter((ex: any) => ex.exercise_id && ex.exercise_id.length > 20) // Filter out unmapped
            }))
        };
    };

    useEffect(() => {
        if (user) {
            loadContext();
        }
    }, [user]);

    useEffect(() => {
        if (mode === 'generate_plan' && messages.length === 1) {
            setMessages([
                {
                    role: 'model',
                    content: "I see you're looking to create a new workout plan! 🚀\n\nTo help me design the perfect program for you, tell me:\n\n1. What's your **primary goal** right now? (e.g. Strength, Weight Loss, Muscle Gain)\n2. How many **days per week** can you realistically train?\n3. Any specific **focus areas** or preferences (e.g. Upper Body focus, Kettlebell only)?"
                }
            ]);
        }
    }, [mode]);

    const loadContext = async () => {
        try {
            const [plan, dashboardData, exercises, weightTrend, detailedHistory] = await Promise.all([
                plannerService.getActivePlan(user!.id),
                dashboardService.getDashboardData(user!.id),
                exerciseService.getExercises(),
                metricsService.getWeightTrend(user!.id, 4), // Last 4 weeks
                workoutService.getDetailedRecentHistory(user!.id, 5) // Last 5 workouts with sets/reps
            ]);

            setMetadata({
                profile,
                activePlan: plan,
                recentActivity: dashboardData?.recentActivity || [],
                exercises: exercises.map((e: any) => ({ id: e.id, name: e.name, category: e.category })),
                weightHistory: weightTrend,
                detailedHistory: detailedHistory
            });
        } catch (e) {
            console.error("Error loading chat context:", e);
        }
    };

    const sendMessage = async () => {
        if (!input.trim() || loading) return;
        const userMsg = input;
        setInput('');

        const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }];
        setMessages(newMessages);
        setLoading(true);

        try {
            // Prepare system instruction with context
            const systemPrompt = `
You are an expert AI Fitness Coach. You have access to the user's data.
Current Profile: ${JSON.stringify(metadata?.profile || {})}
Active Training Plan: ${JSON.stringify(metadata?.activePlan || "No active plan")}
Detailed Recent Workout History (Granular sets/reps/weight): ${JSON.stringify(metadata?.detailedHistory || [])}
Weight History (Date/KG): ${JSON.stringify(metadata?.weightHistory || [])}
Available Exercises: ${metadata?.exercises?.map((e: any) => e.name).join(', ') || 'None'}

CORE INSTRUCTIONS:
1. Provide personalized fitness/nutrition advice based on logs.
2. Use the "Detailed Recent Workout History" to identify patterns, progress, and plateaus. When the user asks for advice, refer to their actual weights and reps (e.g., "I noticed you hit 60kg for 10 reps on Bench Press last Friday...").
3. Suggest specific progressions (e.g., "Try increasing weight by 2.5kg") based on their performance trends.
4. If suggesting PLAN CHANGES (adding exercises, modifying workouts, creating plans), you MUST generate a COMPLETE JSON proposal wrapped in a code block with the marker: \`\`\`plan_proposal
5. The JSON must follow the CreatePlanDTO structure and include the FULL plan with ALL days and ALL exercises (including both existing and new ones).
6. NEVER describe plan changes without providing the complete JSON. If you mention adding exercises, you MUST include the full updated plan JSON.
7. For exercises, use the exact **names** from the Available Exercises list in an "exercise_name" field.
8. Ensure JSON is valid (no comments, no trailing commas, proper quotes).

CRITICAL: When adding exercises to an existing plan, output the COMPLETE updated plan with ALL existing exercises PLUS the new ones. Do not just list the new exercises - include everything.

CreatePlanDTO Structure:
\`\`\`
{
  "name": "Plan Name",
  "description": "Plan description",
  "duration_weeks": 8,
  "days": [
    {
      "day_number": 1,
      "day_name": "Day Name",
      "day_type": "training",
      "notes": "Optional notes",
      "exercises": [
        {
          "exercise_name": "Exact Name from list",
          "order_in_workout": 1,
          "target_sets": 3,
          "target_reps_min": 8,
          "target_reps_max": 12,
          "target_rpe": 8,
          "rest_seconds": 90,
          "notes": "Optional notes"
        }
      ]
    }
  ]
}
\`\`\`

Example correct format for plan changes:
\`\`\`plan_proposal
{"name":"Updated Plan","description":"...","duration_weeks":8,"days":[...all days with all exercises...]}
\`\`\`

Current Date: ${format(new Date(), 'yyyy-MM-dd')}
`;

            const geminiHistory: ChatMessage[] = newMessages.map(m => ({
                role: m.role,
                parts: [{ text: m.content }]
            }));

            const reply = await generateGeminiContent(geminiHistory, systemPrompt);

            // Look for proposal - More robust regex
            let cleanReply = reply;
            let proposal = null;

            // Try plan_proposal block first
            const proposalMatch = reply.match(/```plan_proposal\s*([\s\S]*?)\s*```/i);

            if (proposalMatch) {
                try {
                    const jsonStr = cleanJson(proposalMatch[1]);
                    proposal = mapProposalExercises(JSON.parse(jsonStr));
                    cleanReply = reply.replace(proposalMatch[0], '').trim();
                } catch (e) {
                    console.error("Failed to parse plan_proposal JSON", e);
                    // Attempt one more fallback for partial JSON if block was cut off or has junk
                    try {
                        const startIdx = proposalMatch[1].indexOf('{');
                        const endIdx = proposalMatch[1].lastIndexOf('}');
                        if (startIdx !== -1 && endIdx !== -1) {
                            proposal = mapProposalExercises(JSON.parse(cleanJson(proposalMatch[1].substring(startIdx, endIdx + 1))));
                            cleanReply = reply.replace(proposalMatch[0], '').trim();
                        }
                    } catch (innerE) { }
                }
            }

            // Fallback: If no plan_proposal but there is a json block or raw object that looks like a plan
            if (!proposal) {
                const genericJsonMatch = reply.match(/```json\s*([\s\S]*?)\s*```/i);
                const rawJsonMatch = reply.match(/\{[\s\S]*?"days"[\s\S]*?\}/);

                if (genericJsonMatch) {
                    try {
                        const potentialJson = JSON.parse(cleanJson(genericJsonMatch[1]));
                        if (potentialJson.days && Array.isArray(potentialJson.days)) {
                            proposal = mapProposalExercises(potentialJson);
                            cleanReply = reply.replace(genericJsonMatch[0], '').trim();
                        }
                    } catch (e) { }
                } else if (rawJsonMatch) {
                    try {
                        const potentialJson = JSON.parse(cleanJson(rawJsonMatch[0]));
                        if (potentialJson.days && Array.isArray(potentialJson.days)) {
                            proposal = mapProposalExercises(potentialJson);
                            cleanReply = reply.replace(rawJsonMatch[0], '').trim();
                        }
                    } catch (e) { }
                }
            }

            setMessages([...newMessages, { role: 'model', content: cleanReply || "I've prepared a plan update for you:", proposal }]);
        } catch (e) {
            console.error("Chat error:", e);
            setMessages([...newMessages, { role: 'model', content: "Sorry, I'm having trouble connecting to my brain right now. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    const handleApplyProposal = async (proposal: any) => {
        if (!user) return;

        // Validate proposal has required structure
        if (!proposal || !proposal.name || !proposal.days || !Array.isArray(proposal.days)) {
            showDialog("Invalid Proposal", "The plan proposal is missing required fields. Please ask the AI to generate a complete plan.");
            return;
        }

        const isUpdate = !!metadata?.activePlan;

        showDialog(
            isUpdate ? "Apply New Version" : "Create New Plan",
            isUpdate
                ? "The AI suggested some improvements. Would you like to create an updated version of your plan and activate it?"
                : "The AI has generated a new training plan for you. Would you like to set it as your active plan?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: isUpdate ? "Apply Update" : "Create",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            // We ALWAYS use createPlan for AI proposals now.
                            // plannerService.createPlan automatically deactivates the old plan.
                            await plannerService.createPlan(user.id, proposal);

                            showDialog("Success", isUpdate ? "New version created and activated!" : "New plan created and activated!");
                            loadContext(); // Refresh context
                        } catch (e: any) {
                            console.error("Error applying proposal:", e);
                            showDialog("Error", `Failed to apply changes: ${e.message || 'Unknown error'}`);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-950" edges={['top', 'bottom']}>
            <KeyboardAvoidingView 
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >
                <View className="flex-1">
                    {/* Header */}
                    <View className="px-6 py-4 border-b border-gray-900 bg-gray-950">
                        <View className="flex-row items-center justify-between">
                            <View>
                                <Text className="text-2xl font-bold text-white">AI Coach</Text>
                                <View className="flex-row items-center mt-1">
                                    <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                                    <Text className="text-gray-400 text-xs font-medium uppercase tracking-widest">Active & Context Aware</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={loadContext}
                                className="w-10 h-10 bg-gray-900 rounded-full items-center justify-center border border-gray-800"
                            >
                                <Ionicons name="refresh" size={20} color="#3b82f6" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        className="flex-1 px-4"
                        contentContainerStyle={{ 
                            paddingVertical: 20,
                            paddingBottom: 120
                        }}
                        keyExtractor={(_, i) => i.toString()}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                    renderItem={({ item }) => (
                        <View className={`my-3 ${item.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <View className={`p-4 rounded-3xl max-w-[85%] ${item.role === 'user'
                                ? 'bg-blue-600 rounded-tr-sm shadow-sm shadow-blue-500/20'
                                : 'bg-gray-900 border border-gray-800 rounded-tl-sm'
                                }`}>
                                <MarkdownText
                                    text={item.content}
                                    isUser={item.role === 'user'}
                                    style={{
                                        fontSize: 15,
                                        lineHeight: 22,
                                        color: item.role === 'user' ? 'white' : '#e5e7eb'
                                    }}
                                />
                            </View>

                            {item.proposal && (
                                <View className="mt-3 bg-gray-900 border border-blue-500/30 p-5 rounded-3xl w-[90%] shadow-lg">
                                    <View className="flex-row items-center mb-3">
                                        <View className="bg-blue-600/20 p-2 rounded-full">
                                            <Ionicons name="sparkles" size={18} color="#3b82f6" />
                                        </View>
                                        <Text className="text-blue-400 font-bold ml-3 text-lg">Proposed Plan</Text>
                                    </View>

                                    <View className="bg-gray-800/50 rounded-2xl p-4 mb-4">
                                        <Text className="text-white font-bold mb-1 text-base">{item.proposal.name}</Text>
                                        <Text className="text-gray-400 text-sm mb-3 italic">{item.proposal.description}</Text>

                                        {item.proposal.days?.map((day: any, dIdx: number) => (
                                            <View key={dIdx} className="mb-3">
                                                <Text className="text-blue-400 font-semibold mb-1 uppercase text-xs tracking-wider">
                                                    Day {day.day_number}: {day.day_name}
                                                </Text>
                                                {day.exercises?.slice(0, 3).map((ex: any, eIdx: number) => {
                                                    const exName = metadata?.exercises?.find((e: any) => e.id === ex.exercise_id)?.name || "Exercise";
                                                    return (
                                                        <Text key={eIdx} className="text-gray-300 text-sm ml-2" numberOfLines={1}>
                                                            • {exName} ({ex.target_sets} sets)
                                                        </Text>
                                                    );
                                                })}
                                                {(day.exercises?.length > 3) && (
                                                    <Text className="text-gray-500 text-xs ml-2 italic">
                                                        + {day.exercises.length - 3} more exercises
                                                    </Text>
                                                )}
                                            </View>
                                        ))}
                                    </View>

                                    <TouchableOpacity
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            console.log("Applying proposal:", item.proposal.name);
                                            handleApplyProposal(item.proposal);
                                        }}
                                        style={{ shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
                                        className="bg-blue-600 py-4 rounded-2xl items-center flex-row justify-center active:bg-blue-700"
                                    >
                                        <Text className="text-white font-bold text-base mr-2">Apply Changes</Text>
                                        <Ionicons name="checkmark-circle" size={20} color="white" />
                                    </TouchableOpacity>
                                </View>
                            )}


                        </View>
                    )}
                />

                {/* Input Field - Fixed at bottom */}
                <View 
                    className="px-4 pt-3 bg-gray-950 border-t border-gray-800"
                    style={{ paddingBottom: Math.max(insets.bottom + 6, 24) }}
                >
                    <View className="flex-row items-center bg-gray-900 rounded-2xl px-4 py-2 border border-gray-800">
                        <TextInput
                            className="flex-1 py-2 text-white text-base"
                            placeholder="Ask about your progress, plan..."
                            placeholderTextColor="#6b7280"
                            value={input}
                            onChangeText={setInput}
                            multiline
                            maxLength={500}
                            style={{ maxHeight: 100 }}
                            returnKeyType="send"
                            onSubmitEditing={(e) => {
                                if (Platform.OS !== 'web') {
                                    sendMessage();
                                }
                            }}
                            blurOnSubmit={true}
                            enablesReturnKeyAutomatically={true}
                        />
                        <TouchableOpacity
                            className={`ml-2 w-10 h-10 rounded-full items-center justify-center ${loading || !input.trim() ? 'opacity-50' : ''}`}
                            onPress={sendMessage}
                            disabled={loading || !input.trim()}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#3b82f6" />
                            ) : (
                                <Ionicons name="arrow-up-circle" size={36} color="#3b82f6" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
            </KeyboardAvoidingView>
        </SafeAreaView >
    );
}
