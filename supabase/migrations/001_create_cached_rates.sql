-- Create table to store cached exchange & crypto rates for the app
CREATE TABLE IF NOT EXISTS public.cached_rates (
  id bigserial PRIMARY KEY,
  exchange_rates jsonb,
  crypto_prices jsonb,
  fetched_at timestamptz DEFAULT now(),
  source text,
  created_at timestamptz DEFAULT now()
);

-- index for lookups by fetched_at
CREATE INDEX IF NOT EXISTS idx_cached_rates_fetched_at ON public.cached_rates (fetched_at DESC);
