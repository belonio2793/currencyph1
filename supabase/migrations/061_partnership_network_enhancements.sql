-- Migration: 061 - Partnership Network Enhancements
-- Adds public_name and display_publicly fields to support public partnership directory
-- IDEMPOTENT: Safe to run multiple times

-- ============================================================================
-- ADD COLUMNS TO COMMITMENT_PROFILES
-- ============================================================================
ALTER TABLE IF EXISTS public.commitment_profiles
ADD COLUMN IF NOT EXISTS public_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS display_publicly BOOLEAN DEFAULT TRUE;

-- Create index for querying public partnerships
CREATE INDEX IF NOT EXISTS idx_commitment_profiles_display_publicly 
ON public.commitment_profiles(display_publicly) 
WHERE display_publicly = TRUE;

-- Create index for public name searches
CREATE INDEX IF NOT EXISTS idx_commitment_profiles_public_name 
ON public.commitment_profiles(public_name) 
WHERE display_publicly = TRUE;
