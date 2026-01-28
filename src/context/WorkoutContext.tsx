import { aiService } from '@/services/ai.service';
import { workoutService } from '@/services/workout.service';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

export type WorkoutSet = {
    setNumber: number;
    weight: string;
    reps: string;
    completed: boolean;
    prevWeight?: string;
};

export type Exercise = {
    exerciseId: string;
    name: string;
    sets: WorkoutSet[];
    isAdHoc?: boolean;
    // Video/media fields from ExerciseDB
    video_url?: string | null;
    gif_url?: string | null;
    image_url?: string | null;
    instructions?: string[] | null;
    tips?: string[] | null;
    muscle_groups?: string[] | null;
    equipment_needed?: string[] | null;
};

export type ActiveWorkout = {
    planDayId?: string;
    name: string;
    startTime: number; // timestamp
    exercises: Exercise[];
    durationSeconds: number;
    hasAdHoc?: boolean;
    analysis?: any;
};

type WorkoutContextType = {
    activeWorkout: ActiveWorkout | null;
    startWorkout: (planDay: any, initialExercises: Exercise[]) => void;
    initWorkout: (userId: string, dayId: string) => Promise<void>;
    updateSet: (exIdx: number, setIdx: number, data: Partial<WorkoutSet>) => void;
    addSet: (exIdx: number) => void;
    removeSet: (exIdx: number, setIdx: number) => void;
    addExercise: (exercise: any) => void;
    finishWorkout: (userId: string) => Promise<void>;
    cancelWorkout: () => void;
    isMinimized: boolean;
    setIsMinimized: (val: boolean) => void;
    isMaximized: boolean;
    setIsMaximized: (val: boolean) => void;
    duration: number;
    onWorkoutComplete?: () => void;
    setOnWorkoutComplete: (callback: (() => void) | undefined) => void;
};

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [duration, setDuration] = useState(0);
    const [onWorkoutComplete, setOnWorkoutComplete] = useState<((analysis?: any) => void) | undefined>(undefined);
    const timerRef = useRef<any>(null);

    useEffect(() => {
        if (activeWorkout) {
            timerRef.current = setInterval(() => {
                setDuration(d => d + 1);
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setDuration(0);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [!!activeWorkout]);

    const startWorkout = (planDay: any, initialExercises: Exercise[]) => {
        setActiveWorkout({
            planDayId: planDay.id,
            name: planDay.day_name || 'Workout',
            startTime: Date.now(),
            exercises: initialExercises,
            durationSeconds: 0
        });
        setDuration(0);
        setIsMinimized(false);
        setIsMaximized(true);
    };

    const initWorkout = async (userId: string, dayId: string) => {
        const { plannerService } = await import('@/services/planner.service');
        const day = await plannerService.getPlanDay(dayId);
        const initialExercises: Exercise[] = [];

        console.log('[NEW CODE] Loading exercise history for', day.exercises.length, 'exercises');

        // Load all exercise history first before creating exercises
        const historyPromises = day.exercises.map(ex =>
            workoutService.getExerciseHistory(ex.exercise_id, userId).catch(() => null)
        );
        const histories = await Promise.all(historyPromises);

        console.log('[NEW CODE] History loaded, creating exercises with pre-filled data');

        // Create exercises with pre-filled weights from history
        for (let exIdx = 0; exIdx < day.exercises.length; exIdx++) {
            const ex = day.exercises[exIdx];
            const history = histories[exIdx];
            const numSets = ex.target_sets || 3;
            const sets: WorkoutSet[] = [];

            for (let i = 0; i < numSets; i++) {
                // Pre-fill with previous workout's data if available
                const prevSet = history?.sets?.[i];
                const defaultWeight = prevSet?.weight_kg?.toString() || '';
                const defaultReps = prevSet?.reps?.toString() || (ex.target_reps_min ? ex.target_reps_min.toString() : '');

                if (defaultWeight) {
                    console.log(`[NEW CODE] Pre-filling exercise ${exIdx} set ${i}: ${defaultWeight}kg × ${defaultReps}`);
                }

                sets.push({
                    setNumber: i + 1,
                    weight: defaultWeight,
                    reps: defaultReps,
                    completed: false,
                });
            }

            initialExercises.push({
                exerciseId: ex.exercise_id,
                name: ex.exercise?.name || 'Unknown Exercise',
                sets,
                // Include video/media fields from exercise data
                video_url: ex.exercise?.video_url,
                gif_url: ex.exercise?.gif_url,
                image_url: ex.exercise?.image_url,
                instructions: ex.exercise?.instructions,
                tips: ex.exercise?.tips,
                muscle_groups: ex.exercise?.muscle_groups,
                equipment_needed: ex.exercise?.equipment_needed,
            });
        }

        console.log('[NEW CODE] Starting workout with pre-filled data');
        // Start workout with pre-filled data
        startWorkout(day, initialExercises);
    };

    const updateSet = (exIdx: number, setIdx: number, data: Partial<WorkoutSet>) => {
        if (!activeWorkout) {
            console.warn('updateSet called but no activeWorkout');
            return;
        }
        if (!activeWorkout.exercises[exIdx]) {
            console.warn(`updateSet: exercise ${exIdx} not found`);
            return;
        }
        if (!activeWorkout.exercises[exIdx].sets[setIdx]) {
            console.warn(`updateSet: set ${setIdx} in exercise ${exIdx} not found`);
            return;
        }

        const newExercises = [...activeWorkout.exercises];
        newExercises[exIdx].sets[setIdx] = { ...newExercises[exIdx].sets[setIdx], ...data };
        setActiveWorkout({ ...activeWorkout, exercises: newExercises });

        console.log(`Updated exercise ${exIdx} set ${setIdx}:`, newExercises[exIdx].sets[setIdx]);
    };

    const addSet = (exIdx: number) => {
        if (!activeWorkout) return;
        const newExercises = [...activeWorkout.exercises];
        const currentSets = newExercises[exIdx].sets;
        const lastSet = currentSets[currentSets.length - 1];

        currentSets.push({
            setNumber: currentSets.length + 1,
            weight: lastSet ? lastSet.weight : '',
            reps: lastSet ? lastSet.reps : '',
            completed: false
        });
        setActiveWorkout({ ...activeWorkout, exercises: newExercises });
    };

    const removeSet = (exIdx: number, setIdx: number) => {
        if (!activeWorkout) return;
        const newExercises = [...activeWorkout.exercises];
        newExercises[exIdx].sets.splice(setIdx, 1);
        newExercises[exIdx].sets.forEach((s, i) => s.setNumber = i + 1);
        setActiveWorkout({ ...activeWorkout, exercises: newExercises });
    };

    const addExercise = (exercise: any) => {
        if (!activeWorkout) return;
        const newExercises = [...activeWorkout.exercises, {
            exerciseId: exercise.id,
            name: exercise.name,
            isAdHoc: true,
            sets: [{
                setNumber: 1,
                weight: '',
                reps: '',
                completed: false
            }],
            // Include video/media fields for ad-hoc exercises
            video_url: exercise.video_url,
            gif_url: exercise.gif_url,
            image_url: exercise.image_url,
            instructions: exercise.instructions,
            tips: exercise.tips,
            muscle_groups: exercise.muscle_groups,
            equipment_needed: exercise.equipment_needed,
        }];
        setActiveWorkout({ ...activeWorkout, exercises: newExercises, hasAdHoc: true });
    };

    const finishWorkout = async (userId: string) => {
        if (!activeWorkout) return;

        try {
            await workoutService.saveWorkout({
                userId,
                planDayId: activeWorkout.planDayId,
                name: activeWorkout.name,
                durationMinutes: Math.ceil(duration / 60),
                exercises: activeWorkout.exercises.map(ex => ({
                    exercise_id: ex.exerciseId,
                    sets: ex.sets.map(s => ({
                        reps: parseFloat(s.reps) || 0,
                        weight_kg: parseFloat(s.weight) || 0,
                        is_completed: s.completed
                    }))
                }))
            });
            // Fetch AI analysis
            try {
                const analysis = await aiService.analyzeWorkout(userId, {
                    name: activeWorkout.name,
                    durationMinutes: Math.ceil(duration / 60),
                    exercises: activeWorkout.exercises.map(ex => ({
                        name: ex.name,
                        sets: ex.sets.map(s => ({
                            reps: parseFloat(s.reps) || 0,
                            weight_kg: parseFloat(s.weight) || 0,
                            is_completed: s.completed
                        }))
                    }))
                });

                setActiveWorkout(null);
                setDuration(0);
                setIsMinimized(false);

                // Notify that workout is complete with analysis
                if (onWorkoutComplete) {
                    (onWorkoutComplete as any)(analysis);
                }
            } catch (aiError) {
                console.error("AI Analysis failed:", aiError);
                setActiveWorkout(null);
                setDuration(0);
                setIsMinimized(false);
                if (onWorkoutComplete) {
                    onWorkoutComplete();
                }
            }
        } catch (error) {
            console.error("Error saving workout:", error);
            throw error;
        }
    };

    const cancelWorkout = () => {
        setActiveWorkout(null);
        setDuration(0);
        setIsMinimized(false);
    };

    return (
        <WorkoutContext.Provider value={{
            activeWorkout,
            startWorkout,
            initWorkout,
            updateSet,
            addSet,
            removeSet,
            addExercise,
            finishWorkout,
            cancelWorkout,
            isMinimized,
            setIsMinimized,
            isMaximized,
            setIsMaximized,
            duration,
            onWorkoutComplete,
            setOnWorkoutComplete
        }}>
            {children}
        </WorkoutContext.Provider>
    );
};

export const useWorkout = () => {
    const context = useContext(WorkoutContext);
    if (context === undefined) {
        throw new Error('useWorkout must be used within a WorkoutProvider');
    }
    return context;
};
