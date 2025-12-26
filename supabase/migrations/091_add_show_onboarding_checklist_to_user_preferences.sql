-- Add show_onboarding_checklist column to user_preferences table
-- This allows users to hide the onboarding checklist and have it stay hidden
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS show_onboarding_checklist BOOLEAN DEFAULT true;

-- Create index on show_onboarding_checklist for faster queries
CREATE INDEX IF NOT EXISTS idx_user_preferences_show_onboarding_checklist ON user_preferences(show_onboarding_checklist);
