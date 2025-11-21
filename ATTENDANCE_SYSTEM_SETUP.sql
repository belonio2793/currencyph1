-- =====================================================
-- ATTENDANCE SYSTEM SCHEMA
-- =====================================================
-- This SQL creates the complete attendance tracking system with:
-- - Business hours configuration per business
-- - Employee attendance records with running timers
-- - Overtime tracking
-- - Real-time update support via subscriptions

-- =====================================================
-- 1. BUSINESS HOURS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE,
  opening_time VARCHAR(5) NOT NULL DEFAULT '09:00', -- HH:MM format
  closing_time VARCHAR(5) NOT NULL DEFAULT '17:00', -- HH:MM format
  monday_enabled BOOLEAN DEFAULT true,
  tuesday_enabled BOOLEAN DEFAULT true,
  wednesday_enabled BOOLEAN DEFAULT true,
  thursday_enabled BOOLEAN DEFAULT true,
  friday_enabled BOOLEAN DEFAULT true,
  saturday_enabled BOOLEAN DEFAULT false,
  sunday_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_business_hours_business 
    FOREIGN KEY (business_id) 
    REFERENCES businesses(id) 
    ON DELETE CASCADE
);

-- =====================================================
-- 2. EMPLOYEE ATTENDANCE TABLE (Enhanced)
-- =====================================================
-- Replace existing employee_attendance table if needed
-- This version includes full timer functionality
DROP TABLE IF EXISTS employee_attendance CASCADE;

CREATE TABLE IF NOT EXISTS employee_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  attendance_date DATE NOT NULL, -- The date this attendance is for
  check_in TIMESTAMP WITH TIME ZONE NOT NULL, -- When employee checked in
  check_out TIMESTAMP WITH TIME ZONE, -- When employee checked out (NULL if still checked in)
  status VARCHAR(20) DEFAULT 'checked_in', -- 'checked_in' or 'checked_out'
  checked_in_by_user_id UUID, -- User who initiated check-in (could be manager or self)
  checked_out_by_user_id UUID, -- User who initiated check-out (could be manager or system_auto_checkout)
  notes TEXT, -- Optional notes from manager
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_attendance_business 
    FOREIGN KEY (business_id) 
    REFERENCES businesses(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_attendance_employee 
    FOREIGN KEY (employee_id) 
    REFERENCES employees(id) 
    ON DELETE CASCADE,
  CONSTRAINT unique_daily_checkin 
    UNIQUE(business_id, employee_id, attendance_date, check_in)
);

