-- Migration: Add Canonical Exercise Layer
-- This creates a small, curated set of "standard" exercises that the AI can select from
-- All existing exercises become variants that map to one canonical exercise

-- Step 1: Create canonical_exercises table
CREATE TABLE IF NOT EXISTS public.canonical_exercises (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  canonical_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  movement_pattern TEXT NOT NULL CHECK (movement_pattern IN ('push', 'pull', 'hinge', 'squat', 'lunge', 'carry', 'rotation', 'isolation')),
  primary_muscle TEXT NOT NULL,
  secondary_muscles TEXT[] DEFAULT '{}',
  equipment_category TEXT NOT NULL CHECK (equipment_category IN ('barbell', 'dumbbell', 'machine', 'bodyweight', 'cable', 'kettlebell', 'band')),
  difficulty_level TEXT DEFAULT 'intermediate' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_canonical_exercises_active ON public.canonical_exercises(is_active) WHERE is_active = true;
CREATE INDEX idx_canonical_exercises_pattern ON public.canonical_exercises(movement_pattern);
CREATE INDEX idx_canonical_exercises_muscle ON public.canonical_exercises(primary_muscle);

-- Enable RLS
ALTER TABLE public.canonical_exercises ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read canonical exercises
CREATE POLICY "Canonical exercises are viewable by everyone"
  ON public.canonical_exercises FOR SELECT
  USING (true);

-- Step 2: Add canonical_id to existing exercises table
ALTER TABLE public.exercises 
ADD COLUMN IF NOT EXISTS canonical_id UUID REFERENCES public.canonical_exercises(id);

CREATE INDEX IF NOT EXISTS idx_exercises_canonical_id ON public.exercises(canonical_id);

-- Step 3: Insert core canonical exercises (30 essential movements)
INSERT INTO public.canonical_exercises (canonical_name, display_name, movement_pattern, primary_muscle, secondary_muscles, equipment_category, difficulty_level, sort_order) VALUES
-- PUSH (Chest)
('bench_press', 'Bench Press', 'push', 'Chest', ARRAY['Triceps', 'Shoulders'], 'barbell', 'intermediate', 10),
('incline_press', 'Incline Press', 'push', 'Chest', ARRAY['Shoulders', 'Triceps'], 'barbell', 'intermediate', 11),
('chest_fly', 'Chest Fly', 'isolation', 'Chest', '{}', 'dumbbell', 'beginner', 12),
('dip', 'Dip', 'push', 'Chest', ARRAY['Triceps', 'Shoulders'], 'bodyweight', 'intermediate', 13),

-- PUSH (Shoulders)
('overhead_press', 'Overhead Press', 'push', 'Shoulders', ARRAY['Triceps'], 'barbell', 'intermediate', 20),
('lateral_raise', 'Lateral Raise', 'isolation', 'Shoulders', '{}', 'dumbbell', 'beginner', 21),
('face_pull', 'Face Pull', 'pull', 'Shoulders', ARRAY['Upper Back'], 'cable', 'beginner', 22),

-- PUSH (Triceps)
('tricep_extension', 'Tricep Extension', 'isolation', 'Triceps', '{}', 'cable', 'beginner', 30),
('close_grip_press', 'Close Grip Press', 'push', 'Triceps', ARRAY['Chest'], 'barbell', 'intermediate', 31),

-- PULL (Back)
('deadlift', 'Deadlift', 'hinge', 'Back', ARRAY['Glutes', 'Hamstrings'], 'barbell', 'advanced', 40),
('row', 'Row', 'pull', 'Back', ARRAY['Biceps'], 'barbell', 'intermediate', 41),
('pullup', 'Pull Up', 'pull', 'Back', ARRAY['Biceps'], 'bodyweight', 'intermediate', 42),
('lat_pulldown', 'Lat Pulldown', 'pull', 'Lats', ARRAY['Biceps'], 'cable', 'beginner', 43),
('cable_row', 'Cable Row', 'pull', 'Back', ARRAY['Biceps'], 'cable', 'beginner', 44),

-- PULL (Biceps)
('bicep_curl', 'Bicep Curl', 'isolation', 'Biceps', '{}', 'dumbbell', 'beginner', 50),
('hammer_curl', 'Hammer Curl', 'isolation', 'Biceps', ARRAY['Forearms'], 'dumbbell', 'beginner', 51),

-- LEGS (Quad Dominant)
('squat', 'Squat', 'squat', 'Quadriceps', ARRAY['Glutes', 'Hamstrings'], 'barbell', 'intermediate', 60),
('front_squat', 'Front Squat', 'squat', 'Quadriceps', ARRAY['Core'], 'barbell', 'advanced', 61),
('leg_press', 'Leg Press', 'squat', 'Quadriceps', ARRAY['Glutes'], 'machine', 'beginner', 62),
('lunge', 'Lunge', 'lunge', 'Quadriceps', ARRAY['Glutes'], 'dumbbell', 'beginner', 63),
('leg_extension', 'Leg Extension', 'isolation', 'Quadriceps', '{}', 'machine', 'beginner', 64),

-- LEGS (Hip Dominant)
('romanian_deadlift', 'Romanian Deadlift', 'hinge', 'Hamstrings', ARRAY['Glutes', 'Back'], 'barbell', 'intermediate', 70),
('leg_curl', 'Leg Curl', 'isolation', 'Hamstrings', '{}', 'machine', 'beginner', 71),
('hip_thrust', 'Hip Thrust', 'hinge', 'Glutes', ARRAY['Hamstrings'], 'barbell', 'intermediate', 72),

-- LEGS (Calves)
('calf_raise', 'Calf Raise', 'isolation', 'Calves', '{}', 'machine', 'beginner', 80),

-- CORE
('plank', 'Plank', 'isolation', 'Core', '{}', 'bodyweight', 'beginner', 90),
('crunch', 'Crunch', 'isolation', 'Core', '{}', 'bodyweight', 'beginner', 91),
('russian_twist', 'Russian Twist', 'rotation', 'Core', '{}', 'bodyweight', 'beginner', 92),
('hanging_leg_raise', 'Hanging Leg Raise', 'isolation', 'Core', '{}', 'bodyweight', 'intermediate', 93)

ON CONFLICT (canonical_name) DO NOTHING;

-- Step 4: Create view for exercise selection with variants
CREATE OR REPLACE VIEW canonical_exercises_with_variants AS
SELECT 
  ce.*,
  COUNT(e.id) as variant_count,
  json_agg(
    json_build_object(
      'id', e.id,
      'name', e.name,
      'equipment', e.equipment_needed,
      'difficulty', e.difficulty
    ) ORDER BY e.difficulty, e.name
  ) FILTER (WHERE e.id IS NOT NULL) as variants
FROM canonical_exercises ce
LEFT JOIN exercises e ON e.canonical_id = ce.id
WHERE ce.is_active = true
GROUP BY ce.id, ce.canonical_name, ce.display_name, ce.movement_pattern, 
         ce.primary_muscle, ce.secondary_muscles, ce.equipment_category, 
         ce.difficulty_level, ce.is_active, ce.sort_order, ce.created_at
ORDER BY ce.sort_order, ce.display_name;
