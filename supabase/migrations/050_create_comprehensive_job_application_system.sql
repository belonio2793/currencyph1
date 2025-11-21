-- Comprehensive Job Application System
-- Extended database schema for detailed job applications with employment history,
-- education, certifications, skills, and interview details

-- ============================================================================
-- 1. JOB APPLICATIONS TABLE (Enhanced version of business_requests for jobs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  applicant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Personal Information
  applicant_name VARCHAR(255),
  applicant_email VARCHAR(255),
  applicant_phone VARCHAR(20),
  applicant_location VARCHAR(255),
  
  -- Position Information
  position_applied_for VARCHAR(255) NOT NULL,
  salary_expectation DECIMAL(12, 2),
  salary_currency VARCHAR(10) DEFAULT 'PHP',
  years_of_experience INT,
  notice_period_days INT, -- Days required to leave current job
  available_start_date DATE,
  
  -- Work Authorization
  work_authorized BOOLEAN DEFAULT false,
  visa_sponsorship_needed BOOLEAN DEFAULT false,
  
  -- Application Details
  cover_letter TEXT,
  additional_message TEXT,
  resume_file_url TEXT,
  portfolio_url TEXT,
  linkedin_profile_url TEXT,
  
  -- Preferences
  employment_type VARCHAR(50), -- 'full_time', 'part_time', 'contract', 'temporary', 'flexible'
  work_arrangement VARCHAR(50), -- 'on_site', 'remote', 'hybrid'
  willing_to_relocate BOOLEAN DEFAULT false,
  willing_to_travel BOOLEAN DEFAULT false,
  
  -- Status & Tracking
  status VARCHAR(50) DEFAULT 'submitted', -- 'submitted', 'under_review', 'shortlisted', 'rejected', 'interview_scheduled', 'offer_extended', 'hired', 'withdrawn'
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_employment_type CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'temporary', 'flexible')),
  CONSTRAINT valid_work_arrangement CHECK (work_arrangement IN ('on_site', 'remote', 'hybrid')),
  CONSTRAINT valid_status CHECK (status IN ('submitted', 'under_review', 'shortlisted', 'rejected', 'interview_scheduled', 'offer_extended', 'hired', 'withdrawn'))
);

-- ============================================================================
-- 2. EMPLOYMENT HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.applicant_employment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  
  -- Company Information
  company_name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  company_location VARCHAR(255),
  company_size VARCHAR(50), -- 'small', 'medium', 'large', 'enterprise'
  
  -- Position Information
  job_title VARCHAR(255) NOT NULL,
  job_description TEXT,
  employment_type VARCHAR(50), -- 'full_time', 'part_time', 'contract', 'temporary'
  
  -- Duration
  start_date DATE NOT NULL,
  end_date DATE,
  currently_employed BOOLEAN DEFAULT false,
  months_employed INT,
  
  -- Salary & Compensation
  salary_amount DECIMAL(12, 2),
  salary_currency VARCHAR(10) DEFAULT 'PHP',
  
  -- Responsibilities
  key_responsibilities TEXT,
  achievements TEXT,
  reason_for_leaving TEXT,
  
  -- Manager Information
  manager_name VARCHAR(255),
  manager_email VARCHAR(255),
  manager_phone VARCHAR(20),
  can_contact_manager BOOLEAN DEFAULT true,
  
  -- Additional Info
  reference_person VARCHAR(255),
  reference_contact VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_employment_type_history CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'temporary'))
);

-- ============================================================================
-- 3. EDUCATION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.applicant_education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  
  -- Institution Information
  institution_name VARCHAR(255) NOT NULL,
  institution_type VARCHAR(50), -- 'university', 'college', 'vocational', 'high_school', 'online'
  
  -- Education Details
  degree_level VARCHAR(100), -- 'high_school', 'diploma', 'bachelor', 'master', 'phd', 'postdoc'
  field_of_study VARCHAR(255) NOT NULL,
  specialization VARCHAR(255),
  
  -- Duration
  start_date DATE NOT NULL,
  end_date DATE,
  currently_studying BOOLEAN DEFAULT false,
  
  -- Academic Performance
  grade_average DECIMAL(3, 2), -- GPA/Grade average
  grade_scale VARCHAR(20), -- '4.0', '5.0', '100', 'A-F', etc.
  
  -- Additional Info
  activities_societies TEXT, -- Clubs, societies, honor societies
  description TEXT, -- Relevant coursework, thesis topic, etc.
  
  -- Diploma/Certificate
  diploma_url TEXT,
  transcript_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_degree_level CHECK (degree_level IN ('high_school', 'diploma', 'bachelor', 'master', 'phd', 'postdoc')),
  CONSTRAINT valid_institution_type CHECK (institution_type IN ('university', 'college', 'vocational', 'high_school', 'online'))
);

