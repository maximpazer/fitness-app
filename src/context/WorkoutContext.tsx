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
};

export type ActiveWorkout = {
    planDayId?: string;
    name: string;
    startTime: number; // timestamp
    exercises: Exercise[];
    durationSeconds: number;
    hasAdHoc?: boolean;
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
};

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [duration, setDuration] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

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

        for (const ex of day.exercises) {
            const history = await workoutService.getExerciseHistory(ex.exercise_id, userId);
            const numSets = ex.target_sets || 3;
            const sets: WorkoutSet[] = [];

            for (let i = 0; i < numSets; i++) {
                let defaultWeight = '';
                let defaultReps = '';

                if (history && history.sets && history.sets[i]) {
                    defaultWeight = history.sets[i].weight_kg?.toString() || '';
                    defaultReps = history.sets[i].reps?.toString() || '';
                }

                sets.push({
                    setNumber: i + 1,
                    weight: defaultWeight,
                    reps: defaultReps || (ex.target_reps_min ? ex.target_reps_min.toString() : ''),
                    completed: false
                });
            }

            initialExercises.push({
                exerciseId: ex.exercise_id,
                name: ex.exercise?.name || 'Unknown Exercise',
                sets
            });
        }

        startWorkout(day, initialExercises);
    };

    const updateSet = (exIdx: number, setIdx: number, data: Partial<WorkoutSet>) => {
        if (!activeWorkout) return;
        const newExercises = [...activeWorkout.exercises];
        newExercises[exIdx].sets[setIdx] = { ...newExercises[exIdx].sets[setIdx], ...data };
        setActiveWorkout({ ...activeWorkout, exercises: newExercises });
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
            }]
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
            setActiveWorkout(null);
            setDuration(0);
            setIsMinimized(false);
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
            duration
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
