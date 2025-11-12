-- ============================================================================
-- FLEXIBLE ID TYPE CONSTRAINT
-- Allow any non-empty document type string for DIDIT integration compatibility
-- ============================================================================

-- Drop the old restrictive constraint that only allowed specific document types
ALTER TABLE user_verifications
DROP CONSTRAINT IF EXISTS user_verifications_id_type_check;

-- Add a flexible constraint: only disallow empty strings
-- This allows DIDIT to return various document types without hardcoding them
ALTER TABLE user_verifications
ADD CONSTRAINT user_verifications_id_type_check
CHECK (char_length(trim(id_type)) > 0);

-- Comment for documentation
COMMENT ON CONSTRAINT user_verifications_id_type_check ON user_verifications IS 
'Flexible constraint allowing any non-empty document type. Specific types (passport, drivers_license, national_id, etc.) are managed by DIDIT and can vary by region/workflow.';
