-- Add missing columns to poker_chip_packages table
ALTER TABLE poker_chip_packages ADD COLUMN IF NOT EXISTS is_most_popular boolean DEFAULT false;
ALTER TABLE poker_chip_packages ADD COLUMN IF NOT EXISTS is_flash_sale boolean DEFAULT false;
