# Deposits Three-Currency Fix - Deployment Checklist

## Pre-Deployment

- [ ] Reviewed `DEPOSITS_THREE_CURRENCY_MODEL_FIX.md`
- [ ] Reviewed `DEPOSITS_FIX_TESTING_GUIDE.md`
- [ ] Reviewed `DEPOSITS_FIX_COMPLETE_SUMMARY.md`
- [ ] All team members aware of changes
- [ ] Backup of database taken
- [ ] No active critical incidents

## Deployment Phase 1: Database

### Execute SQL Migration

- [ ] Open Supabase Dashboard
- [ ] Navigate to: SQL Editor
- [ ] Copy content from: `supabase/migrations/0121_fix_deposit_currency_mapping.sql`
- [ ] Execute in SQL Editor
- [ ] Verify execution completed without errors
- [ ] Check logs for any warnings

### Verify Database Schema

Run these verification queries:

```sql
-- Check new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'deposits' 
AND column_name IN ('input_amount', 'input_currency', 'payment_method_currency', 'payment_amount');
```

- [ ] All 4 columns exist
- [ ] Column types are correct (NUMERIC, VARCHAR)

```sql
-- Check indexes exist
SELECT indexname FROM pg_indexes 
WHERE tablename = 'deposits' 
AND indexname LIKE 'idx_deposits_input%'
OR indexname LIKE 'idx_deposits_payment%';
```

- [ ] Indexes created successfully

```sql
-- Check view exists
SELECT * FROM deposits_three_currency_model LIMIT 1;
```

- [ ] View works without errors

```sql
-- Check trigger function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'validate_three_currency_deposit';
```

- [ ] Trigger function exists

**Migration Status:** ✅ / ⏳ / ❌

## Deployment Phase 2: Code

### Deploy Frontend Code

- [ ] Push changes to repository
- [ ] Code changes deployed (through CI/CD or manual)
- [ ] Files updated:
  - [ ] src/lib/multiCurrencyDepositService.js
  - [ ] src/components/Deposits.jsx
- [ ] Build completed without errors
- [ ] No TypeScript/ESLint errors

### Verify Code Deployment

- [ ] Check that live site has new code
- [ ] Open browser DevTools → Sources
- [ ] Verify Deposits.jsx includes new warning section
- [ ] Check multiCurrencyDepositService.js has paymentMethodCurrency parameter

**Code Status:** ✅ / ⏳ / ❌

## Deployment Phase 3: Testing

### Quick Smoke Test

1. **Create Single-Currency Deposit (Simple)**
   - [ ] Open app and navigate to Deposits
   - [ ] Select 10,000 PHP
   - [ ] Select GCash payment method
   - [ ] Proceed to confirmation
   - [ ] **Verify:** No three-currency warning should appear
   - [ ] Submit and verify success message

2. **Create Multi-Currency Deposit (The Bug Fix)**
   - [ ] Navigate to Deposits
   - [ ] Select 90,000 USD (or your test amount)
   - [ ] Select Ethereum payment method
   - [ ] Select PHP wallet
   - [ ] **Verify:** Three-currency model displays
   - [ ] **Verify:** Warning box appears with clear explanations
   - [ ] **Verify:** Shows: 90,000 USD → ~0.03 ETH → ~4.5M PHP
   - [ ] Submit and verify success

### Database Verification

```sql
-- Check most recent deposit
SELECT 
  id, input_amount, input_currency,
  payment_method_currency, payment_amount,
  received_amount, currency_code, status
FROM deposits
ORDER BY created_at DESC
LIMIT 1;
```

- [ ] input_amount is populated
- [ ] input_currency is correct (USD)
- [ ] payment_method_currency is correct (ETH)
- [ ] payment_amount is populated (~0.03)
- [ ] received_amount is correct (~4.5M PHP)

**Testing Status:** ✅ / ⏳ / ❌

## Post-Deployment

### Monitor for Issues (First 24 Hours)

- [ ] No error spikes in logs
- [ ] No validation trigger failures
- [ ] No conversion calculation errors
- [ ] No UI errors in browser console
- [ ] No user complaints

