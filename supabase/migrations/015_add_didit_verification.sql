-- ============================================================================
-- ADD DIDIT INTEGRATION TO USER VERIFICATIONS
-- Enables secure identity verification via DIDIT API with encrypted storage
-- ============================================================================

-- Add DIDIT-specific columns to user_verifications table
ALTER TABLE user_verifications 
  ADD COLUMN IF NOT EXISTS didit_workflow_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS didit_session_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS didit_session_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS didit_decision JSONB, -- Encrypted personal info from DIDIT
  ADD COLUMN IF NOT EXISTS didit_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(100), -- passport, national_id, drivers_license, etc.
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE, -- Whether verification status is publicly visible
  ADD COLUMN IF NOT EXISTS verification_method VARCHAR(50) DEFAULT 'didit' CHECK (verification_method IN ('didit', 'manual', 'admin'));

-- Create index for public verifications for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_verifications_public ON user_verifications(is_public) 
  WHERE is_public = TRUE AND status = 'approved';

-- Create index for DIDIT session tracking
CREATE INDEX IF NOT EXISTS idx_user_verifications_didit_session ON user_verifications(didit_session_id);

-- ============================================================================
-- FUNCTION: Update verification status from DIDIT webhook
-- ============================================================================
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
  
  -- Update the verification record
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

-- ============================================================================
-- FUNCTION: Update lender verification status when verification is approved
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_verification_to_lender_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if status changed to 'approved' and verification_method is 'didit'
  IF (OLD.status != 'approved' AND NEW.status = 'approved' AND NEW.verification_method = 'didit') THEN
    UPDATE lender_profiles
    SET 
      is_verified = TRUE,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
  END IF;
  
  -- If status changed to 'rejected', mark unverified
  IF (NEW.status = 'rejected' AND NEW.verification_method = 'didit') THEN
    UPDATE lender_profiles
    SET 
      is_verified = FALSE,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync verification status to lender profiles
DROP TRIGGER IF EXISTS trigger_sync_verification_to_lender ON user_verifications;
CREATE TRIGGER trigger_sync_verification_to_lender
  AFTER UPDATE ON user_verifications
  FOR EACH ROW
  EXECUTE FUNCTION sync_verification_to_lender_profile();

-- ============================================================================
-- VIEW: Public user profiles with verification status
-- ============================================================================
CREATE OR REPLACE VIEW users_public_profile AS
SELECT 
  u.id,
  u.email,
  u.username,
  u.display_name,
  u.profile_picture_url,
  CASE 
    WHEN uv.is_public AND uv.status = 'approved' THEN TRUE
    ELSE FALSE
  END AS is_identity_verified,
  CASE 
    WHEN uv.is_public AND uv.status = 'approved' THEN uv.document_type
    ELSE NULL
  END AS verified_document_type,
  CASE 
    WHEN uv.is_public AND uv.status = 'approved' THEN uv.verified_at
    ELSE NULL
  END AS verified_date,
  lp.rating,
  lp.completed_loans_count,
  lp.bio,
  lp.profile_image_url
FROM users u
LEFT JOIN user_verifications uv ON uv.user_id = u.id
LEFT JOIN lender_profiles lp ON lp.user_id = u.id
WHERE u.deleted_at IS NULL;

-- ============================================================================
-- UPDATE RLS POLICIES FOR PUBLIC VERIFICATION VISIBILITY
-- ============================================================================

-- Users can update their own verification's public status and view their own
CREATE POLICY user_verifications_update ON user_verifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Community managers can view all verifications and update status
CREATE POLICY user_verifications_update_cm ON user_verifications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM community_managers WHERE user_id = auth.uid() AND status = 'approved'))
  WITH CHECK (EXISTS (SELECT 1 FROM community_managers WHERE user_id = auth.uid() AND status = 'approved'));
