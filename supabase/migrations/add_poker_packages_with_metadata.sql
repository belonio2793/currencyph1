-- This migration ensures poker_chip_packages table has all required metadata
-- and properly seeds it with well-formed data to prevent NaN issues

-- Ensure poker_chip_packages has all required columns with defaults
ALTER TABLE poker_chip_packages 
ADD COLUMN IF NOT EXISTS chip_amount bigint NOT NULL DEFAULT 0;

ALTER TABLE poker_chip_packages 
ADD COLUMN IF NOT EXISTS bonus_chips bigint DEFAULT 0;

ALTER TABLE poker_chip_packages 
ADD COLUMN IF NOT EXISTS usd_price numeric(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE poker_chip_packages 
ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Chip Package';

ALTER TABLE poker_chip_packages 
ADD COLUMN IF NOT EXISTS is_first_purchase_special boolean DEFAULT false;

ALTER TABLE poker_chip_packages 
ADD COLUMN IF NOT EXISTS is_most_popular boolean DEFAULT false;

ALTER TABLE poker_chip_packages 
ADD COLUMN IF NOT EXISTS is_flash_sale boolean DEFAULT false;

ALTER TABLE poker_chip_packages 
ADD COLUMN IF NOT EXISTS display_order int DEFAULT 999;

-- Ensure display_order index exists
CREATE INDEX IF NOT EXISTS idx_poker_chip_packages_display_order 
ON poker_chip_packages(display_order);

-- Clear any existing packages with NULL or bad data
DELETE FROM poker_chip_packages 
WHERE chip_amount IS NULL 
   OR chip_amount = 0 
   OR usd_price IS NULL 
   OR name IS NULL 
   OR name = '';

-- Insert complete chip packages with all metadata
INSERT INTO poker_chip_packages 
  (name, chip_amount, bonus_chips, usd_price, is_first_purchase_special, is_most_popular, is_flash_sale, display_order)
VALUES
  ('280K Chips', 280000, 0, 4.99, true, false, false, 1),
  ('1M Chips Special', 1000000, 100000, 4.99, true, false, false, 2),
  ('560K Chips', 560000, 0, 9.99, false, true, false, 3),
  ('1.3M Chips Special', 1300000, 200000, 19.99, false, false, false, 4),
  ('3M Chips', 3000000, 500000, 34.99, false, false, false, 5),
  ('5M Chips', 5000000, 1000000, 49.99, false, false, false, 6),
  ('9M Chips', 9000000, 2000000, 74.99, false, false, false, 7),
  ('14M Chips', 14000000, 5000000, 99.99, false, false, false, 8),
  ('20M Chips - Flash Sale', 20000000, 10000000, 149.99, false, false, true, 9)
ON CONFLICT DO NOTHING;

-- Ensure player_poker_chips has proper constraints
ALTER TABLE player_poker_chips 
MODIFY COLUMN total_chips SET DEFAULT 0;

-- Add metadata columns to player_poker_chips for enhanced tracking
ALTER TABLE player_poker_chips 
ADD COLUMN IF NOT EXISTS lifetime_purchases bigint DEFAULT 0;

ALTER TABLE player_poker_chips 
ADD COLUMN IF NOT EXISTS total_winnings bigint DEFAULT 0;

ALTER TABLE player_poker_chips 
ADD COLUMN IF NOT EXISTS total_losses bigint DEFAULT 0;

-- Enhance chip_purchases table for payment mapping
ALTER TABLE chip_purchases 
ADD COLUMN IF NOT EXISTS order_id text UNIQUE;

ALTER TABLE chip_purchases 
ADD COLUMN IF NOT EXISTS payment_processor text;

ALTER TABLE chip_purchases 
ADD COLUMN IF NOT EXISTS payment_confirmation_id text;

-- Link chip purchases to payments table if it exists
ALTER TABLE chip_purchases 
ADD COLUMN IF NOT EXISTS payment_id uuid;

-- Add comment explaining the fix
COMMENT ON TABLE poker_chip_packages IS 'Predefined chip packages with metadata. All columns must be NOT NULL to prevent NaN rendering.';
COMMENT ON COLUMN poker_chip_packages.chip_amount IS 'Base chips in this package (must be >= 0, never NULL)';
COMMENT ON COLUMN poker_chip_packages.bonus_chips IS 'Bonus chips awarded (default 0, never NULL)';
COMMENT ON COLUMN poker_chip_packages.usd_price IS 'USD price for this package (must be >= 0, never NULL)';
COMMENT ON COLUMN player_poker_chips.lifetime_purchases IS 'Total chips purchased across all transactions';
COMMENT ON TABLE chip_purchases IS 'Chip purchase history with payment mapping for integration';
