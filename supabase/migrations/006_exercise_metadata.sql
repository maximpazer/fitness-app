-- Migration to add structured metadata columns to the exercises table
ALTER TABLE public.exercises 
ADD COLUMN IF NOT EXISTS classification TEXT,
ADD COLUMN IF NOT EXISTS mechanics TEXT,
ADD COLUMN IF NOT EXISTS movement_type TEXT,
ADD COLUMN IF NOT EXISTS posture TEXT,
ADD COLUMN IF NOT EXISTS grip TEXT,
ADD COLUMN IF NOT EXISTS load_position TEXT,
ADD COLUMN IF NOT EXISTS laterality TEXT,
ADD COLUMN IF NOT EXISTS force_type TEXT;

-- Create indexes for potential filtering
CREATE INDEX IF NOT EXISTS idx_exercises_classification ON public.exercises(classification);
CREATE INDEX IF NOT EXISTS idx_exercises_mechanics ON public.exercises(mechanics);
CREATE INDEX IF NOT EXISTS idx_exercises_posture ON public.exercises(posture);
