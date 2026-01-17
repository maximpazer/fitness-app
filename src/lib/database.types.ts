
// Auto-generate these from Supabase later, but here's the structure:
export interface Profile {
    id: string;
    display_name: string;
    height_cm?: number;
    weight_kg?: number;
    birth_date?: string;
    gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    fitness_level: 'beginner' | 'intermediate' | 'advanced';
    primary_goal: string;
    secondary_goals?: string[];
    training_days_per_week: number;
    session_duration_minutes?: number;
    preferred_training_time?: string;
    available_equipment?: string[];
    injuries_or_limitations?: string;
    exercise_dislikes?: string[];
}

export interface Exercise {
    id: string;
    name: string;
    description?: string;
    category: 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'cardio' | 'full_body';
    muscle_groups: string[];
    equipment_needed: string[];
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    instructions?: string[];
    video_url?: string;
    image_url?: string;
    is_compound?: boolean;
    is_custom?: boolean;
}

export interface WorkoutPlan {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    duration_weeks: number;
    is_active: boolean;
    started_at?: string;
    created_at: string;
}

export interface PlanDay {
    id: string;
    plan_id: string;
    day_number: number;
    day_name?: string;
    day_type: 'training' | 'cardio' | 'rest' | 'active_recovery';
    notes?: string;
}

export interface PlanExercise {
    id: string;
    plan_day_id: string;
    exercise_id: string;
    exercise?: Exercise; // Joined data
    order_in_workout: number;
    target_sets: number;
    target_reps_min?: number;
    target_reps_max?: number;
    target_rpe?: number;
    rest_seconds?: number;
    notes?: string;
}

export interface CompletedWorkout {
    id: string;
    user_id: string;
    plan_day_id?: string;
    workout_date: string;
    workout_name?: string;
    duration_minutes?: number;
    overall_rpe?: number;
    energy_level?: number;
    notes?: string;
    completed_at: string;
}

export interface WorkoutExercise {
    id: string;
    workout_id: string;
    exercise_id: string;
    exercise?: Exercise;
    order_in_workout: number;
    notes?: string;
}

export interface WorkoutSet {
    id: string;
    workout_exercise_id: string;
    set_number: number;
    reps: number;
    weight_kg?: number;
    rpe?: number;
    is_warmup?: boolean;
}

export interface BodyMeasurement {
    id: string;
    user_id: string;
    measured_at: string;
    weight_kg?: number;
    body_fat_percentage?: number;
    chest_cm?: number;
    waist_cm?: number;
    // ... other measurements
}

export interface Goal {
    id: string;
    user_id: string;
    goal_type: 'weight_loss' | 'weight_gain' | 'strength' | 'endurance' | 'body_measurement' | 'habit';
    description: string;
    target_value?: number;
    target_unit?: string;
    target_date?: string;
    current_value?: number;
    is_completed: boolean;
}

export interface ChatMessage {
    id: string;
    user_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: string;
}

// Helper to construct the database type structure
export type Tables<T> = T;
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: Profile;
                Insert: Profile;
                Update: Partial<Profile>;
            };
            exercises: {
                Row: Exercise;
                Insert: Exercise;
                Update: Partial<Exercise>;
            };
            workout_plans: {
                Row: WorkoutPlan;
                Insert: WorkoutPlan;
                Update: Partial<WorkoutPlan>;
            };
            plan_days: {
                Row: PlanDay;
                Insert: PlanDay;
                Update: Partial<PlanDay>;
            };
            plan_exercises: {
                Row: PlanExercise;
                Insert: PlanExercise;
                Update: Partial<PlanExercise>;
            };
            completed_workouts: {
                Row: CompletedWorkout;
                Insert: CompletedWorkout;
                Update: Partial<CompletedWorkout>;
            };
            workout_exercises: {
                Row: WorkoutExercise;
                Insert: WorkoutExercise;
                Update: Partial<WorkoutExercise>;
            };
            workout_sets: {
                Row: WorkoutSet;
                Insert: WorkoutSet;
                Update: Partial<WorkoutSet>;
            };
            body_measurements: {
                Row: BodyMeasurement;
                Insert: BodyMeasurement;
                Update: Partial<BodyMeasurement>;
            };
            goals: {
                Row: Goal;
                Insert: Goal;
                Update: Partial<Goal>;
            };
            chat_messages: {
                Row: ChatMessage;
                Insert: ChatMessage;
                Update: Partial<ChatMessage>;
            };
        };
    };
}
