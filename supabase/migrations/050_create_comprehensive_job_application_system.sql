-- ============================================================================
-- COMPREHENSIVE JOB APPLICATION SYSTEM — FIXED & REORDERED (Nov 2025)
-- Parent table FIRST → all children after → zero column errors
-- ============================================================================

-- 1. MAIN PARENT TABLE — MUST BE FIRST!
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
  notice_period_days INT,
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
  employment_type VARCHAR(50),
  work_arrangement VARCHAR(50),
  willing_to_relocate BOOLEAN DEFAULT false,
  willing_to_travel BOOLEAN DEFAULT false,
  
  -- Status & Tracking
  status VARCHAR(50) DEFAULT 'submitted',
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_employment_type CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'temporary', 'flexible')),
  CONSTRAINT valid_work_arrangement CHECK (work_arrangement IN ('on_site', 'remote', 'hybrid')),
  CONSTRAINT valid_status CHECK (status IN ('submitted', 'under_review', 'shortlisted', 'rejected', 'interview_scheduled', 'offer_extended', 'hired', 'withdrawn'))
);

-- 2. EMPLOYMENT HISTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.applicant_employment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  
  company_name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  company_location VARCHAR(255),
  company_size VARCHAR(50),
  
  job_title VARCHAR(255) NOT NULL,
  job_description TEXT,
  employment_type VARCHAR(50),
  
  start_date DATE NOT NULL,
  end_date DATE,
  currently_employed BOOLEAN DEFAULT false,
  months_employed INT,
  
  salary_amount DECIMAL(12, 2),
  salary_currency VARCHAR(10) DEFAULT 'PHP',
  
  key_responsibilities TEXT,
  achievements TEXT,
  reason_for_leaving TEXT,
  
  manager_name VARCHAR(255),
  manager_email VARCHAR(255),
  manager_phone VARCHAR(20),
  can_contact_manager BOOLEAN DEFAULT true,
  
  reference_person VARCHAR(255),
  reference_contact VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_employment_type_history CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'temporary'))
);

-- 3. EDUCATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.applicant_education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  
  institution_name VARCHAR(255) NOT NULL,
  institution_type VARCHAR(50),
  
  degree_level VARCHAR(100),
  field_of_study VARCHAR(255) NOT NULL,
  specialization VARCHAR(255),
  
  start_date DATE NOT NULL,
  end_date DATE,
  currently_studying BOOLEAN DEFAULT false,
  
  grade_average DECIMAL(3, 2),
  grade_scale VARCHAR(20),
  
  activities_societies TEXT,
  description TEXT,
  
  diploma_url TEXT,
  transcript_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_degree_level CHECK (degree_level IN ('high_school', 'diploma', 'bachelor', 'master', 'phd', 'postdoc')),
  CONSTRAINT valid_institution_type CHECK (institution_type IN ('university', 'college', 'vocational', 'high_school', 'online'))
);

-- 4. CERTIFICATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.applicant_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  
  certification_name VARCHAR(255) NOT NULL,
  issuing_organization VARCHAR(255) NOT NULL,
  credential_id VARCHAR(255),
  credential_url TEXT,
  
  issue_date DATE NOT NULL,
  expiration_date DATE,
  does_not_expire BOOLEAN DEFAULT false,
  
  description TEXT,
  skill_covered VARCHAR(255),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. SKILLS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.applicant_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  
  skill_name VARCHAR(255) NOT NULL,
  skill_category VARCHAR(100),
  
  proficiency_level VARCHAR(50),
  years_of_experience INT,
  
  endorsed_by_count INT DEFAULT 0,
  
  description TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_proficiency_level CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert', 'fluent')),
  CONSTRAINT valid_skill_category CHECK (skill_category IN ('technical', 'soft_skill', 'language', 'tool', 'certification'))
);

-- 6. INTERVIEW DETAILS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.interview_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  scheduled_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  interview_round INT DEFAULT 1,
  interview_type VARCHAR(50),
  
  scheduled_date DATE,
  scheduled_time TIME,
  duration_minutes INT DEFAULT 30,
  timezone VARCHAR(50),
  
  location_address VARCHAR(255),
  meeting_link VARCHAR(500),
  meeting_platform VARCHAR(50),
  
  interviewer_name VARCHAR(255),
  interviewer_email VARCHAR(255),
  interviewer_phone VARCHAR(20),
  interview_panel TEXT,
  
  interview_topics TEXT,
  required_preparations TEXT,
  assessment_type VARCHAR(50),
  
  preferred_interview_type VARCHAR(50),
  preferred_interview_dates TEXT,
  availability_notes TEXT,
  
  interview_status VARCHAR(50) DEFAULT 'scheduled',
  interview_notes TEXT,
  interview_score DECIMAL(3, 1),
  interviewer_feedback TEXT,
  next_steps TEXT,
  
  applicant_confirmed BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_interview_type CHECK (interview_type IN ('phone_screen', 'video', 'in_person', 'panel', 'practical_test', 'group')),
  CONSTRAINT valid_assessment_type CHECK (assessment_type IN ('behavioral', 'technical', 'case_study', 'coding', 'portfolio_review')),
  CONSTRAINT valid_interview_status CHECK (interview_status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show'))
);

-- 7. JOB OFFERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id UUID REFERENCES public.job_applications(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  applicant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  extended_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  position_title VARCHAR(255) NOT NULL,
  employment_type VARCHAR(50),
  work_arrangement VARCHAR(50),
  
  base_salary DECIMAL(12, 2) NOT NULL,
  salary_currency VARCHAR(10) DEFAULT 'PHP',
  benefits TEXT,
  signing_bonus DECIMAL(12, 2),
  
  start_date DATE,
  contract_duration_months INT,
  probation_period_days INT DEFAULT 90,
  
  offer_letter_url TEXT,
  job_description_url TEXT,
  
  offer_status VARCHAR(50) DEFAULT 'pending',
  offer_expiration_date DATE,
  
  applicant_response_date DATE,
  applicant_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_offer_status CHECK (offer_status IN ('pending', 'accepted', 'rejected', 'expired', 'withdrawn', 'counter_proposed'))
);

