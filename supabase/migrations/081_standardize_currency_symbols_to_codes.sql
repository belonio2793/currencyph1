-- ============================================================================
-- MIGRATION 081: Standardize all currency symbols to 3-letter codes
-- ============================================================================
-- This migration replaces special Unicode symbols with 3-letter currency codes
-- Examples: ₿ → BTC, Ð → DOGE, € → EUR, ¥ → JPY/CNY, etc.
-- ============================================================================

-- Update all currency symbols to use 3-letter codes
UPDATE public.currencies
SET symbol = code
WHERE symbol IN (
  '₿',   -- Bitcoin
  'Ð',   -- Dogecoin (old symbol)
  '€',   -- Euro
  '£',   -- British Pound
  '¥',   -- Japanese Yen / Chinese Yuan
  '₹',   -- Indian Rupee
  '฿',   -- Thai Baht
  '₫',   -- Vietnamese Dong
  '₩',   -- South Korean Won
  'د.إ', -- UAE Dirham
  'Ξ',   -- Ethereum
  'Ł',   -- Litecoin
  '₱'    -- Philippine Peso
);

-- Update special cases that are already 3-letter codes (no change needed)
-- '$' appears for multiple currencies, keep those
-- 'CHF', 'kr', 'Rp', 'R', 'R$' are already good or close to codes

-- Convert multi-character but non-code symbols
UPDATE public.currencies
SET symbol = CASE 
  WHEN code = 'AUD' THEN 'AUD'
  WHEN code = 'CAD' THEN 'CAD'
  WHEN code = 'NZD' THEN 'NZD'
  WHEN code = 'SGD' THEN 'SGD'
  WHEN code = 'HKD' THEN 'HKD'
  WHEN code = 'MXN' THEN 'MXN'
  WHEN code = 'BRL' THEN 'BRL'
  WHEN code = 'IDR' THEN 'IDR'
  WHEN code = 'MYR' THEN 'MYR'
  WHEN code = 'ZAR' THEN 'ZAR'
  WHEN code = 'AED' THEN 'AED'
  WHEN code = 'USD' THEN 'USD'
  WHEN code = 'EUR' THEN 'EUR'
  WHEN code = 'GBP' THEN 'GBP'
  WHEN code = 'JPY' THEN 'JPY'
  WHEN code = 'CNY' THEN 'CNY'
  WHEN code = 'INR' THEN 'INR'
  WHEN code = 'CHF' THEN 'CHF'
  WHEN code = 'SEK' THEN 'SEK'
  WHEN code = 'THB' THEN 'THB'
  WHEN code = 'VND' THEN 'VND'
  WHEN code = 'KRW' THEN 'KRW'
  WHEN code = 'NOK' THEN 'NOK'
  WHEN code = 'DKK' THEN 'DKK'
  WHEN code = 'PHP' THEN 'PHP'
  ELSE symbol
END
WHERE code IN (
  'AUD', 'CAD', 'NZD', 'SGD', 'HKD', 'MXN', 'BRL', 'IDR', 'MYR', 
  'ZAR', 'AED', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'CHF', 
  'SEK', 'THB', 'VND', 'KRW', 'NOK', 'DKK', 'PHP'
);

-- Verify the update worked
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.currencies
  WHERE symbol = code;
  
  RAISE NOTICE 'Currencies with symbol = code: %', v_count;
END
$$;

-- ============================================================================
-- END MIGRATION 081
-- ============================================================================
