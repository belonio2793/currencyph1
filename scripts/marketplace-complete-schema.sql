-- Complete marketplace schema migration
-- Player marketplace listings for trading
CREATE TABLE IF NOT EXISTS public.game_marketplace_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID NOT NULL,
  item_type TEXT NOT NULL,
  description TEXT NOT NULL,
  ask_price NUMERIC NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_seller FOREIGN KEY (seller_id) REFERENCES public.game_characters(id) ON DELETE CASCADE
);

-- Trade negotiations/offers
CREATE TABLE IF NOT EXISTS public.game_trade_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  offered_price NUMERIC NOT NULL,
  offered_items JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_listing FOREIGN KEY (listing_id) REFERENCES public.game_marketplace_listings(id) ON DELETE CASCADE,
  CONSTRAINT fk_buyer FOREIGN KEY (buyer_id) REFERENCES public.game_characters(id) ON DELETE CASCADE,
  CONSTRAINT fk_seller FOREIGN KEY (seller_id) REFERENCES public.game_characters(id) ON DELETE CASCADE
);

-- Completed trades/transaction history
CREATE TABLE IF NOT EXISTS public.game_trades_completed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  item_type TEXT,
  description TEXT,
  price_paid NUMERIC,
  buyer_rating INT,
  seller_rating INT,
  completed_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_buyer FOREIGN KEY (buyer_id) REFERENCES public.game_characters(id) ON DELETE CASCADE,
  CONSTRAINT fk_seller FOREIGN KEY (seller_id) REFERENCES public.game_characters(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_seller ON public.game_marketplace_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_status ON public.game_marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_created ON public.game_marketplace_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_offers_listing ON public.game_trade_offers(listing_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_buyer ON public.game_trade_offers(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_status ON public.game_trade_offers(status);
CREATE INDEX IF NOT EXISTS idx_trades_completed_buyer ON public.game_trades_completed(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_completed_seller ON public.game_trades_completed(seller_id);

-- Trigger for updated_at on marketplace_listings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'game_listings_set_updated_at') THEN
    CREATE TRIGGER game_listings_set_updated_at
    BEFORE UPDATE ON public.game_marketplace_listings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_column();
  END IF;
END$$;

-- Trigger for updated_at on trade_offers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'game_offers_set_updated_at') THEN
    CREATE TRIGGER game_offers_set_updated_at
    BEFORE UPDATE ON public.game_trade_offers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_column();
  END IF;
END$$;

-- View: Active listings with seller info
DROP VIEW IF EXISTS public.active_marketplace_listings CASCADE;
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

-- View: Player trade history and ratings
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