-- ============================================================================
-- 4. CERTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.applicant_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  
  -- Certification Details
  certification_name VARCHAR(255) NOT NULL,
  issuing_organization VARCHAR(255) NOT NULL,
  credential_id VARCHAR(255),
  credential_url TEXT,
  
  -- Dates
  issue_date DATE NOT NULL,
  expiration_date DATE,
  does_not_expire BOOLEAN DEFAULT false,
  
  -- Details
  description TEXT,
  skill_covered VARCHAR(255), -- The main skill this certification covers
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. APPLICANT SKILLS TABLE (Enhanced with proficiency levels)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.applicant_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  
  -- Skill Information
  skill_name VARCHAR(255) NOT NULL,
  skill_category VARCHAR(100), -- 'technical', 'soft_skill', 'language', 'tool', 'certification'
  
  -- Proficiency Level
  proficiency_level VARCHAR(50), -- 'beginner', 'intermediate', 'advanced', 'expert', 'fluent'
  years_of_experience INT,
  
  -- Endorsement
  endorsed_by_count INT DEFAULT 0, -- How many people endorsed this skill
  
  -- Details
  description TEXT, -- Where/how acquired, examples of use
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_proficiency_level CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert', 'fluent')),
  CONSTRAINT valid_skill_category CHECK (skill_category IN ('technical', 'soft_skill', 'language', 'tool', 'certification'))
);

-- ============================================================================
-- 6. INTERVIEW DETAILS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.interview_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  scheduled_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Interview Scheduling
  interview_round INT DEFAULT 1, -- Which round of interviews
  interview_type VARCHAR(50), -- 'phone_screen', 'video', 'in_person', 'panel', 'practical_test', 'group'
  
  -- Date & Time
  scheduled_date DATE,
  scheduled_time TIME,
  duration_minutes INT DEFAULT 30,
  timezone VARCHAR(50),
  
  -- Location/Meeting Details
  location_address VARCHAR(255), -- For in-person interviews
  meeting_link VARCHAR(500), -- For video interviews (Zoom, Teams, etc.)
  meeting_platform VARCHAR(50), -- 'zoom', 'teams', 'google_meet', 'other'
  
  -- Interview Information
  interviewer_name VARCHAR(255),
  interviewer_email VARCHAR(255),
  interviewer_phone VARCHAR(20),
  interview_panel TEXT, -- JSON array of interviewer info
  
  -- Topics & Preparation
  interview_topics TEXT, -- Topics to be covered
  required_preparations TEXT, -- What to bring/prepare
  assessment_type VARCHAR(50), -- 'behavioral', 'technical', 'case_study', 'coding', 'portfolio_review'
  
  -- Applicant Preferences
  preferred_interview_type VARCHAR(50),
  preferred_interview_dates TEXT, -- Multiple preferred dates
  availability_notes TEXT,
  
  -- Interview Outcome
  interview_status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show'
  interview_notes TEXT, -- Interviewer's notes
  interview_score DECIMAL(3, 1), -- Overall score if numeric
  interviewer_feedback TEXT,
  next_steps TEXT,
  
  -- Confirmation
  applicant_confirmed BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_interview_type CHECK (interview_type IN ('phone_screen', 'video', 'in_person', 'panel', 'practical_test', 'group')),
  CONSTRAINT valid_assessment_type CHECK (assessment_type IN ('behavioral', 'technical', 'case_study', 'coding', 'portfolio_review')),
  CONSTRAINT valid_interview_status CHECK (interview_status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show'))
);

