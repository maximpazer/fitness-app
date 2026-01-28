import { supabase } from '@/lib/supabase';
import { FullPlan, PlanDay } from './planner.service';

export const planProgressionService = {
    /**
     * Determines which day from the plan should be suggested as "today's workout"
     * Logic:
     * 1. Find the most recently completed workout for this plan.
     * 2. If it exists, suggest the next training day in sequence.
     * 3. If it doesn't exist, suggest the first training day.
     */
    async getSuggestedWorkoutDay(userId: string, plan: FullPlan): Promise<PlanDay | null> {
        if (!plan || !plan.days || plan.days.length === 0) return null;

        const dayIds = plan.days.map(d => d.id);

        // Get the most recently completed workout that belongs to this plan
        const { data: lastCompleted, error } = await supabase
            .from('completed_workouts')
            .select('plan_day_id, completed_at')
            .eq('user_id', userId)
            .in('plan_day_id', dayIds)
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !lastCompleted) {
            // If no workouts completed yet, return the first training day
            return plan.days.find(d => d.day_type === 'training') || plan.days[0];
        }

        // Find the index of the last completed day
        const lastDayIdx = plan.days.findIndex(d => d.id === (lastCompleted as any).plan_day_id);

        // Suggest the next day in sequence
        // We look for the next training day, wrapping around if necessary
        for (let i = 1; i <= plan.days.length; i++) {
            const nextIdx = (lastDayIdx + i) % plan.days.length;
            const nextDay = plan.days[nextIdx];
            if (nextDay.day_type === 'training') {
                return nextDay;
            }
        }

        return plan.days[0];
    },

    /**
     * Get a sequence of upcoming workouts starting from a specific day
     */
    getUpcomingSequence(plan: FullPlan, currentDayId: string, count: number = 3): PlanDay[] {
        if (!plan || !plan.days || plan.days.length === 0) return [];

        const currentIdx = plan.days.findIndex(d => d.id === currentDayId);
        if (currentIdx === -1) return [];

        const sequence: PlanDay[] = [];
        let searchIdx = currentIdx;

        // Add the current day if it's not already completed (handled by UI)
        // But for the sequence, we usually want Tomorrow and Day after tomorrow

        for (let i = 1; i <= plan.days.length && sequence.length < count; i++) {
            const nextIdx = (currentIdx + i) % plan.days.length;
            const nextDay = plan.days[nextIdx];
            if (nextDay.day_type === 'training') {
                sequence.push(nextDay);
            }
        }

        return sequence;
    }
};
