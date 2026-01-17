import { Database } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

export type Exercise = Database['public']['Tables']['exercises']['Row'];

export const exerciseService = {
    async getExercises(filter?: { category?: string; search?: string }) {
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
    }
};
