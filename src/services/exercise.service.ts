import { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Exercise = Database['public']['Tables']['exercises']['Row'];

export const exerciseService = {
    async getExercises(filter?: { category?: string; search?: string; muscleGroups?: string[] }) {
        let query = supabase
            .from('exercises')
            .select('*')
            .order('name');

        if (filter?.category && filter.category !== 'All') {
            query = query.eq('category', filter.category.toLowerCase());
        }

        if (filter?.search) {
            query = query.ilike('name', `%${filter.search}%`);
        }

        // Filter by muscle groups (OR logic - show exercises matching ANY selected muscle group)
        if (filter?.muscleGroups && filter.muscleGroups.length > 0) {
            query = query.overlaps('muscle_groups', filter.muscleGroups);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching exercises:', error);
            throw error;
        }

        return data as Exercise[];
    },

    async getExerciseById(id: string) {
        const { data, error } = await supabase
            .from('exercises')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching exercise:', error);
            throw error;
        }

        return data as Exercise;
    },

    async getExerciseProgress(userId: string, exerciseId: string, weeks: number = 12) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (weeks * 7));

        console.log('Fetching exercise progress for:', { userId, exerciseId, startDate: startDate.toISOString() });

        // Query sets with joined data in one go
        const { data: sets, error } = await supabase
            .from('workout_sets')
            .select(`
                reps,
                weight_kg,
                workout_exercise_id,
                workout_exercises!inner(
                    exercise_id,
                    workout_id,
                    completed_workouts!inner(
                        user_id,
                        workout_date
                    )
                )
            `)
            .eq('workout_exercises.exercise_id', exerciseId)
            .eq('workout_exercises.completed_workouts.user_id', userId)
            .gte('workout_exercises.completed_workouts.workout_date', startDate.toISOString());

        console.log('Query result:', { sets: sets?.length, error });

        if (error) {
            console.error('Error fetching exercise progress:', error);
            throw error;
        }

        if (!sets || sets.length === 0) {
            console.log('No sets found for this exercise');
            return [];
        }

        // Group by date and calculate max weight per workout
        const grouped = new Map<string, { date: string; maxWeight: number; avgReps: number; totalSets: number }>();

        sets.forEach((set: any) => {
            const workoutDate = set.workout_exercises?.completed_workouts?.workout_date;
            if (!workoutDate) {
                console.log('Skipping set - no workout date:', set);
                return;
            }

            const date = workoutDate.split('T')[0];
            const existing = grouped.get(date) || { date, maxWeight: 0, avgReps: 0, totalSets: 0 };

            existing.maxWeight = Math.max(existing.maxWeight, set.weight_kg || 0);
            existing.avgReps = (existing.avgReps * existing.totalSets + (set.reps || 0)) / (existing.totalSets + 1);
            existing.totalSets += 1;

            grouped.set(date, existing);
        });

        const result = Array.from(grouped.values())
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(v => ({
                date: v.date,
                weight: v.maxWeight,
                reps: Math.round(v.avgReps)
            }));

        console.log('Progress data points:', result.length, result);
        return result;
    }
};
