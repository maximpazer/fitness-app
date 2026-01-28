-- Add new columns for enhanced filtering
ALTER TABLE public.exercises
ADD COLUMN IF NOT EXISTS target_muscle TEXT,
ADD COLUMN IF NOT EXISTS target_region TEXT,
ADD COLUMN IF NOT EXISTS movement_patterns TEXT[];

-- Create index for array searching
CREATE INDEX IF NOT EXISTS idx_exercises_movement_patterns ON public.exercises USING GIN (movement_patterns);
CREATE INDEX IF NOT EXISTS idx_exercises_target_muscle ON public.exercises (target_muscle);
