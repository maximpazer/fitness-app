import { supabase } from '@/lib/supabase';

export interface BodyMetric {
    id: string;
    user_id: string;
    logged_at: string;
    weight_kg: number | null;
    height_cm: number | null;
    notes: string | null;
    created_at: string;
}

export interface LogBodyMetricsInput {
    weight_kg?: number;
    height_cm?: number;
    notes?: string;
}

export const metricsService = {
    async logBodyMetrics(userId: string, data: LogBodyMetricsInput) {
        const { data: metric, error } = await supabase
            .from('body_metrics')
            .insert({
                user_id: userId,
                weight_kg: data.weight_kg || null,
                height_cm: data.height_cm || null,
                notes: data.notes || null,
                logged_at: new Date().toISOString()
            } as any)
            .select()
            .single();

        if (error) throw error;
        return metric as BodyMetric;
    },

    async getBodyMetrics(userId: string, limit: number = 50): Promise<BodyMetric[]> {
        const { data, error } = await supabase
            .from('body_metrics')
            .select('*')
            .eq('user_id', userId)
            .order('logged_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return (data || []) as BodyMetric[];
    },

    async getLatestBodyMetrics(userId: string): Promise<BodyMetric | null> {
        const { data, error } = await supabase
            .from('body_metrics')
            .select('*')
            .eq('user_id', userId)
            .order('logged_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // No rows
            throw error;
        }
        return data as BodyMetric;
    },

    async getWeightTrend(userId: string, weeks: number = 12): Promise<{ date: string; weight: number }[]> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (weeks * 7));

        const { data, error } = await supabase
            .from('body_metrics')
            .select('logged_at, weight_kg')
            .eq('user_id', userId)
            .gte('logged_at', startDate.toISOString())
            .not('weight_kg', 'is', null)
            .order('logged_at', { ascending: true });

        if (error) throw error;

        return (data || []).map(d => ({
            date: d.logged_at,
            weight: d.weight_kg!
        }));
    }
};
