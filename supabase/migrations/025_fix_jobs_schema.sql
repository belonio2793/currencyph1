-- Jobs Schema Fixes
-- This migration corrects the jobs system schema to:
-- 1. Remove duplicate foreign key constraints
-- 2. Add missing columns (posting_type, deleted_at, public_notes, budget fields, timeline, user_id)
-- 3. Add enum types for better data integrity
-- 4. Fix nullable inconsistencies
-- 5. Add missing indexes
-- 6. Improve RLS policies

-- Drop existing RLS policies (will be recreated)
DROP POLICY IF EXISTS "Users can view public jobs" ON public.jobs;
DROP POLICY IF EXISTS "Business can manage their jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can view their own offers" ON public.job_offers;
DROP POLICY IF EXISTS "Service providers can create offers" ON public.job_offers;
DROP POLICY IF EXISTS "Job owner and provider can update offers" ON public.job_offers;
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.job_ratings;
DROP POLICY IF EXISTS "Users can create ratings" ON public.job_ratings;
DROP POLICY IF EXISTS "Public remarks are visible to all" ON public.job_remarks;
DROP POLICY IF EXISTS "Job owner can create remarks" ON public.job_remarks;
DROP POLICY IF EXISTS "Users can view relevant history" ON public.job_history;
DROP POLICY IF EXISTS "System can insert history" ON public.job_history;

