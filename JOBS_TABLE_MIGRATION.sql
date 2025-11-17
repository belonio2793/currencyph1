-- SQL Migration for Jobs Table Enhancement
-- This migration adds support for dual posting types (service_offer and service_request)
-- and implements soft delete for reputation tracking

-- Add posting_type column if it doesn't exist
-- Values: 'service_offer' (for service providers) or 'service_request' (for businesses looking to hire)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS posting_type VARCHAR(50) DEFAULT 'service_offer';

-- Add deleted_at column for soft delete support
-- Tracks when a job was deleted (soft delete)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add public_notes column for reputation/feedback
-- Users can add public notes about their business or job request
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS public_notes TEXT DEFAULT NULL;

-- Add budget_min and budget_max for service requests (Looking To Hire)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS budget_min DECIMAL(10, 2) DEFAULT NULL;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS budget_max DECIMAL(10, 2) DEFAULT NULL;

-- Add timeline column for service requests
-- Values: 'flexible', 'urgent' (1-2 days), 'soon' (1-2 weeks), 'ongoing'
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS timeline VARCHAR(50) DEFAULT 'flexible';

-- Create index on posting_type for efficient filtering
CREATE INDEX IF NOT EXISTS idx_jobs_posting_type ON jobs(posting_type);

-- Create index on deleted_at for soft delete queries
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON jobs(deleted_at);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_jobs_active_listing ON jobs(status, is_public, deleted_at, posting_type, created_at DESC);

-- Create a table to track job completion history and reputation
CREATE TABLE IF NOT EXISTS job_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  service_provider_id UUID NOT NULL,
  service_provider_name VARCHAR(255),
  completion_status VARCHAR(50), -- 'completed', 'cancelled', 'dispute'
  completion_date TIMESTAMP WITH TIME ZONE,
  final_amount_paid DECIMAL(10, 2),
  notes TEXT, -- Private completion notes
  public_feedback TEXT, -- Public feedback/reputation note
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for history lookups
CREATE INDEX IF NOT EXISTS idx_job_history_user_id ON job_history(user_id);
CREATE INDEX IF NOT EXISTS idx_job_history_job_id ON job_history(job_id);

-- Update existing jobs to have a default posting_type
UPDATE jobs SET posting_type = 'service_offer' WHERE posting_type IS NULL;

-- Make posting_type non-nullable after data is set
ALTER TABLE jobs ALTER COLUMN posting_type SET NOT NULL;

-- Add a constraint to ensure valid posting_type values
ALTER TABLE jobs ADD CONSTRAINT check_posting_type CHECK (posting_type IN ('service_offer', 'service_request'));

-- Create a view for active service offers (jobs by service providers)
CREATE OR REPLACE VIEW active_service_offers AS
SELECT * FROM jobs
WHERE posting_type = 'service_offer'
  AND status = 'active'
  AND is_public = true
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- Create a view for active service requests (hiring requests by businesses)
CREATE OR REPLACE VIEW active_service_requests AS
SELECT * FROM jobs
WHERE posting_type = 'service_request'
  AND status = 'active'
  AND is_public = true
  AND deleted_at IS NULL
ORDER BY created_at DESC;
