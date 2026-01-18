import { useAuthContext } from '@/context/AuthContext';
import { useWorkout } from '@/context/WorkoutContext';
import { plannerService } from '@/services/planner.service';
import { workoutService } from '@/services/workout.service';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Audio } from 'expo-av';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, Swipeable } from 'react-native-gesture-handler';
import Animated, { Extrapolate, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const WorkoutLoggerOverlay = () => {
    const { user } = useAuthContext();
    const {
        activeWorkout,
        startWorkout,
        updateSet,
        addSet,
        removeSet,
        addExercise,
        finishWorkout,
        cancelWorkout,
        setIsMinimized,
        isMaximized,
        setIsMaximized,
        duration
    } = useWorkout();

    const router = useRouter();

    // Rest Timer State
    const [restTimerVisible, setRestTimerVisible] = useState(false);
    const [restTimeRemaining, setRestTimeRemaining] = useState(0);
    const [defaultRestTime, setDefaultRestTime] = useState(60);
    const soundRef = useRef<Audio.Sound | null>(null);

    // Ad-hoc Exercise State
    const [addExVisible, setAddExVisible] = useState(false);
    const [availableExercises, setAvailableExercises] = useState<any[]>([]);

    // UI/Loading State
    const [saving, setSaving] = useState(false);
    const [exHistory, setExHistory] = useState<Record<string, { summary: string; date: string; sets: any[] }>>({});

    // Focus / Navigation State
    const [activeExIdx, setActiveExIdx] = useState(0);
    const [activeSetIdx, setActiveSetIdx] = useState(0);
    const inputRefs = useRef<Record<string, TextInput | null>>({});
    const scrollViewRef = useRef<ScrollView | null>(null);
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);

    const insets = useSafeAreaInsets();
    const { height: SCREEN_HEIGHT } = Dimensions.get('window');
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const isDragging = useSharedValue(false);

    useEffect(() => {
        if (isMaximized) {
            translateY.value = withSpring(0, { damping: 20, stiffness: 90 });
        } else {
            translateY.value = withSpring(SCREEN_HEIGHT, { damping: 20, stiffness: 90 });
        }
    }, [isMaximized]);

    const gesture = Gesture.Pan()
        .onStart(() => {
            isDragging.value = true;
        })
        .onUpdate((event) => {
            if (event.translationY > 0) {
                translateY.value = event.translationY;
            }
        })
        .onEnd((event) => {
            isDragging.value = false;
            if (event.translationY > 150 || event.velocityY > 500) {
                runOnJS(setIsMaximized)(false);
                runOnJS(setIsMinimized)(true);
            } else {
                translateY.value = withSpring(0);
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: interpolate(translateY.value, [0, SCREEN_HEIGHT], [0.5, 0], Extrapolate.CLAMP),
        display: translateY.value === SCREEN_HEIGHT ? 'none' : 'flex',
    }));

    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    // Load history when a NEW exercise is added or at start
    useEffect(() => {
        if (!user || !activeWorkout) return;

        const loadHistory = async () => {
            const allExercises = await plannerService.getAllExercises();
            setAvailableExercises(allExercises);

            for (const ex of activeWorkout.exercises) {
                if (!exHistory[ex.exerciseId]) {
                    const history = await workoutService.getExerciseHistory(ex.exerciseId, user.id);
                    if (history && history.workout?.completed_at) {
                        const dateStr = format(new Date(history.workout.completed_at), 'MMM d');
                        const summary = `${history.sets.length}×${history.sets[0]?.reps || 0} @ ${history.sets[0]?.weight_kg || 0}kg`;
                        setExHistory(prev => ({
                            ...prev,
                            [ex.exerciseId]: { summary, date: dateStr, sets: history.sets }
                        }));
                    }
                }
            }
        };

        loadHistory();
    }, [user, activeWorkout?.exercises.length]);

    // Derived State
    const totalVolume = useMemo(() => {
        if (!activeWorkout) return 0;
        return activeWorkout.exercises.reduce((acc, ex) => {
            return acc + ex.sets.reduce((sAcc, set) => {
                if (set.completed && set.weight && set.reps) {
                    return sAcc + (parseFloat(set.weight) * parseFloat(set.reps));
                }
                return sAcc;
            }, 0);
        }, 0);
    }, [activeWorkout]);

    // Rest Timer Countdown
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (restTimerVisible && restTimeRemaining > 0) {
            interval = setInterval(async () => {
                if (restTimeRemaining === 1) {
                    if (soundRef.current) {
                        try { await soundRef.current.replayAsync(); } catch (e) { }
                    }
                }
                setRestTimeRemaining((prev) => {
                    if (prev <= 1) {
                        setRestTimerVisible(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [restTimerVisible, restTimeRemaining]);

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleSetChange = (exIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) => {
        updateSet(exIndex, setIndex, { [field]: value });
    };

    const toggleSetComplete = (exIndex: number, setIndex: number) => {
        if (!activeWorkout) return;
        const set = activeWorkout.exercises[exIndex].sets[setIndex];
        const wasCompleted = set.completed;

        updateSet(exIndex, setIndex, { completed: !wasCompleted });

        if (!wasCompleted) {
            setRestTimeRemaining(defaultRestTime);
            setRestTimerVisible(true);
        }
    };

    const handleKeySubmit = (exIndex: number, setIndex: number, field: 'weight' | 'reps') => {
        if (!activeWorkout) return;

        if (field === 'weight') {
            // Move from weight to reps
            inputRefs.current[`${exIndex}-${setIndex}-reps`]?.focus();
        } else {
            // Target reps finished, mark complete and go to next set
            toggleSetComplete(exIndex, setIndex);

            const currentEx = activeWorkout.exercises[exIndex];
            if (setIndex < currentEx.sets.length - 1) {
                const nextSetIdx = setIndex + 1;
                setActiveSetIdx(nextSetIdx);
                inputRefs.current[`${exIndex}-${nextSetIdx}-weight`]?.focus();
            } else if (exIndex < activeWorkout.exercises.length - 1) {
                const nextExIdx = exIndex + 1;
                setActiveExIdx(nextExIdx);
                setActiveSetIdx(0);
                inputRefs.current[`${nextExIdx}-0-weight`]?.focus();
            } else {
                Keyboard.dismiss();
            }
        }
    };

    const handleFinish = async () => {
        if (!user || !activeWorkout) return;

        const onFinalFinish = async (shouldOverwrite: boolean) => {
            try {
                setSaving(true);
                if (shouldOverwrite && activeWorkout.planDayId) {
                    await plannerService.updatePlanDayExercises(activeWorkout.planDayId, activeWorkout.exercises);
                }
                await finishWorkout(user.id);
                setIsMaximized(false);
                setTimeout(() => {
                    Alert.alert("Great Job!", "Workout saved successfully.");
                }, 500);
            } catch (error) {
                console.error("Error saving workout:", error);
                Alert.alert("Error", "Failed to save workout");
            } finally {
                setSaving(false);
            }
        };

        if (activeWorkout.hasAdHoc) {
            Alert.alert(
                "Update Plan Template?",
                "You added exercises during this session. Do you want to add them permanently to your workout plan?",
                [
                    { text: "Update Template", onPress: () => onFinalFinish(true) },
                    { text: "Only Save Results", onPress: () => onFinalFinish(false) },
                    { text: "Cancel", style: "cancel" }
                ]
            );
        } else {
            Alert.alert(
                "Finish Workout",
                "Are you sure you want to finish this session?",
                [
                    { text: "Resume", style: "cancel" },
                    {
                        text: "Finish Workout",
                        style: "destructive",
                        onPress: () => onFinalFinish(false)
                    }
                ]
            );
        }
    };

    const handleMinimize = () => {
        setIsMaximized(false);
        setIsMinimized(true);
    };

    const handleScroll = (event: any) => {
        // We'll let the PanGesture handle the big minimize, but could still use this
    };

    const focusPrev = () => {
        if (!activeWorkout) return;
        let prevEx = activeExIdx;
        let prevSet = activeSetIdx - 1;

        if (prevSet < 0) {
            prevEx -= 1;
            if (prevEx < 0) return;
            prevSet = activeWorkout.exercises[prevEx].sets.length - 1;
        }

        setActiveExIdx(prevEx);
        setActiveSetIdx(prevSet);
        inputRefs.current[`${prevEx}-${prevSet}-weight`]?.focus();
    };

    const focusNext = () => {
        if (!activeWorkout) return;
        let nextEx = activeExIdx;
        let nextSet = activeSetIdx + 1;

        const currentEx = activeWorkout.exercises[nextEx];
        if (nextSet >= currentEx.sets.length) {
            nextEx += 1;
            if (nextEx >= activeWorkout.exercises.length) return;
            nextSet = 0;
        }

        setActiveExIdx(nextEx);
        setActiveSetIdx(nextSet);
        inputRefs.current[`${nextEx}-${nextSet}-weight`]?.focus();
    };

    if (!activeWorkout) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents={isMaximized ? 'auto' : 'none'}>
            <Animated.View
                style={[StyleSheet.absoluteFill, { backgroundColor: 'black' }, backdropStyle]}
            />
            <GestureDetector gesture={gesture}>
                <Animated.View
                    style={[StyleSheet.absoluteFill, animatedStyle, { zIndex: 1000, backgroundColor: '#030712' }]}
                >
                    <View style={{ paddingTop: insets.top }} className="flex-1 bg-gray-950">
                        {/* Drag Handle */}
                        <View className="items-center py-2">
                            <View className="w-12 h-1.5 bg-gray-800 rounded-full" />
                        </View>

                        {/* Header */}
                        <View className="px-4 py-3 bg-gray-950 border-b border-gray-800 flex-row justify-between items-center">
                            <View className="flex-row items-center flex-1">
                                <TouchableOpacity
                                    onPress={() => {
                                        Alert.alert(
                                            "Exit Workout",
                                            "Are you sure you want to exit? Your progress for this session will be lost.",
                                            [
                                                { text: "Resume", style: "cancel" },
                                                {
                                                    text: "Exit", style: "destructive", onPress: () => {
                                                        cancelWorkout();
                                                        setIsMaximized(false);
                                                    }
                                                }
                                            ]
                                        );
                                    }}
                                    className="w-10 h-10 items-center justify-center -ml-2"
                                >
                                    <Ionicons name="close" size={28} color="#9ca3af" />
                                </TouchableOpacity>
                                <View className="flex-1 px-2">
                                    <Text className="text-white font-bold text-lg" numberOfLines={1}>{activeWorkout.name}</Text>
                                    <Text className="text-gray-400 text-xs">{format(new Date(), 'MMM d, yyyy')}</Text>
                                </View>
                            </View>

                            <View className="flex-row items-center">
                                <TouchableOpacity
                                    onPress={handleMinimize}
                                    className="bg-gray-800 px-3 py-2 rounded-xl mr-4 flex-row items-center border border-gray-700"
                                >
                                    <Ionicons name="contract" size={16} color="#3b82f6" />
                                    <Text className="text-blue-400 font-bold text-xs ml-1 uppercase">Minimize</Text>
                                </TouchableOpacity>

                                <View className="items-end">
                                    <Text className="text-white font-mono text-xl font-bold">{formatTime(duration)}</Text>
                                    <Text className="text-gray-500 text-xs">{totalVolume.toFixed(0)} kg vol</Text>
                                </View>
                            </View>
                        </View>

                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            className="flex-1"
                        >
                            <ScrollView
                                ref={scrollViewRef}
                                className="flex-1 px-4 py-4"
                                keyboardShouldPersistTaps="handled"
                                onScroll={handleScroll}
                                scrollEventThrottle={16}
                            >
                                {activeWorkout.exercises.map((ex, exIndex) => {
                                    const history = exHistory[ex.exerciseId];
                                    const exTotalVolume = ex.sets.reduce((acc, s) => acc + (parseFloat(s.weight) * parseFloat(s.reps) || 0), 0);

                                    return (
                                        <View key={`${ex.exerciseId}-${exIndex}`} className="mb-6 bg-gray-900 rounded-3xl overflow-hidden border border-gray-800">
                                            <View className="p-4 bg-gray-900 text-left">
                                                <View className="flex-row justify-between items-start mb-2">
                                                    <Text className="text-blue-400 font-bold text-xl flex-1">{ex.name}</Text>
                                                </View>

                                                {history ? (
                                                    <Text className="text-gray-500 text-xs text-left">
                                                        Previous: {history.summary} ({history.date})
                                                    </Text>
                                                ) : (
                                                    <Text className="text-gray-600 text-xs italic text-left">No prior history found</Text>
                                                )}
                                            </View>

                                            <View className="flex-row bg-gray-800/50 py-2 px-4 border-y border-gray-800">
                                                <Text className="w-10 text-gray-400 text-[10px] font-bold uppercase tracking-tight">Set</Text>
                                                <View className="flex-1 flex-row items-center">
                                                    <Text className="flex-1 text-center text-gray-400 text-[10px] font-bold uppercase tracking-tight">KG</Text>
                                                    <Text className="flex-1 text-center text-gray-400 text-[10px] font-bold uppercase tracking-tight">Reps</Text>
                                                    <Text className="flex-1 text-center text-gray-400 text-[10px] font-bold uppercase tracking-tight">Volume</Text>
                                                </View>
                                                <Text className="w-10 text-center text-gray-400 text-[10px] font-bold uppercase tracking-tight">✓</Text>
                                            </View>

                                            {ex.sets.map((set, setIndex) => {
                                                const isActive = activeExIdx === exIndex && activeSetIdx === setIndex;
                                                const setVolume = (parseFloat(set.weight) * parseFloat(set.reps) || 0);
                                                const prevSet = history?.sets[setIndex];

                                                return (
                                                    <Swipeable
                                                        key={`${ex.exerciseId}-set-${setIndex}`}
                                                        renderRightActions={() => (
                                                            <TouchableOpacity onPress={() => removeSet(exIndex, setIndex)} className="bg-red-600 justify-center px-10">
                                                                <Ionicons name="trash-outline" size={24} color="white" />
                                                            </TouchableOpacity>
                                                        )}
                                                        onSwipeableRightOpen={() => removeSet(exIndex, setIndex)}
                                                        rightThreshold={40}
                                                    >
                                                        <View className={`flex-row items-center py-3 px-4 bg-gray-900 ${set.completed ? 'bg-green-900/10' : ''} ${isActive ? 'border-l-4 border-blue-500 bg-blue-600/5' : ''}`}>
                                                            <Text className={`w-10 font-bold ${set.completed ? 'text-green-500' : isActive ? 'text-blue-400' : 'text-gray-500'}`}>
                                                                {set.setNumber}
                                                            </Text>

                                                            <View className="flex-1 flex-row items-center">
                                                                <View className="flex-1 px-1">
                                                                    <TextInput
                                                                        ref={r => { if (r) inputRefs.current[`${exIndex}-${setIndex}-weight`] = r; }}
                                                                        className={`bg-gray-800/50 text-white text-center py-2.5 rounded-xl font-bold text-lg ${isActive ? 'border border-blue-500/50 bg-gray-800' : 'border border-transparent'} ${set.completed ? 'opacity-40 text-gray-400' : ''}`}
                                                                        keyboardType="numeric"
                                                                        value={set.weight}
                                                                        onChangeText={(v) => handleSetChange(exIndex, setIndex, 'weight', v)}
                                                                        onFocus={() => {
                                                                            setActiveExIdx(exIndex);
                                                                            setActiveSetIdx(setIndex);
                                                                        }}
                                                                        maxLength={5}
                                                                        selectTextOnFocus
                                                                        placeholder="0"
                                                                        placeholderTextColor="#374151"
                                                                        returnKeyType="next"
                                                                        onSubmitEditing={() => handleKeySubmit(exIndex, setIndex, 'weight')}
                                                                    />
                                                                </View>

                                                                <View className="flex-1 px-1">
                                                                    <TextInput
                                                                        ref={r => { if (r) inputRefs.current[`${exIndex}-${setIndex}-reps`] = r; }}
                                                                        className={`bg-gray-800/50 text-white text-center py-2.5 rounded-xl font-bold text-lg ${isActive ? 'border border-blue-500/50 bg-gray-800' : 'border border-transparent'} ${set.completed ? 'opacity-40 text-gray-400' : ''}`}
                                                                        keyboardType="numeric"
                                                                        value={set.reps}
                                                                        onChangeText={(v) => handleSetChange(exIndex, setIndex, 'reps', v)}
                                                                        onFocus={() => {
                                                                            setActiveExIdx(exIndex);
                                                                            setActiveSetIdx(setIndex);
                                                                        }}
                                                                        maxLength={3}
                                                                        selectTextOnFocus
                                                                        placeholder="0"
                                                                        placeholderTextColor="#374151"
                                                                        returnKeyType="done"
                                                                        onSubmitEditing={() => handleKeySubmit(exIndex, setIndex, 'reps')}
                                                                    />
                                                                </View>

                                                                <View className="flex-1 items-center justify-start pt-2.5">
                                                                    <Text className={`text-xs font-semibold ${set.completed ? 'text-green-600' : 'text-gray-400'}`}>
                                                                        {setVolume > 0 ? `${setVolume.toFixed(0)} kg` : '-'}
                                                                    </Text>
                                                                </View>
                                                            </View>

                                                            <TouchableOpacity
                                                                onPress={() => toggleSetComplete(exIndex, setIndex)}
                                                                className={`w-10 h-10 items-center justify-center rounded-xl ${set.completed ? 'bg-green-600' : 'bg-gray-800/50 border border-gray-700'}`}
                                                            >
                                                                {set.completed ? (
                                                                    <Ionicons name="checkmark" size={20} color="white" />
                                                                ) : (
                                                                    <View className="w-5 h-5 border-2 border-gray-600 rounded-md" />
                                                                )}
                                                            </TouchableOpacity>
                                                        </View>
                                                    </Swipeable>
                                                );
                                            })}

                                            <View className="p-4 flex-row justify-between items-center bg-gray-900/50">
                                                <TouchableOpacity
                                                    onPress={() => addSet(exIndex)}
                                                    className="flex-row items-center"
                                                >
                                                    <Ionicons name="add-circle-outline" size={20} color="#3b82f6" />
                                                    <Text className="text-blue-400 font-bold ml-1 text-sm">Add Set</Text>
                                                </TouchableOpacity>
                                                <Text className="text-gray-500 text-xs font-bold uppercase tracking-widest">
                                                    Total: <Text className="text-gray-300">{exTotalVolume.toLocaleString()} kg</Text>
                                                </Text>
                                            </View>
                                        </View>
                                    );
                                })}

                                <TouchableOpacity
                                    onPress={() => setAddExVisible(true)}
                                    className="bg-gray-900 border border-dashed border-gray-700 p-6 rounded-3xl items-center flex-row justify-center mb-10"
                                >
                                    <Ionicons name="add-circle" size={24} color="#3b82f6" />
                                    <Text className="text-blue-400 font-bold ml-2 text-lg">Add Ad-hoc Exercise</Text>
                                </TouchableOpacity>

                                <View className="h-32" />
                            </ScrollView>

                            <View className="p-4 bg-gray-900 border-t border-gray-800">
                                {isKeyboardVisible ? (
                                    <View className="flex-row justify-between items-center bg-gray-800 -mx-4 -mt-4 mb-4 px-4 py-2 border-y border-gray-700">
                                        <TouchableOpacity onPress={focusPrev} className="flex-row items-center px-3 py-2">
                                            <Ionicons name="chevron-up" size={20} color="#3b82f6" />
                                            <Text className="text-blue-400 font-bold ml-1 text-sm">Prev Set</Text>
                                        </TouchableOpacity>
                                        <View className="items-center">
                                            <Text className="text-white font-bold text-[10px] uppercase opacity-60">
                                                Ex {activeExIdx + 1} • Set {activeSetIdx + 1}
                                            </Text>
                                        </View>
                                        <TouchableOpacity onPress={focusNext} className="flex-row items-center px-3 py-2">
                                            <Text className="text-blue-400 font-bold mr-1 text-sm">Next Set</Text>
                                            <Ionicons name="chevron-down" size={20} color="#3b82f6" />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        onPress={handleFinish}
                                        disabled={saving}
                                        className={`bg-green-600 w-full py-4 rounded-2xl items-center shadow-lg ${saving ? 'opacity-70' : ''}`}
                                    >
                                        {saving ? (
                                            <ActivityIndicator color="white" />
                                        ) : (
                                            <Text className="text-white font-bold text-lg uppercase tracking-wider">Finish Workout</Text>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        </KeyboardAvoidingView>

                        {/* Rest Timer Modal */}
                        <Modal
                            animationType="slide"
                            transparent={true}
                            visible={restTimerVisible}
                            onRequestClose={() => setRestTimerVisible(false)}
                        >
                            <Pressable onPress={() => setRestTimerVisible(false)} className="flex-1 justify-end bg-black/50">
                                <Pressable className="bg-gray-900 border-t border-gray-800 p-6 rounded-t-3xl pb-10">
                                    <View className="flex-row justify-between items-center mb-4">
                                        <Text className="text-gray-400 font-bold uppercase tracking-widest text-xs">Resting</Text>
                                        <TouchableOpacity onPress={() => setRestTimerVisible(false)}>
                                            <Ionicons name="close-circle" size={28} color="#6b7280" />
                                        </TouchableOpacity>
                                    </View>

                                    <Text className="text-white text-center text-8xl font-black mb-2 font-mono">
                                        {formatTime(restTimeRemaining)}
                                    </Text>

                                    <View className="flex-row justify-center mb-8 gap-4">
                                        {[60, 90, 120, 180].map(time => (
                                            <TouchableOpacity
                                                key={time}
                                                onPress={() => {
                                                    setDefaultRestTime(time);
                                                    setRestTimeRemaining(time);
                                                }}
                                                className={`px-4 py-2 rounded-xl border ${defaultRestTime === time ? 'bg-blue-600 border-blue-500' : 'bg-gray-800 border-gray-700'}`}
                                            >
                                                <Text className={`font-bold ${defaultRestTime === time ? 'text-white' : 'text-gray-400'}`}>{time}s</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <View className="flex-row gap-4 justify-center">
                                        <TouchableOpacity
                                            onPress={() => setRestTimeRemaining(t => t - 10 > 0 ? t - 10 : 0)}
                                            className="bg-gray-800 h-16 w-16 rounded-full items-center justify-center border border-gray-700"
                                        >
                                            <Text className="text-white font-bold">-10</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => setRestTimerVisible(false)}
                                            className="bg-blue-600 px-8 h-16 rounded-full items-center justify-center flex-1 shadow-lg shadow-blue-500/30"
                                        >
                                            <Text className="text-white font-bold text-lg">Skip Rest</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => setRestTimeRemaining(t => t + 30)}
                                            className="bg-gray-800 h-16 w-16 rounded-full items-center justify-center border border-gray-700"
                                        >
                                            <Text className="text-white font-bold">+30</Text>
                                        </TouchableOpacity>
                                    </View>
                                </Pressable>
                            </Pressable>
                        </Modal>

                        {/* Add Exercise Modal */}
                        <Modal
                            animationType="fade"
                            transparent={true}
                            visible={addExVisible}
                            onRequestClose={() => setAddExVisible(false)}
                        >
                            <View className="flex-1 bg-black/80 justify-center p-6">
                                <View className="bg-gray-900 rounded-3xl border border-gray-800 overflow-hidden max-h-[80%]">
                                    <View className="p-4 border-b border-gray-800 flex-row justify-between items-center bg-gray-900">
                                        <Text className="text-white font-bold text-lg">Add Exercise</Text>
                                        <TouchableOpacity onPress={() => setAddExVisible(false)}>
                                            <Ionicons name="close" size={24} color="#9ca3af" />
                                        </TouchableOpacity>
                                    </View>
                                    <ScrollView className="p-2">
                                        {availableExercises.map(ex => (
                                            <TouchableOpacity
                                                key={ex.id}
                                                onPress={() => {
                                                    addExercise(ex);
                                                    setAddExVisible(false);
                                                }}
                                                className="p-4 border-b border-gray-800 flex-row items-center justify-between"
                                            >
                                                <View>
                                                    <Text className="text-white font-bold">{ex.name}</Text>
                                                    <Text className="text-gray-500 text-xs">{ex.muscle_group} • {ex.equipment}</Text>
                                                </View>
                                                <Ionicons name="add" size={20} color="#3b82f6" />
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </View>
                        </Modal>

                    </View>
                </Animated.View>
            </GestureDetector>
        </View>
    );
};
