/**
 * MIGRATION 0207: Backfill Deposits with Correct Exchange Rates
 * 
 * PROBLEM: All deposits created while hardcoded rates were in database
 * now have incorrect exchange_rate values stored.
 * 
 * Example:
 *   - Deposit: 999 PHP → BTC
 *   - Stored rate: 1 PHP = 0.0000004 BTC (from hardcoded 2,500,000)
 *   - Correct rate: 1 PHP = 0.0000001931 BTC (real market)
 *   - Received amount will be wrong
 * 
 * SOLUTION: Query current rates from public.pairs and recalculate
 * converted_amount for all deposits that used the wrong rate.
 * 
 * NOTE: This only works if fetch-rates has populated public.pairs
 * with fresh, correct rates. Run migration 0206 first.
 */

BEGIN;

-- ============================================================================
-- STEP 1: Audit current state - show deposits with likely wrong rates
-- ============================================================================
CREATE TEMP TABLE deposits_with_wrong_rates AS
SELECT 
  d.id,
  d.user_id,
  d.currency_code,
  d.amount,
  d.exchange_rate,
  d.converted_amount,
  d.created_at,
  p.rate as current_pair_rate,
  CASE 
    WHEN d.currency_code = 'PHP' THEN d.amount
    ELSE d.amount * p.rate
  END as correct_converted_amount,
  (d.converted_amount - (CASE 
    WHEN d.currency_code = 'PHP' THEN d.amount
    ELSE d.amount * p.rate
  END)) as difference
FROM deposits d
LEFT JOIN pairs p 
  ON p.from_currency = d.currency_code 
  AND p.to_currency = 'PHP'
WHERE d.status IN ('pending', 'approved', 'completed')
  AND d.currency_code != 'PHP'
  AND p.rate IS NOT NULL
  AND p.rate > 0
ORDER BY d.created_at DESC;

-- ============================================================================
-- STEP 2: Show diagnostic - how many deposits are affected
-- ============================================================================
DO $$
DECLARE
  affected_count int;
  total_amount_error numeric;
  sample_record record;
BEGIN
  SELECT COUNT(*) INTO affected_count FROM deposits_with_wrong_rates WHERE difference != 0;
  
  SELECT SUM(ABS(difference)) INTO total_amount_error FROM deposits_with_wrong_rates WHERE difference != 0;
  
  SELECT * INTO sample_record FROM deposits_with_wrong_rates 
  WHERE difference != 0 
  LIMIT 1;
  
  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════╗
║  MIGRATION 0207 - BACKFILL DEPOSITS WITH CORRECT RATES         ║
╠════════════════════════════════════════════════════════════════╣
║ DIAGNOSTIC RESULTS:                                            ║
║   Deposits with incorrect rates: %                             ║
║   Total conversion error: % PHP                                ║
║                                                                ║
║ SAMPLE INCORRECT DEPOSIT:                                      ║
║   Deposit ID: %                                                ║
║   Amount: % %                                                 ║
║   Stored rate: %                                               ║
║   Current correct rate: %                                      ║
║   Stored received: % PHP                                      ║
║   Correct received: % PHP                                     ║
║   Difference: % PHP                                           ║
║                                                                ║
║ ACTION: Will update all deposits to use correct rates          ║
╚════════════════════════════════════════════════════════════════╝
  ',
  affected_count,
  ROUND(COALESCE(total_amount_error, 0)::numeric, 2),
  sample_record.id,
  sample_record.amount,
  sample_record.currency_code,
  ROUND(sample_record.exchange_rate::numeric, 10),
  ROUND(sample_record.current_pair_rate::numeric, 10),
  ROUND(sample_record.converted_amount::numeric, 2),
  ROUND(sample_record.correct_converted_amount::numeric, 2),
  ROUND(sample_record.difference::numeric, 2);
END $$;

