import { useAuthContext } from '@/context/AuthContext';
import { usePlan } from '@/context/PlanContext';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ChatMessage, generateOpenAIContentWithTools } from '@/lib/openai';
import { AI_TOOLS, aiToolsService } from '@/services/ai-tools.service';
import { canonicalExerciseService } from '@/services/canonical-exercise.service';
import { dashboardService } from '@/services/dashboard.service';
import { exerciseService } from '@/services/exercise.service';
import { metricsService } from '@/services/metrics.service';
import { plannerService } from '@/services/planner.service';
import { workoutService } from '@/services/workout.service';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfWeek } from 'date-fns';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Message = {
    role: 'user' | 'model';
    content: string;
    proposal?: any;
    hasSuggestions?: boolean; // AI mentioned changes but no valid JSON
}

type QuickAction = {
    id: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    prompt: string;
    color: string;
}

type AutoInsight = {
    type: 'volume' | 'frequency' | 'plateau' | 'rest' | 'streak' | 'pr';
    title: string;
    message: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
}

// Simple Markdown-ish parser for React Native
const MarkdownText = ({ text, style, isUser }: { text: string, style: any, isUser: boolean }) => {
    // Split into lines to handle bullets and headers
    const lines = text.split('\n');

    return (
        <View>
            {lines.map((line, i) => {
                const trimmedLine = line.trim();
                
                // Handle headers (###, ##, #)
                const h3Match = trimmedLine.match(/^###\s*(.*)/);
                const h2Match = trimmedLine.match(/^##\s*(.*)/);
                const h1Match = trimmedLine.match(/^#\s*(.*)/);
                
                if (h3Match) {
                    return (
                        <Text key={i} className={`font-bold text-base mb-2 mt-3 ${isUser ? 'text-white' : 'text-gray-200'}`}>
                            {h3Match[1]}
                        </Text>
                    );
                }
                if (h2Match) {
                    return (
                        <Text key={i} className={`font-bold text-lg mb-2 mt-3 ${isUser ? 'text-white' : 'text-gray-100'}`}>
                            {h2Match[1]}
                        </Text>
                    );
                }
                if (h1Match) {
                    return (
                        <Text key={i} className={`font-bold text-xl mb-2 mt-3 ${isUser ? 'text-white' : 'text-white'}`}>
                            {h1Match[1]}
                        </Text>
                    );
                }
                
                // Handle numbered lists (1. 2. etc)
                const numberedMatch = trimmedLine.match(/^(\d+)\.\s*(.*)/);
                if (numberedMatch) {
                    const [, num, content] = numberedMatch;
                    const parts = content.split(/(\*\*.*?\*\*)/g);
                    return (
                        <View key={i} className="flex-row flex-wrap pl-1 mb-1">
                            <Text className={isUser ? "text-white mr-2" : "text-blue-400 mr-2 font-semibold"}>{num}.</Text>
                            <Text style={style} className="flex-1">
                                {parts.map((part, j) => {
                                    if (part.startsWith('**') && part.endsWith('**')) {
                                        return <Text key={j} className="font-bold">{part.substring(2, part.length - 2)}</Text>;
                                    }
                                    return <Text key={j}>{part}</Text>;
                                })}
                            </Text>
                        </View>
                    );
                }
                
                // Handle bullets
                const isBullet = trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ');
                const cleanLine = isBullet ? trimmedLine.substring(2) : line;

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

// Quick action prompts
const QUICK_ACTIONS: QuickAction[] = [
    {
        id: 'analyze_last',
        icon: 'analytics',
        label: 'Analyze my last workout',
        prompt: 'Analyze my most recent workout. What did I do well? What could be improved? Be specific with the numbers.',
        color: '#3b82f6'
    },
    {
        id: 'suggest_plan',
        icon: 'calendar',
        label: 'Suggest next week\'s plan',
        prompt: 'Based on my recent training history and progress, suggest what I should focus on next week. Give me specific recommendations.',
        color: '#8b5cf6'
    },
    {
        id: 'plateau',
        icon: 'trending-down',
        label: 'Why am I stagnating?',
        prompt: 'Look at my recent workout data and identify if any exercises are stagnating or showing no progress. Explain why this might be happening and what I can do.',
        color: '#f59e0b'
    },
    {
        id: 'volume_analysis',
        icon: 'bar-chart',
        label: 'Analyze my training volume',
        prompt: 'Analyze my training volume over recent workouts. Am I doing enough sets per muscle group? Is my volume progressing week over week?',
        color: '#10b981'
    }
];

// Insight card component
const InsightCard = ({ insight, onDismiss }: { insight: AutoInsight; onDismiss: () => void }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, []);
    
    const bgColors: Record<string, string> = {
        volume: 'bg-blue-600/20',
        frequency: 'bg-purple-600/20',
        plateau: 'bg-amber-600/20',
        rest: 'bg-green-600/20',
        streak: 'bg-emerald-600/20',
        pr: 'bg-yellow-600/20'
    };
    
    const borderColors: Record<string, string> = {
        volume: 'border-blue-500/40',
        frequency: 'border-purple-500/40',
        plateau: 'border-amber-500/40',
        rest: 'border-green-500/40',
        streak: 'border-emerald-500/40',
        pr: 'border-yellow-500/40'
    };
    
    return (
        <Animated.View style={{ opacity: fadeAnim }} className={`mx-4 mb-4 p-4 rounded-2xl ${bgColors[insight.type]} border ${borderColors[insight.type]}`}>
            <View className="flex-row items-start">
                <View className="bg-gray-800/50 p-2 rounded-xl mr-3">
                    <Ionicons name={insight.icon} size={20} color={insight.color} />
                </View>
                <View className="flex-1">
                    <Text className="text-white font-bold text-sm mb-1">{insight.title}</Text>
                    <Text className="text-gray-300 text-sm leading-5">{insight.message}</Text>
                </View>
                <TouchableOpacity onPress={onDismiss} className="p-1">
                    <Ionicons name="close" size={18} color="#6b7280" />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

export default function Chat() {
    const { user, profile } = useAuthContext();
    const { refreshPlan } = usePlan();
    const { showDialog } = useConfirmDialog();
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [contextLoading, setContextLoading] = useState(true);
    const [metadata, setMetadata] = useState<any>(null);
    const [autoInsight, setAutoInsight] = useState<AutoInsight | null>(null);
    const [showQuickActions, setShowQuickActions] = useState(true);
    const flatListRef = useRef<FlatList>(null);
    const { mode } = useLocalSearchParams();
    
    // Tab bar height (approximate for iOS with safe area)
    const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 88 : 60;

    // Shared helpers
    const cleanJson = (str: string) => {
        return str
            .replace(/\/\/.*$/gm, '') // Remove single line comments
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
            .trim();
    };

    // Normalize plan proposal to handle different LLM output formats
    const normalizeProposal = (p: any): any => {
        if (!p) return null;
        
        let normalizedDays = p.days;
        
        // Handle object-style days (OpenAI sometimes returns {"Push": {...}, "Pull": {...}})
        if (p.days && typeof p.days === 'object' && !Array.isArray(p.days)) {
            normalizedDays = Object.entries(p.days).map(([dayName, dayData]: [string, any], index) => ({
                day_number: dayData.day_number || index + 1,
                day_name: dayData.day_name || dayName,
                day_type: dayData.day_type || 'training', // Preserve or default day_type
                exercises: dayData.exercises || []
            }));
        }
        
        // Validate we now have an array
        if (!Array.isArray(normalizedDays) || normalizedDays.length === 0) {
            console.warn('[Plan] Could not normalize proposal days:', p);
            return null;
        }
        
        // Ensure required fields have defaults
        return { 
            ...p, 
            days: normalizedDays,
            duration_weeks: p.duration_weeks || 8, // Default to 8 weeks if not specified
            description: p.description || `${p.name || 'Custom'} training plan`
        };
    };

    // Async function to map canonical names to actual exercises
    const mapProposalExercisesAsync = async (p: any): Promise<any> => {
        const normalized = normalizeProposal(p);
        if (!normalized) return null;
        
        // Helper to parse rep range string into min/max
        const parseReps = (repsStr: string): { min: number; max: number } => {
            if (!repsStr) return { min: 8, max: 12 };
            if (repsStr.includes('-')) {
                const [min, max] = repsStr.split('-').map(s => parseInt(s.trim()));
                return { min: min || 8, max: max || 12 };
            }
            const num = parseInt(repsStr);
            if (!isNaN(num)) return { min: num, max: num };
            return { min: 8, max: 12 };
        };
        
        // Collect all canonical names from the proposal
        const allCanonicalNames: string[] = [];
        for (const day of normalized.days) {
            if (Array.isArray(day.exercises)) {
                for (const ex of day.exercises) {
                    const name = ex.exercise_name || ex.name;
                    if (name) allCanonicalNames.push(name);
                }
            }
        }
        
        // Get user equipment from profile
        const userEquipment = metadata?.profile?.available_equipment || [];
        const userDifficulty = metadata?.profile?.fitness_level || 'intermediate';
        
        // Batch fetch all variants at once (efficient!)
        const variantMap = await canonicalExerciseService.selectVariantsBatch(
            allCanonicalNames,
            userEquipment,
            userDifficulty
        );
        
        // Also keep the old fuzzy matcher as fallback (for backward compatibility)
        const exercises = metadata?.exercises || [];
        const findExerciseFallback = (searchName: string) => {
            const normalizedSearch = searchName.toLowerCase().replace(/[-_]/g, ' ').trim();
            const searchWords = normalizedSearch.split(' ').filter(w => w.length > 2);
            
            let found = exercises.find((e: any) => 
                e.name.toLowerCase().replace(/[-_]/g, ' ').trim() === normalizedSearch
            );
            if (found) return found;
            
            // Word-based matching
            let bestMatch: any = null;
            let bestScore = 0;
            for (const ex of exercises) {
                const exWords = ex.name.toLowerCase().split(' ').filter((w: string) => w.length > 2);
                let matchCount = 0;
                for (const sw of searchWords) {
                    if (exWords.some((ew: string) => ew.includes(sw) || sw.includes(ew))) matchCount++;
                }
                if (matchCount >= 2) {
                    const score = matchCount / Math.max(searchWords.length, exWords.length);
                    if (score > bestScore) { bestScore = score; bestMatch = ex; }
                }
            }
            if (bestMatch && bestScore >= 0.5) return bestMatch;
            return null;
        };
        
        // Map each day's exercises
        const mappedDays = normalized.days.map((day: any) => ({
            ...day,
            day_type: day.day_type || 'training',
            exercises: Array.isArray(day.exercises) ? day.exercises.map((ex: any, index: number) => {
                // If already has valid UUID, keep it
                if (ex.exercise_id && ex.exercise_id.length > 20) {
                    const reps = parseReps(ex.target_reps || '8-12');
                    return { 
                        ...ex, 
                        order_in_workout: ex.order_in_workout ?? index + 1,
                        target_sets: ex.target_sets || 3,
                        target_reps_min: reps.min,
                        target_reps_max: reps.max,
                        rest_seconds: ex.rest_seconds || 90
                    };
                }
                
                const name = ex.exercise_name || ex.name;
                if (!name) return null;
                
                // Try canonical lookup first
                const variant = variantMap.get(name);
                if (variant) {
                    if (__DEV__) console.log(`[Plan] Canonical: "${name}" -> "${variant.name}"`);
                    const reps = parseReps(ex.target_reps || '8-12');
                    return {
                        ...ex,
                        exercise_id: variant.id,
                        exercise_name: variant.name, // Update to actual variant name
                        order_in_workout: ex.order_in_workout ?? index + 1,
                        target_sets: ex.target_sets || 3,
                        target_reps_min: reps.min,
                        target_reps_max: reps.max,
                        rest_seconds: ex.rest_seconds || 90
                    };
                }
                
                // Fallback to fuzzy matching (for old proposals or edge cases)
                const found = findExerciseFallback(name);
                if (found) {
                    if (__DEV__) console.log(`[Plan] Fallback match: "${name}" -> "${found.name}"`);
                    const reps = parseReps(ex.target_reps || '8-12');
                    return {
                        ...ex,
                        exercise_id: found.id,
                        order_in_workout: ex.order_in_workout ?? index + 1,
                        target_sets: ex.target_sets || 3,
                        target_reps_min: reps.min,
                        target_reps_max: reps.max,
                        rest_seconds: ex.rest_seconds || 90
                    };
                }
                
                console.warn(`[Plan] Could not map exercise: "${name}"`);
                return null;
            }).filter(Boolean) : []
        }));
        
        return { ...normalized, days: mappedDays };
    };

    // Sync wrapper for backward compatibility (uses cached metadata)
    const mapProposalExercises = (p: any) => {
        const normalized = normalizeProposal(p);
        if (!normalized) return null;
        
        // For sync usage, just return normalized with placeholder IDs
        // Real mapping happens in acceptPlan via mapProposalExercisesAsync
        return {
            ...normalized,
            _needsAsyncMapping: true,
        };
    };

    useEffect(() => {
        if (user) {
            loadContext();
        }
    }, [user]);

    useEffect(() => {
        if (mode === 'generate_plan' && messages.length === 0) {
            setMessages([
                {
                    role: 'model',
                    content: "I see you're looking to create a new workout plan! 🚀\n\nTo help me design the perfect program for you, tell me:\n\n1. What's your **primary goal** right now? (e.g. Strength, Weight Loss, Muscle Gain)\n2. How many **days per week** can you realistically train?\n3. Any specific **focus areas** or preferences (e.g. Upper Body focus, Kettlebell only)?"
                }
            ]);
            setShowQuickActions(false);
        }
    }, [mode]);

    // Generate auto insight from user data
    const generateAutoInsight = useCallback(async (data: any): Promise<AutoInsight | null> => {
        if (!data || !data.detailedHistory || data.detailedHistory.length === 0) {
            return null;
        }

        const insights: AutoInsight[] = [];
        const history = data.detailedHistory;
        
        // 1. Check for volume changes
        if (history.length >= 2) {
            const recentVolumes = history.slice(0, 3).map((w: any) => {
                return w.workout_exercises?.reduce((total: number, ex: any) => {
                    return total + (ex.sets?.reduce((setTotal: number, set: any) => {
                        return setTotal + (set.weight_kg * set.reps);
                    }, 0) || 0);
                }, 0) || 0;
            });
            
            const avgRecentVolume = recentVolumes.reduce((a: number, b: number) => a + b, 0) / recentVolumes.length;
            const lastVolume = recentVolumes[0];
            
            if (recentVolumes.length >= 2 && avgRecentVolume > 0) {
                const volumeChange = ((lastVolume - avgRecentVolume) / avgRecentVolume) * 100;
                
                if (volumeChange < -15) {
                    insights.push({
                        type: 'volume',
                        title: 'Volume Drop Detected',
                        message: `Your last workout had ${Math.abs(volumeChange).toFixed(0)}% less volume than your recent average. This could affect gains - consider if you're under-recovering.`,
                        icon: 'trending-down',
                        color: '#f59e0b'
                    });
                } else if (volumeChange > 15) {
                    insights.push({
                        type: 'volume',
                        title: 'Great Volume Increase! 💪',
                        message: `Your last workout had ${volumeChange.toFixed(0)}% more volume than average. You're pushing harder - make sure you're recovering well!`,
                        icon: 'trending-up',
                        color: '#10b981'
                    });
                }
            }
        }
        
        // 2. Check training frequency this week
        if (data.recentActivity) {
            const thisWeekStart = startOfWeek(new Date());
            const workoutsThisWeek = history.filter((w: any) => 
                new Date(w.completed_at) >= thisWeekStart
            ).length;
            
            const targetDays = data.profile?.training_days_per_week || 4;
            const dayOfWeek = new Date().getDay();
            const expectedByNow = Math.floor((dayOfWeek / 7) * targetDays);
            
            if (workoutsThisWeek < expectedByNow - 1 && dayOfWeek >= 3) {
                insights.push({
                    type: 'frequency',
                    title: 'Behind Schedule',
                    message: `You've done ${workoutsThisWeek} workout${workoutsThisWeek !== 1 ? 's' : ''} this week, but aimed for ${targetDays}. Time to catch up!`,
                    icon: 'calendar',
                    color: '#8b5cf6'
                });
            }
        }
        
        // 3. Check for exercise plateaus (same weight for 3+ sessions)
        if (history.length >= 3) {
            const exerciseWeights: Map<string, number[]> = new Map();
            
            history.forEach((workout: any) => {
                workout.workout_exercises?.forEach((ex: any) => {
                    const name = ex.exercise?.name;
                    if (name && ex.sets?.length > 0) {
                        const maxWeight = Math.max(...ex.sets.map((s: any) => s.weight_kg || 0));
                        if (maxWeight > 0) {
                            const weights = exerciseWeights.get(name) || [];
                            weights.push(maxWeight);
                            exerciseWeights.set(name, weights);
                        }
                    }
                });
            });
            
            for (const [exercise, weights] of exerciseWeights) {
                if (weights.length >= 3) {
                    const last3 = weights.slice(0, 3);
                    if (last3.every(w => w === last3[0])) {
                        insights.push({
                            type: 'plateau',
                            title: `${exercise} Plateau`,
                            message: `You've used ${last3[0]}kg for 3 sessions straight. Consider adding 2.5kg or increasing reps.`,
                            icon: 'pause-circle',
                            color: '#f59e0b'
                        });
                        break; // Only show one plateau insight
                    }
                }
            }
        }
        
        // 4. Check for rest days
        if (history.length > 0) {
            const lastWorkout = new Date(history[0].completed_at);
            const daysSince = Math.floor((new Date().getTime() - lastWorkout.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysSince >= 3) {
                insights.push({
                    type: 'rest',
                    title: 'Extended Rest',
                    message: `It's been ${daysSince} days since your last workout. Ready to get back in the gym?`,
                    icon: 'bed',
                    color: '#6366f1'
                });
            }
        }
        
        // Return a random insight or the most relevant one
        if (insights.length > 0) {
            // Prioritize: plateau > volume > frequency > rest
            const prioritized = insights.sort((a, b) => {
                const priority = { plateau: 4, volume: 3, frequency: 2, rest: 1, streak: 0, pr: 5 };
                return (priority[b.type] || 0) - (priority[a.type] || 0);
            });
            return prioritized[0];
        }
        
        // Default insight if we have data but no specific issues
        if (history.length > 0) {
            const totalWorkouts = history.length;
            const totalVolume = history.reduce((sum: number, w: any) => {
                return sum + (w.workout_exercises?.reduce((total: number, ex: any) => {
                    return total + (ex.sets?.reduce((setTotal: number, set: any) => {
                        return setTotal + (set.weight_kg * set.reps);
                    }, 0) || 0);
                }, 0) || 0);
            }, 0);
            
            return {
                type: 'streak',
                title: 'Training Summary',
                message: `${totalWorkouts} recent workouts tracked with ${(totalVolume / 1000).toFixed(1)}t total volume. Keep building momentum!`,
                icon: 'fitness',
                color: '#3b82f6'
            };
        }
        
        return null;
    }, []);

    const loadContext = async () => {
        try {
            setContextLoading(true);
            const [plan, dashboardData, exercises, weightTrend, detailedHistory] = await Promise.all([
                plannerService.getActivePlan(user!.id),
                dashboardService.getDashboardData(user!.id),
                exerciseService.getExercises(),
                metricsService.getWeightTrend(user!.id, 4), // Last 4 weeks
                workoutService.getDetailedRecentHistory(user!.id, 5) // Last 5 workouts with sets/reps
            ]);

            const contextData = {
                profile,
                activePlan: plan,
                recentActivity: dashboardData?.recentActivity || [],
                exercises: exercises.map((e: any) => ({ id: e.id, name: e.name, category: e.category })),
                weightHistory: weightTrend,
                detailedHistory: detailedHistory
            };
            
            setMetadata(contextData);
            
            // Generate auto insight after loading context
            const insight = await generateAutoInsight(contextData);
            setAutoInsight(insight);
        } catch (e) {
            console.error("Error loading chat context:", e);
        } finally {
            setContextLoading(false);
        }
    };

    const handleQuickAction = (action: QuickAction) => {
        setShowQuickActions(false);
        setInput(action.prompt);
        // Trigger send after a brief delay to show the message
        setTimeout(() => {
            setInput('');
            const newMessages: Message[] = [...messages, { role: 'user', content: action.prompt }];
            setMessages(newMessages);
            sendMessageWithHistory(newMessages);
        }, 50);
    };

    const sendMessageWithHistory = async (newMessages: Message[]) => {
        setLoading(true);

        try {
            // System prompt for the AI coach - tool-mediated reasoning
            const systemPrompt = `
You are an expert AI Fitness Coach. You have tools to query summarized user data.

AVAILABLE TOOLS:
- get_recent_workout_summary: Summarized overview (volume, frequency, muscles) for N days
- get_last_session_overview: Last workout summary (exercises, sets, volume)
- get_exercise_progress: Trend data for specific exercise (weight/volume/reps)
- get_exercise_consistency: How regularly an exercise is performed
- get_muscle_group_coverage: Identify imbalances or neglected muscles
- compare_workout_periods: Compare this_week vs last_week, etc.
- get_last_exercise_load: Quick lookup of last weight/reps for exercise
- get_body_metrics_trend: Body weight trend
- search_exercises: Search CANONICAL exercises (30 core movements). Returns canonical_name to use in plans.
- create_plan_proposal: Create an interactive plan proposal (ONLY when explicitly asked for a plan).

CRITICAL BEHAVIOR RULES:
1. ONLY create a plan when the user EXPLICITLY asks for a workout plan, program, or routine.
2. For general questions, advice, progress queries - just answer conversationally. Do NOT create a plan.
3. Use appropriate tools based on what the user actually asks.
4. Be concise and coaching-focused.

USER PROFILE: ${JSON.stringify(metadata?.profile || {})}
USER'S AVAILABLE EQUIPMENT: ${JSON.stringify(metadata?.profile?.available_equipment || ['Barbell', 'Dumbbell', 'Cable', 'Machine'])}
ACTIVE PLAN: ${JSON.stringify(metadata?.activePlan?.name || "No active plan")}

CANONICAL EXERCISE SYSTEM:
You select from 30 standard exercise types (bench_press, squat, deadlift, etc).
The system automatically picks the best variant based on user's equipment.
Example: You say "bench_press" → User with dumbbells gets "Dumbbell Bench Press"

PLAN CREATION WORKFLOW (ONLY when user asks for a plan):
1. Do 1-2 exercise searches max (the 30 canonicals cover all common movements)
2. Call create_plan_proposal with canonical_name for each exercise
3. For EACH exercise: exercise_name (canonical), target_sets (3-5), target_reps (e.g., "8-12")
4. Common canonicals: bench_press, squat, deadlift, row, overhead_press, pullup, lat_pulldown, bicep_curl, tricep_extension, lunge, leg_press, leg_curl, hip_thrust, calf_raise, plank

CANONICAL NAMES (use these exact names):
- Chest: bench_press, incline_press, chest_fly, dip
- Back: deadlift, row, pullup, lat_pulldown, cable_row
- Shoulders: overhead_press, lateral_raise, face_pull
- Arms: bicep_curl, hammer_curl, tricep_extension, close_grip_press
- Legs: squat, front_squat, leg_press, lunge, leg_extension, romanian_deadlift, leg_curl, hip_thrust, calf_raise
- Core: plank, crunch, russian_twist, hanging_leg_raise

ALWAYS include target_reps: strength "5-8", hypertrophy "8-12", endurance "12-15"

Current Date: ${format(new Date(), 'yyyy-MM-dd')}
`;

            // Prepare messages for API
            let conversationHistory: ChatMessage[] = newMessages.map(m => ({
                role: m.role,
                parts: [{ text: m.content }]
            }));

            // Configure tools for function calling
            const toolConfig = {
                tools: [{ functionDeclarations: AI_TOOLS.declarations }],
                toolConfig: {
                    functionCallingConfig: {
                        mode: 'AUTO' as const
                    }
                }
            };

            // Tool-mediated reasoning loop (max 12 calls for plan creation workflows)
            const MAX_TOOL_CALLS = 12;
            let iteration = 0;
            let finalResponse = '';
            let pendingProposal: any = null; // Capture proposal from tool
            let searchCount = 0; // Track consecutive searches to prevent infinite loops

            while (iteration < MAX_TOOL_CALLS) {
                iteration++;

                const response = await generateOpenAIContentWithTools(
                    conversationHistory,
                    systemPrompt,
                    toolConfig
                );

                // Check if it's a function call
                if (response.functionCall) {
                    // Log only tool name (no reasoning text stored)
                    if (__DEV__) console.log(`[Tool] ${response.functionCall.name}`);

                    // Detect search loop - if we've searched 5 times without creating a plan, force a response
                    if (response.functionCall.name === 'search_exercises') {
                        searchCount++;
                        if (searchCount >= 5) {
                            if (__DEV__) console.warn('[Chat] Too many consecutive searches - forcing response');
                            // Add a system message to force plan creation
                            conversationHistory.push({
                                role: 'user',
                                parts: [{ text: "You have enough exercise data now. Please create the plan using create_plan_proposal tool with the exercises you've found. Do NOT search for more exercises." }]
                            });
                            searchCount = 0; // Reset counter
                        }
                    } else if (response.functionCall.name === 'create_plan_proposal') {
                        searchCount = 0; // Reset on plan creation
                    }

                    try {
                        // Execute the function
                        const toolResult = await aiToolsService.executeFunction(
                            user!.id,
                            response.functionCall.name,
                            response.functionCall.args
                        );

                        // Log result summary in dev only
                        if (__DEV__) console.log(`[Tool Result] ${response.functionCall.name} returned`);

                        // Check if this is a plan proposal from the tool
                        if (toolResult?.__is_plan_proposal && toolResult?.proposal) {
                            if (__DEV__) console.log('[Tool] Plan proposal captured from create_plan_proposal tool');
                            pendingProposal = toolResult.proposal;
                        }

                        // Add function call and result to conversation
                        conversationHistory.push({
                            role: 'model',
                            parts: [{
                                functionCall: {
                                    name: response.functionCall.name,
                                    args: response.functionCall.args
                                }
                            }]
                        });

                        conversationHistory.push({
                            role: 'user', // Function responses use 'user' role
                            parts: [{
                                functionResponse: {
                                    name: response.functionCall.name,
                                    response: toolResult
                                }
                            }]
                        });

                        // Continue the loop to get the model's response with the data
                        continue;
                    } catch (toolError: any) {
                        if (__DEV__) console.error(`[Tool Error] ${response.functionCall.name}:`, toolError.message);
                        // Add error to conversation
                        conversationHistory.push({
                            role: 'model',
                            parts: [{
                                functionCall: {
                                    name: response.functionCall.name,
                                    args: response.functionCall.args
                                }
                            }]
                        });
                        conversationHistory.push({
                            role: 'user',
                            parts: [{
                                functionResponse: {
                                    name: response.functionCall.name,
                                    response: { error: toolError.message }
                                }
                            }]
                        });
                        continue;
                    }
                }

                // Text response - we're done
                finalResponse = response.text || '';
                break;
            }

            // If we hit max iterations without getting a text response, the AI may be stuck
            if (!finalResponse && !pendingProposal && iteration >= MAX_TOOL_CALLS) {
                if (__DEV__) console.warn('[Chat] Hit max tool calls without final response');
                finalResponse = "I've gathered the exercise data, but let me know if you'd like me to create a specific workout plan or need more information!";
            }

            // Process the final response for plan proposals
            let cleanReply = finalResponse;
            let proposal = pendingProposal; // Start with tool-captured proposal

            // If we got a proposal from the tool, map the exercises
            if (proposal) {
                if (__DEV__) console.log('[Plan] Got proposal from tool, mapping exercises...');
                const mapped = mapProposalExercises(proposal);
                if (mapped) {
                    proposal = mapped;
                    if (__DEV__) console.log('[Plan] Mapped proposal:', proposal.name, 'with', proposal.days?.length, 'days');
                    // Clean any JSON that might still be in the response
                    cleanReply = cleanReply
                        .replace(/```plan_proposal[\s\S]*?```/gi, '')
                        .replace(/```json[\s\S]*?```/gi, '')
                        .trim();
                } else {
                    if (__DEV__) console.warn('[Plan] Failed to map proposal exercises');
                }
            }

            // Fallback: Try plan_proposal block in text (legacy support)
            if (!proposal) {
                const proposalMatch = finalResponse.match(/```plan_proposal\s*([\s\S]*?)\s*```/i);

                if (proposalMatch) {
                    try {
                        const jsonStr = cleanJson(proposalMatch[1]);
                        const parsed = JSON.parse(jsonStr);
                        const mapped = mapProposalExercises(parsed);
                        if (mapped) {
                            proposal = mapped;
                            cleanReply = finalResponse.replace(proposalMatch[0], '').trim();
                        }
                    } catch (e) {
                        console.error("Failed to parse plan_proposal JSON", e);
                        try {
                            const startIdx = proposalMatch[1].indexOf('{');
                            const endIdx = proposalMatch[1].lastIndexOf('}');
                            if (startIdx !== -1 && endIdx !== -1) {
                                const parsed = JSON.parse(cleanJson(proposalMatch[1].substring(startIdx, endIdx + 1)));
                                const mapped = mapProposalExercises(parsed);
                                if (mapped) {
                                    proposal = mapped;
                                    cleanReply = finalResponse.replace(proposalMatch[0], '').trim();
                                }
                            }
                        } catch (innerE) { }
                    }
                }
            }

            // Fallback: detect any JSON with days array
            if (!proposal) {
                const genericJsonMatch = finalResponse.match(/```json\s*([\s\S]*?)\s*```/i);
                const rawJsonMatch = finalResponse.match(/\{[\s\S]*?"days"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/);

                if (genericJsonMatch) {
                    try {
                        const potentialJson = JSON.parse(cleanJson(genericJsonMatch[1]));
                        if (potentialJson.days && Array.isArray(potentialJson.days)) {
                            const mapped = mapProposalExercises(potentialJson);
                            if (mapped) {
                                proposal = mapped;
                                cleanReply = finalResponse.replace(genericJsonMatch[0], '').trim();
                            }
                        }
                    } catch (e) { }
                } else if (rawJsonMatch) {
                    try {
                        const potentialJson = JSON.parse(cleanJson(rawJsonMatch[0]));
                        if (potentialJson.days && Array.isArray(potentialJson.days)) {
                            const mapped = mapProposalExercises(potentialJson);
                            if (mapped) {
                                proposal = mapped;
                                cleanReply = finalResponse.replace(rawJsonMatch[0], '').trim();
                            }
                        }
                    } catch (e) { }
                }
            }

            // Log what we're about to render
            if (__DEV__) {
                console.log('[Chat] Final state - proposal:', proposal ? proposal.name : 'none');
                console.log('[Chat] Clean reply length:', cleanReply?.length || 0);
            }

            setMessages([...newMessages, { role: 'model', content: cleanReply || "I've prepared a plan update for you:", proposal }]);
        } catch (e) {
            console.error("Chat error:", e);
            setMessages([...newMessages, { role: 'model', content: "Sorry, I'm having trouble connecting right now. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!input.trim() || loading) return;
        const userMsg = input;
        setInput('');
        setShowQuickActions(false);

        const newMessages: Message[] = [...messages, { role: 'user', content: userMsg }];
        setMessages(newMessages);
        await sendMessageWithHistory(newMessages);
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
                            
                            // Map canonical names to actual exercises (async)
                            const mappedProposal = await mapProposalExercisesAsync(proposal);
                            
                            if (!mappedProposal) {
                                showDialog("Error", "Failed to map exercises. Please try again.");
                                return;
                            }
                            
                            // Validate we have exercises mapped
                            const totalExercises = mappedProposal.days.reduce(
                                (sum: number, day: any) => sum + (day.exercises?.length || 0), 0
                            );
                            
                            if (totalExercises === 0) {
                                showDialog("Error", "No exercises could be mapped. Please ask the AI to generate a new plan.");
                                return;
                            }
                            
                            // We ALWAYS use createPlan for AI proposals now.
                            // plannerService.createPlan automatically deactivates the old plan.
                            await plannerService.createPlan(user.id, mappedProposal, 'ai_update');

                            showDialog("Success", isUpdate ? "New version created and activated!" : "New plan created and activated!");
                            loadContext(); // Refresh context
                            refreshPlan(); // Notify global context so dashboard updates
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
        <View className="flex-1 bg-gray-950" style={{ paddingTop: insets.top }}>
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
                                    <View className={`w-2 h-2 rounded-full mr-2 ${contextLoading ? 'bg-amber-500' : 'bg-green-500'}`} />
                                    <Text className="text-gray-400 text-xs font-medium uppercase tracking-widest">
                                        {contextLoading ? 'Loading Context...' : 'Active & Context Aware'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={loadContext}
                                disabled={contextLoading}
                                className={`w-10 h-10 bg-gray-900 rounded-full items-center justify-center border border-gray-800 ${contextLoading ? 'opacity-50' : ''}`}
                            >
                                <Ionicons name="refresh" size={20} color="#3b82f6" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Auto Insight Card */}
                    {autoInsight && messages.length === 0 && (
                        <InsightCard 
                            insight={autoInsight} 
                            onDismiss={() => setAutoInsight(null)} 
                        />
                    )}

                    {/* Empty State with Quick Actions */}
                    {messages.length === 0 && showQuickActions && !contextLoading && (
                        <ScrollView 
                            className="flex-1 px-4"
                            contentContainerStyle={{ paddingTop: 20, paddingBottom: 20 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Welcome Section */}
                            <View className="items-center mb-8 mt-4">
                                <View className="bg-blue-600/20 p-4 rounded-3xl mb-4">
                                    <Ionicons name="sparkles" size={40} color="#3b82f6" />
                                </View>
                                <Text className="text-white text-xl font-bold text-center mb-2">
                                    Your Personal AI Coach
                                </Text>
                                <Text className="text-gray-400 text-center text-sm leading-5 px-4">
                                    I analyze your workouts, track your progress, and provide data-driven recommendations to help you reach your goals faster.
                                </Text>
                            </View>
                            
                            {/* Quick Actions Grid */}
                            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3 px-1">
                                Quick Actions
                            </Text>
                            <View className="gap-3">
                                {QUICK_ACTIONS.map((action) => (
                                    <TouchableOpacity
                                        key={action.id}
                                        className="bg-gray-900 border border-gray-800 p-4 rounded-2xl flex-row items-center active:bg-gray-800"
                                        onPress={() => handleQuickAction(action)}
                                    >
                                        <View 
                                            className="w-10 h-10 rounded-xl items-center justify-center mr-4"
                                            style={{ backgroundColor: `${action.color}20` }}
                                        >
                                            <Ionicons name={action.icon} size={20} color={action.color} />
                                        </View>
                                        <Text className="text-white font-semibold text-base flex-1">{action.label}</Text>
                                        <Ionicons name="arrow-forward" size={18} color="#6b7280" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                            
                            {/* Or Ask Anything Section */}
                            <View className="mt-8 items-center">
                                <View className="flex-row items-center mb-3">
                                    <View className="h-px bg-gray-800 flex-1" />
                                    <Text className="text-gray-500 text-xs font-medium mx-3">OR ASK ANYTHING</Text>
                                    <View className="h-px bg-gray-800 flex-1" />
                                </View>
                                <Text className="text-gray-500 text-sm text-center">
                                    Type a question below about your training,{'\n'}nutrition, or recovery.
                                </Text>
                            </View>
                        </ScrollView>
                    )}

                    {/* Loading State */}
                    {contextLoading && messages.length === 0 && (
                        <View className="flex-1 items-center justify-center">
                            <View className="bg-gray-900 p-6 rounded-3xl items-center">
                                <ActivityIndicator size="large" color="#3b82f6" />
                                <Text className="text-gray-400 mt-4 text-sm">Loading your fitness data...</Text>
                            </View>
                        </View>
                    )}

                    {/* Chat Messages */}
                    {messages.length > 0 && (
                        <FlatList
                            ref={flatListRef}
                            data={messages}
                            className="flex-1 px-4"
                            contentContainerStyle={{ 
                                paddingVertical: 20,
                                paddingBottom: 20
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
                                                                    • {exName} ({ex.target_sets} × {ex.target_reps || '8-12'})
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
                    )}

                    {/* Loading indicator for AI response */}
                    {loading && (
                        <View className="px-4 pb-2">
                            <View className="bg-gray-900 border border-gray-800 p-4 rounded-3xl rounded-tl-sm self-start max-w-[85%]">
                                <View className="flex-row items-center">
                                    <View className="mr-3">
                                        <ActivityIndicator size="small" color="#3b82f6" />
                                    </View>
                                    <View>
                                        <Text className="text-gray-300 text-sm font-medium">Analyzing your data...</Text>
                                        <Text className="text-gray-500 text-xs mt-0.5">Querying workout history</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Input Field - Fixed at bottom with proper tab bar offset */}
                    <View 
                        className="px-4 pt-3 pb-2 bg-gray-950 border-t border-gray-800"
                        style={{ paddingBottom: Math.max(TAB_BAR_HEIGHT + 8, insets.bottom + TAB_BAR_HEIGHT) }}
                    >
                        <View className="flex-row items-end bg-gray-900 rounded-2xl px-4 py-2 border border-gray-800">
                            <TextInput
                                className="flex-1 py-2 text-white text-base"
                                placeholder="Ask about your progress, plan..."
                                placeholderTextColor="#6b7280"
                                value={input}
                                onChangeText={setInput}
                                multiline
                                maxLength={500}
                                style={{ maxHeight: 100, minHeight: 24 }}
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
                                className={`ml-2 w-10 h-10 rounded-full items-center justify-center ${loading || !input.trim() ? 'opacity-40' : ''}`}
                                onPress={sendMessage}
                                disabled={loading || !input.trim()}
                            >
                                <Ionicons name="arrow-up-circle" size={36} color="#3b82f6" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}
