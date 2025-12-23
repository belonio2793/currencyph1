-- Migration: 060 - Create Commitments System
-- Creates tables for tracking user commitments, pledges, and partnership contributions
-- IDEMPOTENT: Safe to run multiple times

-- ============================================================================
-- COMMITMENT PROFILES TABLE
-- ============================================================================
-- Stores user profile information for commitments (name, contact, business type)
CREATE TABLE IF NOT EXISTS public.commitment_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  planning_user_id UUID REFERENCES public.planning_users(id) ON DELETE SET NULL,
  business_name VARCHAR(255),
  business_type VARCHAR(100), -- 'farmer', 'vendor', 'wholesaler', 'retailer', 'processor', 'exporter', 'service_provider', 'equipment_supplier', 'logistics', 'other'
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone_number VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  province VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Philippines',
  bio TEXT,
  profile_completed BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commitment_profiles_user_id ON public.commitment_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_commitment_profiles_business_type ON public.commitment_profiles(business_type);
CREATE INDEX IF NOT EXISTS idx_commitment_profiles_created_at ON public.commitment_profiles(created_at);

-- ============================================================================
-- COMMITMENTS TABLE
-- ============================================================================
-- Stores individual commitments/pledges from users
CREATE TABLE IF NOT EXISTS public.commitments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  commitment_profile_id UUID NOT NULL REFERENCES public.commitment_profiles(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed', 'cancelled'
  
  -- Commitment Details
  item_type VARCHAR(100), -- 'coconut', 'equipment', 'machinery', 'warehouse_space', 'labour', 'water', 'processing', 'transportation', 'retail_space', 'other'
  item_description VARCHAR(500),
  
  -- Quantity and Schedule
  quantity DECIMAL(15, 4) NOT NULL,
  quantity_unit VARCHAR(50), -- 'pieces', 'tons', 'liters', 'kg', 'hours', 'sq_meters', 'units', 'other'
  scheduled_interval VARCHAR(50), -- 'daily', 'weekly', 'bi-weekly', 'monthly', 'quarterly', 'annual', 'as-needed', 'one-time'
  interval_count INT DEFAULT 1, -- how many intervals (e.g., for 3 months: interval='monthly', interval_count=3)
  
  -- Pricing
  unit_price DECIMAL(15, 2),
  currency VARCHAR(3) DEFAULT 'PHP',
  total_committed_value DECIMAL(15, 2), -- calculated: quantity * unit_price * interval_count
  
  -- Requirements
  requires_delivery BOOLEAN DEFAULT FALSE,
  estimated_delivery_cost DECIMAL(15, 2),
  
  requires_handling BOOLEAN DEFAULT FALSE,
  estimated_handling_cost DECIMAL(15, 2),
  
  requires_shipping BOOLEAN DEFAULT FALSE,
  estimated_shipping_cost DECIMAL(15, 2),
  
  total_additional_costs DECIMAL(15, 2), -- sum of delivery + handling + shipping
  grand_total DECIMAL(15, 2), -- total_committed_value + total_additional_costs
  
  -- Partnership & Commission
  commission_percentage DECIMAL(5, 2) DEFAULT 50.00, -- default 50% for affiliates
  affiliate_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  affiliate_commission_amount DECIMAL(15, 2),
  
  -- Notes and Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_commitments_user_id ON public.commitments(user_id);
CREATE INDEX IF NOT EXISTS idx_commitments_profile_id ON public.commitments(commitment_profile_id);
CREATE INDEX IF NOT EXISTS idx_commitments_status ON public.commitments(status);
CREATE INDEX IF NOT EXISTS idx_commitments_item_type ON public.commitments(item_type);
CREATE INDEX IF NOT EXISTS idx_commitments_affiliate_user_id ON public.commitments(affiliate_user_id);
CREATE INDEX IF NOT EXISTS idx_commitments_created_at ON public.commitments(created_at);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.commitment_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMMITMENT PROFILES RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view all commitment profiles" ON public.commitment_profiles;
DROP POLICY IF EXISTS "Users can create own commitment profile" ON public.commitment_profiles;
DROP POLICY IF EXISTS "Users can update own commitment profile" ON public.commitment_profiles;
DROP POLICY IF EXISTS "Users can delete own commitment profile" ON public.commitment_profiles;

CREATE POLICY "Users can view all commitment profiles" ON public.commitment_profiles
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can create own commitment profile" ON public.commitment_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own commitment profile" ON public.commitment_profiles
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own commitment profile" ON public.commitment_profiles
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- COMMITMENTS RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view all commitments" ON public.commitments;
DROP POLICY IF EXISTS "Users can create own commitments" ON public.commitments;
DROP POLICY IF EXISTS "Users can update own commitments" ON public.commitments;
DROP POLICY IF EXISTS "Users can delete own commitments" ON public.commitments;

CREATE POLICY "Users can view all commitments" ON public.commitments
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can create own commitments" ON public.commitments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own commitments" ON public.commitments
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own commitments" ON public.commitments
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- UPDATE TIMESTAMP FUNCTIONS AND TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_commitment_profiles_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_commitments_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commitment_profiles_timestamp_trigger ON public.commitment_profiles;
DROP TRIGGER IF EXISTS commitments_timestamp_trigger ON public.commitments;

CREATE TRIGGER commitment_profiles_timestamp_trigger
  BEFORE UPDATE ON public.commitment_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_commitment_profiles_timestamp();

CREATE TRIGGER commitments_timestamp_trigger
  BEFORE UPDATE ON public.commitments
  FOR EACH ROW
  EXECUTE FUNCTION update_commitments_timestamp();

-- ============================================================================
-- AUTO-CALCULATION FUNCTION FOR COMMITMENT TOTALS
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_commitment_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total committed value
  NEW.total_committed_value := COALESCE(NEW.quantity * NEW.unit_price * NEW.interval_count, 0);
  
  -- Calculate total additional costs
  NEW.total_additional_costs := COALESCE(NEW.estimated_delivery_cost, 0) + 
                               COALESCE(NEW.estimated_handling_cost, 0) + 
                               COALESCE(NEW.estimated_shipping_cost, 0);
  
  -- Calculate grand total
  NEW.grand_total := COALESCE(NEW.total_committed_value, 0) + NEW.total_additional_costs;
  
  -- Calculate affiliate commission
  IF NEW.affiliate_user_id IS NOT NULL THEN
    NEW.affiliate_commission_amount := (NEW.grand_total * COALESCE(NEW.commission_percentage, 50)) / 100;
  ELSE
    NEW.affiliate_commission_amount := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_commitment_totals_trigger ON public.commitments;

CREATE TRIGGER calculate_commitment_totals_trigger
  BEFORE INSERT OR UPDATE ON public.commitments
  FOR EACH ROW
  EXECUTE FUNCTION calculate_commitment_totals();
