-- ============================================================================
-- P2P LOAN MARKETPLACE SYSTEM
-- Enables peer-to-peer lending with offers, ratings, verification, and platform fees
-- ============================================================================

-- ============================================================================
-- 1️⃣ USER VERIFICATION TABLE - Track ID verification status
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- ID Information
  id_type VARCHAR(50) NOT NULL,
  id_number VARCHAR(255) NOT NULL,
  id_image_url VARCHAR(500),
  
  -- Verification Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verification_notes TEXT,
  
  -- Timestamps
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMP,
  expires_at TIMESTAMP,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_verifications_user ON user_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_verifications_status ON user_verifications(status);
CREATE INDEX IF NOT EXISTS idx_user_verifications_verified_by ON user_verifications(verified_by);

-- ============================================================================
-- 2️⃣ COMMUNITY MANAGER ROLES - Track approved community managers
-- ============================================================================
CREATE TABLE IF NOT EXISTS community_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Manager Info
  bio TEXT,
  profile_image_url VARCHAR(500),
  
  -- Approval Status (voted in by community)
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'inactive')),
  approval_votes_required INT DEFAULT 5,
  approval_votes_received INT DEFAULT 0,
  
  -- Permissions
  can_verify_users BOOLEAN DEFAULT TRUE,
  can_approve_loans BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_managers_user ON community_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_community_managers_status ON community_managers(status);

