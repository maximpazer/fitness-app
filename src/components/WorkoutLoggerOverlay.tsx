import { CircularRestTimer } from '@/components/logger/CircularRestTimer';
import { ExerciseCard } from '@/components/logger/ExerciseCard';
import { NotebookInput } from '@/components/logger/NotebookInput';
import { SessionHeader } from '@/components/logger/SessionHeader';
import { useAuthContext } from '@/context/AuthContext';
import { useWorkout } from '@/context/WorkoutContext';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { plannerService } from '@/services/planner.service';
import { workoutService } from '@/services/workout.service';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, Swipeable } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { ExercisePickerModal } from './ExercisePickerModal';
import { ExerciseVideoModal } from './ExerciseVideoModal';

export const WorkoutLoggerOverlay = () => {
    const { user } = useAuthContext();
    const { showDialog } = useConfirmDialog();
    const {
        activeWorkout,
        updateSet,
        updateWorkoutData,
        addSet,
        removeSet,
        addExercise,
        removeExercise,
        finishWorkout,
        cancelWorkout,
        setIsMinimized,
        isMaximized,
        setIsMaximized,
        duration
    } = useWorkout();

    // -- Helpers --
    const renderExerciseRightActions = (exIdx: number) => {
        return (
            <TouchableOpacity
                onPress={() => {
                    showDialog(
                        "Remove Exercise",
                        "Are you sure you want to remove this entire exercise and all its sets?",
                        [
                            { text: "Remove", style: "destructive", onPress: () => removeExercise(exIdx) },
                            { text: "Cancel", style: "cancel" }
                        ]
                    );
                }}
                className="bg-red-500/90 justify-center items-center w-24 rounded-2xl mb-4 ml-2"
                activeOpacity={0.7}
            >
                <Ionicons name="trash" size={28} color="white" />
                <Text className="text-white text-xs font-bold uppercase mt-1">Remove</Text>
            </TouchableOpacity>
        );
    };

    // -- State --
    // Expansion State (Single Expansion Mode as requested for "focus")
    const [expandedExId, setExpandedExId] = useState<string | null>(null);

    // Notebook Focus State with LOCAL input value for instant feedback
    const [focusedField, setFocusedField] = useState<{ exIdx: number, setIdx: number, field: 'weight' | 'reps' } | null>(null);
    const [focusedExtra, setFocusedExtra] = useState<'warmup' | 'cooldown' | null>(null);
    const [localInputValue, setLocalInputValue] = useState<string>('');

    // Floating Rest Timer (Deprecated floating bubble, moving to Inline)
    const [restTimerStart, setRestTimerStart] = useState<number | null>(null);
    const [restTimerDuration, setRestTimerDuration] = useState(60);
    const [isResting, setIsResting] = useState(false);
    const [restingLoc, setRestingLoc] = useState<{ exIdx: number, setIdx: number } | null>(null);

    // Data
    const [addExVisible, setAddExVisible] = useState(false);
    const [availableExercises, setAvailableExercises] = useState<any[]>([]);
    const [exHistory, setExHistory] = useState<Record<string, { sets: any[] }>>({});

    // UI State
    const [saving, setSaving] = useState(false);
    const [finishDialogVisible, setFinishDialogVisible] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState<any>(null);

    // Animations
    const { height: SCREEN_HEIGHT } = Dimensions.get('window');
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const isDragging = useSharedValue(false);

    // Ref for instant access in callbacks without re-creating them
    const workoutRef = useRef(activeWorkout);
    useEffect(() => {
        workoutRef.current = activeWorkout;
    }, [activeWorkout]);

    // Debounce timer for syncing local input to context
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cleanup sync timer on unmount
    useEffect(() => {
        return () => {
            if (syncTimerRef.current) {
                clearTimeout(syncTimerRef.current);
            }
        };
    }, []);

    // -- Effects --

    // Auto-Expand First Exercise on Load
    useEffect(() => {
        if (activeWorkout && activeWorkout.exercises.length > 0 && !expandedExId) {
            setExpandedExId(activeWorkout.exercises[0].exerciseId);
        }
    }, [activeWorkout]);

    // Minimize logic
    useEffect(() => {
        translateY.value = withTiming(isMaximized ? 0 : SCREEN_HEIGHT, { duration: 300 });
        if (!isMaximized) {
            setFocusedField(null);
        }
    }, [isMaximized]);

    // Rest Timer
    useEffect(() => {
        let interval: any;
        if (isResting) {
            interval = setInterval(() => {
                const now = Date.now();
                const elapsed = Math.floor((now - (restTimerStart || now)) / 1000);
                if (elapsed >= restTimerDuration) {
                    // Timer done
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isResting, restTimerStart]);

    // Load History
    useEffect(() => {
        if (!user || !activeWorkout) return;
        const load = async () => {
            const all = await plannerService.getAllExercises();
            setAvailableExercises(all);

            for (const ex of activeWorkout.exercises) {
                if (!exHistory[ex.exerciseId]) {
                    const h = await workoutService.getExerciseHistory(ex.exerciseId, user.id);
                    if (h && h.sets) {
                        setExHistory(prev => ({ ...prev, [ex.exerciseId]: { sets: h.sets } }));
                    }
                }
            }
        };
        load();
    }, [user, activeWorkout]);

    // Gestures
    const gesture = Gesture.Pan()
        .onStart(() => { isDragging.value = true; })
        .onUpdate((e) => {
            if (e.translationY > 0) translateY.value = e.translationY;
        })
        .onEnd((e) => {
            isDragging.value = false;
            if (e.translationY > 150) {
                runOnJS(setIsMaximized)(false);
                runOnJS(setIsMinimized)(true);
            } else {
                translateY.value = withSpring(0);
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    // Volume Calculation
    const totalVolume = useMemo(() => {
        if (!activeWorkout) return 0;
        return activeWorkout.exercises.reduce((acc, ex) => {
            return acc + ex.sets.reduce((exAcc, s) => {
                if (!s.completed) return exAcc;
                return exAcc + (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0);
            }, 0);
        }, 0);
    }, [activeWorkout]);



    // -- Handlers --

    const handleSetComplete = useCallback((exIdx: number, setIdx: number) => {
        if (!workoutRef.current) return;
        const set = workoutRef.current.exercises[exIdx].sets[setIdx];
        const wasCompleted = set.completed;
        const currentExId = workoutRef.current.exercises[exIdx].exerciseId;

        updateSet(exIdx, setIdx, { completed: !wasCompleted });

        if (!wasCompleted) {
            // Trigger Light Haptic
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            // Start Timer
            setRestTimerStart(Date.now());
            setIsResting(true);
            setRestingLoc({ exIdx, setIdx });

            // Check if ALL sets are now done? 
            // We need to check state AFTER update, but we calculate locally
            const allOthersDone = workoutRef.current.exercises[exIdx].sets.every((s: any, i: number) => i === setIdx || s.completed);

            if (allOthersDone) {
                // Auto-Advance to next exercise
                if (exIdx < workoutRef.current.exercises.length - 1) {
                    const nextExId = workoutRef.current.exercises[exIdx + 1].exerciseId;
                    setExpandedExId(nextExId); // "Hop to next one"
                }
            }
        }
    }, [updateSet]);

    const handleAddSet = useCallback((exIdx: number) => {
        addSet(exIdx);
    }, [addSet]);

    // Sync local input value to context (called when navigating away)
    const syncInputToContext = useCallback(() => {
        if (!localInputValue) return;

        if (focusedField) {
            const { exIdx, setIdx, field } = focusedField;
            updateSet(exIdx, setIdx, { [field]: localInputValue });
        } else if (focusedExtra) {
            const numVal = parseFloat(localInputValue);
            if (!isNaN(numVal)) {
                if (focusedExtra === 'warmup') updateWorkoutData({ warmupDuration: numVal * 60 });
                if (focusedExtra === 'cooldown') updateWorkoutData({ cooldownDuration: numVal * 60 });
            }
        }
    }, [focusedField, focusedExtra, localInputValue, updateSet, updateWorkoutData]);

    // Notebook Input - LOCAL state for instant feedback
    const handleInputUpdate = useCallback((val: string) => {
        setLocalInputValue(val);

        // Clear previous timer
        if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
        }

        // Debounce sync to context (300ms)
        syncTimerRef.current = setTimeout(() => {
            const numVal = parseFloat(val);

            if (focusedField) {
                const { exIdx, setIdx, field } = focusedField;
                updateSet(exIdx, setIdx, { [field]: val });
            } else if (focusedExtra) {
                if (!isNaN(numVal)) {
                    if (focusedExtra === 'warmup') updateWorkoutData({ warmupDuration: numVal * 60 });
                    if (focusedExtra === 'cooldown') updateWorkoutData({ cooldownDuration: numVal * 60 });
                }
            }
        }, 300);
    }, [focusedField, focusedExtra, updateSet, updateWorkoutData]);

    const handleNav = useCallback((dir: 'next' | 'prev') => {
        if (!focusedField || !workoutRef.current) return;

        // Sync current value to context immediately before navigating
        if (localInputValue && syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
            const { exIdx, setIdx, field } = focusedField;
            updateSet(exIdx, setIdx, { [field]: localInputValue });
        }

        const { exIdx, setIdx, field } = focusedField;
        const currentEx = workoutRef.current.exercises[exIdx];

        if (dir === 'next') {
            if (field === 'weight') {
                // Instant field switch - load reps value
                const repsValue = currentEx.sets[setIdx].reps || '';
                setLocalInputValue(repsValue);
                setFocusedField({ exIdx, setIdx, field: 'reps' });
            } else {
                // Moving forward from reps -> Auto-complete this set
                if (!currentEx.sets[setIdx].completed) {
                    handleSetComplete(exIdx, setIdx);
                }

                // Next Row
                if (setIdx < currentEx.sets.length - 1) {
                    const nextWeight = currentEx.sets[setIdx + 1].weight || '';
                    setLocalInputValue(nextWeight);
                    setFocusedField({ exIdx, setIdx: setIdx + 1, field: 'weight' });
                } else {
                    // Next Exercise
                    if (exIdx < workoutRef.current.exercises.length - 1) {
                        const nextEx = workoutRef.current.exercises[exIdx + 1];
                        const nextWeight = nextEx.sets[0]?.weight || '';
                        setExpandedExId(nextEx.exerciseId);
                        setLocalInputValue(nextWeight);
                        setFocusedField({ exIdx: exIdx + 1, setIdx: 0, field: 'weight' });
                    } else {
                        setFocusedField(null);
                        setLocalInputValue('');
                    }
                }
            }
        } else {
            // Previous Logic
            if (field === 'reps') {
                const weightValue = currentEx.sets[setIdx].weight || '';
                setLocalInputValue(weightValue);
                setFocusedField({ exIdx, setIdx, field: 'weight' });
            } else {
                if (setIdx > 0) {
                    const prevReps = currentEx.sets[setIdx - 1].reps || '';
                    setLocalInputValue(prevReps);
                    setFocusedField({ exIdx, setIdx: setIdx - 1, field: 'reps' });
                } else {
                    if (exIdx > 0) {
                        const prevEx = workoutRef.current.exercises[exIdx - 1];
                        const prevReps = prevEx.sets[prevEx.sets.length - 1]?.reps || '';
                        setExpandedExId(prevEx.exerciseId);
                        setLocalInputValue(prevReps);
                        setFocusedField({ exIdx: exIdx - 1, setIdx: prevEx.sets.length - 1, field: 'reps' });
                    }
                }
            }
        }
    }, [focusedField, localInputValue, handleSetComplete, updateSet]);

    const handleFinishPress = async () => {
        if (!activeWorkout || !user) return;

        const hasAdHoc = activeWorkout.exercises.some(ex => ex.isAdHoc);

        if (hasAdHoc && activeWorkout.planDayId) {
            showDialog(
                "Finish Workout",
                "You added new exercises to this session. Would you like to add them to your permanent plan template?",
                [
                    {
                        text: "Save to Plan & Finish",
                        onPress: async () => {
                            setSaving(true);
                            try {
                                await plannerService.updatePlanDayExercises(
                                    activeWorkout.planDayId!,
                                    activeWorkout.exercises
                                );
                                await finishWorkout(user.id);
                            } finally {
                                setSaving(false);
                            }
                        }
                    },
                    {
                        text: "Finish Session Only",
                        style: 'cancel',
                        onPress: () => finishWorkout(user.id)
                    },
                    {
                        text: "Cancel",
                        style: 'cancel'
                    }
                ]
            );
        } else {
            showDialog(
                "Finish Workout",
                "Complete this workout and save your results?",
                [
                    {
                        text: "Finish Workout",
                        onPress: () => finishWorkout(user.id)
                    },
                    {
                        text: "Cancel",
                        style: 'cancel'
                    }
                ]
            );
        }
    };

    const getFocusedLabel = useCallback(() => {
        if (!focusedField || !activeWorkout) return '';
        const { exIdx, setIdx, field } = focusedField;
        return `${activeWorkout.exercises[exIdx]?.name} • S${setIdx + 1} • ${field}`;
    }, [focusedField, activeWorkout]);

    if (!activeWorkout) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents={isMaximized ? 'auto' : 'none'}>
            <GestureDetector gesture={gesture}>
                <Animated.View style={[StyleSheet.absoluteFill, animatedStyle, { zIndex: 1000, backgroundColor: '#111827' }]}>

                    {/* Background Dismissal Trigger */}
                    {focusedField && (
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => setFocusedField(null)}
                            style={StyleSheet.absoluteFill}
                            className="z-0"
                        />
                    )}

                    <SessionHeader
                        workoutName={activeWorkout.name}
                        durationSeconds={duration}
                        volumeKg={totalVolume}
                        onExit={() => showDialog(
                            "Exit Workout",
                            "Are you sure you want to stop? Your progress will not be saved.",
                            [
                                { text: "Exit", style: 'destructive', onPress: cancelWorkout },
                                { text: "Continue", style: 'cancel' }
                            ]
                        )}
                    />

                    <CircularRestTimer
                        visible={isResting}
                        startTime={restTimerStart}
                        duration={restTimerDuration}
                        onSkip={() => setIsResting(false)}
                        onAddTime={(seconds) => setRestTimerStart(prev => (prev || Date.now()) + seconds * 1000)}
                    />

                    <FlatList
                        data={activeWorkout.exercises}
                        keyExtractor={(item) => item.exerciseId}
                        extraData={activeWorkout}
                        style={{ opacity: isResting ? 0.92 : 1, flex: 1 }}
                        contentContainerStyle={{ padding: 16, paddingBottom: 400 }}
                        renderItem={({ item: ex, index: exIdx }) => (
                            <Swipeable
                                key={ex.exerciseId}
                                renderRightActions={() => renderExerciseRightActions(exIdx)}
                                friction={2}
                                rightThreshold={40}
                            >
                                <ExerciseCard
                                    exercise={ex}
                                    isExpanded={expandedExId === ex.exerciseId}
                                    historySets={exHistory[ex.exerciseId]?.sets}
                                    activeFieldId={focusedField?.exIdx === exIdx ? `${ex.exerciseId}-${focusedField.setIdx}-${focusedField.field}` : undefined}
                                    localInputValue={focusedField?.exIdx === exIdx ? localInputValue : undefined}
                                    onFocusField={(sIdx, field) => {
                                        const currentValue = ex.sets[sIdx][field] || '';
                                        setLocalInputValue(currentValue);
                                        setFocusedField({ exIdx, setIdx: sIdx, field });
                                        setExpandedExId(ex.exerciseId); // Auto-expand on tap
                                    }}
                                    onCompleteSet={(sIdx) => handleSetComplete(exIdx, sIdx)}
                                    onAddSet={() => handleAddSet(exIdx)}
                                    onRemoveSet={(sIdx) => removeSet(exIdx, sIdx)}
                                    onShowInfo={() => setSelectedExercise(ex)}
                                    onToggleExpand={() => setExpandedExId(expandedExId === ex.exerciseId ? null : ex.exerciseId)}
                                    onStopResting={() => setIsResting(false)}
                                />
                            </Swipeable>
                        )}
                        ListHeaderComponent={
                            <View className="mb-4 flex-row justify-center">
                                <TouchableOpacity
                                    onPress={() => {
                                        setFocusedField(null);
                                        setLocalInputValue(activeWorkout.warmupDuration ? (activeWorkout.warmupDuration / 60).toString() : '');
                                        setFocusedExtra('warmup');
                                    }}
                                    style={{
                                        backgroundColor: '#2a2a2a',
                                        borderColor: '#FF6B35',
                                        borderWidth: 1
                                    }}
                                    className="flex-row items-center px-5 py-3 rounded-full"
                                >
                                    <Ionicons name="flame" size={18} color="#FF6B35" />
                                    <Text style={{ color: '#FF6B35', fontWeight: '600' }} className="ml-2 text-sm uppercase tracking-wide">
                                        {activeWorkout.warmupDuration
                                            ? `Warmup: ${Math.round(activeWorkout.warmupDuration / 60)} min`
                                            : "Add Warmup"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        }
                        ListFooterComponent={
                            <View className="gap-6 mt-4 pb-10">
                                <View className="flex-row justify-center">
                                    <TouchableOpacity
                                        onPress={() => {
                                            setFocusedField(null);
                                            setLocalInputValue(activeWorkout.cooldownDuration ? (activeWorkout.cooldownDuration / 60).toString() : '');
                                            setFocusedExtra('cooldown');
                                        }}
                                        style={{
                                            backgroundColor: '#2a2a2a',
                                            borderColor: '#FF6B35',
                                            borderWidth: 1
                                        }}
                                        className="flex-row items-center px-5 py-3 rounded-full"
                                    >
                                        <Ionicons name="snow" size={18} color="#FF6B35" />
                                        <Text style={{ color: '#FF6B35', fontWeight: '600' }} className="ml-2 text-sm uppercase tracking-wide">
                                            {activeWorkout.cooldownDuration
                                                ? `Cooldown: ${Math.round(activeWorkout.cooldownDuration / 60)} min`
                                                : "Add Cooldown"}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    onPress={() => setAddExVisible(true)}
                                    className="py-2 items-center active:opacity-60"
                                >
                                    <View className="flex-row items-center">
                                        <Ionicons name="add-circle-outline" size={22} color="#3b82f6" />
                                        <Text className="text-blue-500 font-black ml-2 uppercase tracking-widest text-xs">Add Exercise</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleFinishPress}
                                    activeOpacity={0.8}
                                    className="bg-blue-600 py-5 rounded-2xl items-center shadow-lg shadow-blue-500/30"
                                >
                                    <Text className="text-white font-black text-lg uppercase tracking-[0.1em]">Proceed to Finish</Text>
                                </TouchableOpacity>
                            </View>
                        }
                    />

                    {/* Floating Rest Timer Deprecated */}

                    <NotebookInput
                        visible={!!focusedField || !!focusedExtra}
                        value={localInputValue}
                        label={focusedExtra
                            ? (focusedExtra === 'warmup' ? 'Warmup Duration (min)' : 'Cooldown Duration (min)')
                            : getFocusedLabel()
                        }
                        onChange={handleInputUpdate}
                        onNext={() => handleNav('next')}
                        onPrev={() => handleNav('prev')}
                        onClose={() => {
                            syncInputToContext();
                            setFocusedField(null);
                            setFocusedExtra(null);
                            setLocalInputValue('');
                        }}
                    />

                </Animated.View>
            </GestureDetector>

            {selectedExercise && (
                <ExerciseVideoModal
                    visible={!!selectedExercise}
                    exercise={selectedExercise}
                    onClose={() => setSelectedExercise(null)}
                />
            )}

            <ExercisePickerModal
                visible={addExVisible}
                onClose={() => setAddExVisible(false)}
                allExercises={availableExercises}
                onSelect={(ex) => {
                    addExercise(ex);
                    setAddExVisible(false);
                }}
            />
        </View>
    );
};

