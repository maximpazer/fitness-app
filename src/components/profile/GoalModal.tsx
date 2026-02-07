import { Goal } from '@/lib/database.types';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface GoalModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (goal: Partial<Goal>) => void;
    initialGoal?: Goal | null;
}

export const GoalModal: React.FC<GoalModalProps> = ({ visible, onClose, onSave, initialGoal }) => {
    const [goalType, setGoalType] = useState<Goal['goal_type']>('weight_loss');
    const [description, setDescription] = useState('');
    const [targetValue, setTargetValue] = useState('');
    const [currentValue, setCurrentValue] = useState('');
    const [targetUnit, setTargetUnit] = useState('kg');
    const [targetDate, setTargetDate] = useState('');

    useEffect(() => {
        if (initialGoal) {
            setGoalType(initialGoal.goal_type);
            setDescription(initialGoal.description);
            setTargetValue(initialGoal.target_value?.toString() || '');
            setCurrentValue(initialGoal.current_value?.toString() || '');
            setTargetUnit(initialGoal.target_unit || 'kg');
            setTargetDate(initialGoal.target_date || '');
        } else {
            resetForm();
        }
    }, [initialGoal, visible]);

    const resetForm = () => {
        setGoalType('weight_loss');
        setDescription('');
        setTargetValue('');
        setCurrentValue('');
        setTargetUnit('kg');
        setTargetDate('');
    };

    const handleSave = () => {
        const goalData: Partial<Goal> = {
            goal_type: goalType,
            description,
            target_value: targetValue ? parseFloat(targetValue) : undefined,
            current_value: currentValue ? parseFloat(currentValue) : undefined,
            target_unit: targetUnit,
            target_date: targetDate || undefined,
        };
        onSave(goalData);
        onClose();
    };

    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1 justify-end bg-black/50"
            >
                <View className="bg-gray-900 rounded-t-3xl p-6 border-t border-gray-800 h-[85%]">
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-white text-xl font-bold">
                            {initialGoal ? 'Edit Goal' : 'Add New Goal'}
                        </Text>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-gray-800 rounded-full">
                            <Ionicons name="close" size={24} color="#9ca3af" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Goal Type Selector */}
                        <Text className="text-gray-400 text-xs font-bold uppercase mb-2">Goal Type</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                            {(['weight_loss', 'weight_gain', 'strength', 'endurance', 'body_measurement', 'habit'] as const).map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    onPress={() => setGoalType(type)}
                                    className={`mr-3 px-4 py-2 rounded-full border ${goalType === type ? 'bg-blue-600 border-blue-600' : 'bg-gray-800 border-gray-700'}`}
                                >
                                    <Text className={`capitalize font-semibold ${goalType === type ? 'text-white' : 'text-gray-400'}`}>
                                        {type.replace('_', ' ')}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Description */}
                        <Text className="text-gray-400 text-xs font-bold uppercase mb-2">Description</Text>
                        <TextInput
                            className="bg-gray-800 text-white p-4 rounded-xl mb-6 text-base"
                            placeholder="e.g. Reach 10% body fat"
                            placeholderTextColor="#6b7280"
                            value={description}
                            onChangeText={setDescription}
                        />

                        {/* Values Row */}
                        <View className="flex-row gap-4 mb-6">
                            <View className="flex-1">
                                <Text className="text-gray-400 text-xs font-bold uppercase mb-2">Current</Text>
                                <TextInput
                                    className="bg-gray-800 text-white p-4 rounded-xl text-base"
                                    placeholder="0"
                                    placeholderTextColor="#6b7280"
                                    keyboardType="numeric"
                                    value={currentValue}
                                    onChangeText={setCurrentValue}
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-gray-400 text-xs font-bold uppercase mb-2">Target</Text>
                                <TextInput
                                    className="bg-gray-800 text-white p-4 rounded-xl text-base"
                                    placeholder="100"
                                    placeholderTextColor="#6b7280"
                                    keyboardType="numeric"
                                    value={targetValue}
                                    onChangeText={setTargetValue}
                                />
                            </View>
                        </View>

                        {/* Unit */}
                        <Text className="text-gray-400 text-xs font-bold uppercase mb-2">Unit</Text>
                        <TextInput
                            className="bg-gray-800 text-white p-4 rounded-xl mb-6 text-base"
                            placeholder="e.g. kg, lbs, cm, %"
                            placeholderTextColor="#6b7280"
                            value={targetUnit}
                            onChangeText={setTargetUnit}
                        />

                        {/* Target Date (Simplified as text for now) */}
                        <Text className="text-gray-400 text-xs font-bold uppercase mb-2">Target Date (YYYY-MM-DD)</Text>
                        <TextInput
                            className="bg-gray-800 text-white p-4 rounded-xl mb-8 text-base"
                            placeholder="2026-12-31"
                            placeholderTextColor="#6b7280"
                            value={targetDate}
                            onChangeText={setTargetDate}
                        />


                        <TouchableOpacity
                            onPress={handleSave}
                            className="bg-blue-600 py-4 rounded-xl items-center shadow-lg shadow-blue-500/20 mb-8"
                        >
                            <Text className="text-white font-bold text-lg">Save Goal</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};
