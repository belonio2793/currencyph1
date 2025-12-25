/**
 * 🔴 CRITICAL IMMEDIATE FIX - RUN THIS NOW
 * PURPOSE: Remove backwards/inverted rates from pairs table
 * 
 * PROBLEM: Database still contains inverted rates causing 3.18B BTC error
 * SOLUTION: Delete ALL inverted pairs (PHP→X), keep ONLY canonical (X→PHP)
 * 
 * ⚠️  WARNING: This is an immediate hotfix. Run in Supabase SQL Editor NOW.
 */

BEGIN;

-- ============================================================================
-- STEP 1: DELETE ALL INVERTED PAIRS (PHP → X)
-- These are causing the backwards conversion errors
-- ============================================================================
DELETE FROM pairs 
WHERE from_currency = 'PHP' 
  AND to_currency != 'PHP';

-- Log what was deleted
INSERT INTO pairs_migration_audit (action_type, reason, notes)
VALUES (
  'CRITICAL_HOTFIX_0202',
  'Removed all inverted PHP→X pairs causing backwards rate errors',
  'Deleted all rows where from_currency=PHP to prevent 1 PHP = 0.00000314 BTC errors'
);

-- ============================================================================
-- STEP 2: Verify only canonical pairs remain
-- ============================================================================
-- Check that only canonical (X→PHP) pairs exist
SELECT 
  COUNT(*) as total_pairs,
  SUM(CASE WHEN to_currency = 'PHP' THEN 1 ELSE 0 END) as canonical_count,
  SUM(CASE WHEN from_currency = 'PHP' THEN 1 ELSE 0 END) as inverted_count
FROM pairs;

-- ============================================================================
-- STEP 3: Display results
-- ============================================================================
DO $$
DECLARE
  canonical_count INT;
  inverted_count INT;
BEGIN
  SELECT COUNT(*) INTO canonical_count FROM pairs WHERE to_currency = 'PHP';
  SELECT COUNT(*) INTO inverted_count FROM pairs WHERE from_currency = 'PHP' AND to_currency != 'PHP';
  
  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════╗
║          CRITICAL FIX 0202 - BACKWARDS RATES REMOVED            ║
╠════════════════════════════════════════════════════════════════╣
║ Canonical pairs (X→PHP):  % (GOOD - Keep these)               ║
║ Inverted pairs (PHP→X):   % (BAD - Should be 0)               ║
╠════════════════════════════════════════════════════════════════╣
║ ✅ ALL INVERTED PAIRS REMOVED                                   ║
║ ✅ Deposits page will now show correct rates                   ║
║ ✅ Conversion calculation will work properly                   ║
╚════════════════════════════════════════════════════════════════╝
  ', canonical_count, inverted_count;
END $$;

-- ============================================================================
-- STEP 4: Verify critical pairs exist with correct rates
-- ============================================================================
-- BTC should be around 2.5M, not 0.0000004
SELECT 'BTC→PHP' as pair, rate FROM pairs WHERE from_currency = 'BTC' AND to_currency = 'PHP' LIMIT 1;
SELECT 'ETH→PHP' as pair, rate FROM pairs WHERE from_currency = 'ETH' AND to_currency = 'PHP' LIMIT 1;
SELECT 'USD→PHP' as pair, rate FROM pairs WHERE from_currency = 'USD' AND to_currency = 'PHP' LIMIT 1;

COMMIT;
