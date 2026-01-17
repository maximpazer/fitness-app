import { supabase } from '@/lib/supabase'
import { startOfWeek } from 'date-fns'

export const dashboardService = {
    async getDashboardData(userId: string) {
        try {
            // 1. Get Profile (for name)
            const { data: profile } = await supabase
                .from('profiles')
                .select('display_name')
                .eq('id', userId)
                .single()

            // 2. Get Today's Stats (Completed Workouts count & minutes)
            const now = new Date()
            const startOfCurrentWeek = startOfWeek(now).toISOString()

            const { data: weeklyWorkouts } = await supabase
                .from('completed_workouts')
                .select('duration_minutes, completed_at')
                .eq('user_id', userId)
                .gte('completed_at', startOfCurrentWeek)

            const weeklyCount = weeklyWorkouts?.length || 0
            const weeklyMinutes = weeklyWorkouts?.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0) || 0

            // 3. Get Recent Activity (Last 3)
            const { data: recentActivity } = await supabase
                .from('completed_workouts')
                .select('*')
                .eq('user_id', userId)
                .order('completed_at', { ascending: false })
                .limit(3)

            // 4. Get Weight History (Last 7 entries)
            // Note: Assuming we have a 'body_measurements' table or similar, if not relying on profile updates/table.
            // For now, let's mock chart data if table doesn't exist or return empty array.
            // TODO: Check if body_measurements table exists in types, if not, skip.

            return {
                displayName: profile?.display_name || 'Athlete',
                weeklyCount,
                weeklyMinutes,
                recentActivity: recentActivity || [],
                chartData: [
                    { x: 'Mon', y: 0 },
                    { x: 'Tue', y: 0 },
                    { x: 'Wed', y: 0 },
                    { x: 'Thu', y: 0 },
                    { x: 'Fri', y: 0 },
                    { x: 'Sat', y: 0 },
                    { x: 'Sun', y: 0 }
                ] // Placeholder for now
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error)
            return null
        }
    },

    async getWeeklyVolume(userId: string, weeks: number = 12) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (weeks * 7));

        const { data: workouts, error } = await supabase
            .from('completed_workouts')
            .select(`
                completed_at,
                workout_exercises (
                    workout_sets (
                        weight_kg,
                        reps
                    )
                )
            `)
            .eq('user_id', userId)
            .gte('completed_at', startDate.toISOString())
            .order('completed_at', { ascending: true });

        if (error) throw error;

        // Group by week and calculate total volume (weight × reps)
        const weeklyData: { week: string; volume: number }[] = [];
        const weekMap = new Map<string, number>();

        (workouts || []).forEach((workout: any) => {
            const weekStart = startOfWeek(new Date(workout.completed_at));
            const weekKey = weekStart.toISOString().split('T')[0];

            let workoutVolume = 0;
            (workout.workout_exercises || []).forEach((ex: any) => {
                (ex.workout_sets || []).forEach((set: any) => {
                    if (set.weight_kg && set.reps) {
                        workoutVolume += set.weight_kg * set.reps;
                    }
                });
            });

            weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + workoutVolume);
        });

        weekMap.forEach((volume, week) => {
            weeklyData.push({ week, volume });
        });

        return weeklyData;
    },

    async getWorkoutFrequency(userId: string, weeks: number = 12) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (weeks * 7));

        const { data: workouts, error } = await supabase
            .from('completed_workouts')
            .select('completed_at')
            .eq('user_id', userId)
            .gte('completed_at', startDate.toISOString());

        if (error) throw error;

        // Count workouts per week
        const weekMap = new Map<string, number>();

        (workouts || []).forEach((workout) => {
            const weekStart = startOfWeek(new Date(workout.completed_at));
            const weekKey = weekStart.toISOString().split('T')[0];
            weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + 1);
        });

        const frequencyData: { week: string; count: number }[] = [];
        weekMap.forEach((count, week) => {
            frequencyData.push({ week, count });
        });

        return frequencyData;
    },

    async getTodayWorkoutStatus(userId: string, planDayId: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        const { data, error } = await supabase
            .from('completed_workouts')
            .select('id')
            .eq('user_id', userId)
            .eq('plan_day_id', planDayId)
            .gte('completed_at', todayISO)
            .limit(1);

        if (error) throw error;

        return (data && data.length > 0);
    }
}