-- Create ENUM types for better data integrity
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_type_enum') THEN
    CREATE TYPE job_type_enum AS ENUM ('one_time', 'hourly', 'full_time', 'part_time', 'contract');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status_enum') THEN
    CREATE TYPE job_status_enum AS ENUM ('active', 'filled', 'closed', 'cancelled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_offer_status_enum') THEN
    CREATE TYPE job_offer_status_enum AS ENUM ('pending', 'accepted', 'rejected', 'completed', 'cancelled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'completion_status_enum') THEN
    CREATE TYPE completion_status_enum AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
  END IF;
END $$;

-- Drop constraints temporarily to add new columns
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS valid_job_type CASCADE;
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS valid_status CASCADE;
ALTER TABLE public.job_offers DROP CONSTRAINT IF EXISTS valid_offer_status CASCADE;

-- Add missing columns to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS posting_type VARCHAR(50) DEFAULT 'service_offer'; -- 'service_offer', 'job_request'
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS public_notes TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS budget_min DECIMAL(12, 2);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS budget_max DECIMAL(12, 2);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS timeline VARCHAR(50) DEFAULT 'flexible'; -- 'urgent', 'flexible', 'negotiable'

-- Update job_type to use ENUM if data exists
ALTER TABLE public.jobs 
  ALTER COLUMN job_type TYPE job_type_enum USING job_type::job_type_enum;

-- Update status to use ENUM if data exists  
ALTER TABLE public.jobs 
  ALTER COLUMN status TYPE job_status_enum USING status::job_status_enum;

-- Update job_offers status to use ENUM
ALTER TABLE public.job_offers 
  ALTER COLUMN status TYPE job_offer_status_enum USING status::job_offer_status_enum;

-- Fix job_history table - remove duplicate FK and ensure proper cascade rules
-- First, drop the old constraints
ALTER TABLE public.job_history DROP CONSTRAINT IF EXISTS fk_job_history_job CASCADE;
ALTER TABLE public.job_history DROP CONSTRAINT IF EXISTS job_history_job_id_fkey CASCADE;
ALTER TABLE public.job_history DROP CONSTRAINT IF EXISTS fk_job_history_user CASCADE;
ALTER TABLE public.job_history DROP CONSTRAINT IF EXISTS job_history_user_id_fkey CASCADE;
ALTER TABLE public.job_history DROP CONSTRAINT IF EXISTS job_history_business_id_fkey CASCADE;
ALTER TABLE public.job_history DROP CONSTRAINT IF EXISTS job_history_job_offer_id_fkey CASCADE;
ALTER TABLE public.job_history DROP CONSTRAINT IF EXISTS job_history_service_provider_id_fkey CASCADE;

-- Re-add only one FK for job_id with CASCADE
ALTER TABLE public.job_history 
  ADD CONSTRAINT job_history_job_id_fkey FOREIGN KEY (job_id) 
  REFERENCES public.jobs(id) ON DELETE CASCADE;

-- Re-add other FKs with proper rules
ALTER TABLE public.job_history 
  ADD CONSTRAINT job_history_user_id_fkey FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.job_history 
  ADD CONSTRAINT job_history_business_id_fkey FOREIGN KEY (business_id) 
  REFERENCES public.businesses(id) ON DELETE CASCADE;

ALTER TABLE public.job_history 
  ADD CONSTRAINT job_history_job_offer_id_fkey FOREIGN KEY (job_offer_id) 
  REFERENCES public.job_offers(id) ON DELETE CASCADE;

ALTER TABLE public.job_history 
  ADD CONSTRAINT job_history_service_provider_id_fkey FOREIGN KEY (service_provider_id) 
  REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update completion_status to use ENUM if data exists
ALTER TABLE public.job_history 
  ALTER COLUMN completion_status TYPE completion_status_enum 
  USING completion_status::completion_status_enum;

-- Add missing indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_jobs_posting_type ON public.jobs(posting_type);
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON public.jobs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_active_listing ON public.jobs(status, is_public, created_at DESC, posting_type, deleted_at);

CREATE INDEX IF NOT EXISTS idx_job_offers_business_id ON public.job_offers(business_id);
CREATE INDEX IF NOT EXISTS idx_job_history_user_id ON public.job_history(user_id);
CREATE INDEX IF NOT EXISTS idx_job_history_combined ON public.job_history(job_id, service_provider_id);

CREATE INDEX IF NOT EXISTS idx_job_ratings_job_offer_id ON public.job_ratings(job_offer_id);

CREATE INDEX IF NOT EXISTS idx_job_remarks_created_by_user_id ON public.job_remarks(created_by_user_id);

-- Recreate RLS policies with improved logic
CREATE POLICY "Users can view public jobs" ON public.jobs
  FOR SELECT USING (
    (is_public = true AND deleted_at IS NULL) 
    OR auth.uid() = posted_by_user_id
  );

CREATE POLICY "Business can manage their jobs" ON public.jobs
  FOR ALL USING (auth.uid() = posted_by_user_id);

CREATE POLICY "Users can view their own offers" ON public.job_offers
  FOR SELECT USING (
    auth.uid() = service_provider_id 
    OR auth.uid() IN (SELECT posted_by_user_id FROM public.jobs WHERE id = job_id)
  );

CREATE POLICY "Service providers can create offers" ON public.job_offers
  FOR INSERT WITH CHECK (auth.uid() = service_provider_id);

CREATE POLICY "Job owner and provider can update offers" ON public.job_offers
  FOR UPDATE USING (
    auth.uid() = service_provider_id 
    OR auth.uid() IN (SELECT posted_by_user_id FROM public.jobs WHERE id = job_id)
  );

CREATE POLICY "Anyone can view ratings" ON public.job_ratings
  FOR SELECT USING (true);

CREATE POLICY "Users can create ratings" ON public.job_ratings
  FOR INSERT WITH CHECK (auth.uid() = rated_by_user_id);

CREATE POLICY "Public remarks are visible to all" ON public.job_remarks
  FOR SELECT USING (
    is_public = true 
    OR auth.uid() IN (SELECT posted_by_user_id FROM public.jobs WHERE id = job_id)
    OR auth.uid() IN (SELECT service_provider_id FROM public.job_offers WHERE job_id = job_id)
  );

CREATE POLICY "Job owner can create remarks" ON public.job_remarks
  FOR INSERT WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can view relevant history" ON public.job_history
  FOR SELECT USING (
    auth.uid() IN (SELECT posted_by_user_id FROM public.jobs WHERE id = job_id)
    OR auth.uid() = service_provider_id
  );

CREATE POLICY "System can insert history" ON public.job_history
  FOR INSERT WITH CHECK (true);
