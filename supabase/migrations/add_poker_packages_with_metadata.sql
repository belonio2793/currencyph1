-- This migration ensures poker_chip_packages table has all required metadata
-- and properly seeds it with well-formed data to prevent NaN issues

-- =========================================================
-- poker_chip_packages schema hardening
-- =========================================================

ALTER TABLE poker_chip_packages 
ADD COLUMN IF NOT EXISTS chip_amount bigint NOT NULL DEFAULT 0;

ALTER TABLE poker_chip_packages 
ADD COLUMN IF NOT EXISTS bonus_chips bigint NOT NULL DEFAULT 0;

ALTER TABLE poker_chip_packages 
ADD COLUMN IF NOT EXISTS usd_price numeric(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE poker_chip_packages 
ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Chip Package';

ALTER TABLE poker_chip_packages 
ADD COLUMN IF NOT EXISTS is_first_purchase_special boolean NOT NULL DEFAULT false;

ALTER TABLE poker_chip_packages 
ADD COLUMN IF NOT EXISTS is_most_popular boolean NOT NULL DEFAULT false;

ALTER TABLE poker_chip_packages 
ADD COLUMN IF NOT EXISTS is_flash_sale boolean NOT NULL DEFAULT false;

ALTER TABLE poker_chip_packages 
ADD COLUMN IF NOT EXISTS display_order int NOT NULL DEFAULT 999;

-- Ensure display_order index exists
CREATE INDEX IF NOT EXISTS idx_poker_chip_packages_display_order 
ON poker_chip_packages(display_order);

-- =========================================================
-- Data cleanup (remove broken / invalid rows)
-- =========================================================

DELETE FROM poker_chip_packages 
WHERE chip_amount <= 0
   OR usd_price IS NULL
   OR usd_price < 0
   OR name IS NULL
   OR name = '';

-- =========================================================
-- Seed canonical chip packages
-- =========================================================

INSERT INTO poker_chip_packages
  (
    name,
    chip_amount,
    bonus_chips,
    usd_price,
    is_first_purchase_special,
    is_most_popular,
    is_flash_sale,
    display_order
  )
VALUES
  ('280K Chips',              280000,   0,        4.99,  true,  false, false, 1),
  ('1M Chips Special',       1000000, 100000,     4.99,  true,  false, false, 2),
  ('560K Chips',              560000,   0,        9.99,  false, true,  false, 3),
  ('1.3M Chips Special',     1300000, 200000,    19.99,  false, false, false, 4),
  ('3M Chips',               3000000, 500000,    34.99,  false, false, false, 5),
  ('5M Chips',               5000000, 1000000,   49.99,  false, false, false, 6),
  ('9M Chips',               9000000, 2000000,   74.99,  false, false, false, 7),
  ('14M Chips',             14000000, 5000000,   99.99,  false, false, false, 8),
  ('20M Chips - Flash Sale', 20000000, 10000000, 149.99, false, false, true,  9)
ON CONFLICT DO NOTHING;

-- =========================================================
-- player_poker_chips hardening (POSTGRES FIX)
-- =========================================================

-- Backfill bad data
UPDATE player_poker_chips
SET total_chips = 0
WHERE total_chips IS NULL;

-- Correct PostgreSQL syntax (NOT MySQL)
ALTER TABLE player_poker_chips
ALTER COLUMN total_chips SET DEFAULT 0;

ALTER TABLE player_poker_chips
ALTER COLUMN total_chips SET NOT NULL;

-- Add metadata columns
ALTER TABLE player_poker_chips 
ADD COLUMN IF NOT EXISTS lifetime_purchases bigint NOT NULL DEFAULT 0;

ALTER TABLE player_poker_chips 
ADD COLUMN IF NOT EXISTS total_winnings bigint NOT NULL DEFAULT 0;

ALTER TABLE player_poker_chips 
ADD COLUMN IF NOT EXISTS total_losses bigint NOT NULL DEFAULT 0;

-- =========================================================
-- chip_purchases payment mapping
-- =========================================================

ALTER TABLE chip_purchases 
ADD COLUMN IF NOT EXISTS order_id text UNIQUE;

ALTER TABLE chip_purchases 
ADD COLUMN IF NOT EXISTS payment_processor text;

ALTER TABLE chip_purchases 
ADD COLUMN IF NOT EXISTS payment_confirmation_id text;

ALTER TABLE chip_purchases 
ADD COLUMN IF NOT EXISTS payment_id uuid;

-- =========================================================
-- Documentation / comments
-- =========================================================

COMMENT ON TABLE poker_chip_packages IS
'Predefined chip packages with strict defaults. All numeric columns are NOT NULL to prevent NaN rendering.';

COMMENT ON COLUMN poker_chip_packages.chip_amount IS
'Base chips in this package (>= 0, never NULL)';

COMMENT ON COLUMN poker_chip_packages.bonus_chips IS
'Bonus chips awarded (default 0, never NULL)';

COMMENT ON COLUMN poker_chip_packages.usd_price IS
'USD price for this package (>= 0, never NULL)';

COMMENT ON COLUMN player_poker_chips.lifetime_purchases IS
'Total chips purchased across all transactions';

COMMENT ON TABLE chip_purchases IS
'Chip purchase history with payment and processor mapping';
