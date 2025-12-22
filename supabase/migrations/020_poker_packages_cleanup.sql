-- Simple poker chip packages migration
-- Safe PostgreSQL syntax only - no MySQL commands

-- Step 1: Delete bad packages
DELETE FROM poker_chip_packages WHERE chip_amount IS NULL OR chip_amount = 0;
DELETE FROM poker_chip_packages WHERE usd_price IS NULL OR usd_price < 0;
DELETE FROM poker_chip_packages WHERE name IS NULL OR name = '';

-- Step 2: Seed clean package data
INSERT INTO poker_chip_packages
  (name, chip_amount, bonus_chips, usd_price, is_first_purchase_special, is_most_popular, is_flash_sale, display_order)
VALUES
  ('280K Chips',              280000,      0,    4.99,  true,  false, false, 1),
  ('1M Chips Special',       1000000, 100000,    4.99,  true,  false, false, 2),
  ('560K Chips',              560000,      0,    9.99,  false, true,  false, 3),
  ('1.3M Chips Special',     1300000, 200000,   19.99,  false, false, false, 4),
  ('3M Chips',               3000000, 500000,   34.99,  false, false, false, 5),
  ('5M Chips',               5000000,1000000,   49.99,  false, false, false, 6),
  ('9M Chips',               9000000,2000000,   74.99,  false, false, false, 7),
  ('14M Chips',             14000000,5000000,   99.99,  false, false, false, 8),
  ('20M Chips - Flash Sale', 20000000,10000000, 149.99, false, false, true,  9)
ON CONFLICT DO NOTHING;

-- Step 3: Fix player_poker_chips NULL values
UPDATE player_poker_chips SET total_chips = 0 WHERE total_chips IS NULL;

-- Add missing columns if they don't exist
ALTER TABLE player_poker_chips ADD COLUMN IF NOT EXISTS lifetime_purchases bigint DEFAULT 0;
ALTER TABLE player_poker_chips ADD COLUMN IF NOT EXISTS total_winnings bigint DEFAULT 0;
ALTER TABLE player_poker_chips ADD COLUMN IF NOT EXISTS total_losses bigint DEFAULT 0;

-- Step 4: Add payment mapping columns to chip_purchases
ALTER TABLE chip_purchases ADD COLUMN IF NOT EXISTS order_id text;
ALTER TABLE chip_purchases ADD COLUMN IF NOT EXISTS payment_processor text;
ALTER TABLE chip_purchases ADD COLUMN IF NOT EXISTS payment_confirmation_id text;
ALTER TABLE chip_purchases ADD COLUMN IF NOT EXISTS payment_id uuid;

-- Add unique constraint on order_id if not exists
ALTER TABLE chip_purchases ADD CONSTRAINT IF NOT EXISTS unique_chip_purchase_order_id UNIQUE (order_id);

-- Step 5: Add index for performance
CREATE INDEX IF NOT EXISTS idx_poker_chip_packages_display_order ON poker_chip_packages(display_order);
CREATE INDEX IF NOT EXISTS idx_chip_purchases_order_id ON chip_purchases(order_id);
