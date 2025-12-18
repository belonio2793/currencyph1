-- Add wallet_display_currencies column to user_preferences table
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS wallet_display_currencies TEXT[] DEFAULT ARRAY['PHP'];

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_preferences_wallet_display_currencies ON user_preferences(wallet_display_currencies);

-- Update existing records to have PHP as default
UPDATE user_preferences
SET wallet_display_currencies = ARRAY['PHP']
WHERE wallet_display_currencies IS NULL OR array_length(wallet_display_currencies, 1) = 0;