-- ============================================================================
-- STEP 3: Update deposits with correct exchange rates
-- ============================================================================
UPDATE deposits d
SET 
  exchange_rate = p.rate,
  converted_amount = CASE 
    WHEN d.currency_code = 'PHP' THEN d.amount
    ELSE d.amount * p.rate
  END,
  metadata = jsonb_set(
    COALESCE(d.metadata, '{}'::jsonb),
    '{rate_corrected}',
    jsonb_build_object(
      'corrected_at', NOW()::text,
      'migration', '0207',
      'old_rate', d.exchange_rate::text,
      'new_rate', p.rate::text,
      'reason', 'Corrected from hardcoded fallback rates'
    )
  ),
  updated_at = NOW()
FROM pairs p
WHERE d.currency_code = p.from_currency
  AND p.to_currency = 'PHP'
  AND p.rate IS NOT NULL
  AND p.rate > 0
  AND d.status IN ('pending', 'approved', 'completed')
  AND d.currency_code != 'PHP'
  -- Only update if rate actually changed
  AND d.exchange_rate != p.rate;

-- ============================================================================
-- STEP 4: Audit after correction
-- ============================================================================
DO $$
DECLARE
  corrected_count int;
  remaining_issues int;
BEGIN
  SELECT COUNT(*)
  INTO corrected_count
  FROM deposits
  WHERE metadata->>'rate_corrected' IS NOT NULL
    AND metadata->'rate_corrected'->>'migration' = '0207';
  
  SELECT COUNT(*)
  INTO remaining_issues
  FROM deposits d
  LEFT JOIN pairs p ON p.from_currency = d.currency_code AND p.to_currency = 'PHP'
  WHERE d.status IN ('pending', 'approved', 'completed')
    AND d.currency_code != 'PHP'
    AND (p.rate IS NULL OR p.rate != d.exchange_rate);
  
  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════╗
║           MIGRATION 0207 - CORRECTION COMPLETE                ║
╠════════════════════════════════════════════════════════════════╣
║ RESULTS:                                                       ║
║   Deposits corrected: %                                        ║
║   Deposits still with issues: %                                ║
║                                                                ║
║ NEXT STEPS:                                                    ║
║   ✓ All deposits now have correct rates from public.pairs      ║
║   ✓ Exchange rates reflect current market prices              ║
║   ✓ Users will see correct "You Receive" amounts              ║
║                                                                ║
║ If remaining issues exist:                                    ║
║   - Check that public.pairs has fresh rates                   ║
║   - Run: npm run check:rates-status                            ║
║   - Run: npm run seed-currency-rates                           ║
╚════════════════════════════════════════════════════════════════╝
  ',
  corrected_count,
  remaining_issues;
END $$;

-- ============================================================================
-- STEP 5: Verification - show corrected deposits
-- ============================================================================
INSERT INTO pairs_migration_audit (action_type, from_currency, to_currency, reason)
VALUES (
  'MIGRATION_0207_DEPOSITS_CORRECTED',
  'ALL',
  'PHP',
  'Backfilled all deposits with correct exchange rates from public.pairs. ' ||
  'Deposits that were created with hardcoded fallback rates now have accurate ' ||
  'exchange_rate and converted_amount values.'
)
ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================
-- Query 1: Check a sample of corrected deposits
-- SELECT id, currency_code, amount, exchange_rate, converted_amount, 
--        metadata->'rate_corrected' as correction_info, created_at
-- FROM deposits 
-- WHERE metadata->>'rate_corrected' IS NOT NULL
-- LIMIT 5;

-- Query 2: Show deposits needing correction (should be empty)
-- SELECT d.id, d.currency_code, d.amount, d.exchange_rate,
--        p.rate as current_rate
-- FROM deposits d
-- LEFT JOIN pairs p ON p.from_currency = d.currency_code AND p.to_currency = 'PHP'
-- WHERE d.status IN ('pending', 'approved', 'completed')
--   AND d.currency_code != 'PHP'
--   AND p.rate IS NOT NULL
--   AND d.exchange_rate != p.rate;

-- Query 3: Verify PHP base rate is correct
-- SELECT * FROM pairs WHERE from_currency = 'PHP' AND to_currency = 'PHP';