-- ============================================================================
-- 3️⃣ COMMUNITY MANAGER VOTES - Track voting for community manager approval
-- ============================================================================
CREATE TABLE IF NOT EXISTS community_manager_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_manager_id UUID NOT NULL REFERENCES community_managers(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  vote_type VARCHAR(20) NOT NULL CHECK (vote_type IN ('approve', 'reject')),
  reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(community_manager_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_community_manager_votes_cm ON community_manager_votes(community_manager_id);
CREATE INDEX IF NOT EXISTS idx_community_manager_votes_voter ON community_manager_votes(voter_id);

-- ============================================================================
-- 4️⃣ LENDER PROFILES - Track lending history and performance
-- ============================================================================
CREATE TABLE IF NOT EXISTS lender_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Public Profile
  bio TEXT,
  profile_image_url VARCHAR(500),
  
  -- Lending Stats
  total_loaned NUMERIC(36, 8) DEFAULT 0,
  active_loans_count INT DEFAULT 0,
  completed_loans_count INT DEFAULT 0,
  defaulted_loans_count INT DEFAULT 0,
  
  -- Verification & Status
  is_verified BOOLEAN DEFAULT FALSE,
  preferred_payment_methods VARCHAR(255), -- comma-separated: 'cash', 'gcash', 'crypto'
  preferred_loan_currency VARCHAR(16), -- default currency
  
  -- Auto-calculated Rating (0-5 stars)
  rating NUMERIC(3, 2) DEFAULT 0,
  total_rating_count INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lender_profiles_user ON lender_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_lender_profiles_rating ON lender_profiles(rating DESC);
CREATE INDEX IF NOT EXISTS idx_lender_profiles_verified ON lender_profiles(is_verified);

-- ============================================================================
-- 5️⃣ LOAN REQUESTS - Updated from loans table, represents borrower requests
-- ============================================================================
ALTER TABLE loans ADD COLUMN IF NOT EXISTS lender_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS reason_for_loan TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS minimum_interest_rate NUMERIC(5, 2);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS maximum_interest_rate NUMERIC(5, 2);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS preferred_payment_methods VARCHAR(255);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS repayment_schedule VARCHAR(50); -- 'lump_sum', 'monthly', 'weekly'
ALTER TABLE loans ADD COLUMN IF NOT EXISTS duration_days INT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS original_due_date TIMESTAMP;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS days_past_due INT DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS platform_fee_applied BOOLEAN DEFAULT FALSE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS platform_fee_amount NUMERIC(36, 8);

-- ============================================================================
-- 6️⃣ LOAN OFFERS - Lenders submit offers to borrower requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS loan_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_request_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  lender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Offer Terms
  offered_amount NUMERIC(36, 8) NOT NULL CHECK (offered_amount > 0),
  interest_rate NUMERIC(5, 2) NOT NULL CHECK (interest_rate >= 0),
  duration_days INT NOT NULL,
  due_date TIMESTAMP NOT NULL,
  repayment_schedule VARCHAR(50) NOT NULL, -- 'lump_sum', 'monthly', 'weekly'
  payment_method VARCHAR(50) NOT NULL,
  
  -- Platform Fee
  use_platform_facilitation BOOLEAN DEFAULT FALSE, -- If TRUE, 10% fee applies
  platform_fee_amount NUMERIC(36, 8),
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMP,
  expires_at TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_offers_request ON loan_offers(loan_request_id);
CREATE INDEX IF NOT EXISTS idx_loan_offers_lender ON loan_offers(lender_id);
CREATE INDEX IF NOT EXISTS idx_loan_offers_status ON loan_offers(status);
CREATE INDEX IF NOT EXISTS idx_loan_offers_created ON loan_offers(created_at DESC);

-- ============================================================================
-- 7️⃣ LOAN RATINGS - Automatic ratings for lenders and borrowers
-- ============================================================================
CREATE TABLE IF NOT EXISTS loan_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rated_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Rating Info
  rating_score NUMERIC(3, 2) NOT NULL CHECK (rating_score >= 0 AND rating_score <= 5),
  review TEXT,
  
  -- Context
  rating_type VARCHAR(50) NOT NULL, -- 'lender_review', 'borrower_review'
  
  -- Automatic Metrics
  on_time_payment BOOLEAN DEFAULT TRUE,
  communication_quality INT CHECK (communication_quality >= 1 AND communication_quality <= 5),
  trustworthiness INT CHECK (trustworthiness >= 1 AND trustworthiness <= 5),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_ratings_loan ON loan_ratings(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_ratings_rater ON loan_ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_loan_ratings_rated_user ON loan_ratings(rated_user_id);

-- ============================================================================
-- 8️⃣ LOAN PAYMENT SCHEDULE - Track due dates and penalties
-- ============================================================================
CREATE TABLE IF NOT EXISTS loan_payment_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  
  -- Payment Details
  payment_number INT NOT NULL,
  due_date TIMESTAMP NOT NULL,
  amount_due NUMERIC(36, 8) NOT NULL,
  amount_paid NUMERIC(36, 8) DEFAULT 0,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'late', 'missed')),
  paid_date TIMESTAMP,
  
  -- Penalty Tracking
  days_late INT DEFAULT 0,
  penalty_amount NUMERIC(36, 8) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_payment_schedules_loan ON loan_payment_schedules(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_payment_schedules_status ON loan_payment_schedules(status);
CREATE INDEX IF NOT EXISTS idx_loan_payment_schedules_due_date ON loan_payment_schedules(due_date);

-- ============================================================================
-- 9️⃣ PLATFORM TRANSACTIONS - Track 10% fees when using platform facilitation
-- ============================================================================
CREATE TABLE IF NOT EXISTS platform_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  
  -- Transaction Details
  transaction_type VARCHAR(50) NOT NULL, -- 'loan_offer_accepted', 'payment_processed'
  amount NUMERIC(36, 8) NOT NULL,
  fee_percentage NUMERIC(5, 2) DEFAULT 10,
  fee_amount NUMERIC(36, 8) NOT NULL,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_transactions_loan ON platform_transactions(loan_id);
CREATE INDEX IF NOT EXISTS idx_platform_transactions_type ON platform_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_platform_transactions_created ON platform_transactions(created_at DESC);

-- ============================================================================
-- 🔟 FUNCTIONS - Auto-calculate ratings based on loan completion
-- ============================================================================

-- Function to calculate lender rating
CREATE OR REPLACE FUNCTION calculate_lender_rating(p_lender_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_avg_rating NUMERIC;
  v_count INT;
BEGIN
  SELECT 
    AVG(rating_score),
    COUNT(*)
  INTO v_avg_rating, v_count
  FROM loan_ratings
  WHERE rated_user_id = p_lender_id 
    AND rating_type = 'lender_review';
  
  RETURN COALESCE(v_avg_rating, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate borrower rating
CREATE OR REPLACE FUNCTION calculate_borrower_rating(p_borrower_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_avg_rating NUMERIC;
  v_count INT;
BEGIN
  SELECT 
    AVG(rating_score),
    COUNT(*)
  INTO v_avg_rating, v_count
  FROM loan_ratings
  WHERE rated_user_id = p_borrower_id 
    AND rating_type = 'borrower_review';
  
  RETURN COALESCE(v_avg_rating, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create rating on loan completion
CREATE OR REPLACE FUNCTION auto_rate_loan_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger on status change to 'completed'
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    -- Create placeholder ratings (can be filled by users later)
    INSERT INTO loan_ratings (
      loan_id, rater_id, rated_user_id, rating_score, 
      rating_type, on_time_payment, communication_quality, trustworthiness
    ) VALUES 
      (NEW.id, NEW.user_id, NEW.lender_id, 0, 'lender_review', 
       (NEW.days_past_due <= 0), 3, 3),
      (NEW.id, NEW.lender_id, NEW.user_id, 0, 'borrower_review', 
       (NEW.days_past_due <= 0), 3, 3)
    ON CONFLICT DO NOTHING;
    
    -- Update lender profile rating
    UPDATE lender_profiles SET
      rating = calculate_lender_rating(NEW.lender_id),
      total_rating_count = (SELECT COUNT(*) FROM loan_ratings WHERE rated_user_id = NEW.lender_id),
      completed_loans_count = (SELECT COUNT(*) FROM loans WHERE lender_id = NEW.lender_id AND status = 'completed'),
      updated_at = NOW()
    WHERE user_id = NEW.lender_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-rating
DROP TRIGGER IF EXISTS trigger_auto_rate_loan_completion ON loans;
CREATE TRIGGER trigger_auto_rate_loan_completion
  AFTER UPDATE ON loans
  FOR EACH ROW
  EXECUTE FUNCTION auto_rate_loan_completion();

-- Function to update due date penalties
CREATE OR REPLACE FUNCTION update_payment_schedule_penalties()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'late' OR NEW.status = 'missed' THEN
    NEW.days_late := GREATEST(0, EXTRACT(DAY FROM (NOW() - NEW.due_date))::INT);
    NEW.penalty_amount := ROUND((NEW.amount_due * (NEW.days_late * 0.01))::numeric, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payment_penalties ON loan_payment_schedules;
CREATE TRIGGER trigger_update_payment_penalties
  BEFORE UPDATE ON loan_payment_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_schedule_penalties();

-- ============================================================================
-- 1️⃣1️⃣ VIEWS - Summary views for querying
-- ============================================================================

-- View: Loan requests with active offers
CREATE OR REPLACE VIEW loan_requests_with_offers AS
SELECT 
  l.id,
  l.user_id,
  l.loan_type,
  l.requested_amount,
  l.currency_code,
  l.status,
  l.city,
  l.created_at,
  COUNT(lo.id) AS total_offers,
  COUNT(CASE WHEN lo.status = 'pending' THEN 1 END) AS pending_offers,
  COUNT(CASE WHEN lo.status = 'accepted' THEN 1 END) AS accepted_offers
FROM loans l
LEFT JOIN loan_offers lo ON lo.loan_request_id = l.id
WHERE l.lender_id IS NULL
GROUP BY l.id;

-- View: Lender profile summary
CREATE OR REPLACE VIEW lender_profile_summary AS
SELECT 
  lp.id,
  lp.user_id,
  lp.bio,
  lp.profile_image_url,
  lp.rating,
  lp.total_rating_count,
  lp.completed_loans_count,
  lp.defaulted_loans_count,
  lp.is_verified,
  lp.preferred_payment_methods,
  u.email,
  uv.status AS verification_status,
  CASE 
    WHEN lp.rating >= 4.5 THEN 'excellent'
    WHEN lp.rating >= 3.5 THEN 'good'
    WHEN lp.rating >= 2.5 THEN 'fair'
    ELSE 'new'
  END AS rating_category
FROM lender_profiles lp
LEFT JOIN users u ON u.id = lp.user_id
LEFT JOIN user_verifications uv ON uv.user_id = lp.user_id;

-- ============================================================================
-- 1️⃣2️⃣ RLS POLICIES
-- ============================================================================

ALTER TABLE user_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_manager_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lender_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_transactions ENABLE ROW LEVEL SECURITY;

-- User verifications: Users see their own, community managers see pending/submitted
CREATE POLICY user_verifications_view ON user_verifications FOR SELECT
  USING (auth.uid() = user_id OR 
         EXISTS (SELECT 1 FROM community_managers WHERE user_id = auth.uid() AND status = 'approved'));

CREATE POLICY user_verifications_insert ON user_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Lender profiles: All can view, users can edit their own
CREATE POLICY lender_profiles_view ON lender_profiles FOR SELECT
  USING (TRUE);

CREATE POLICY lender_profiles_insert ON lender_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY lender_profiles_update ON lender_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Loan offers: Lenders see their own, borrowers see offers on their requests, community managers see all
CREATE POLICY loan_offers_view ON loan_offers FOR SELECT
  USING (
    lender_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM loans WHERE id = loan_request_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM community_managers WHERE user_id = auth.uid() AND status = 'approved')
  );

CREATE POLICY loan_offers_insert ON loan_offers FOR INSERT
  WITH CHECK (lender_id = auth.uid());

-- Loan ratings: Users can view and insert ratings
CREATE POLICY loan_ratings_view ON loan_ratings FOR SELECT
  USING (TRUE);

CREATE POLICY loan_ratings_insert ON loan_ratings FOR INSERT
  WITH CHECK (rater_id = auth.uid());

-- Payment schedules: Users see their own loans' schedules
CREATE POLICY loan_payment_schedules_view ON loan_payment_schedules FOR SELECT
  USING (EXISTS (SELECT 1 FROM loans WHERE id = loan_id AND (user_id = auth.uid() OR lender_id = auth.uid())));
