-- Add ExerciseDB video/media columns to exercises table
-- Run this in Supabase SQL Editor before running the sync script

-- Add new columns for ExerciseDB integration
ALTER TABLE exercises 
ADD COLUMN IF NOT EXISTS exercisedb_id VARCHAR UNIQUE,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS gif_url TEXT,
ADD COLUMN IF NOT EXISTS instructions TEXT[],
ADD COLUMN IF NOT EXISTS tips TEXT[];

-- Create index for faster lookups by ExerciseDB ID
CREATE INDEX IF NOT EXISTS idx_exercisedb_id ON exercises(exercisedb_id);

-- Optional: Add comment for documentation
COMMENT ON COLUMN exercises.exercisedb_id IS 'External ID from ExerciseDB API for syncing';
COMMENT ON COLUMN exercises.video_url IS 'Exercise demonstration video URL from ExerciseDB';
COMMENT ON COLUMN exercises.gif_url IS 'Exercise demonstration GIF URL from ExerciseDB';
COMMENT ON COLUMN exercises.image_url IS 'Exercise image URL from ExerciseDB';
COMMENT ON COLUMN exercises.instructions IS 'Step-by-step instructions array from ExerciseDB';
COMMENT ON COLUMN exercises.tips IS 'Pro tips array from ExerciseDB';
