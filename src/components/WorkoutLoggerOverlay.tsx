import { ExerciseCard } from '@/components/logger/ExerciseCard';
import { NotebookInput } from '@/components/logger/NotebookInput';
import { SessionHeader } from '@/components/logger/SessionHeader';
import { useAuthContext } from '@/context/AuthContext';
import { useWorkout } from '@/context/WorkoutContext';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { plannerService } from '@/services/planner.service';
import { workoutService } from '@/services/workout.service';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { ExercisePickerModal } from './ExercisePickerModal';
import { ExerciseVideoModal } from './ExerciseVideoModal';

export const WorkoutLoggerOverlay = () => {
    const { user } = useAuthContext();
    const { showDialog } = useConfirmDialog();
    const {
        activeWorkout,
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

    // -- State --
    // Expansion State (Single Expansion Mode as requested for "focus")
    const [expandedExId, setExpandedExId] = useState<string | null>(null);

    // Notebook Focus State
    const [focusedField, setFocusedField] = useState<{ exIdx: number, setIdx: number, field: 'weight' | 'reps' } | null>(null);

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
        let interval: NodeJS.Timeout;
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

    if (!activeWorkout) return null;

    // -- Handlers --

    const handleSetComplete = (exIdx: number, setIdx: number) => {
        const set = activeWorkout.exercises[exIdx].sets[setIdx];
        const wasCompleted = set.completed;
        const currentExId = activeWorkout.exercises[exIdx].exerciseId;

        updateSet(exIdx, setIdx, { completed: !wasCompleted });

        if (!wasCompleted) {
            // Start Timer
            setRestTimerStart(Date.now());
            setIsResting(true);
            setRestingLoc({ exIdx, setIdx });

            // Check if ALL sets are now done? 
            // We need to check state AFTER update, but we calculate locally
            const allOthersDone = activeWorkout.exercises[exIdx].sets.every((s: any, i: number) => i === setIdx || s.completed);

            if (allOthersDone) {
                // Auto-Advance to next exercise
                if (exIdx < activeWorkout.exercises.length - 1) {
                    const nextExId = activeWorkout.exercises[exIdx + 1].exerciseId;
                    setExpandedExId(nextExId); // "Hop to next one"
                }
            }
        }
    };

    const handleAddSet = (exIdx: number) => {
        addSet(exIdx);
    };

    // Notebook Input
    const handleInputUpdate = (val: string) => {
        if (!focusedField) return;
        const { exIdx, setIdx, field } = focusedField;
        updateSet(exIdx, setIdx, { [field]: val });
    };

    const handleNav = (dir: 'next' | 'prev') => {
        if (!focusedField) return;
        const { exIdx, setIdx, field } = focusedField;
        const currentEx = activeWorkout.exercises[exIdx];

        if (dir === 'next') {
            if (field === 'weight') {
                setFocusedField({ exIdx, setIdx, field: 'reps' });
            } else {
                // Moving forward from reps -> Auto-complete this set
                if (!currentEx.sets[setIdx].completed) {
                    handleSetComplete(exIdx, setIdx);
                }

                // Next Row
                if (setIdx < currentEx.sets.length - 1) {
                    setFocusedField({ exIdx, setIdx: setIdx + 1, field: 'weight' });
                } else {
                    // Next Exercise
                    if (exIdx < activeWorkout.exercises.length - 1) {
                        const nextEx = activeWorkout.exercises[exIdx + 1];
                        setFocusedField({ exIdx: exIdx + 1, setIdx: 0, field: 'weight' });
                        setExpandedExId(nextEx.exerciseId); // Auto-expand next
                    } else {
                        setFocusedField(null); // End of workout
                    }
                }
            }
        } else {
            // Previous Logic
            if (field === 'reps') {
                setFocusedField({ exIdx, setIdx, field: 'weight' });
            } else {
                if (setIdx > 0) {
                    setFocusedField({ exIdx, setIdx: setIdx - 1, field: 'reps' });
                } else {
                    if (exIdx > 0) {
                        const prevEx = activeWorkout.exercises[exIdx - 1];
                        setFocusedField({ exIdx: exIdx - 1, setIdx: prevEx.sets.length - 1, field: 'reps' });
                        setExpandedExId(prevEx.exerciseId);
                    }
                }
            }
        }
    };

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


    const getFocusedValue = () => {
        if (!focusedField) return '';
        const { exIdx, setIdx, field } = focusedField;
        return activeWorkout.exercises[exIdx]?.sets[setIdx]?.[field] || '';
    };

    const getFocusedLabel = () => {
        if (!focusedField) return '';
        const { exIdx, setIdx, field } = focusedField;
        return `${activeWorkout.exercises[exIdx]?.name} • S${setIdx + 1} • ${field}`;
    };

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents={isMaximized ? 'auto' : 'none'}>
            <GestureDetector gesture={gesture}>
                <Animated.View style={[StyleSheet.absoluteFill, animatedStyle, { zIndex: 1000, backgroundColor: '#030712' }]}>

                    {/* Background Dismissal Trigger */}
                    {focusedField && (
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => setFocusedField(null)}
                            style={StyleSheet.absoluteFill}
                            className="z-0"
                        />
                    )}

                    <View style={{ paddingTop: 10 }} className="bg-gray-950">
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
                    </View>

                    <SessionRestBar
                        visible={isResting}
                        startTime={restTimerStart}
                        duration={restTimerDuration}
                        onSkip={() => setIsResting(false)}
                    />

                    <FlatList
                        data={activeWorkout.exercises}
                        keyExtractor={(item) => item.exerciseId}
                        extraData={activeWorkout}
                        style={{ opacity: isResting ? 0.92 : 1 }}
                        contentContainerStyle={{ padding: 16, paddingBottom: 400 }}
                        renderItem={({ item: ex, index: exIdx }) => (
                            <ExerciseCard
                                exercise={ex}
                                isExpanded={expandedExId === ex.exerciseId}
                                historySets={exHistory[ex.exerciseId]?.sets}
                                activeFieldId={focusedField?.exIdx === exIdx ? `${ex.exerciseId}-${focusedField.setIdx}-${focusedField.field}` : undefined}
                                onFocusField={(sIdx, field) => {
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
                        )}
                        ListFooterComponent={
                            <View className="gap-4 mt-2">
                                <TouchableOpacity
                                    onPress={() => setAddExVisible(true)}
                                    className="py-4 border-2 border-dashed border-gray-800 rounded-2xl items-center active:bg-gray-900"
                                >
                                    <View className="flex-row items-center opacity-60">
                                        <Ionicons name="search" size={20} color="#9ca3af" />
                                        <Text className="text-gray-400 font-bold ml-2">ADD EXERCISE</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleFinishPress}
                                    className="bg-green-600 p-4 rounded-xl items-center"
                                >
                                    <Text className="text-white font-bold text-lg">PROCEED TO FINISH</Text>
                                </TouchableOpacity>
                            </View>
                        }
                    />

                    {/* Floating Rest Timer Deprecated */}

                    <NotebookInput
                        visible={!!focusedField}
                        value={getFocusedValue()}
                        label={getFocusedLabel()}
                        onChange={handleInputUpdate}
                        onNext={() => handleNav('next')}
                        onPrev={() => handleNav('prev')}
                        onClose={() => setFocusedField(null)}
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

// Session-level Rest Bar
const SessionRestBar = ({ visible, startTime, duration, onSkip }: { visible: boolean, startTime: number | null, duration: number, onSkip: () => void }) => {
    const [timeLeft, setTimeLeft] = useState(duration);
    const height = useSharedValue(0);

    useEffect(() => {
        height.value = withTiming(visible ? 48 : 0, { duration: 300 });
    }, [visible]);

    useEffect(() => {
        if (!visible || !startTime) {
            setTimeLeft(duration);
            return;
        }
        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = Math.max(0, duration - elapsed);
            setTimeLeft(remaining);
            if (remaining === 0) onSkip();
        }, 500);
        return () => clearInterval(interval);
    }, [visible, startTime, duration]);

    const animatedStyle = useAnimatedStyle(() => ({
        height: height.value,
        opacity: height.value > 0 ? 1 : 0,
        overflow: 'hidden'
    }));

    if (!visible && height.value === 0) return null;

    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;

    return (
        <Animated.View style={animatedStyle} className="bg-blue-600/10 border-b border-blue-500/20">
            <View className="flex-1 flex-row items-center justify-between px-4">
                <View className="flex-row items-center">
                    <Ionicons name="timer" size={18} color="#3b82f6" />
                    <Text className="text-blue-500 font-bold ml-2 text-xs uppercase tracking-widest">Resting</Text>
                </View>
                <View className="flex-row items-center gap-6">
                    <Text className="text-white font-mono font-black text-lg">{m}:{s < 10 ? '0' : ''}{s}</Text>
                    <TouchableOpacity onPress={onSkip} className="bg-blue-500/20 px-3 py-1 rounded-full border border-blue-500/30">
                        <Text className="text-blue-400 text-[10px] font-black uppercase">Skip</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    );
};
