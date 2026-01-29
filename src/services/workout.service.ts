import { WorkoutExercise, WorkoutSet } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export const workoutService = {
    async getExerciseHistory(exerciseId: string, userId: string): Promise<(WorkoutExercise & { sets: WorkoutSet[], workout?: { completed_at: string } }) | null> {
        // Fetch the last set of this exercise from completed workouts
        const { data: recentWorkouts } = await supabase
            .from('completed_workouts')
            .select('id, completed_at')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false })
            .limit(10); // Check last 10 workouts to find this exercise

        if (!recentWorkouts || recentWorkouts.length === 0) return null;

        const workoutIds = recentWorkouts.map(w => w.id);

        const { data: exerciseData } = await supabase
            .from('workout_exercises')
            .select(`
                *,
                workout:completed_workouts (completed_at),
                sets:workout_sets (*)
            `)
            .eq('exercise_id', exerciseId)
            .in('workout_id', workoutIds) as { data: (WorkoutExercise & { sets: WorkoutSet[], workout: { completed_at: string } })[] | null; error: any };

        if (!exerciseData || exerciseData.length === 0) return null;

        // Find the one belonging to the most recent workout
        for (const rw of recentWorkouts) {
            const match = exerciseData.find(e => e.workout_id === rw.id);
            if (match) {
                // Sort sets
                if (match.sets) match.sets.sort((a, b) => a.set_number - b.set_number);
                return match;
            }
        }

        return null;
    },

    async saveWorkout(data: {
        userId: string;
        planDayId?: string;
        name: string;
        durationMinutes: number;
        exercises: {
            exercise_id: string;
            sets: {
                reps: number;
                weight_kg: number;
                is_completed: boolean;
            }[];
        }[];
    }) {
        // 1. Create Completed Workout
        const { data: workout, error: workoutError } = await supabase
            .from('completed_workouts')
            .insert({
                user_id: data.userId,
                plan_day_id: data.planDayId,
                workout_date: new Date().toISOString(),
                workout_name: data.name,
                duration_minutes: data.durationMinutes,
                completed_at: new Date().toISOString()
            })
            .select()
            .single();

        if (workoutError) throw workoutError;
        if (!workout) throw new Error('Failed to create workout');

        // 2. Insert Exercises and Sets
        for (const [index, exercise] of data.exercises.entries()) {
            // Filter out empty sets or sets with no reps (unless logical?)
            const validSets = exercise.sets.filter(s => s.is_completed); // Only save completed sets? Or all? User said "Finish saves all data". Strong saves marked complete usually. Let's save checked ones.

            if (validSets.length === 0) continue;

            const { data: woExercise, error: exError } = await supabase
                .from('workout_exercises')
                .insert({
                    workout_id: workout.id,
                    exercise_id: exercise.exercise_id,
                    order_in_workout: index + 1
                })
                .select()
                .single();

            if (exError) throw exError;

            const setsToInsert = validSets.map((s, i) => ({
                workout_exercise_id: woExercise.id,
                set_number: i + 1,
                reps: Number(s.reps),
                weight_kg: Number(s.weight_kg),
                is_warmup: false
            }));

            const { error: setsError } = await supabase
                .from('workout_sets')
                .insert(setsToInsert);

            if (setsError) throw setsError;
        }

        return workout;
    },

    async getWorkoutSummary(workoutId: string) {
        const { data, error } = await supabase
            .from('completed_workouts')
            .select(`
                *,
                workout_exercises (
                    *,
                    exercise:exercises (name),
                    workout_sets (*)
                )
            `)
            .eq('id', workoutId)
            .single();

        if (error) throw error;
        return data;
    },

    async getDetailedRecentHistory(userId: string, limit: number = 5) {
        const { data, error } = await supabase
            .from('completed_workouts')
            .select(`
                id,
                workout_name,
                completed_at,
                duration_minutes,
                workout_exercises (
                    exercise:exercises (name),
                    sets:workout_sets (
                        reps,
                        weight_kg
                    )
                )
            `)
            .eq('user_id', userId)
            .order('completed_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    async deleteWorkoutExercise(workoutExerciseId: string) {
        // First delete all associated sets
        const { error: setsError } = await supabase
            .from('workout_sets')
            .delete()
            .eq('workout_exercise_id', workoutExerciseId);

        if (setsError) throw setsError;

        // Then delete the workout exercise itself
        const { error: exerciseError } = await supabase
            .from('workout_exercises')
            .delete()
            .eq('id', workoutExerciseId);

        if (exerciseError) throw exerciseError;
    },

    async deleteWorkout(workoutId: string) {
        // Get all workout exercises for this workout
        const { data: exercises } = await supabase
            .from('workout_exercises')
            .select('id')
            .eq('workout_id', workoutId);

        if (exercises && exercises.length > 0) {
            const exerciseIds = exercises.map(ex => ex.id);
            
            // Delete all sets for these exercises
            const { error: setsError } = await supabase
                .from('workout_sets')
                .delete()
                .in('workout_exercise_id', exerciseIds);

            if (setsError) throw setsError;

            // Delete all workout exercises
            const { error: exercisesError } = await supabase
                .from('workout_exercises')
                .delete()
                .eq('workout_id', workoutId);

            if (exercisesError) throw exercisesError;
        }

        // Finally delete the workout itself
        const { error: workoutError } = await supabase
            .from('completed_workouts')
            .delete()
            .eq('id', workoutId);

        if (workoutError) throw workoutError;
    }
};
