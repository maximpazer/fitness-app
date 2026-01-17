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

    async getPlanById(planId: string): Promise<FullPlan | null> {
        const { data: plan, error } = await supabase
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
            .eq('id', planId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            console.error('Error fetching plan:', error);
            throw error;
        }

        // Sort days and exercises
        if (plan && plan.days) {
            plan.days.sort((a: any, b: any) => a.day_number - b.day_number);
            plan.days.forEach((day: any) => {
                if (day.exercises) {
                    day.exercises.sort((a: any, b: any) => a.order_in_workout - b.order_in_workout);
                }
            });
        }

        return plan as FullPlan;
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

    async updatePlan(planId: string, planData: CreatePlanDTO) {
        // 1. Update top-level plan details
        const { error: planError } = await supabase
            .from('workout_plans')
            .update({
                name: planData.name,
                description: planData.description,
                duration_weeks: planData.duration_weeks
            })
            .eq('id', planId);

        if (planError) throw planError;

        // 2. Fetch existing days to diff
        const { data: existingDays, error: fetchError } = await supabase
            .from('plan_days')
            .select('id, day_number')
            .eq('plan_id', planId);

        if (fetchError) throw fetchError;

        // 3. Handle Days
        const newDayNumbers = new Set(planData.days.map(d => d.day_number));

        // 3a. Delete removed days
        if (existingDays) {
            const daysToDelete = existingDays.filter((d: any) => !newDayNumbers.has(d.day_number));
            if (daysToDelete.length > 0) {
                await supabase.from('plan_days').delete().in('id', daysToDelete.map((d: any) => d.id));
            }
        }

        // 3b. Update or Insert Days
        for (const day of planData.days) {
            const existingDay = existingDays?.find((d: any) => d.day_number === day.day_number);

            let dayId = (existingDay as any)?.id;

            if (dayId) {
                // Update existing day
                await supabase
                    .from('plan_days')
                    .update({
                        day_name: day.day_name,
                        day_type: day.day_type,
                        notes: day.notes
                    } as any)
                    .eq('id', dayId);
            } else {
                // Insert new day
                const { data: newDay, error: insertError } = await supabase
                    .from('plan_days')
                    .insert({
                        plan_id: planId,
                        day_number: day.day_number,
                        day_name: day.day_name,
                        day_type: day.day_type,
                        notes: day.notes
                    } as any)
                    .select()
                    .single();

                if (insertError) throw insertError;
                dayId = newDay.id;
            }

            // 4. Handle Exercises for this day
            // We'll treat exercises as a full replace for simplicity for now, 
            // OR try to smart diff if we had stable IDs (which we don't really from the DTO).
            // Actually, deleting all exercises for the day and re-inserting is safest 
            // to guarantee order and content match exactly without complex individual diffing.
            // CAUTION: This loses exercise history if linked strictly by plan_exercise_id. 
            // But usually history is linked by exercise_id + workout date/completed_workout.

            // Delete old exercises for this day
            await supabase.from('plan_exercises').delete().eq('plan_day_id', dayId);

            // Insert new exercises
            if (day.exercises && day.exercises.length > 0) {
                const exercisesToInsert = day.exercises.map(ex => ({
                    plan_day_id: dayId, // we know dayId is string here (from update or insert)
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
                    .insert(exercisesToInsert as any); // Typescript might complain about dayId being potentially undefined?

                if (exError) throw exError;
            }
        }
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
    },
    async deletePlan(planId: string) {
        // Try to delete, but if there are completed workouts referencing this plan,
        // we'll deactivate it instead to preserve workout history
        const { error } = await supabase
            .from('workout_plans')
            .delete()
            .eq('id', planId);

        if (error) {
            // If foreign key constraint error, deactivate instead
            if (error.code === '23503') {
                const { error: updateError } = await supabase
                    .from('workout_plans')
                    .update({ is_active: false } as any)
                    .eq('id', planId);

                if (updateError) throw updateError;
                return; // Successfully deactivated
            }
            throw error;
        }
    }
};
