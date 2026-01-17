import { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type WorkoutPlan = Database['public']['Tables']['workout_plans']['Row'];
export type PlanDay = Database['public']['Tables']['plan_days']['Row'];
export type PlanExercise = Database['public']['Tables']['plan_exercises']['Row'];

export type FullPlan = WorkoutPlan & {
    days: (PlanDay & {
        exercises: (PlanExercise & {
            exercise: Database['public']['Tables']['exercises']['Row'] | null;
        })[];
    })[];
};

export interface CreatePlanDTO {
    name: string;
    description?: string;
    duration_weeks: number;
    days: {
        day_number: number;
        day_name: string;
        day_type: 'training' | 'cardio' | 'rest' | 'active_recovery';
        notes?: string;
        exercises: {
            exercise_id: string; // or exercise_name if mapped later
            order_in_workout: number;
            target_sets: number;
            target_reps_min?: number;
            target_reps_max?: number;
            target_rpe?: number;
            rest_seconds?: number;
            notes?: string;
        }[];
    }[];
}

export const plannerService = {
    async getActivePlan(userId: string): Promise<FullPlan | null> {
        const { data: plans, error } = await supabase
            .from('workout_plans')
            .select(`
        *,
        days:plan_days (
          *,
          exercises:plan_exercises (
            *,
            exercise:exercises (*)
          )
        )
      `)
            .eq('user_id', userId)
            .eq('is_active', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // No rows found
            console.error('Error fetching active plan:', error);
            throw error;
        }

        // Sort days and exercises
        if (plans && plans.days) {
            plans.days.sort((a, b) => a.day_number - b.day_number);
            plans.days.forEach(day => {
                if (day.exercises) {
                    day.exercises.sort((a, b) => a.order_in_workout - b.order_in_workout);
                }
            });
        }

        return plans as FullPlan;
    },

    async deactivateCurrentPlan(userId: string) {
        await supabase
            .from('workout_plans')
            .update({ is_active: false })
            .eq('user_id', userId)
            .eq('is_active', true);
    },

    async createPlan(userId: string, planData: CreatePlanDTO) {
        // Start transaction (manual via sequential calls, Supabase JS doesn't support easy transactions yet)
        // 1. Deactivate old plans
        await this.deactivateCurrentPlan(userId);

        // 2. Create Plan
        const { data: newPlan, error: planError } = await supabase
            .from('workout_plans')
            .insert({
                user_id: userId,
                name: planData.name,
                description: planData.description,
                duration_weeks: planData.duration_weeks,
                is_active: true,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (planError) throw planError;
        if (!newPlan) throw new Error('Failed to create plan');

        // 3. Create Days & Exercises
        for (const day of planData.days) {
            const { data: newDay, error: dayError } = await supabase
                .from('plan_days')
                .insert({
                    plan_id: newPlan.id,
                    day_number: day.day_number,
                    day_name: day.day_name,
                    day_type: day.day_type,
                    notes: day.notes
                })
                .select()
                .single();

            if (dayError) throw dayError;
            if (!newDay) throw new Error('Failed to create day');

            if (day.exercises && day.exercises.length > 0) {
                const exercisesToInsert = day.exercises.map(ex => ({
                    plan_day_id: newDay.id,
                    exercise_id: ex.exercise_id,
                    order_in_workout: ex.order_in_workout,
                    target_sets: ex.target_sets,
                    target_reps_min: ex.target_reps_min,
                    target_reps_max: ex.target_reps_max,
                    target_rpe: ex.target_rpe,
                    rest_seconds: ex.rest_seconds,
                    notes: ex.notes
                }));

                const { error: exError } = await supabase
                    .from('plan_exercises')
                    .insert(exercisesToInsert);

                if (exError) throw exError;
            }
        }

        return newPlan;
    },
    async getPlanDay(dayId: string) {
        const { data, error } = await supabase
            .from('plan_days')
            .select(`
                *,
                exercises:plan_exercises (
                    *,
                    exercise:exercises (*)
                )
            `)
            .eq('id', dayId)
            .single();

        if (error) throw error;

        // Sort exercises
        if (data && data.exercises) {
            data.exercises.sort((a, b) => a.order_in_workout - b.order_in_workout);
        }

        return data as PlanDay & {
            exercises: (PlanExercise & {
                exercise: Database['public']['Tables']['exercises']['Row'] | null;
            })[];
        };
    }
};
