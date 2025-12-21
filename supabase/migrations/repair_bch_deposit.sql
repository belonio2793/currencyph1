-- ============================================================================
-- REPAIR: Fix the 3443 BCH deposit with incorrect currency_code
-- ============================================================================
-- Issue: Deposit was stored with currency_code='PHP' instead of 'BCH'
-- This caused wallet to be credited with 3443 PHP instead of 119,947,205.75 PHP

-- 1. Fix the deposit record - change currency_code from PHP to BCH
UPDATE public.deposits
SET 
  currency_code = 'BCH',
  original_currency = 'BCH',
  updated_at = NOW()
WHERE 
  id = '700d799c-7a4d-46f8-b609-6edfeddd46f3'
  AND user_id = '336c05a0-3b97-417b-90c4-eca4560346cf'
  AND wallet_id = 'ab5b16c7-07d2-483f-97f3-cb2542b08cb1';

-- 2. Fix the wallet balance - should be 119,947,205.75 PHP not 3443 PHP
UPDATE public.wallets
SET 
  balance = 119947205.75000000,
  updated_at = NOW()
WHERE 
  id = 'ab5b16c7-07d2-483f-97f3-cb2542b08cb1';

-- 3. Create a wallet transaction to record this correction
INSERT INTO public.wallet_transactions (
  wallet_id,
  type,
  amount,
  balance_before,
  balance_after,
  currency_code,
  description,
  reference_id,
  metadata,
  created_at
) VALUES (
  'ab5b16c7-07d2-483f-97f3-cb2542b08cb1',
  'correction',
  119947202.75,
  3443,
  119947205.75,
  'PHP',
  'Correction: BCH deposit 3443 BCH credited (approved deposit 700d799c-7a4d-46f8-b609-6edfeddd46f3)',
  '700d799c-7a4d-46f8-b609-6edfeddd46f3',
  '{
    "reason": "Currency conversion correction",
    "original_currency": "BCH",
    "exchange_rate": 34837.99179495,
    "original_received_amount": 119947205.75,
    "issue": "Deposit was stored with currency_code=PHP instead of BCH"
  }',
  NOW()
);

-- ============================================================================
-- VERIFICATION QUERIES (run these to verify the fix)
-- ============================================================================

-- Check the fixed deposit record
-- SELECT 
--   id, 
--   amount, 
--   currency_code, 
--   original_currency,
--   received_amount, 
--   exchange_rate, 
--   status
-- FROM public.deposits
-- WHERE id = '700d799c-7a4d-46f8-b609-6edfeddd46f3';

-- Check the fixed wallet balance
-- SELECT 
--   id, 
--   balance
-- FROM public.wallets
-- WHERE id = 'ab5b16c7-07d2-483f-97f3-cb2542b08cb1';

-- Check the transaction log
-- SELECT 
--   id,
--   type,
--   amount,
--   balance_before,
--   balance_after,
--   description,
--   created_at
-- FROM public.wallet_transactions
-- WHERE wallet_id = 'ab5b16c7-07d2-483f-97f3-cb2542b08cb1'
-- ORDER BY created_at DESC
-- LIMIT 5;
