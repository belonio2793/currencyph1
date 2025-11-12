-- ============================================================================
-- SIMPLIFY ID TYPE FOR DIDIT SYNC ONLY APPROACH
-- Make id_type nullable to avoid NOT NULL constraints during session registration
-- ============================================================================

-- Drop the existing NOT NULL constraint on id_type
ALTER TABLE user_verifications
ALTER COLUMN id_type DROP NOT NULL;

-- Drop the length constraint since we don't require id_type to be set
ALTER TABLE user_verifications
DROP CONSTRAINT IF EXISTS user_verifications_id_type_check;

-- Add a new constraint: if id_type is provided, it must be non-empty
-- (but it can be NULL)
ALTER TABLE user_verifications
ADD CONSTRAINT user_verifications_id_type_check
CHECK (id_type IS NULL OR char_length(trim(id_type)) > 0);

-- Also make id_number nullable for consistency
ALTER TABLE user_verifications
ALTER COLUMN id_number DROP NOT NULL;

COMMENT ON CONSTRAINT user_verifications_id_type_check ON user_verifications IS 
'Optional: id_type can be NULL (populated by didit-sync when DIDIT returns decision data).';
