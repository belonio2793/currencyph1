-- Add preferred_currency column to user_preferences table
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) DEFAULT 'PHP';

-- Create index on preferred_currency for faster queries
CREATE INDEX IF NOT EXISTS idx_user_preferences_preferred_currency ON user_preferences(preferred_currency);
