import { useAuthContext } from '@/context/AuthContext';
import { Goal } from '@/lib/database.types';
import { goalsService } from '@/services/goals.service';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { GoalModal } from './GoalModal';

export const GoalsSection = () => {
    const { user } = useAuthContext();
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

    useEffect(() => {
        if (user) {
            loadGoals();
        }
    }, [user]);

    const loadGoals = async () => {
        if (!user) return;
        setLoading(true);
        const { data, error } = await goalsService.fetchGoals(user.id);
        if (data) setGoals(data);
        setLoading(false);
    };

    const handleSaveGoal = async (goalData: Partial<Goal>) => {
        if (!user) return;

        if (editingGoal) {
            const { data, error } = await goalsService.updateGoal(editingGoal.id, goalData);
            if (data) {
                setGoals(goals.map(g => g.id === editingGoal.id ? data : g));
            }
        } else {
            const { data, error } = await goalsService.createGoal({
                ...goalData as any,
                user_id: user.id
            });
            if (data) {
                setGoals([data, ...goals]);
            }
        }
        setEditingGoal(null);
    };

    const handleDeleteGoal = async (goalId: string) => {
        Alert.alert(
            "Delete Goal",
            "Are you sure you want to delete this goal?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        const { error } = await goalsService.deleteGoal(goalId);
                        if (!error) {
                            setGoals(goals.filter(g => g.id !== goalId));
                        }
                    }
                }
            ]
        );
    };

    const getProgress = (goal: Goal) => {
        if (!goal.target_value || !goal.current_value) return 0;

        // Simple linear progress for now
        // Assuming goal is always to increase value unless weight_loss (where target < start usually)
        // But for visual simplicity, let's just do current / target for gain, and target / current for loss?
        // Let's keep it simple: strict percentage of target achieved if target > 0

        let progress = 0;
        if (goal.goal_type === 'weight_loss') {
            // For weight loss, we ideally need a start value, but let's approximate
            // Improvement: Add starting_value to table schema if not present, but for now specific request was about user adaptable stats.
            // If target is 80 and current is 90. 
            // Let's just show the current vs target text. Progress bar might be confusing without start point.
            return 0.5; // Placeholder
        } else {
            progress = Math.min(1, Math.max(0, goal.current_value / goal.target_value));
        }
        return progress;
    };

    return (
        <View className="mb-8">
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-gray-400 font-bold uppercase text-xs tracking-widest">My Goals</Text>
                <TouchableOpacity onPress={() => { setEditingGoal(null); setModalVisible(true); }}>
                    <Text className="text-blue-500 font-bold text-xs uppercase tracking-wide">+ Add Goal</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator color="#3b82f6" />
            ) : goals.length === 0 ? (
                <View className="bg-gray-900 rounded-2xl p-6 border border-gray-800 items-center">
                    <Text className="text-gray-500 text-sm">No goals set yet.</Text>
                </View>
            ) : (
                <View className="bg-gray-900 rounded-2xl p-4 border border-gray-800 space-y-4">
                    {goals.map((goal, index) => (
                        <View key={goal.id}>
                            <TouchableOpacity
                                onPress={() => { setEditingGoal(goal); setModalVisible(true); }}
                                onLongPress={() => handleDeleteGoal(goal.id)}
                            >
                                <View className="flex-row justify-between items-center mb-2">
                                    <View>
                                        <Text className="text-white font-bold text-base">{goal.description}</Text>
                                        <Text className="text-gray-500 text-xs capitalize">{goal.goal_type.replace('_', ' ')}</Text>
                                    </View>
                                    <View className="items-end">
                                        <Text className="text-blue-400 font-bold text-lg">
                                            {goal.current_value || 0} <Text className="text-xs text-gray-500">/ {goal.target_value} {goal.target_unit}</Text>
                                        </Text>
                                    </View>
                                </View>

                                {/* Progress Bar */}
                                {goal.target_value && goal.current_value && (
                                    <View className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                        <View
                                            className="h-full bg-blue-600 rounded-full"
                                            style={{ width: `${Math.min(100, (goal.current_value / goal.target_value) * 100)}%` }}
                                        />
                                    </View>
                                )}
                            </TouchableOpacity>
                            {index < goals.length - 1 && <View className="h-[1px] bg-gray-800 mt-4" />}
                        </View>
                    ))}
                </View>
            )}

            <GoalModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSave={handleSaveGoal}
                initialGoal={editingGoal}
            />
        </View>
    );
};
