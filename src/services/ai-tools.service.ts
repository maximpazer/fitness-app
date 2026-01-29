/**
 * AI Tools Service - Coach-Oriented Data Access
 * 
 * Provides summarized, intent-based data retrieval functions.
 * Tools return coach-ready insights, not raw data dumps.
 * 
 * Design principles:
 * - Summarized outputs (not full workout logs)
 * - Intent-based queries (what a coach would ask)
 * - Token-efficient responses
 */

import { supabase } from '@/lib/supabase';
import { differenceInDays, format, startOfWeek, subDays } from 'date-fns';

// Tool definitions for Gemini function calling
export const AI_TOOLS = {
    declarations: [
        {
            name: 'get_recent_workout_summary',
            description: 'Get a summarized overview of recent workouts. Returns workout count, total volume, muscle groups trained, and trends - NOT raw exercise data.',
            parameters: {
                type: 'object',
                properties: {
                    days: {
                        type: 'number',
                        description: 'Number of days to look back (default: 7, max: 30)',
                    },
                },
                required: [],
            },
        },
        {
            name: 'get_last_session_overview',
            description: 'Get overview of the most recent workout session. Returns date, duration, exercises performed (names only), total sets, and estimated volume.',
            parameters: {
                type: 'object',
                properties: {
                    workout_type: {
                        type: 'string',
                        description: 'Optional filter by muscle focus (e.g., "chest", "legs", "back")',
                    },
                },
                required: [],
            },
        },
        {
            name: 'get_exercise_progress',
            description: 'Track progression for a specific exercise. Returns max weight trend, volume trend, or rep trend over time.',
            parameters: {
                type: 'object',
                properties: {
                    exercise_name: {
                        type: 'string',
                        description: 'Name of the exercise (e.g., "Bench Press", "Squat")',
                    },
                    metric: {
                        type: 'string',
                        enum: ['max_weight', 'volume', 'reps'],
                        description: 'Which metric to track (default: max_weight)',
                    },
                    period: {
                        type: 'string',
                        enum: ['2_weeks', '4_weeks', '8_weeks', '12_weeks'],
                        description: 'Time period to analyze (default: 4_weeks)',
                    },
                },
                required: ['exercise_name'],
            },
        },
        {
            name: 'get_exercise_consistency',
            description: 'Check how consistently an exercise has been performed. Returns frequency, gaps, and regularity score.',
            parameters: {
                type: 'object',
                properties: {
                    exercise_name: {
                        type: 'string',
                        description: 'Name of the exercise',
                    },
                    period: {
                        type: 'string',
                        enum: ['2_weeks', '4_weeks', '8_weeks'],
                        description: 'Time period to check (default: 4_weeks)',
                    },
                },
                required: ['exercise_name'],
            },
        },
        {
            name: 'get_muscle_group_coverage',
            description: 'Analyze which muscle groups have been trained and identify potential imbalances or neglected areas.',
            parameters: {
                type: 'object',
                properties: {
                    period: {
                        type: 'string',
                        enum: ['1_week', '2_weeks', '4_weeks'],
                        description: 'Time period to analyze (default: 2_weeks)',
                    },
                },
                required: [],
            },
        },
        {
            name: 'compare_workout_periods',
            description: 'Compare training metrics between two periods (e.g., this week vs last week).',
            parameters: {
                type: 'object',
                properties: {
                    period_1: {
                        type: 'string',
                        enum: ['this_week', 'last_week', 'last_2_weeks'],
                        description: 'First period for comparison',
                    },
                    period_2: {
                        type: 'string',
                        enum: ['this_week', 'last_week', 'last_2_weeks', 'last_month'],
                        description: 'Second period for comparison',
                    },
                },
                required: ['period_1', 'period_2'],
            },
        },
        {
            name: 'get_last_exercise_load',
            description: 'Quick lookup of the last recorded weight/reps for a specific exercise. Use for suggesting next session loads.',
            parameters: {
                type: 'object',
                properties: {
                    exercise_name: {
                        type: 'string',
                        description: 'Name of the exercise',
                    },
                },
                required: ['exercise_name'],
            },
        },
        {
            name: 'get_body_metrics_trend',
            description: 'Get body weight or measurement trends.',
            parameters: {
                type: 'object',
                properties: {
                    metric: {
                        type: 'string',
                        enum: ['weight'],
                        description: 'Which metric to track (currently only weight)',
                    },
                    period: {
                        type: 'string',
                        enum: ['4_weeks', '8_weeks', '12_weeks'],
                        description: 'Time period (default: 8_weeks)',
                    },
                },
                required: [],
            },
        },
        {
            name: 'search_exercises',
            description: 'Search the exercise database to find valid exercises for plan creation. MUST use this before creating plans to get correct exercise names. Returns exercise IDs and names. Prioritizes popular/compound exercises.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search term for exercise name (e.g., "push up", "squat", "row", "press")',
                    },
                    category: {
                        type: 'string',
                        enum: ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'full_body'],
                        description: 'Filter by body category',
                    },
                    equipment: {
                        type: 'string',
                        enum: ['Bodyweight', 'Barbell', 'Dumbbell', 'Kettlebell', 'Cable', 'Machine', 'Resistance Band'],
                        description: 'Filter by equipment. Use "Bodyweight" for calisthenics/no-equipment exercises.',
                    },
                    muscle_group: {
                        type: 'string',
                        description: 'Target muscle (e.g., "Chest", "Lats", "Quadriceps", "Biceps", "Glutes")',
                    },
                    limit: {
                        type: 'number',
                        description: 'Max results (default: 15, max: 30). Use higher for more variety.',
                    },
                },
                required: [],
            },
        },
        {
            name: 'create_plan_proposal',
            description: 'Create a workout plan proposal for the user to review and accept. Use this INSTEAD of outputting JSON. The plan will be shown as an interactive card the user can accept or decline.',
            parameters: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                        description: 'Name of the plan (e.g., "Push Pull Legs", "Upper Lower Split")',
                    },
                    description: {
                        type: 'string',
                        description: 'Brief description of the plan and its goals',
                    },
                    duration_weeks: {
                        type: 'number',
                        description: 'Duration in weeks (typically 4-12)',
                    },
                    days: {
                        type: 'array',
                        description: 'Array of workout days',
                        items: {
                            type: 'object',
                            properties: {
                                day_number: { type: 'number', description: 'Day number (1, 2, 3...)' },
                                day_name: { type: 'string', description: 'Name of the day (e.g., "Push", "Legs")' },
                                day_type: { type: 'string', enum: ['training', 'cardio', 'rest', 'active_recovery'], description: 'Type of day (default: training)' },
                                exercises: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            exercise_name: { type: 'string', description: 'EXACT name from search_exercises' },
                                            target_sets: { type: 'number', description: 'Number of sets (typically 3-5)' },
                                            target_reps: { type: 'string', description: 'Rep range (e.g., "8-12", "5", "12-15")' },
                                            rest_seconds: { type: 'number', description: 'Rest between sets in seconds' },
                                        },
                                        required: ['exercise_name', 'target_sets', 'target_reps'],
                                    },
                                },
                            },
                            required: ['day_number', 'day_name', 'exercises'],
                        },
                    },
                },
                required: ['name', 'description', 'duration_weeks', 'days'],
            },
        },
    ],
};