### Run Full Test Suite

From `DEPOSITS_FIX_TESTING_GUIDE.md`:

Test Scenario | Status
---|---
90,000 USD via Ethereum | ✅ / ⏳ / ❌
10,000 PHP via GCash | ✅ / ⏳ / ❌
100 USD via GCash → PHP | ✅ / ⏳ / ❌
0.5 BTC via Bitcoin | ✅ / ⏳ / ❌

### Database Verification (Full)

Run all verification queries from testing guide:

- [ ] Three-currency view returns correct data
- [ ] Conversion math is correct
- [ ] Validation trigger works
- [ ] Migration helper function accessible

### Performance Check

- [ ] Page load time for Deposits page: ___ms (should be <3s)
- [ ] Deposit form submission: ___ms (should be <2s)
- [ ] Success modal display: ___ms (should be <1s)
- [ ] No database query timeouts

## Documentation

- [ ] DEPOSITS_THREE_CURRENCY_MODEL_FIX.md in docs
- [ ] DEPOSITS_FIX_TESTING_GUIDE.md in docs
- [ ] DEPOSITS_FIX_COMPLETE_SUMMARY.md in docs
- [ ] Changes documented in changelog
- [ ] Team wiki updated (if applicable)

## Communication

- [ ] Announcement ready for users
- [ ] Internal documentation updated
- [ ] Support team briefed on changes
- [ ] FAQ updated (if applicable)

## Rollback Plan

If critical issues found:

- [ ] Code rollback procedure documented
- [ ] Database rollback procedure documented
- [ ] Rollback time estimate: ___minutes
- [ ] Communication plan for rollback

**Rollback Prepared:** ✅ / ⏳ / ❌

## Final Sign-Off

### Development Lead
- [ ] Code reviewed
- [ ] Tests passed
- [ ] Ready for production
- **Name:** _______________ **Date:** ___________

### QA Lead
- [ ] All scenarios tested
- [ ] No regressions found
- [ ] Ready for production
- **Name:** _______________ **Date:** ___________

### Product Lead
- [ ] Feature is complete
- [ ] User-facing changes acceptable
- [ ] Ready for production
- **Name:** _______________ **Date:** ___________

## Deployment Summary

**Deployment Date:** ___________
**Deployed By:** ___________
**Duration:** ___________
**Issues Found:** ___________
**Resolution:** ___________

## Post-Deployment Monitoring

### Day 1
- [ ] Monitor error logs
- [ ] Check user feedback
- [ ] No escalations

### Day 3
- [ ] Verify all deposits working
- [ ] Check conversion accuracy
- [ ] Database integrity check

### Day 7
- [ ] Full system health check
- [ ] Performance baseline
- [ ] User satisfaction

### Day 30
- [ ] Long-term stability check
- [ ] Migration helper run (if needed)
- [ ] Lessons learned documentation

## Success Criteria

✅ **Fix is successful when:**

1. **Bug fixed:** 90,000 USD via ETH shows correct amounts
2. **UI clear:** Three-currency model visible and understandable
3. **Database:** All three currencies properly tracked
4. **No errors:** No validation or conversion errors
5. **Backward compatible:** Old deposits still work
6. **Performance:** No degradation vs. before
7. **User feedback:** Positive or neutral (no confusion)

## Questions or Issues?

1. Check `DEPOSITS_FIX_TESTING_GUIDE.md` troubleshooting section
2. Review code comments in Deposits.jsx and service
3. Check database logs in Supabase Dashboard
4. Contact development team with specific error messages

---

## Quick Reference

| Item | Value |
|------|-------|
| Files Changed | 3 files (1 SQL, 2 JS) |
| Columns Added | 4 columns |
| Functions Added | 1 trigger, 1 helper |
| Views Added | 1 view |
| Breaking Changes | None |
| Backward Compatible | Yes |
| Rollback Time | <10 minutes |
| Testing Time | ~30 minutes |

**Status: READY FOR DEPLOYMENT** ✅
