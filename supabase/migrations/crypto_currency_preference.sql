-- Add cryptocurrency preference column to user_preferences table
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS selected_cryptocurrency VARCHAR(10) DEFAULT 'BTC';

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_preferences_selected_cryptocurrency 
ON user_preferences(selected_cryptocurrency);

-- Add comment for documentation
COMMENT ON COLUMN user_preferences.selected_cryptocurrency IS 'User preference for display cryptocurrency (e.g., BTC, ETH, USDT, etc.)';
