-- Jobs Management System Schema
-- Comprehensive job posting, applications, ratings, and history system

-- Jobs Table: Main job postings
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  posted_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Job Details
  job_title VARCHAR(255) NOT NULL,
  job_category VARCHAR(100) NOT NULL, -- e.g., 'haircut', 'beauty', 'chef', 'personal_services', 'construction', etc.
  job_description TEXT NOT NULL,
  
  -- Job Type & Compensation
  job_type VARCHAR(50) NOT NULL, -- 'one_time', 'hourly', 'full_time', 'part_time', 'contract'
  pay_rate DECIMAL(12, 2),
  pay_currency VARCHAR(10) DEFAULT 'PHP',
  pay_type VARCHAR(50), -- 'fixed', 'negotiable', 'hourly_rate'
  
  -- Location & Details
  location VARCHAR(255),
  city VARCHAR(100),
  province VARCHAR(100),
  skills_required TEXT, -- JSON array of required skills
  experience_level VARCHAR(50), -- 'entry', 'intermediate', 'expert'
  
  -- Timeline
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  deadline_for_applications TIMESTAMP WITH TIME ZONE,
  
  -- Job Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'filled', 'closed', 'cancelled'
  positions_available INT DEFAULT 1,
  positions_filled INT DEFAULT 0,
  
  -- Visibility
  is_public BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_job_type CHECK (job_type IN ('one_time', 'hourly', 'full_time', 'part_time', 'contract')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'filled', 'closed', 'cancelled'))
);

-- Job Applications/Offers Table: Service providers offering for jobs
CREATE TABLE IF NOT EXISTS public.job_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  service_provider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  
  -- Provider Details
  provider_name VARCHAR(255),
  provider_email VARCHAR(255),
  provider_phone VARCHAR(20),
  provider_description TEXT,
  
  -- Offer Details
  offered_rate DECIMAL(12, 2),
  offer_message TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'completed', 'cancelled'
  accepted_date TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_offer_status CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled'))
);

-- Job Ratings Table: Rating system for completed jobs
CREATE TABLE IF NOT EXISTS public.job_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  job_offer_id UUID REFERENCES public.job_offers(id) ON DELETE CASCADE,
  rated_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rated_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Rating
  rating_score INT NOT NULL, -- 1-5 stars
  review_title VARCHAR(255),
  review_text TEXT,
  
  -- Tags/Categories
  rating_type VARCHAR(50), -- 'quality', 'professionalism', 'communication', 'reliability'
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_rating CHECK (rating_score >= 1 AND rating_score <= 5)
);

-- Job Remarks/Comments Table: Public and private remarks about jobs
CREATE TABLE IF NOT EXISTS public.job_remarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  job_offer_id UUID REFERENCES public.job_offers(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Remark Details
  remark_text TEXT NOT NULL,
  is_public BOOLEAN DEFAULT false, -- Public remarks visible to all, private only to business
  remark_type VARCHAR(50), -- 'feedback', 'note', 'issue', 'completion_note'
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job History Table: Track job completion and history
CREATE TABLE IF NOT EXISTS public.job_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  job_offer_id UUID REFERENCES public.job_offers(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  service_provider_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Completion Info
  completion_status VARCHAR(50) -- 'pending', 'in_progress', 'completed', 'cancelled'
  completion_date TIMESTAMP WITH TIME ZONE,
  completion_notes TEXT,
  
  -- Final Payment
  final_amount_paid DECIMAL(12, 2),
  payment_date TIMESTAMP WITH TIME ZONE,
  payment_method VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_jobs_business_id ON public.jobs(business_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_category ON public.jobs(job_category);
CREATE INDEX idx_jobs_created_at ON public.jobs(created_at DESC);
CREATE INDEX idx_jobs_posted_by ON public.jobs(posted_by_user_id);

CREATE INDEX idx_job_offers_job_id ON public.job_offers(job_id);
CREATE INDEX idx_job_offers_provider_id ON public.job_offers(service_provider_id);
CREATE INDEX idx_job_offers_status ON public.job_offers(status);
CREATE INDEX idx_job_offers_created_at ON public.job_offers(created_at DESC);

CREATE INDEX idx_job_ratings_job_id ON public.job_ratings(job_id);
CREATE INDEX idx_job_ratings_rated_user ON public.job_ratings(rated_user_id);
CREATE INDEX idx_job_ratings_rated_by ON public.job_ratings(rated_by_user_id);

CREATE INDEX idx_job_remarks_job_id ON public.job_remarks(job_id);
CREATE INDEX idx_job_remarks_is_public ON public.job_remarks(is_public);
CREATE INDEX idx_job_remarks_created_at ON public.job_remarks(created_at DESC);

CREATE INDEX idx_job_history_job_id ON public.job_history(job_id);
CREATE INDEX idx_job_history_business_id ON public.job_history(business_id);
CREATE INDEX idx_job_history_provider_id ON public.job_history(service_provider_id);

-- Row Level Security Policies
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_remarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_history ENABLE ROW LEVEL SECURITY;

-- Jobs RLS Policies
CREATE POLICY "Users can view public jobs" ON public.jobs
  FOR SELECT USING (is_public = true OR auth.uid() = posted_by_user_id);

CREATE POLICY "Business can manage their jobs" ON public.jobs
  FOR ALL USING (auth.uid() = posted_by_user_id);

-- Job Offers RLS Policies
CREATE POLICY "Users can view their own offers" ON public.job_offers
  FOR SELECT USING (auth.uid() = service_provider_id OR auth.uid() IN (
    SELECT posted_by_user_id FROM public.jobs WHERE id = job_id
  ));

CREATE POLICY "Service providers can create offers" ON public.job_offers
  FOR INSERT WITH CHECK (auth.uid() = service_provider_id);

CREATE POLICY "Job owner and provider can update offers" ON public.job_offers
  FOR UPDATE USING (auth.uid() = service_provider_id OR auth.uid() IN (
    SELECT posted_by_user_id FROM public.jobs WHERE id = job_id
  ));

-- Job Ratings RLS Policies
CREATE POLICY "Anyone can view ratings" ON public.job_ratings
  FOR SELECT USING (true);

CREATE POLICY "Users can create ratings" ON public.job_ratings
  FOR INSERT WITH CHECK (auth.uid() = rated_by_user_id);

-- Job Remarks RLS Policies
CREATE POLICY "Public remarks are visible to all" ON public.job_remarks
  FOR SELECT USING (is_public = true OR auth.uid() IN (
    SELECT posted_by_user_id FROM public.jobs WHERE id = job_id
  ) OR auth.uid() IN (
    SELECT service_provider_id FROM public.job_offers WHERE job_id = job_id
  ));

CREATE POLICY "Job owner can create remarks" ON public.job_remarks
  FOR INSERT WITH CHECK (auth.uid() = created_by_user_id);

-- Job History RLS Policies
CREATE POLICY "Users can view relevant history" ON public.job_history
  FOR SELECT USING (auth.uid() IN (
    SELECT posted_by_user_id FROM public.jobs WHERE id = job_id
  ) OR auth.uid() = service_provider_id);

CREATE POLICY "System can insert history" ON public.job_history
  FOR INSERT WITH CHECK (true);