-- =====================================================
-- 3. OVERTIME TRACKING TABLE (Optional but recommended)
-- =====================================================
CREATE TABLE IF NOT EXISTS employee_overtime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  attendance_id UUID NOT NULL,
  overtime_hours DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  overtime_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'paid'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_overtime_business 
    FOREIGN KEY (business_id) 
    REFERENCES businesses(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_overtime_employee 
    FOREIGN KEY (employee_id) 
    REFERENCES employees(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_overtime_attendance 
    FOREIGN KEY (attendance_id) 
    REFERENCES employee_attendance(id) 
    ON DELETE CASCADE
);

-- =====================================================
-- 4. ATTENDANCE SUMMARY TABLE (For quick stats)
-- =====================================================
-- This is optional but useful for performance
CREATE TABLE IF NOT EXISTS employee_attendance_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  month_year VARCHAR(7) NOT NULL, -- YYYY-MM format
  total_hours DECIMAL(8, 2) DEFAULT 0.00,
  total_overtime_hours DECIMAL(8, 2) DEFAULT 0.00,
  days_worked INTEGER DEFAULT 0,
  last_check_in TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_summary_business 
    FOREIGN KEY (business_id) 
    REFERENCES businesses(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_summary_employee 
    FOREIGN KEY (employee_id) 
    REFERENCES employees(id) 
    ON DELETE CASCADE,
  CONSTRAINT unique_monthly_summary 
    UNIQUE(business_id, employee_id, month_year)
);

-- =====================================================
-- 5. INDEXES FOR PERFORMANCE
-- =====================================================

-- Primary query indexes
CREATE INDEX IF NOT EXISTS idx_attendance_business_employee_date 
  ON employee_attendance(business_id, employee_id, attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_status 
  ON employee_attendance(business_id, employee_id, status);

CREATE INDEX IF NOT EXISTS idx_attendance_date_range 
  ON employee_attendance(business_id, employee_id, attendance_date);

-- For fetching records by date range
CREATE INDEX IF NOT EXISTS idx_attendance_created_at 
  ON employee_attendance(created_at DESC);

-- For overtime tracking
CREATE INDEX IF NOT EXISTS idx_overtime_status 
  ON employee_overtime(business_id, status);

CREATE INDEX IF NOT EXISTS idx_overtime_date 
  ON employee_overtime(overtime_date DESC);

-- For summary lookups
CREATE INDEX IF NOT EXISTS idx_summary_month_year 
  ON employee_attendance_summary(business_id, employee_id, month_year DESC);

-- =====================================================
-- 6. VIEWS FOR EASY QUERYING
-- =====================================================

-- View for current check-in status
CREATE OR REPLACE VIEW v_current_checkin_status AS
SELECT 
  ea.id,
  ea.business_id,
  ea.employee_id,
  ea.check_in,
  ea.status,
  ea.attendance_date,
  EXTRACT(EPOCH FROM (NOW() - ea.check_in)) as seconds_elapsed,
  CONCAT(
    LPAD(FLOOR(EXTRACT(EPOCH FROM (NOW() - ea.check_in)) / 3600)::TEXT, 2, '0'), ':',
    LPAD(FLOOR((EXTRACT(EPOCH FROM (NOW() - ea.check_in)) % 3600) / 60)::TEXT, 2, '0'), ':',
    LPAD((EXTRACT(EPOCH FROM (NOW() - ea.check_in))::INTEGER % 60)::TEXT, 2, '0')
  ) as elapsed_time_formatted
FROM employee_attendance ea
WHERE ea.status = 'checked_in'
  AND ea.attendance_date = CURRENT_DATE;

-- View for daily attendance summary
CREATE OR REPLACE VIEW v_daily_attendance_summary AS
SELECT 
  ea.business_id,
  ea.employee_id,
  ea.attendance_date,
  COUNT(*) as check_in_count,
  SUM(CASE WHEN ea.status = 'checked_out' 
      THEN EXTRACT(EPOCH FROM (ea.check_out - ea.check_in)) / 3600 
      ELSE 0 
  END) as hours_worked,
  SUM(CASE WHEN (EXTRACT(EPOCH FROM (ea.check_out - ea.check_in)) / 3600) > 8 
      THEN (EXTRACT(EPOCH FROM (ea.check_out - ea.check_in)) / 3600) - 8 
      ELSE 0 
  END) as overtime_hours,
  MAX(ea.check_in) as first_check_in,
  MIN(ea.check_out) as last_check_out
FROM employee_attendance ea
GROUP BY ea.business_id, ea.employee_id, ea.attendance_date;

-- =====================================================
-- 7. HELPER FUNCTIONS
-- =====================================================

-- Function to auto-checkout employees past closing time
CREATE OR REPLACE FUNCTION auto_checkout_past_closing_time()
RETURNS TABLE(id UUID, business_id UUID, employee_id UUID)
LANGUAGE plpgsql
AS $$
DECLARE
  v_record RECORD;
  v_closing_time TIME;
  v_current_time TIME;
BEGIN
  v_current_time := CURRENT_TIME;
  
  FOR v_record IN
    SELECT 
      ea.id,
      ea.business_id,
      ea.employee_id,
      bh.closing_time
    FROM employee_attendance ea
    JOIN business_hours bh ON ea.business_id = bh.business_id
    WHERE ea.status = 'checked_in'
      AND ea.attendance_date = CURRENT_DATE
      AND bh.closing_time::TIME < v_current_time
  LOOP
    UPDATE employee_attendance
    SET 
      check_out = NOW(),
      checked_out_by_user_id = 'system_auto_checkout',
      status = 'checked_out',
      updated_at = NOW()
    WHERE id = v_record.id;
    
    RETURN QUERY SELECT v_record.id, v_record.business_id, v_record.employee_id;
  END LOOP;
END;
$$;

-- Function to calculate elapsed time
CREATE OR REPLACE FUNCTION calc_elapsed_seconds(check_in TIMESTAMP WITH TIME ZONE, check_out TIMESTAMP WITH TIME ZONE)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF check_out IS NULL THEN
    RETURN EXTRACT(EPOCH FROM (NOW() - check_in))::INTEGER;
  ELSE
    RETURN EXTRACT(EPOCH FROM (check_out - check_in))::INTEGER;
  END IF;
END;
$$;

-- =====================================================
-- 8. ENABLE REALTIME
-- =====================================================
-- Enable Realtime for automatic updates in the frontend

ALTER PUBLICATION supabase_realtime ADD TABLE business_hours;
ALTER PUBLICATION supabase_realtime ADD TABLE employee_attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE employee_overtime;

-- =====================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_overtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_attendance_summary ENABLE ROW LEVEL SECURITY;

-- Policies for business_hours
CREATE POLICY "users can view business hours for their businesses"
  ON business_hours FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM employees 
      WHERE employee_id = auth.uid()
    )
    OR business_id IN (
      SELECT id FROM businesses 
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "business owners can update their hours"
  ON business_hours FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses 
      WHERE owner_id = auth.uid()
    )
  );

-- Policies for employee_attendance
CREATE POLICY "employees can view their own attendance"
  ON employee_attendance FOR SELECT
  USING (
    employee_id = auth.uid()
    OR business_id IN (
      SELECT id FROM businesses 
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "employees can insert their own attendance"
  ON employee_attendance FOR INSERT
  WITH CHECK (
    employee_id = auth.uid()
    OR business_id IN (
      SELECT id FROM businesses 
      WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "employees can update their own attendance"
  ON employee_attendance FOR UPDATE
  USING (
    employee_id = auth.uid()
    OR business_id IN (
      SELECT id FROM businesses 
      WHERE owner_id = auth.uid()
    )
  );

-- =====================================================
-- 10. SAMPLE DATA (Optional - for testing)
-- =====================================================
-- Uncomment to insert sample data

/*
-- Sample business hours
INSERT INTO business_hours (business_id, opening_time, closing_time)
VALUES (
  (SELECT id FROM businesses LIMIT 1),
  '09:00',
  '17:00'
)
ON CONFLICT (business_id) DO NOTHING;
*/

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- All tables and functions have been created.
-- The attendance system is now ready to use.
-- 
-- Next steps:
-- 1. Ensure RLS policies match your business logic
-- 2. Run: SELECT enable_realtime('employee_attendance');
-- 3. Test check-in/check-out functionality
-- 4. Monitor performance with the provided indexes
