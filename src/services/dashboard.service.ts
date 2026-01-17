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
                .select('duration_minutes, created_at')
                .eq('user_id', userId)
                .gte('created_at', startOfCurrentWeek)

            const weeklyCount = weeklyWorkouts?.length || 0
            const weeklyMinutes = weeklyWorkouts?.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0) || 0

            // 3. Get Recent Activity (Last 3)
            const { data: recentActivity } = await supabase
                .from('completed_workouts')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
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
}
