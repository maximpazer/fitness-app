import { useAuthContext } from '@/context/AuthContext';
import { usePlan } from '@/context/PlanContext';
import { useWorkout } from '@/context/WorkoutContext';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ArchivedPlan, FullPlan, plannerService } from '@/services/planner.service';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Planner() {
    const { user } = useAuthContext();
    const { refreshPlan, planVersion } = usePlan();
    const router = useRouter();
    const { showDialog } = useConfirmDialog();
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [activePlan, setActivePlan] = useState<FullPlan | null>(null);
    const [archivedPlans, setArchivedPlans] = useState<ArchivedPlan[]>([]);
    const [showArchive, setShowArchive] = useState(false);
    const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
    const { initWorkout, activeWorkout: sessionActive } = useWorkout();

    const loadPlan = useCallback(async () => {
        if (!user) return;
        try {
            const [plan, archived] = await Promise.all([
                plannerService.getActivePlan(user.id),
                plannerService.getArchivedPlans(user.id)
            ]);
            setActivePlan(plan);
            setArchivedPlans(archived);
        } catch (error) {
            console.error(error);
            showDialog('Error', 'Failed to load workout plan');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadPlan();
    }, [loadPlan]);

    // Notify global context when plan changes
    const notifyPlanChange = useCallback(async () => {
        await loadPlan();
        await refreshPlan(); // Update global context so dashboard refreshes
    }, [loadPlan, refreshPlan]);

    const handleGenerateAIPlan = async () => {
        // Redirect to Chat with a special parameter
        router.push({
            pathname: '/chat',
            params: { mode: 'generate_plan' }
        });
    };

    const handleArchiveCurrentPlan = async () => {
        if (!activePlan) return;
        try {
            await plannerService.archivePlan(activePlan.id, 'user_archived');
            await notifyPlanChange();
            showDialog('Archived', 'Your plan has been archived. You can restore it anytime from the archive.');
        } catch (error) {
            console.error(error);
            showDialog('Error', 'Failed to archive plan');
        }
    };

    const handleRestorePlan = async (planId: string) => {
        if (!user) return;
        try {
            await plannerService.restorePlan(user.id, planId);
            await notifyPlanChange();
            setShowArchive(false);
            showDialog('Restored', 'Plan has been restored as your active plan.');
        } catch (error) {
            console.error(error);
            showDialog('Error', 'Failed to restore plan');
        }
    };

    const handleDeleteArchivedPlan = async (planId: string, planName: string) => {
        showDialog(
            'Delete Plan',
            `Are you sure you want to permanently delete "${planName}"? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await plannerService.deleteArchivedPlan(planId);
                            await notifyPlanChange();
                        } catch (error) {
                            console.error(error);
                            showDialog('Error', 'Failed to delete plan');
                        }
                    }
                }
            ]
        );
    };

    const toggleDay = (dayId: string) => {
        setExpandedDays(prev => ({
            ...prev,
            [dayId]: !prev[dayId]
        }));
    };

    const startWorkout = async (dayId: string) => {
        if (!user) return;

        let targetId = dayId;
        if (dayId === 'today') {
            if (activePlan && activePlan.days.length > 0) {
                targetId = activePlan.days[0].id; // Simple heuristic for now
            } else {
                return;
            }
        }

        try {
            await initWorkout(user.id, targetId);
        } catch (e) {
            showDialog("Error", "Could not start workout");
        }
    };

    // Helper to determine border color
    const getDayBorderColor = (type: string, completed: boolean = false) => {
        if (completed) return 'border-green-500';
        if (type === 'rest') return 'border-gray-600';
        return 'border-blue-500';
    };

    if (loading) {
        return (
            <View className="flex-1 bg-gray-950 justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-950" edges={['top']}>
            <ScrollView
                className="flex-1 px-4"
                refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPlan} tintColor="#fff" />}
                showsVerticalScrollIndicator={false}
            >
                <View className="py-6 mb-20">
                    {!activePlan ? (
                        // STATE 1: EMPTY STATE
                        <View>
                            <View className="flex-row items-center justify-between mb-6">
                                <Text className="text-3xl font-bold text-white">Planner</Text>
                                {archivedPlans.length > 0 && (
                                    <TouchableOpacity
                                        className="flex-row items-center bg-gray-800 px-3 py-2 rounded-lg"
                                        onPress={() => setShowArchive(!showArchive)}
                                    >
                                        <Ionicons name="archive-outline" size={18} color="#9ca3af" />
                                        <Text className="text-gray-400 ml-2 font-medium">
                                            Archive ({archivedPlans.length})
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {showArchive && archivedPlans.length > 0 ? (
                                // ARCHIVE VIEW
                                <View>
                                    <Text className="text-gray-400 mb-4">
                                        Restore a previous plan or delete it permanently.
                                    </Text>
                                    {archivedPlans.map((plan) => (
                                        <View 
                                            key={plan.id} 
                                            className="bg-gray-900 rounded-xl p-4 mb-3 border border-gray-800"
                                        >
                                            <View className="flex-row justify-between items-start mb-2">
                                                <View className="flex-1">
                                                    <Text className="text-white font-bold text-lg">{plan.name}</Text>
                                                    <Text className="text-gray-500 text-sm">
                                                        {plan.duration_weeks} weeks • {plan.days_count} days • {plan.exercises_count} exercises
                                                    </Text>
                                                    <Text className="text-gray-600 text-xs mt-1">
                                                        Archived {plan.archived_at ? new Date(plan.archived_at).toLocaleDateString() : ''}
                                                        {plan.archive_reason === 'ai_update' && ' (AI update)'}
                                                        {plan.archive_reason === 'replaced' && ' (Replaced)'}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View className="flex-row gap-2 mt-3">
                                                <TouchableOpacity
                                                    className="flex-1 bg-blue-600/10 py-3 rounded-lg items-center border border-blue-600/30"
                                                    onPress={() => handleRestorePlan(plan.id)}
                                                >
                                                    <Text className="text-blue-400 font-bold">Restore</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    className="flex-1 bg-red-600/10 py-3 rounded-lg items-center border border-red-600/30"
                                                    onPress={() => handleDeleteArchivedPlan(plan.id, plan.name)}
                                                >
                                                    <Text className="text-red-400 font-bold">Delete</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                    
                                    <TouchableOpacity
                                        className="py-4 items-center"
                                        onPress={() => setShowArchive(false)}
                                    >
                                        <Text className="text-gray-500 font-medium">← Back to Planner</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                // REGULAR EMPTY STATE
                                <View>
                                    <View className="items-center py-10">
                                        <MaterialCommunityIcons name="dumbbell" size={64} color="#3b82f6" style={{ marginBottom: 24 }} />
                                        <Text className="text-2xl font-bold text-white text-center mb-2">No Workout Plan</Text>
                                        <Text className="text-gray-400 text-center mb-10 px-6 leading-6">
                                            Create your personalized training program to reach your goals faster.
                                        </Text>
                                    </View>

                            {/* AI Generator Card */}
                            <View className="bg-gray-900 rounded-2xl p-6 mb-4 border border-blue-500/20 shadow-lg shadow-blue-900/10">
                                <View className="flex-row items-center mb-3">
                                    <Text className="text-3xl mr-3">🤖</Text>
                                    <View>
                                        <Text className="text-xl font-bold text-white">Generate AI Plan</Text>
                                        <Text className="text-gray-400 text-sm">Science-based plan for your goals</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    className={`bg-blue-600 w-full py-4 rounded-full items-center mt-4 ${generating ? 'opacity-70' : ''}`}
                                    onPress={handleGenerateAIPlan}
                                    disabled={generating}
                                >
                                    {generating ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <Text className="text-white font-bold text-lg">Generate Plan</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Manual Creation Card */}
                            <View className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                                <View className="flex-row items-center mb-3">
                                    <Text className="text-3xl mr-3">✏️</Text>
                                    <View>
                                        <Text className="text-xl font-bold text-white">Create Custom Plan</Text>
                                        <Text className="text-gray-400 text-sm">Build your own split from scratch</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    className="bg-gray-800 w-full py-4 rounded-full items-center mt-4 border border-gray-700"
                                    onPress={() => router.push('/plans/new')}
                                >
                                    <Text className="text-white font-bold text-lg">Create Plan</Text>
                                </TouchableOpacity>
                            </View>
                                </View>
                            )}
                        </View>
                    ) : (
                        // STATE 2: ACTIVE PLAN
                        <View>
                            <View className="flex-row justify-between items-center mb-6">
                                <Text className="text-3xl font-bold text-white">Your Plan</Text>
                                <View className="flex-row gap-2">
                                    {archivedPlans.length > 0 && (
                                        <TouchableOpacity
                                            className="bg-gray-800 px-3 py-2 rounded-lg"
                                            onPress={() => setShowArchive(!showArchive)}
                                        >
                                            <Ionicons name="archive-outline" size={20} color="#9ca3af" />
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        className="bg-gray-800 px-4 py-2 rounded-lg"
                                        onPress={() => router.push(`/plans/edit/${activePlan.id}`)}
                                    >
                                        <Text className="text-blue-400 font-bold">Edit</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {showArchive ? (
                                // ARCHIVE VIEW WITHIN ACTIVE PLAN STATE
                                <View className="mb-6">
                                    <View className="bg-gray-900/50 rounded-xl p-4 border border-gray-800 mb-4">
                                        <Text className="text-white font-bold mb-2">📦 Archived Plans</Text>
                                        <Text className="text-gray-400 text-sm mb-4">
                                            Previous plans are saved here. Restore to make active again.
                                        </Text>
                                        
                                        {archivedPlans.map((plan) => (
                                            <View 
                                                key={plan.id} 
                                                className="bg-gray-800/50 rounded-lg p-3 mb-2 border border-gray-700"
                                            >
                                                <View className="flex-row justify-between items-center">
                                                    <View className="flex-1">
                                                        <Text className="text-white font-medium">{plan.name}</Text>
                                                        <Text className="text-gray-500 text-xs">
                                                            {plan.duration_weeks}w • {plan.days_count}d • {plan.archive_reason === 'ai_update' ? '🤖 AI replaced' : 'Archived'}
                                                        </Text>
                                                    </View>
                                                    <View className="flex-row gap-2">
                                                        <TouchableOpacity
                                                            className="bg-blue-600/20 px-3 py-2 rounded-lg border border-blue-600/30"
                                                            onPress={() => handleRestorePlan(plan.id)}
                                                        >
                                                            <Text className="text-blue-400 text-sm font-medium">Restore</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            className="bg-red-600/10 px-2 py-2 rounded-lg border border-red-600/20"
                                                            onPress={() => handleDeleteArchivedPlan(plan.id, plan.name)}
                                                        >
                                                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            </View>
                                        ))}
                                        
                                        <TouchableOpacity
                                            className="py-2 items-center mt-2"
                                            onPress={() => setShowArchive(false)}
                                        >
                                            <Text className="text-gray-500 text-sm">Hide Archive</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : null}

                            {/* Plan Info Card */}
                            <View className="bg-gray-900 p-6 rounded-2xl mb-8 border border-gray-800">
                                <Text className="text-white text-2xl font-bold mb-2">{activePlan.name}</Text>
                                <Text className="text-gray-400 text-sm mb-4">
                                    {activePlan.duration_weeks} weeks • Week 1 of {activePlan.duration_weeks}
                                </Text>

                                {/* Progress Bar */}
                                <View className="flex-row items-center justify-between mb-2">
                                    <Text className="text-gray-500 text-xs font-bold">PROGRESS</Text>
                                    <Text className="text-blue-400 text-xs font-bold">12%</Text>
                                </View>
                                <View className="h-2 bg-gray-800 rounded-full w-full overflow-hidden mb-6">
                                    <View className="h-full bg-blue-600 w-[12%]" />
                                </View>

                                {/* Today's Action */}
                                <TouchableOpacity
                                    className="bg-blue-600 w-full py-4 rounded-full items-center"
                                    onPress={() => startWorkout('today')}
                                >
                                    <Text className="text-white font-bold text-lg">Start Today's Workout</Text>
                                </TouchableOpacity>
                                
                                {/* Archive current plan option */}
                                <TouchableOpacity
                                    className="flex-row items-center justify-center mt-4 py-2"
                                    onPress={handleArchiveCurrentPlan}
                                >
                                    <Ionicons name="archive-outline" size={16} color="#6b7280" />
                                    <Text className="text-gray-500 text-sm ml-2">Archive this plan</Text>
                                </TouchableOpacity>
                            </View>

                            <Text className="text-xl font-bold text-white mb-4">Weekly Schedule</Text>

                            {activePlan.days.map((day) => {
                                const isExpanded = expandedDays[day.id];
                                const isRest = day.day_type === 'rest';
                                const dayTypeColor = isRest ? 'text-gray-500' : 'text-blue-400';
                                const borderColor = getDayBorderColor(day.day_type, false); // Todo: check completed

                                return (
                                    <View key={day.id} className={`bg-gray-900 rounded-xl mb-4 overflow-hidden border-l-4 ${borderColor}`}>
                                        <TouchableOpacity
                                            className="p-5 flex-row justify-between items-center bg-gray-900 active:bg-gray-800"
                                            onPress={() => toggleDay(day.id)}
                                        >
                                            <View>
                                                <Text className="text-white font-bold text-lg mb-1">
                                                    {day.day_name || `Day ${day.day_number}`}
                                                </Text>
                                                <Text className={`${dayTypeColor} text-sm font-bold uppercase tracking-wider`}>
                                                    {day.day_type}
                                                </Text>
                                            </View>
                                            <Ionicons
                                                name={isExpanded ? "chevron-up" : "chevron-down"}
                                                size={24}
                                                color="#6b7280"
                                            />
                                        </TouchableOpacity>

                                        {isExpanded && !isRest && (
                                            <View className="px-5 pb-5 pt-0">
                                                <View className="h-[1px] bg-gray-800 my-4" />

                                                {day.exercises.length > 0 ? (
                                                    day.exercises.map((ex, index) => (
                                                        <View key={ex.id} className="mb-4 last:mb-0">
                                                            <View className="flex-row items-start">
                                                                <Text className="text-gray-600 w-6 font-bold pt-1">{index + 1}.</Text>
                                                                <View className="flex-1">
                                                                    <Text className="text-white font-medium text-base mb-1">
                                                                        {ex.exercise?.name || 'Exercise'}
                                                                    </Text>
                                                                    <Text className="text-gray-400 text-sm">
                                                                        {ex.target_sets} sets × {ex.target_reps_min}-{ex.target_reps_max} reps
                                                                        {ex.rest_seconds ? ` • ${ex.rest_seconds}s rest` : ''}
                                                                    </Text>
                                                                    {/* Placeholder for history */}
                                                                    {/* <Text className="text-xs text-gray-600 mt-1">Last: 4x10 @ 20kg</Text> */}
                                                                </View>
                                                            </View>
                                                        </View>
                                                    ))
                                                ) : (
                                                    <Text className="text-gray-500 italic">No exercises scheduled.</Text>
                                                )}

                                                <View className="mt-6 pt-4 border-t border-gray-800">
                                                    <TouchableOpacity
                                                        className="bg-blue-600/10 py-3 rounded-lg items-center border border-blue-600/30"
                                                        onPress={() => startWorkout(day.id)}
                                                    >
                                                        <Text className="text-blue-400 font-bold">Start Workout</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
