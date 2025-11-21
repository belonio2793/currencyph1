-- Employee Management System
-- Comprehensive system for job invitations, employee assignments, and attendance tracking

-- Job Invitations Table: Track job invitations sent to users
CREATE TABLE IF NOT EXISTS public.job_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Job Details
  job_title VARCHAR(255) NOT NULL,
  job_description TEXT,
  job_category VARCHAR(100),
  pay_rate DECIMAL(12, 2),
  pay_currency VARCHAR(10) DEFAULT 'PHP',
  pay_type VARCHAR(50),
  job_type VARCHAR(50),
  
  -- Invitation Details
  message TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  is_hidden BOOLEAN DEFAULT false,
  
  -- Timeline
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_invitation_status CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'withdrawn'))
);

CREATE INDEX IF NOT EXISTS idx_job_invitations_invited_user ON public.job_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_job_invitations_business ON public.job_invitations(business_id);
CREATE INDEX IF NOT EXISTS idx_job_invitations_status ON public.job_invitations(status);
CREATE INDEX IF NOT EXISTS idx_job_invitations_sent_at ON public.job_invitations(sent_at DESC);

-- Employee Assignments Table: Track employee assignments to businesses and jobs
CREATE TABLE IF NOT EXISTS public.employee_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Assignment Details
  assigned_job_title VARCHAR(255) NOT NULL,
  assigned_job_category VARCHAR(100),
  employment_type VARCHAR(50),
  pay_rate DECIMAL(12, 2),
  pay_currency VARCHAR(10) DEFAULT 'PHP',
  
  -- Timeline
  start_date DATE NOT NULL,
  end_date DATE,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_assignment_status CHECK (status IN ('active', 'inactive', 'terminated', 'on_leave'))
);

CREATE INDEX IF NOT EXISTS idx_employee_assignments_user ON public.employee_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_assignments_business ON public.employee_assignments(business_id);
CREATE INDEX IF NOT EXISTS idx_employee_assignments_employee ON public.employee_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_assignments_status ON public.employee_assignments(status);
CREATE INDEX IF NOT EXISTS idx_employee_assignments_start_date ON public.employee_assignments(start_date DESC);

-- Business Hours Table: Track business operating hours
CREATE TABLE IF NOT EXISTS public.business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  opening_time TIME DEFAULT '08:00:00',
  closing_time TIME DEFAULT '17:00:00',
  
  monday_enabled BOOLEAN DEFAULT true,
  tuesday_enabled BOOLEAN DEFAULT true,
  wednesday_enabled BOOLEAN DEFAULT true,
  thursday_enabled BOOLEAN DEFAULT true,
  friday_enabled BOOLEAN DEFAULT true,
  saturday_enabled BOOLEAN DEFAULT false,
  sunday_enabled BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_hours_business ON public.business_hours(business_id);

-- Employee Attendance Table: Track employee check-in and check-out times
CREATE TABLE IF NOT EXISTS public.employee_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  checked_in_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_out_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  attendance_date DATE NOT NULL,
  check_in TIMESTAMP WITH TIME ZONE,
  check_out TIMESTAMP WITH TIME ZONE,
  check_in_time TIME,
  check_out_time TIME,
  
  location VARCHAR(255),
  notes TEXT,
  status VARCHAR(50) DEFAULT 'checked_in',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_attendance_business ON public.employee_attendance(business_id);
CREATE INDEX IF NOT EXISTS idx_employee_attendance_employee ON public.employee_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_attendance_user ON public.employee_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_attendance_date ON public.employee_attendance(attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_employee_attendance_status ON public.employee_attendance(status);

-- Enable Row Level Security
ALTER TABLE public.job_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_attendance ENABLE ROW LEVEL SECURITY;

-- Job Invitations RLS Policies
CREATE POLICY "Users can view invitations sent to them" ON public.job_invitations
  FOR SELECT USING (auth.uid() = invited_user_id OR auth.uid() = invited_by_user_id);

CREATE POLICY "Business owners can send invitations" ON public.job_invitations
  FOR INSERT WITH CHECK (
    auth.uid() = invited_by_user_id AND
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update invitations" ON public.job_invitations
  FOR UPDATE USING (
    auth.uid() = invited_user_id OR 
    auth.uid() = invited_by_user_id
  );

-- Employee Assignments RLS Policies
CREATE POLICY "Users can view their own assignments" ON public.employee_assignments
  FOR SELECT USING (
    auth.uid() = user_id OR 
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Business owners can manage assignments" ON public.employee_assignments
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Business owners can update assignments" ON public.employee_assignments
  FOR UPDATE USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
  );

-- Business Hours RLS Policies
CREATE POLICY "Anyone can view business hours" ON public.business_hours
  FOR SELECT USING (true);

CREATE POLICY "Business owners can manage hours" ON public.business_hours
  FOR INSERT WITH CHECK (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Business owners can update hours" ON public.business_hours
  FOR UPDATE USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
  );

-- Employee Attendance RLS Policies
CREATE POLICY "Users can view own attendance" ON public.employee_attendance
  FOR SELECT USING (
    auth.uid() = user_id OR 
    auth.uid() = checked_in_by_user_id OR
    auth.uid() = checked_out_by_user_id OR
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Employees can record attendance" ON public.employee_attendance
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    auth.uid() = checked_in_by_user_id
  );

CREATE POLICY "Users can update own attendance" ON public.employee_attendance
  FOR UPDATE USING (
    auth.uid() = user_id OR
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
  );
