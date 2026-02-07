import { Goal } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export const goalsService = {
    async fetchGoals(userId: string) {
        const { data, error } = await supabase
            .from('goals')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching goals:', error);
            return { data: null, error };
        }

        return { data: data as Goal[], error: null };
    },

    async createGoal(goal: Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { user_id: string }) {
        const { data, error } = await supabase
            .from('goals')
            .insert([goal] as any)
            .select()
            .single();

        if (error) {
            console.error('Error creating goal:', error);
            return { data: null, error };
        }

        return { data: data as Goal, error: null };
    },

    async updateGoal(goalId: string, updates: Partial<Goal>) {
        const { data, error } = await supabase
            .from('goals')
            .update(updates as any)
            .eq('id', goalId)
            .select()
            .single();

        if (error) {
            console.error('Error updating goal:', error);
            return { data: null, error };
        }

        return { data: data as Goal, error: null };
    },

    async deleteGoal(goalId: string) {
        const { error } = await supabase
            .from('goals')
            .delete()
            .eq('id', goalId);

        if (error) {
            console.error('Error deleting goal:', error);
            return { error };
        }

        return { error: null };
    }
};