-- 8. REFERENCES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.applicant_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  
  reference_name VARCHAR(255) NOT NULL,
  reference_title VARCHAR(255),
  reference_company VARCHAR(255),
  reference_email VARCHAR(255),
  reference_phone VARCHAR(20),
  
  relationship_type VARCHAR(50),
  years_known INT,
  known_since_date DATE,
  
  can_be_contacted BOOLEAN DEFAULT true,
  contact_permission_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_relationship_type CHECK (relationship_type IN ('manager', 'colleague', 'professor', 'mentor', 'client'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_job_applications_job_id ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_business_id ON public.job_applications(business_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_applicant_user_id ON public.job_applications(applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON public.job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_submitted_at ON public.job_applications(submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_employment_history_app_id ON public.applicant_employment_history(job_application_id);
CREATE INDEX IF NOT EXISTS idx_education_app_id ON public.applicant_education(job_application_id);
CREATE INDEX IF NOT EXISTS idx_certifications_app_id ON public.applicant_certifications(job_application_id);
CREATE INDEX IF NOT EXISTS idx_skills_app_id ON public.applicant_skills(job_application_id);
CREATE INDEX IF NOT EXISTS idx_interview_app_id ON public.interview_details(job_application_id);
CREATE INDEX IF NOT EXISTS idx_job_offers_application_id ON public.job_offers(job_application_id);
CREATE INDEX IF NOT EXISTS idx_references_app_id ON public.applicant_references(job_application_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_employment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_references ENABLE ROW LEVEL SECURITY;

-- Job Applications
CREATE POLICY "Users can view own applications" ON public.job_applications FOR SELECT USING (auth.uid() = applicant_user_id);
CREATE POLICY "Business owners can view applications" ON public.job_applications FOR SELECT USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own applications" ON public.job_applications FOR INSERT WITH CHECK (auth.uid() = applicant_user_id);
CREATE POLICY "Users can update own applications" ON public.job_applications FOR UPDATE USING (auth.uid() = applicant_user_id);
CREATE POLICY "Business can update applications" ON public.job_applications FOR UPDATE USING (business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid()));

-- Child tables — applicants own their data
DO $$
BEGIN
   -- Employment History
   CREATE POLICY "Applicant owns employment history" ON public.applicant_employment_history FOR ALL USING (job_application_id IN (SELECT id FROM job_applications WHERE applicant_user_id = auth.uid())) WITH CHECK (job_application_id IN (SELECT id FROM job_applications WHERE applicant_user_id = auth.uid()));
   CREATE POLICY "Business can view employment history" ON public.applicant_employment_history FOR SELECT USING (job_application_id IN (SELECT id FROM job_applications WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())));

   -- Education, Certifications, Skills, References — same pattern
   CREATE POLICY "Applicant owns education" ON public.applicant_education FOR ALL USING (job_application_id IN (SELECT id FROM job_applications WHERE applicant_user_id = auth.uid())) WITH CHECK (job_application_id IN (SELECT id FROM job_applications WHERE applicant_user_id = auth.uid()));
   CREATE POLICY "Business can view education" ON public.applicant_education FOR SELECT USING (job_application_id IN (SELECT id FROM job_applications WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())));

   CREATE POLICY "Applicant owns certifications" ON public.applicant_certifications FOR ALL USING (job_application_id IN (SELECT id FROM job_applications WHERE applicant_user_id = auth.uid())) WITH CHECK (job_application_id IN (SELECT id FROM job_applications WHERE applicant_user_id = auth.uid()));
   CREATE POLICY "Business can view certifications" ON public.applicant_certifications FOR SELECT USING (job_application_id IN (SELECT id FROM job_applications WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())));

   CREATE POLICY "Applicant owns skills" ON public.applicant_skills FOR ALL USING (job_application_id IN (SELECT id FROM job_applications WHERE applicant_user_id = auth.uid())) WITH CHECK (job_application_id IN (SELECT id FROM job_applications WHERE applicant_user_id = auth.uid()));
   CREATE POLICY "Business can view skills" ON public.applicant_skills FOR SELECT USING (job_application_id IN (SELECT id FROM job_applications WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())));

   CREATE POLICY "Applicant owns references" ON public.applicant_references FOR ALL USING (job_application_id IN (SELECT id FROM job_applications WHERE applicant_user_id = auth.uid())) WITH CHECK (job_application_id IN (SELECT id FROM job_applications WHERE applicant_user_id = auth.uid()));
   CREATE POLICY "Business can view references" ON public.applicant_references FOR SELECT USING (job_application_id IN (SELECT id FROM job_applications WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())));

   -- Interviews & Offers — business manages, applicant can read/update limited fields
   CREATE POLICY "Applicant can view own interviews" ON public.interview_details FOR SELECT USING (job_application_id IN (SELECT id FROM job_applications WHERE applicant_user_id = auth.uid()));
   CREATE POLICY "Business manages interviews" ON public.interview_details FOR ALL USING (job_application_id IN (SELECT id FROM job_applications WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())));

   CREATE POLICY "Applicant can view own offers" ON public.job_offers FOR SELECT USING (auth.uid() = applicant_user_id);
   CREATE POLICY "Business manages offers" ON public.job_offers FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
   CREATE POLICY "Applicant can respond to offers" ON public.job_offers FOR UPDATE USING (auth.uid() = applicant_user_id);
END $$;
