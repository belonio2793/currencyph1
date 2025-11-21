-- =====================================================
-- EMPLOYEE INVITATION & MANAGEMENT SYSTEM
-- =====================================================
-- Comprehensive system for managing employee invitations,
-- job assignments, and business-employee relationships

-- =====================================================
-- 1. JOB INVITATIONS TABLE
-- =====================================================
-- Businesses invite specific users to work for them
CREATE TABLE IF NOT EXISTS public.job_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  invited_user_id UUID NOT NULL,
  invited_by_user_id UUID NOT NULL, -- Business owner who sent invitation
  
  -- Job Details
  job_title VARCHAR(255) NOT NULL,
  job_description TEXT,
  job_category VARCHAR(100),
  
  -- Compensation
  pay_rate DECIMAL(12, 2),
  pay_currency VARCHAR(10) DEFAULT 'PHP',
  pay_type VARCHAR(50), -- 'fixed', 'negotiable', 'hourly_rate'
  
  -- Job Type
  job_type VARCHAR(50) NOT NULL, -- 'one_time', 'hourly', 'full_time', 'part_time', 'contract'
  
  -- Status & Timeline
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'withdrawn', 'expired'
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Additional Info
  message TEXT,
  is_hidden BOOLEAN DEFAULT false, -- Employee can hide invitation
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_invitation_business 
    FOREIGN KEY (business_id) 
    REFERENCES businesses(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_invitation_invited_user 
    FOREIGN KEY (invited_user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_invitation_invited_by 
    FOREIGN KEY (invited_by_user_id) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL,
  CONSTRAINT valid_invitation_status 
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired')),
  CONSTRAINT unique_pending_invitation 
    UNIQUE(business_id, invited_user_id, status, job_title)
);

-- =====================================================
-- 2. EMPLOYEE ASSIGNMENTS TABLE (Enhanced)
-- =====================================================
-- Track which employees work for which businesses
-- This should link to existing employees table but add more info
CREATE TABLE IF NOT EXISTS public.employee_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  user_id UUID NOT NULL, -- The actual user ID
  
  -- Assignment Details
  assigned_job_title VARCHAR(255),
  assigned_job_category VARCHAR(100),
  
  -- Compensation for this assignment
  pay_rate DECIMAL(12, 2),
  pay_currency VARCHAR(10) DEFAULT 'PHP',
  
  -- Employment Type
  employment_type VARCHAR(50), -- 'full_time', 'part_time', 'contract', 'temporary'
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'on_leave', 'suspended', 'terminated'
  assignment_status VARCHAR(50) DEFAULT 'accepted', -- 'pending', 'accepted', 'rejected'
  
  -- Timeline
  start_date DATE NOT NULL,
  end_date DATE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Linked to invitation
  job_invitation_id UUID,
  
  -- Visibility
  is_visible_to_employee BOOLEAN DEFAULT true,
  employee_notes TEXT,
  manager_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_assignment_business 
    FOREIGN KEY (business_id) 
    REFERENCES businesses(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_assignment_employee 
    FOREIGN KEY (employee_id) 
    REFERENCES employees(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_assignment_user 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_assignment_invitation 
    FOREIGN KEY (job_invitation_id) 
    REFERENCES job_invitations(id) 
    ON DELETE SET NULL,
  CONSTRAINT valid_assignment_status 
    CHECK (assignment_status IN ('pending', 'accepted', 'rejected')),
  CONSTRAINT valid_employment_status 
    CHECK (status IN ('active', 'on_leave', 'suspended', 'terminated')),
  CONSTRAINT unique_active_assignment 
    UNIQUE(business_id, employee_id, status)
);

-- =====================================================
-- 3. EMPLOYEE JOB OFFERS TABLE
-- =====================================================
-- Track job offers from a business to an employee
CREATE TABLE IF NOT EXISTS public.employee_job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  user_id UUID NOT NULL,
  job_id UUID,
  
  -- Job Details
  job_title VARCHAR(255),
  job_description TEXT,
  job_type VARCHAR(50), -- 'one_time', 'hourly', 'full_time', 'part_time'
  
  -- Compensation
  pay_rate DECIMAL(12, 2),
  pay_currency VARCHAR(10) DEFAULT 'PHP',
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'completed'
  accepted_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Details
  offer_message TEXT,
  start_date DATE,
  deadline DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_emp_offer_business 
    FOREIGN KEY (business_id) 
    REFERENCES businesses(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_emp_offer_employee 
    FOREIGN KEY (employee_id) 
    REFERENCES employees(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_emp_offer_user 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_emp_offer_job 
    FOREIGN KEY (job_id) 
    REFERENCES jobs(id) 
    ON DELETE SET NULL,
  CONSTRAINT valid_offer_status 
    CHECK (status IN ('pending', 'accepted', 'rejected', 'completed'))
);

-- =====================================================
-- 4. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_job_invitations_invited_user 
  ON job_invitations(invited_user_id, status);

CREATE INDEX IF NOT EXISTS idx_job_invitations_business 
  ON job_invitations(business_id, status);

CREATE INDEX IF NOT EXISTS idx_job_invitations_pending 
  ON job_invitations(invited_user_id) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_employee_assignments_user 
  ON employee_assignments(user_id, status);

CREATE INDEX IF NOT EXISTS idx_employee_assignments_business 
  ON employee_assignments(business_id, status);

CREATE INDEX IF NOT EXISTS idx_emp_job_offers_user 
  ON employee_job_offers(user_id, status);

CREATE INDEX IF NOT EXISTS idx_emp_job_offers_business 
  ON employee_job_offers(business_id, status);

-- =====================================================
-- 5. VIEWS FOR EASY QUERYING
-- =====================================================

-- View for employee's businesses
CREATE OR REPLACE VIEW v_employee_businesses AS
SELECT DISTINCT
  ea.business_id,
  b.business_name,
  b.owner_id,
  u.full_name as owner_name,
  ea.user_id as employee_user_id,
  ea.employee_id,
  ea.assigned_job_title,
  ea.pay_rate,
  ea.status as assignment_status,
  ea.start_date,
  ea.end_date
FROM employee_assignments ea
JOIN businesses b ON ea.business_id = b.id
JOIN auth.users u ON b.owner_id = u.id
WHERE ea.status = 'active';

-- View for pending invitations
CREATE OR REPLACE VIEW v_pending_invitations AS
SELECT 
  ji.id,
  ji.business_id,
  b.business_name,
  b.owner_id,
  u.full_name as owner_name,
  ji.invited_user_id,
  ji.job_title,
  ji.job_type,
  ji.pay_rate,
  ji.message,
  ji.sent_at,
  ji.expires_at,
  ji.is_hidden,
  (NOW() > ji.expires_at) as is_expired
FROM job_invitations ji
JOIN businesses b ON ji.business_id = b.id
JOIN auth.users u ON b.owner_id = u.id
WHERE ji.status = 'pending' AND ji.is_hidden = false;

-- View for active employee assignments with job info
CREATE OR REPLACE VIEW v_employee_active_jobs AS
SELECT 
  ea.id as assignment_id,
  ea.business_id,
  b.business_name,
  ea.employee_id,
  ea.user_id,
  ea.assigned_job_title,
  ea.job_category,
  ea.assigned_job_type,
  ea.pay_rate,
  ea.employment_type,
  ea.start_date,
  ea.end_date,
  CURRENT_DATE BETWEEN ea.start_date AND COALESCE(ea.end_date, CURRENT_DATE) as is_active
FROM employee_assignments ea
JOIN businesses b ON ea.business_id = b.id
WHERE ea.status = 'active';

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE job_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_job_offers ENABLE ROW LEVEL SECURITY;

-- Policies for job_invitations
CREATE POLICY "users can view their own invitations"
  ON job_invitations FOR SELECT
  USING (
    invited_user_id = auth.uid()
    OR invited_by_user_id = auth.uid()
    OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "business owners can create invitations"
  ON job_invitations FOR INSERT
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "users can update their own invitation status"
  ON job_invitations FOR UPDATE
  USING (invited_user_id = auth.uid())
  WITH CHECK (invited_user_id = auth.uid());

-- Policies for employee_assignments
CREATE POLICY "users can view their own assignments"
  ON employee_assignments FOR SELECT
  USING (
    user_id = auth.uid()
    OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "business owners can manage assignments"
  ON employee_assignments FOR INSERT
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- Policies for employee_job_offers
CREATE POLICY "users can view their own job offers"
  ON employee_job_offers FOR SELECT
  USING (
    user_id = auth.uid()
    OR business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

CREATE POLICY "business owners can create job offers"
  ON employee_job_offers FOR INSERT
  WITH CHECK (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- =====================================================
-- 7. ENABLE REALTIME
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE job_invitations;
ALTER PUBLICATION supabase_realtime ADD TABLE employee_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE employee_job_offers;

-- =====================================================
-- SCHEMA COMPLETE
-- =====================================================
-- All tables for employee invitation and management system
-- are ready for use. The system supports:
-- 1. Job invitations from businesses to users
-- 2. Employee assignments tracking
-- 3. Job offers to specific employees
-- 4. Real-time updates via subscriptions