// Helper to parse period strings to days
const periodToDays = (period: string): number => {
    const map: Record<string, number> = {
        '1_week': 7,
        '2_weeks': 14,
        '4_weeks': 28,
        '8_weeks': 56,
        '12_weeks': 84,
        'last_month': 30,
    };
    return map[period] || 28;
};

// Helper to get date range for period
const getPeriodDateRange = (period: string): { start: Date; end: Date } => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    
    switch (period) {
        case 'this_week':
            return { start: weekStart, end: now };
        case 'last_week':
            return { 
                start: subDays(weekStart, 7), 
                end: subDays(weekStart, 1) 
            };
        case 'last_2_weeks':
            return { start: subDays(now, 14), end: now };
        case 'last_month':
            return { start: subDays(now, 30), end: now };
        default:
            return { start: subDays(now, periodToDays(period)), end: now };
    }
};

// Tool execution service
export const aiToolsService = {
    async executeFunction(userId: string, functionName: string, args: any): Promise<any> {
        switch (functionName) {
            case 'search_exercises':
                return this.searchExercises(args);
            case 'create_plan_proposal':
                return this.createPlanProposal(args);
            case 'get_recent_workout_summary':
                return this.getRecentWorkoutSummary(userId, args.days || 7);
            case 'get_last_session_overview':
                return this.getLastSessionOverview(userId, args.workout_type);
            case 'get_exercise_progress':
                return this.getExerciseProgress(userId, args.exercise_name, args.metric || 'max_weight', args.period || '4_weeks');
            case 'get_exercise_consistency':
                return this.getExerciseConsistency(userId, args.exercise_name, args.period || '4_weeks');
            case 'get_muscle_group_coverage':
                return this.getMuscleGroupCoverage(userId, args.period || '2_weeks');
            case 'compare_workout_periods':
                return this.compareWorkoutPeriods(userId, args.period_1, args.period_2);
            case 'get_last_exercise_load':
                return this.getLastExerciseLoad(userId, args.exercise_name);
            case 'get_body_metrics_trend':
                return this.getBodyMetricsTrend(userId, args.metric || 'weight', args.period || '8_weeks');
            default:
                throw new Error(`Unknown function: ${functionName}`);
        }
    },

    /**
     * Summarized workout overview - NOT raw data
     */
    async getRecentWorkoutSummary(userId: string, days: number = 7) {
        const cutoffDate = subDays(new Date(), Math.min(days, 30)).toISOString();

        const { data } = await supabase
            .from('completed_workouts')
            .select(`
                id,
                completed_at,
                duration_minutes,
                workout_exercises (
                    exercise:exercises (category, muscle_groups),
                    sets:workout_sets (reps, weight_kg, is_warmup)
                )
            `)
            .eq('user_id', userId)
            .gte('completed_at', cutoffDate)
            .order('completed_at', { ascending: false });

        const workouts = data as any[] | null;

        if (!workouts || workouts.length === 0) {
            return {
                period_days: days,
                workout_count: 0,
                message: 'No workouts found in this period',
            };
        }

        // Calculate summaries
        let totalVolume = 0;
        let totalSets = 0;
        let totalMinutes = 0;
        const muscleGroupSets: Record<string, number> = {};

        workouts.forEach((w: any) => {
            totalMinutes += w.duration_minutes || 0;
            w.workout_exercises?.forEach((we: any) => {
                const workingSets = we.sets?.filter((s: any) => !s.is_warmup) || [];
                totalSets += workingSets.length;
                
                workingSets.forEach((s: any) => {
                    totalVolume += (s.weight_kg || 0) * (s.reps || 0);
                });

                // Track muscle groups
                const muscles = we.exercise?.muscle_groups || [we.exercise?.category];
                muscles?.forEach((m: string) => {
                    if (m) muscleGroupSets[m] = (muscleGroupSets[m] || 0) + workingSets.length;
                });
            });
        });

        // Top muscle groups trained
        const topMuscles = Object.entries(muscleGroupSets)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([muscle, sets]) => ({ muscle, sets }));

        return {
            period_days: days,
            workout_count: workouts.length,
            avg_workouts_per_week: Math.round((workouts.length / days) * 7 * 10) / 10,
            total_volume_kg: Math.round(totalVolume),
            total_working_sets: totalSets,
            total_training_minutes: totalMinutes,
            avg_session_duration: Math.round(totalMinutes / workouts.length),
            muscle_groups_trained: topMuscles,
            last_workout_date: format(new Date(workouts[0].completed_at), 'yyyy-MM-dd'),
            days_since_last_workout: differenceInDays(new Date(), new Date(workouts[0].completed_at)),
        };
    },

    /**
     * Last session overview - concise, not raw
     */
    async getLastSessionOverview(userId: string, workoutType?: string) {
        const query = supabase
            .from('completed_workouts')
            .select(`
                id,
                workout_name,
                completed_at,
                duration_minutes,
                workout_exercises (
                    exercise:exercises (name, category, muscle_groups),
                    sets:workout_sets (reps, weight_kg, is_warmup)
                )
            `)
            .eq('user_id', userId)
            .order('completed_at', { ascending: false })
            .limit(10);

        const { data: workouts } = await query;

        if (!workouts || workouts.length === 0) {
            return { message: 'No workout history found' };
        }

        // Filter by workout type if specified
        let targetWorkout = workouts[0];
        if (workoutType) {
            const filtered = workouts.find((w: any) => 
                w.workout_exercises?.some((we: any) => 
                    we.exercise?.category?.toLowerCase().includes(workoutType.toLowerCase()) ||
                    we.exercise?.muscle_groups?.some((m: string) => m.toLowerCase().includes(workoutType.toLowerCase()))
                )
            );
            if (filtered) targetWorkout = filtered;
        }

        const workout = targetWorkout as any;
        
        // Summarize exercises (names only, no raw data)
        const exerciseNames = workout.workout_exercises?.map((we: any) => we.exercise?.name).filter(Boolean) || [];
        
        let totalSets = 0;
        let totalVolume = 0;
        workout.workout_exercises?.forEach((we: any) => {
            const workingSets = we.sets?.filter((s: any) => !s.is_warmup) || [];
            totalSets += workingSets.length;
            workingSets.forEach((s: any) => {
                totalVolume += (s.weight_kg || 0) * (s.reps || 0);
            });
        });

        return {
            workout_name: workout.workout_name || 'Workout',
            date: format(new Date(workout.completed_at), 'yyyy-MM-dd'),
            days_ago: differenceInDays(new Date(), new Date(workout.completed_at)),
            duration_minutes: workout.duration_minutes,
            exercises_performed: exerciseNames,
            exercise_count: exerciseNames.length,
            total_working_sets: totalSets,
            estimated_volume_kg: Math.round(totalVolume),
        };
    },

    /**
     * Exercise progress - trend data, not raw sets
     */
    async getExerciseProgress(userId: string, exerciseName: string, metric: string = 'max_weight', period: string = '4_weeks') {
        const days = periodToDays(period);
        const cutoffDate = subDays(new Date(), days).toISOString();

        // Find exercise
        const { data: exercises } = await supabase
            .from('exercises')
            .select('id, name')
            .ilike('name', `%${exerciseName}%`)
            .limit(1);

        if (!exercises || exercises.length === 0) {
            return { error: `Exercise "${exerciseName}" not found` };
        }

        const exercise = exercises[0] as { id: string; name: string };

        // Get workout data
        const { data: workouts } = await supabase
            .from('completed_workouts')
            .select(`
                completed_at,
                workout_exercises!inner (
                    exercise_id,
                    sets:workout_sets (reps, weight_kg, is_warmup)
                )
            `)
            .eq('user_id', userId)
            .eq('workout_exercises.exercise_id', exercise.id)
            .gte('completed_at', cutoffDate)
            .order('completed_at', { ascending: true });

        if (!workouts || workouts.length === 0) {
            return {
                exercise_name: exercise.name,
                period,
                sessions_found: 0,
                message: 'No data found for this exercise in the specified period',
            };
        }

        // Calculate metrics per session
        const sessions = workouts.map((w: any) => {
            const exerciseData = w.workout_exercises[0];
            const workingSets = exerciseData.sets.filter((s: any) => !s.is_warmup);
            
            if (workingSets.length === 0) return null;

            const maxWeight = Math.max(...workingSets.map((s: any) => s.weight_kg || 0));
            const totalVolume = workingSets.reduce((sum: number, s: any) => sum + ((s.weight_kg || 0) * (s.reps || 0)), 0);
            const totalReps = workingSets.reduce((sum: number, s: any) => sum + (s.reps || 0), 0);

            return {
                date: format(new Date(w.completed_at), 'yyyy-MM-dd'),
                max_weight: maxWeight,
                volume: totalVolume,
                reps: totalReps,
                sets: workingSets.length,
            };
        }).filter(Boolean);

        if (sessions.length === 0) {
            return {
                exercise_name: exercise.name,
                period,
                sessions_found: 0,
                message: 'No completed sets found',
            };
        }

        // Calculate trend
        const first = sessions[0] as { max_weight: number; volume: number; reps: number };
        const last = sessions[sessions.length - 1] as { max_weight: number; volume: number; reps: number };
        const metricKey = metric === 'max_weight' ? 'max_weight' : metric === 'volume' ? 'volume' : 'reps';
        
        const startValue = first[metricKey];
        const endValue = last[metricKey];
        const change = endValue - startValue;
        const changePercent = startValue > 0 ? Math.round((change / startValue) * 100) : 0;

        // Detect plateau (same value for last 3+ sessions)
        const lastThree = sessions.slice(-3).map((s: any) => s[metricKey]);
        const isPlateaued = lastThree.length >= 3 && lastThree.every((v: number) => v === lastThree[0]);

        return {
            exercise_name: exercise.name,
            metric_tracked: metric,
            period,
            sessions_found: sessions.length,
            trend: {
                start_value: startValue,
                current_value: endValue,
                change: change,
                change_percent: changePercent,
                direction: change > 0 ? 'improving' : change < 0 ? 'declining' : 'stable',
            },
            is_plateaued: isPlateaued,
            plateau_value: isPlateaued ? lastThree[0] : null,
        };
    },

    /**
     * Exercise consistency check
     */
    async getExerciseConsistency(userId: string, exerciseName: string, period: string = '4_weeks') {
        const days = periodToDays(period);
        const cutoffDate = subDays(new Date(), days).toISOString();

        const { data: exercises } = await supabase
            .from('exercises')
            .select('id, name')
            .ilike('name', `%${exerciseName}%`)
            .limit(1);

        if (!exercises || exercises.length === 0) {
            return { error: `Exercise "${exerciseName}" not found` };
        }

        const exercise = exercises[0] as { id: string; name: string };

        const { data } = await supabase
            .from('completed_workouts')
            .select('completed_at, workout_exercises!inner(exercise_id)')
            .eq('user_id', userId)
            .eq('workout_exercises.exercise_id', exercise.id)
            .gte('completed_at', cutoffDate)
            .order('completed_at', { ascending: true });

        const sessions = (data || []) as Array<{ completed_at: string }>;
        const weeks = Math.ceil(days / 7);
        const frequency = sessions.length / weeks;

        // Calculate gaps between sessions
        let maxGapDays = 0;
        let avgGapDays = 0;
        
        if (sessions.length >= 2) {
            const gaps: number[] = [];
            for (let i = 1; i < sessions.length; i++) {
                const gap = differenceInDays(
                    new Date(sessions[i].completed_at),
                    new Date(sessions[i - 1].completed_at)
                );
                gaps.push(gap);
            }
            maxGapDays = Math.max(...gaps);
            avgGapDays = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
        }

        // Days since last session
        const daysSinceLast = sessions.length > 0 
            ? differenceInDays(new Date(), new Date(sessions[sessions.length - 1].completed_at))
            : null;

        // Consistency score (0-100)
        let consistencyScore = 0;
        if (sessions.length > 0) {
            const idealFrequency = 2; // 2x per week is ideal
            const frequencyScore = Math.min(frequency / idealFrequency, 1) * 50;
            const gapScore = maxGapDays <= 7 ? 50 : maxGapDays <= 14 ? 30 : 10;
            consistencyScore = Math.round(frequencyScore + gapScore);
        }

        return {
            exercise_name: exercise.name,
            period,
            total_sessions: sessions.length,
            frequency_per_week: Math.round(frequency * 10) / 10,
            max_gap_days: maxGapDays,
            avg_gap_days: avgGapDays,
            days_since_last: daysSinceLast,
            consistency_score: consistencyScore,
            assessment: consistencyScore >= 70 ? 'consistent' : consistencyScore >= 40 ? 'moderate' : 'inconsistent',
        };
    },

    /**
     * Muscle group coverage analysis
     */
    async getMuscleGroupCoverage(userId: string, period: string = '2_weeks') {
        const days = periodToDays(period);
        const cutoffDate = subDays(new Date(), days).toISOString();

        const { data: workouts } = await supabase
            .from('completed_workouts')
            .select(`
                workout_exercises (
                    exercise:exercises (category, muscle_groups),
                    sets:workout_sets (is_warmup)
                )
            `)
            .eq('user_id', userId)
            .gte('completed_at', cutoffDate);

        if (!workouts || workouts.length === 0) {
            return { period, message: 'No workouts found' };
        }

        const muscleSetCount: Record<string, number> = {};
        const allMuscles = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'core', 'glutes'];

        workouts.forEach((w: any) => {
            w.workout_exercises?.forEach((we: any) => {
                const workingSets = we.sets?.filter((s: any) => !s.is_warmup).length || 0;
                const muscles = we.exercise?.muscle_groups || [we.exercise?.category];
                
                muscles?.forEach((m: string) => {
                    if (m) {
                        const normalized = m.toLowerCase();
                        muscleSetCount[normalized] = (muscleSetCount[normalized] || 0) + workingSets;
                    }
                });
            });
        });

        // Identify coverage
        const coverage = allMuscles.map(muscle => ({
            muscle,
            sets: muscleSetCount[muscle] || 0,
            status: (muscleSetCount[muscle] || 0) >= 10 ? 'adequate' : 
                    (muscleSetCount[muscle] || 0) >= 5 ? 'light' : 'neglected',
        }));

        const neglected = coverage.filter(c => c.status === 'neglected').map(c => c.muscle);
        const mostTrained = coverage.sort((a, b) => b.sets - a.sets).slice(0, 3);

        return {
            period,
            workout_count: workouts.length,
            coverage: coverage.sort((a, b) => b.sets - a.sets),
            neglected_muscles: neglected,
            most_trained: mostTrained.map(m => m.muscle),
            balance_assessment: neglected.length === 0 ? 'balanced' : 
                               neglected.length <= 2 ? 'minor_imbalance' : 'significant_imbalance',
        };
    },

    /**
     * Compare two periods
     */
    async compareWorkoutPeriods(userId: string, period1: string, period2: string) {
        const getPeriodMetrics = async (period: string) => {
            const { start, end } = getPeriodDateRange(period);
            
            const { data: workouts } = await supabase
                .from('completed_workouts')
                .select(`
                    duration_minutes,
                    workout_exercises (
                        sets:workout_sets (reps, weight_kg, is_warmup)
                    )
                `)
                .eq('user_id', userId)
                .gte('completed_at', start.toISOString())
                .lte('completed_at', end.toISOString());

            if (!workouts) return null;

            let totalSets = 0;
            let totalVolume = 0;
            let totalMinutes = 0;

            workouts.forEach((w: any) => {
                totalMinutes += w.duration_minutes || 0;
                w.workout_exercises?.forEach((we: any) => {
                    we.sets?.forEach((s: any) => {
                        if (!s.is_warmup) {
                            totalSets++;
                            totalVolume += (s.weight_kg || 0) * (s.reps || 0);
                        }
                    });
                });
            });

            return {
                workouts: workouts.length,
                total_sets: totalSets,
                total_volume: Math.round(totalVolume),
                total_minutes: totalMinutes,
            };
        };

        const [metrics1, metrics2] = await Promise.all([
            getPeriodMetrics(period1),
            getPeriodMetrics(period2),
        ]);

        if (!metrics1 || !metrics2) {
            return { error: 'Could not retrieve data for comparison' };
        }

        const volumeChange = metrics1.total_volume > 0 
            ? Math.round(((metrics2.total_volume - metrics1.total_volume) / metrics1.total_volume) * 100)
            : 0;

        return {
            period_1: { name: period1, ...metrics1 },
            period_2: { name: period2, ...metrics2 },
            comparison: {
                workout_diff: metrics2.workouts - metrics1.workouts,
                volume_change_percent: volumeChange,
                sets_diff: metrics2.total_sets - metrics1.total_sets,
                trend: volumeChange > 5 ? 'improving' : volumeChange < -5 ? 'declining' : 'stable',
            },
        };
    },

    /**
     * Quick lookup - last weight/reps for exercise
     */
    async getLastExerciseLoad(userId: string, exerciseName: string) {
        const { data: exercises } = await supabase
            .from('exercises')
            .select('id, name')
            .ilike('name', `%${exerciseName}%`)
            .limit(1);

        if (!exercises || exercises.length === 0) {
            return { error: `Exercise "${exerciseName}" not found` };
        }

        const exercise = exercises[0] as { id: string; name: string };

        const { data: workouts } = await supabase
            .from('completed_workouts')
            .select(`
                completed_at,
                workout_exercises!inner (
                    exercise_id,
                    sets:workout_sets (set_number, reps, weight_kg, is_warmup)
                )
            `)
            .eq('user_id', userId)
            .eq('workout_exercises.exercise_id', exercise.id)
            .order('completed_at', { ascending: false })
            .limit(1);

        if (!workouts || workouts.length === 0) {
            return {
                exercise_name: exercise.name,
                message: 'No previous data for this exercise',
            };
        }

        const workout = workouts[0] as any;
        const exerciseData = workout.workout_exercises[0];
        const workingSets = exerciseData.sets
            .filter((s: any) => !s.is_warmup)
            .sort((a: any, b: any) => a.set_number - b.set_number);

        if (workingSets.length === 0) {
            return {
                exercise_name: exercise.name,
                message: 'No working sets recorded',
            };
        }

        const topSet = workingSets.reduce((best: any, s: any) => 
            (s.weight_kg || 0) > (best.weight_kg || 0) ? s : best
        , workingSets[0]);

        return {
            exercise_name: exercise.name,
            last_performed: format(new Date(workout.completed_at), 'yyyy-MM-dd'),
            days_ago: differenceInDays(new Date(), new Date(workout.completed_at)),
            top_set: {
                weight_kg: topSet.weight_kg,
                reps: topSet.reps,
            },
            working_sets: workingSets.length,
            suggestion: `Consider ${topSet.weight_kg}kg for ${topSet.reps} reps, or progress to ${topSet.weight_kg + 2.5}kg`,
        };
    },

    /**
     * Body metrics trend
     */
    async getBodyMetricsTrend(userId: string, _metric: string = 'weight', period: string = '8_weeks') {
        const days = periodToDays(period);
        const cutoffDate = subDays(new Date(), days).toISOString();

        const { data: metrics } = await supabase
            .from('body_metrics')
            .select('weight_kg, logged_at')
            .eq('user_id', userId)
            .gte('logged_at', cutoffDate)
            .order('logged_at', { ascending: true });

        if (!metrics || metrics.length === 0) {
            return { period, message: 'No body metrics data found' };
        }

        const firstMetric = metrics[0] as any;
        const lastMetric = metrics[metrics.length - 1] as any;
        const startWeight = firstMetric?.weight_kg;
        const endWeight = lastMetric?.weight_kg;
        const change = endWeight && startWeight ? endWeight - startWeight : 0;

        return {
            metric: 'weight',
            period,
            data_points: metrics.length,
            start_value: startWeight,
            current_value: endWeight,
            change_kg: Math.round(change * 10) / 10,
            weekly_avg_change: Math.round((change / (days / 7)) * 10) / 10,
            trend: change > 0.5 ? 'gaining' : change < -0.5 ? 'losing' : 'stable',
        };
    },

    /**
     * Search exercises - for plan creation
     * Returns exercises that match the criteria with their IDs
     * Prioritizes common/popular exercises
     */
    async searchExercises(args: {
        query?: string;
        category?: string;
        equipment?: string;
        muscle_group?: string;
        limit?: number;
    }) {
        const { query, category, equipment, muscle_group, limit = 15 } = args;
        const maxLimit = Math.min(limit, 30);

        // Define popular/common exercises to prioritize
        const popularExercises = [
            'bench press', 'squat', 'deadlift', 'pull up', 'push up', 'row',
            'overhead press', 'lunge', 'plank', 'curl', 'tricep', 'dip',
            'lat pulldown', 'leg press', 'shoulder press', 'chest fly',
            'romanian deadlift', 'hip thrust', 'cable', 'face pull'
        ];

        let dbQuery = supabase
            .from('exercises')
            .select('id, name, category, muscle_groups, equipment_needed, difficulty, is_compound, classification, mechanics')
            .order('name');

        // Filter by category
        if (category) {
            dbQuery = dbQuery.eq('category', category);
        }

        // Filter by muscle group (using contains for array)
        if (muscle_group) {
            dbQuery = dbQuery.contains('muscle_groups', [muscle_group]);
        }

        // Search by name (if query provided)
        if (query) {
            dbQuery = dbQuery.ilike('name', `%${query}%`);
        }

        // Filter by equipment using contains
        if (equipment) {
            const equipmentMap: Record<string, string> = {
                'bodyweight': 'Bodyweight',
                'barbell': 'Barbell',
                'dumbbell': 'Dumbbell',
                'kettlebell': 'Kettlebell',
                'cable': 'Cable',
                'machine': 'Machine',
                'resistance_band': 'Resistance Band',
                'miniband': 'Miniband',
            };
            const mappedEquip = equipmentMap[equipment.toLowerCase()] || equipment;
            dbQuery = dbQuery.contains('equipment_needed', [mappedEquip]);
        }

        // Get more results to allow for sorting/prioritization
        const { data: exercises, error } = await dbQuery.limit(200);

        if (error) {
            console.error('[searchExercises] Error:', error);
            return { error: 'Failed to search exercises', details: error.message };
        }

        if (!exercises || exercises.length === 0) {
            // Try a broader search without equipment filter
            if (equipment && query) {
                const { data: fallback } = await supabase
                    .from('exercises')
                    .select('id, name, category, muscle_groups, equipment_needed, difficulty, is_compound')
                    .ilike('name', `%${query}%`)
                    .limit(50);
                
                if (fallback && fallback.length > 0) {
                    const results = fallback.slice(0, maxLimit).map((ex: any) => ({
                        id: ex.id,
                        name: ex.name,
                        category: ex.category,
                        muscles: (ex.muscle_groups || []).slice(0, 3).join(', '),
                        equipment: (ex.equipment_needed || []).join(', ') || 'None',
                    }));
                    return {
                        query: args,
                        count: results.length,
                        results,
                        note: `No exact equipment match. Showing ${query} exercises with any equipment.`,
                    };
                }
            }
            
            return { 
                query: args, 
                results: [],
                message: 'No exercises found. Try: query="push up" or equipment="bodyweight" or category="chest"' 
            };
        }

        // Score and sort exercises - prioritize popular/common ones
        const scored = exercises.map((ex: any) => {
            let score = 0;
            const nameLower = ex.name.toLowerCase();
            
            // Boost for popular exercises
            for (const popular of popularExercises) {
                if (nameLower.includes(popular)) {
                    score += 10;
                    break;
                }
            }
            
            // Boost for compound exercises
            if (ex.is_compound) score += 5;
            
            // Boost for simpler names (less verbose = more common)
            if (ex.name.split(' ').length <= 4) score += 3;
            
            // Boost for Bodybuilding classification (common exercises)
            if (ex.classification === 'Bodybuilding') score += 2;
            
            return { ...ex, score };
        });

        // Sort by score (highest first), then alphabetically
        scored.sort((a: any, b: any) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.name.localeCompare(b.name);
        });

        // Return formatted results with clear naming
        const results = scored.slice(0, maxLimit).map((ex: any) => ({
            exercise_name: ex.name, // Use this EXACT name in create_plan_proposal
            id: ex.id,
            category: ex.category,
            muscles: (ex.muscle_groups || []).slice(0, 3).join(', '),
            equipment: (ex.equipment_needed || []).join(', ') || 'Bodyweight',
            is_compound: ex.is_compound || false,
        }));

        return {
            query: args,
            total_found: exercises.length,
            returned: results.length,
            results,
            IMPORTANT: 'Copy the "exercise_name" field EXACTLY when using create_plan_proposal. Do NOT modify or simplify the names.',
        };
    },

    /**
     * Create a plan proposal for the user to review
     * Returns a structured proposal that the frontend will display as an interactive card
     */
    async createPlanProposal(args: {
        name: string;
        description: string;
        duration_weeks: number;
        days: Array<{
            day_number: number;
            day_name: string;
            exercises: Array<{
                exercise_name: string;
                target_sets: number;
                target_reps: string;
                rest_seconds?: number;
            }>;
        }>;
    }) {
        // Validate required fields
        if (!args.name || !args.days || !Array.isArray(args.days)) {
            return { 
                success: false, 
                error: 'Invalid plan structure. Need name and days array.' 
            };
        }

        // Return the proposal with a special flag
        return {
            success: true,
            __is_plan_proposal: true,
            proposal: {
                name: args.name,
                description: args.description || `${args.name} training plan`,
                duration_weeks: args.duration_weeks || 8,
                days: args.days.map((day, idx) => ({
                    day_number: day.day_number || idx + 1,
                    day_name: day.day_name,
                    day_type: (day as any).day_type || 'training', // Default to training
                    exercises: (day.exercises || []).map((ex, exIdx) => ({
                        exercise_name: ex.exercise_name,
                        target_sets: ex.target_sets || 3,
                        target_reps: ex.target_reps || '8-12',
                        rest_seconds: ex.rest_seconds || 90,
                        order_in_workout: exIdx + 1,
                    })),
                })),
            },
            message: 'Plan proposal created. User can now review and accept it.',
        };
    },
};
