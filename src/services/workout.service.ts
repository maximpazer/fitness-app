import { WorkoutExercise, WorkoutSet } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export const workoutService = {
    async getExerciseHistory(exerciseId: string, userId: string): Promise<(WorkoutExercise & { sets: WorkoutSet[] }) | null> {
        // Fetch the last set of this exercise from completed workouts
        // This is complex because we need to join workout_exercises -> workouts

        // Workaround: 
        const { data: recentWorkouts } = await supabase
            .from('completed_workouts')
            .select('id')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false })
            .limit(5); // Check last 5 workouts to find this exercise

        if (!recentWorkouts || recentWorkouts.length === 0) return null;

        const workoutIds = recentWorkouts.map(w => w.id);

        const { data: exerciseData } = await supabase
            .from('workout_exercises')
            .select(`
            *,
            sets:workout_sets (*)
        `)
            .eq('exercise_id', exerciseId)
            .in('workout_id', workoutIds) as { data: (WorkoutExercise & { sets: WorkoutSet[] })[] | null; error: any };

        if (!exerciseData || exerciseData.length === 0) return null;

        // Find the one belonging to the most recent workout
        for (const wid of workoutIds) {
            const match = exerciseData.find(e => e.workout_id === wid);
            if (match) {
                // Sort sets
                if (match.sets) match.sets.sort((a, b) => a.set_number - b.set_number);
                return match as (WorkoutExercise & { sets: WorkoutSet[] });
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
    }
};
