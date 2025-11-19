-- Migration: Add service_data JSONB column to support service form data
-- This migration adds support for storing detailed service information 
-- from the services modal (e.g., ride-share, package, food, laundry, medical, documents)

-- ============================================================================
-- ADD SERVICE_DATA COLUMN TO RIDES TABLE
-- ============================================================================
ALTER TABLE rides ADD COLUMN IF NOT EXISTS service_data JSONB DEFAULT NULL;

-- Add comment to describe the column
COMMENT ON COLUMN rides.service_data IS 'Stores service-specific data from the services modal, including form field values, preferences, and requirements. Example: {"serviceId": "ride-share", "passengerCount": 2, "hasPets": false, "luggage": 1}';

-- ============================================================================
-- ADD SERVICE_DATA COLUMN TO RIDE_REQUESTS TABLE
-- ============================================================================
ALTER TABLE ride_requests ADD COLUMN IF NOT EXISTS service_data JSONB DEFAULT NULL;

-- Add comment to describe the column
COMMENT ON COLUMN ride_requests.service_data IS 'Stores service-specific data from the services modal for ride requests';

-- ============================================================================
-- CREATE INDEXES FOR SERVICE_DATA QUERIES
-- ============================================================================
-- Index for JSONB queries on rides.service_data
CREATE INDEX IF NOT EXISTS idx_rides_service_data ON rides USING gin (service_data);

-- Index for JSONB queries on ride_requests.service_data
CREATE INDEX IF NOT EXISTS idx_ride_requests_service_data ON ride_requests USING gin (service_data);

-- Composite index for service_id lookups
CREATE INDEX IF NOT EXISTS idx_rides_service_type ON rides((service_data->>'serviceId'));
CREATE INDEX IF NOT EXISTS idx_ride_requests_service_type ON ride_requests((service_data->>'serviceId'));

-- ============================================================================
-- CREATE VALIDATION FUNCTION FOR SERVICE DATA
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_service_data(
  p_service_id VARCHAR,
  p_service_data JSONB
) RETURNS TABLE (
  is_valid BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_passenger_count INTEGER;
  v_package_weight DECIMAL;
  v_document_count INTEGER;
BEGIN
  -- If no service data provided, it's valid
  IF p_service_data IS NULL THEN
    RETURN QUERY SELECT true, NULL::TEXT;
    RETURN;
  END IF;

  -- Validate ride-share service
  IF p_service_id = 'ride-share' THEN
    v_passenger_count := (p_service_data->>'passengerCount')::INTEGER;
    IF v_passenger_count IS NULL OR v_passenger_count < 1 OR v_passenger_count > 4 THEN
      RETURN QUERY SELECT false, 'Passenger count must be between 1 and 4'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Validate package service
  IF p_service_id = 'package' THEN
    v_package_weight := (p_service_data->>'weight')::DECIMAL;
    IF v_package_weight IS NULL OR v_package_weight <= 0 OR v_package_weight > 25 THEN
      RETURN QUERY SELECT false, 'Package weight must be between 0.1 and 25 kg'::TEXT;
      RETURN;
    END IF;
    
    IF (p_service_data->>'contents') IS NULL OR (p_service_data->>'contents')::TEXT = '' THEN
      RETURN QUERY SELECT false, 'Package contents must be specified'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Validate food service
  IF p_service_id = 'food' THEN
    IF (p_service_data->>'restaurantName') IS NULL OR (p_service_data->>'restaurantName')::TEXT = '' THEN
      RETURN QUERY SELECT false, 'Restaurant name is required'::TEXT;
      RETURN;
    END IF;
    
    IF (p_service_data->>'foodType') IS NULL OR (p_service_data->>'foodType')::TEXT = '' THEN
      RETURN QUERY SELECT false, 'Food type must be specified'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Validate medical service
  IF p_service_id = 'medical' THEN
    IF (p_service_data->>'prescriptionNumber') IS NULL OR (p_service_data->>'prescriptionNumber')::TEXT = '' THEN
      RETURN QUERY SELECT false, 'Prescription/order number is required'::TEXT;
      RETURN;
    END IF;
    
    IF (p_service_data->>'patientName') IS NULL OR (p_service_data->>'patientName')::TEXT = '' THEN
      RETURN QUERY SELECT false, 'Patient name is required'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Validate document service
  IF p_service_id = 'documents' THEN
    v_document_count := (p_service_data->>'documentCount')::INTEGER;
    IF v_document_count IS NULL OR v_document_count < 1 OR v_document_count > 50 THEN
      RETURN QUERY SELECT false, 'Document count must be between 1 and 50'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- If all validations pass
  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- CREATE TRIGGER TO AUTO-UPDATE UPDATED_AT ON SERVICE DATA CHANGES
-- ============================================================================
CREATE OR REPLACE FUNCTION update_rides_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rides_update_timestamp
BEFORE UPDATE ON rides
FOR EACH ROW
EXECUTE FUNCTION update_rides_timestamp();

CREATE TRIGGER ride_requests_update_timestamp
BEFORE UPDATE ON ride_requests
FOR EACH ROW
EXECUTE FUNCTION update_rides_timestamp();
