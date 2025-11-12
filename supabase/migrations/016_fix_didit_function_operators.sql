-- ============================================================================
-- FIX DIDIT INTEGRATION - CORRECT JSON OPERATORS
-- Fixes HTML-encoded operators in update_verification_from_didit function
-- ============================================================================

-- Drop and recreate the function with CORRECT operators
DROP FUNCTION IF EXISTS update_verification_from_didit(VARCHAR(255), VARCHAR(50), JSONB);

CREATE OR REPLACE FUNCTION update_verification_from_didit(
  p_didit_session_id VARCHAR(255),
  p_status VARCHAR(50),
  p_decision JSONB
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  status VARCHAR(50),
  message TEXT
) AS $$
DECLARE
  v_user_id UUID;
  v_id UUID;
BEGIN
  -- Find the verification record by DIDIT session ID
  SELECT user_verifications.user_id, user_verifications.id
  INTO v_user_id, v_id
  FROM user_verifications
  WHERE didit_session_id = p_didit_session_id
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::UUID, 'error'::VARCHAR, 
      'Verification session not found'::TEXT;
    RETURN;
  END IF;
  
  -- Update the verification record (FIXED: using correct ->> operators)
  UPDATE user_verifications
  SET 
    status = p_status,
    didit_decision = p_decision,
    didit_verified_at = NOW(),
    document_type = p_decision->>'document_type',
    expires_at = CASE 
      WHEN p_decision->>'expiration_date' IS NOT NULL 
      THEN (p_decision->>'expiration_date')::TIMESTAMP 
      ELSE NULL 
    END,
    updated_at = NOW()
  WHERE id = v_id;
  
  -- Return success
  RETURN QUERY SELECT v_id, v_user_id, p_status, 'Verification updated from DIDIT'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger still exists
DROP TRIGGER IF EXISTS trigger_sync_verification_to_lender ON user_verifications;
CREATE TRIGGER trigger_sync_verification_to_lender
  AFTER UPDATE ON user_verifications
  FOR EACH ROW
  EXECUTE FUNCTION sync_verification_to_lender_profile();
