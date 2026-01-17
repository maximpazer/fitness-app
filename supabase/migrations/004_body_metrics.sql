-- Create body_metrics table for tracking weight, height, and other body measurements over time

CREATE TABLE IF NOT EXISTS body_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    weight_kg DECIMAL(5,2),
    height_cm DECIMAL(5,2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_body_metrics_user_id ON body_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_body_metrics_logged_at ON body_metrics(logged_at DESC);

-- Enable Row Level Security
ALTER TABLE body_metrics ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own metrics
CREATE POLICY "Users can view own body metrics"
    ON body_metrics
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy: Users can insert their own metrics
CREATE POLICY "Users can insert own body metrics"
    ON body_metrics
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own metrics
CREATE POLICY "Users can update own body metrics"
    ON body_metrics
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Create policy: Users can delete their own metrics
CREATE POLICY "Users can delete own body metrics"
    ON body_metrics
    FOR DELETE
    USING (auth.uid() = user_id);