-- ============================================================================
-- 7. JOB OFFER TABLE (Enhanced for comprehensive tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id UUID REFERENCES public.job_applications(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  applicant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  extended_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Offer Details
  position_title VARCHAR(255) NOT NULL,
  employment_type VARCHAR(50),
  work_arrangement VARCHAR(50),
  
  -- Compensation
  base_salary DECIMAL(12, 2) NOT NULL,
  salary_currency VARCHAR(10) DEFAULT 'PHP',
  benefits TEXT, -- JSON array or text describing benefits
  signing_bonus DECIMAL(12, 2),
  
  -- Employment Terms
  start_date DATE,
  contract_duration_months INT,
  probation_period_days INT DEFAULT 90,
  
  -- Offer Details
  offer_letter_url TEXT,
  job_description_url TEXT,
  
  -- Status
  offer_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired', 'withdrawn', 'counter_proposed'
  offer_expiration_date DATE,
  
  -- Response
  applicant_response_date DATE,
  applicant_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_offer_status CHECK (offer_status IN ('pending', 'accepted', 'rejected', 'expired', 'withdrawn', 'counter_proposed'))
);

-- ============================================================================
-- 8. REFERENCES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.applicant_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  
  -- Reference Contact
  reference_name VARCHAR(255) NOT NULL,
  reference_title VARCHAR(255), -- Job title/position
  reference_company VARCHAR(255),
  reference_email VARCHAR(255),
  reference_phone VARCHAR(20),
  
  -- Relationship
  relationship_type VARCHAR(50), -- 'manager', 'colleague', 'professor', 'mentor', 'client'
  years_known INT,
  known_since_date DATE,
  
  -- Permission
  can_be_contacted BOOLEAN DEFAULT true,
  contact_permission_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_relationship_type CHECK (relationship_type IN ('manager', 'colleague', 'professor', 'mentor', 'client'))
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_business_id ON public.job_applications(business_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant_user_id ON public.job_applications(applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON public.job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_submitted_at ON public.job_applications(submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_employment_history_app_id ON public.applicant_employment_history(job_application_id);
CREATE INDEX IF NOT EXISTS idx_employment_history_company ON public.applicant_employment_history(company_name);

CREATE INDEX IF NOT EXISTS idx_education_app_id ON public.applicant_education(job_application_id);
CREATE INDEX IF NOT EXISTS idx_education_field ON public.applicant_education(field_of_study);

CREATE INDEX IF NOT EXISTS idx_certifications_app_id ON public.applicant_certifications(job_application_id);
CREATE INDEX IF NOT EXISTS idx_certifications_org ON public.applicant_certifications(issuing_organization);

CREATE INDEX IF NOT EXISTS idx_skills_app_id ON public.applicant_skills(job_application_id);
CREATE INDEX IF NOT EXISTS idx_skills_name ON public.applicant_skills(skill_name);
CREATE INDEX IF NOT EXISTS idx_skills_category ON public.applicant_skills(skill_category);

CREATE INDEX IF NOT EXISTS idx_interview_app_id ON public.interview_details(job_application_id);
CREATE INDEX IF NOT EXISTS idx_interview_scheduled_date ON public.interview_details(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_interview_type ON public.interview_details(interview_type);
CREATE INDEX IF NOT EXISTS idx_interview_status ON public.interview_details(interview_status);

CREATE INDEX IF NOT EXISTS idx_job_offers_application_id ON public.job_offers(job_application_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_business_id ON public.job_offers(business_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_applicant_user ON public.job_offers(applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_status ON public.job_offers(offer_status);

CREATE INDEX IF NOT EXISTS idx_references_app_id ON public.applicant_references(job_application_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_employment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_references ENABLE ROW LEVEL SECURITY;

-- Job Applications RLS Policies
CREATE POLICY "Users can view own applications" ON public.job_applications
  FOR SELECT USING (auth.uid() = applicant_user_id);

CREATE POLICY "Business owners can view applications to their jobs" ON public.job_applications
  FOR SELECT USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create applications" ON public.job_applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_user_id);

CREATE POLICY "Users can update own applications" ON public.job_applications
  FOR UPDATE USING (auth.uid() = applicant_user_id);

CREATE POLICY "Business owners can update applications" ON public.job_applications
  FOR UPDATE USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
  );

-- Employment History RLS Policies
CREATE POLICY "Users can view own employment history" ON public.applicant_employment_history
  FOR SELECT USING (
    job_application_id IN (
      SELECT id FROM public.job_applications WHERE applicant_user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can view employment history" ON public.applicant_employment_history
  FOR SELECT USING (
    job_application_id IN (
      SELECT id FROM public.job_applications 
      WHERE business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage own employment history" ON public.applicant_employment_history
  FOR ALL USING (
    job_application_id IN (
      SELECT id FROM public.job_applications WHERE applicant_user_id = auth.uid()
    )
  );

-- Education RLS Policies
CREATE POLICY "Users can view own education" ON public.applicant_education
  FOR SELECT USING (
    job_application_id IN (
      SELECT id FROM public.job_applications WHERE applicant_user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can view education" ON public.applicant_education
  FOR SELECT USING (
    job_application_id IN (
      SELECT id FROM public.job_applications 
      WHERE business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage own education" ON public.applicant_education
  FOR ALL USING (
    job_application_id IN (
      SELECT id FROM public.job_applications WHERE applicant_user_id = auth.uid()
    )
  );

-- Certifications RLS Policies
CREATE POLICY "Users can view own certifications" ON public.applicant_certifications
  FOR SELECT USING (
    job_application_id IN (
      SELECT id FROM public.job_applications WHERE applicant_user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can view certifications" ON public.applicant_certifications
  FOR SELECT USING (
    job_application_id IN (
      SELECT id FROM public.job_applications 
      WHERE business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage own certifications" ON public.applicant_certifications
  FOR ALL USING (
    job_application_id IN (
      SELECT id FROM public.job_applications WHERE applicant_user_id = auth.uid()
    )
  );

-- Skills RLS Policies
CREATE POLICY "Users can view own skills" ON public.applicant_skills
  FOR SELECT USING (
    job_application_id IN (
      SELECT id FROM public.job_applications WHERE applicant_user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can view skills" ON public.applicant_skills
  FOR SELECT USING (
    job_application_id IN (
      SELECT id FROM public.job_applications 
      WHERE business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage own skills" ON public.applicant_skills
  FOR ALL USING (
    job_application_id IN (
      SELECT id FROM public.job_applications WHERE applicant_user_id = auth.uid()
    )
  );

-- Interview Details RLS Policies
CREATE POLICY "Applicants can view own interviews" ON public.interview_details
  FOR SELECT USING (
    job_application_id IN (
      SELECT id FROM public.job_applications WHERE applicant_user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can view interviews" ON public.interview_details
  FOR SELECT USING (
    job_application_id IN (
      SELECT id FROM public.job_applications 
      WHERE business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Business owners can manage interviews" ON public.interview_details
  FOR ALL USING (
    job_application_id IN (
      SELECT id FROM public.job_applications 
      WHERE business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Applicants can update own interview confirmations" ON public.interview_details
  FOR UPDATE USING (
    job_application_id IN (
      SELECT id FROM public.job_applications WHERE applicant_user_id = auth.uid()
    )
  );

-- Job Offers RLS Policies
CREATE POLICY "Applicants can view own offers" ON public.job_offers
  FOR SELECT USING (auth.uid() = applicant_user_id);

CREATE POLICY "Business owners can view offers" ON public.job_offers
  FOR SELECT USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Business owners can manage offers" ON public.job_offers
  FOR ALL USING (
    business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
  );

CREATE POLICY "Applicants can update own offer responses" ON public.job_offers
  FOR UPDATE USING (auth.uid() = applicant_user_id);

-- References RLS Policies
CREATE POLICY "Users can view own references" ON public.applicant_references
  FOR SELECT USING (
    job_application_id IN (
      SELECT id FROM public.job_applications WHERE applicant_user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can view references" ON public.applicant_references
  FOR SELECT USING (
    job_application_id IN (
      SELECT id FROM public.job_applications 
      WHERE business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage own references" ON public.applicant_references
  FOR ALL USING (
    job_application_id IN (
      SELECT id FROM public.job_applications WHERE applicant_user_id = auth.uid()
    )
  );
