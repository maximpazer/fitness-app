-- Migration: Add archive functionality to workout plans
-- When AI updates a plan or user wants to keep history, old plans get archived

-- Add archive columns to workout_plans
ALTER TABLE workout_plans
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archive_reason TEXT; -- 'ai_update', 'user_archived', 'replaced'

-- Create index for efficient archive queries
CREATE INDEX IF NOT EXISTS idx_workout_plans_archived 
ON workout_plans(user_id, is_archived, archived_at DESC);

-- Update existing deactivated plans to be considered as archived
-- (Any plan that is_active = false but not explicitly archived)
UPDATE workout_plans 
SET is_archived = true, 
    archived_at = COALESCE(created_at, NOW()),
    archive_reason = 'legacy_deactivated'
WHERE is_active = false 
AND is_archived IS NOT TRUE;

COMMENT ON COLUMN workout_plans.is_archived IS 'Whether the plan is archived (kept for history)';
COMMENT ON COLUMN workout_plans.archived_at IS 'When the plan was archived';
COMMENT ON COLUMN workout_plans.archive_reason IS 'Why archived: ai_update, user_archived, replaced';
