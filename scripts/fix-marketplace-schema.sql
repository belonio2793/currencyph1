-- Fix marketplace schema migration
-- This ensures the item_type column exists and recreates views

-- Step 1: Add item_type column if it doesn't exist
ALTER TABLE IF EXISTS public.game_marketplace_listings
ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'item';

-- Step 2: Drop and recreate the view that references item_type
DROP VIEW IF EXISTS public.active_marketplace_listings CASCADE;

-- Step 3: Recreate the view
CREATE OR REPLACE VIEW public.active_marketplace_listings AS
SELECT 
  ml.id,
  ml.seller_id,
  gc.name as seller_name,
  gc.level as seller_level,
  ml.item_type,
  ml.description,
  ml.ask_price,
  ml.created_at,
  (SELECT COUNT(*) FROM public.game_trade_offers WHERE listing_id = ml.id AND status = 'pending') as pending_offers
FROM public.game_marketplace_listings ml
JOIN public.game_characters gc ON ml.seller_id = gc.id
WHERE ml.status = 'active'
ORDER BY ml.created_at DESC;

-- Step 4: Drop and recreate player_trade_stats view
DROP VIEW IF EXISTS public.player_trade_stats CASCADE;

CREATE OR REPLACE VIEW public.player_trade_stats AS
SELECT 
  player_id,
  COUNT(*) as total_trades,
  AVG(COALESCE(rating, 0)) as avg_rating,
  SUM(COALESCE(amount, 0)) as total_volume
FROM (
  SELECT buyer_id as player_id, buyer_rating as rating, price_paid as amount FROM public.game_trades_completed
  UNION ALL
  SELECT seller_id as player_id, seller_rating as rating, price_paid as amount FROM public.game_trades_completed
) trades
GROUP BY player_id;

-- Verify the column exists
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'game_marketplace_listings' AND column_name = 'item_type';
