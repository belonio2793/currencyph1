-- Migration: Add missing vehicle details columns to ride_profiles
-- This migration adds the columns needed for storing detailed vehicle information

-- ============================================================================
-- ADD MISSING VEHICLE COLUMNS TO ride_profiles TABLE
-- ============================================================================

-- Add vehicle_make_model column for storing make and model (e.g., "Toyota Corolla")
ALTER TABLE ride_profiles
ADD COLUMN IF NOT EXISTS vehicle_make_model VARCHAR(100);

-- Add vehicle_year column for storing the year of manufacture
ALTER TABLE ride_profiles
ADD COLUMN IF NOT EXISTS vehicle_year INT;

-- Add vehicle_fuel_type column for storing fuel type (e.g., gasoline, diesel, electric, hybrid, lpg)
ALTER TABLE ride_profiles
ADD COLUMN IF NOT EXISTS vehicle_fuel_type VARCHAR(50);

-- Add vehicle_mileage column for storing vehicle mileage in kilometers
ALTER TABLE ride_profiles
ADD COLUMN IF NOT EXISTS vehicle_mileage INT;

-- ============================================================================
-- ADD INDEXES FOR BETTER QUERY PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ride_profiles_vehicle_type ON ride_profiles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_ride_profiles_fuel_type ON ride_profiles(vehicle_fuel_type);
