# Loans Feature - Deployment Checklist

## Pre-Deployment (Verify All Items)

### Database Setup
- [ ] Supabase project is active and accessible
- [ ] Can connect to Supabase SQL Editor
- [ ] Have write permissions to execute migrations
- [ ] Backup of existing database created (recommended)

### Frontend Setup
- [ ] Project builds without errors (`npm run build`)
- [ ] No TypeScript/syntax errors in console
- [ ] All dependencies installed (`npm install`)
- [ ] Dev server runs without errors (`npm run dev`)

### Files Created (Verify Existence)
- [ ] `supabase/migrations/008_create_loans_table.sql` exists (231 lines)
- [ ] `src/components/BorrowMoney.jsx` exists (270 lines)
- [ ] `src/components/RequestLoanModal.jsx` exists (216 lines)
- [ ] `src/components/LoanPaymentModal.jsx` exists (263 lines)
- [ ] `src/components/NetworkBalances.jsx` exists (261 lines)
- [ ] `src/lib/paymentMethods.js` exists (237 lines)

### Files Modified (Verify Changes)
- [ ] `src/components/Navbar.jsx` has borrowOptions array
- [ ] `src/components/Navbar.jsx` has Borrow Money dropdown
- [ ] `src/App.jsx` imports BorrowMoney and NetworkBalances
- [ ] `src/App.jsx` has new tab handlers (borrow-personal, borrow-business, network-balances)

### Documentation Created
- [ ] `LOANS_FEATURE_DOCUMENTATION.md` (440 lines)
- [ ] `LOANS_SETUP_GUIDE.md` (288 lines)
- [ ] `LOANS_IMPLEMENTATION_SUMMARY.md` (347 lines)
- [ ] `LOANS_QUICK_REFERENCE.md` (300 lines)
- [ ] `LOANS_DEPLOYMENT_CHECKLIST.md` (this file)

## Deployment Steps

### Step 1: Database Migration
```
[ ] Go to Supabase Dashboard
[ ] Navigate to SQL Editor
[ ] Create new query
[ ] Paste content from: supabase/migrations/008_create_loans_table.sql
[ ] Execute the query
[ ] Wait for completion (should show success message)
[ ] Verify no errors in output
```

**Expected Outcome:**
- [ ] Tables created: `loans`, `loan_payments`
- [ ] Functions created: `create_loan_request`, `process_loan_payment`
- [ ] Views created: `user_loans_summary`
- [ ] RLS policies enabled and active

### Step 2: Verify Database Setup
```sql
[ ] Run: SELECT tablename FROM pg_tables WHERE tablename IN ('loans', 'loan_payments');
    Expected: 2 rows returned

[ ] Run: SELECT proname FROM pg_proc WHERE proname IN ('create_loan_request', 'process_loan_payment');
    Expected: 2 rows returned

[ ] Run: SELECT viewname FROM pg_views WHERE viewname = 'user_loans_summary';
    Expected: 1 row returned
```

### Step 3: Test Database Functions
```sql
[ ] Get a test user_id from your database:
    SELECT id FROM users LIMIT 1;

[ ] Test create_loan_request function:
    SELECT create_loan_request(
      '<user-id>',
      'personal',
      5000,
      'PHP',
      'Test User',
      'Manila',
      '+639171234567'
    );
    Expected: Returns UUID (loan ID)

[ ] Verify loan was created:
    SELECT * FROM loans WHERE loan_type = 'personal' ORDER BY created_at DESC LIMIT 1;
    Expected: See loan record with status='pending'
```

### Step 4: Frontend Deployment
```
[ ] Commit all changes to git
[ ] Push to repository
[ ] Run: npm run build
[ ] Verify build succeeds with no errors
[ ] Test in development: npm run dev
```

### Step 5: Component Testing

**Test Navbar Dropdown:**
```
[ ] Login to application
[ ] Verify "Borrow Money" appears in navbar (after login)
[ ] Click on "Borrow Money" dropdown
[ ] Verify "Personal Loan" option appears
[ ] Verify "Business Loan" option appears
[ ] Click "Personal Loan" and verify it navigates to loans page
```

**Test Request Loan:**
```
[ ] On Personal Loan page, click "Request New Personal Loan"
[ ] Verify RequestLoanModal opens
[ ] Fill form:
    - Amount: 5000
    - Currency: PHP
    - Name: Test User
    - City: Manila
    - Phone: +639171234567
[ ] Click "Request Loan"
[ ] Verify modal closes
[ ] Verify loan appears in "Pending" tab
[ ] Verify total owed = 5500 (5000 × 1.10)
```

**Test Business Loan:**
```
[ ] Click "Borrow Money" → "Business Loan"
[ ] Repeat request loan steps
[ ] Verify loan_type = 'business' in database
```

**Test Payment Processing:**
```
[ ] Ensure user has PHP wallet with balance > 0
[ ] On active loan, click "Pay" button
[ ] Verify LoanPaymentModal Step 1 opens
[ ] Enter amount: 2000
[ ] Select "Wallet Balance"
[ ] Click "Review"
[ ] Verify Step 2 shows confirmation
[ ] Click "Confirm Payment"
[ ] Verify payment succeeds
[ ] Verify loan balance decreases
[ ] Verify wallet balance decreases
[ ] Verify payment appears in loan_payments table
```

**Test Network Balances:**
```
[ ] Click footer link "Network Balances"
[ ] Verify page loads with summary cards
[ ] Verify tables are expandable
[ ] Expand "User Profile" table
[ ] Expand "Wallets" table
[ ] Expand "Loans" table
[ ] Expand "Currencies" table
[ ] Verify data displays correctly
```

**Test Data Blurring:**
```
[ ] In loan list, verify phone numbers show as masked
[ ] In loan list, verify UUIDs show only first 8 characters
[ ] In database, verify full phone numbers are stored
[ ] In database, verify full UUIDs are stored
```

### Step 6: Mobile Testing

```
[ ] Open app on mobile device
[ ] Verify responsive design
[ ] Click hamburger menu
[ ] Verify "Borrow Money" section appears
[ ] Verify "Personal Loan" and "Business Loan" options visible
[ ] Test loan request form on mobile
[ ] Test payment form on mobile
[ ] Verify tables are scrollable on mobile
```

### Step 7: Error Handling

```
[ ] Test with empty form submission
  Expected: Error message shown

[ ] Test with invalid amount (0 or negative)
  Expected: Validation error

[ ] Test with insufficient wallet balance
  Expected: Payment error

[ ] Test with missing required fields
  Expected: Form validation error

[ ] Test with invalid phone number
  Expected: Validation error
```

## Post-Deployment Verification

### Database Integrity
```
[ ] No error logs in Supabase
[ ] All constraints working (unique, foreign key, etc.)
[ ] RLS policies enforcing correctly
[ ] Audit trail capturing all operations
```

### Application Performance
```
[ ] Loans load in < 2 seconds
[ ] Payment processing < 1 second
[ ] No console errors
[ ] No memory leaks detected
[ ] Responsive on all screen sizes
```

### Data Integrity
```
[ ] Phone numbers are blurred in UI
[ ] Full phone numbers stored in database
[ ] UUIDs truncated in UI
[ ] Full UUIDs stored in database
[ ] Interest calculated correctly (10%)
[ ] Remaining balance accurate
```

### Security
```
[ ] RLS policies preventing unauthorized access
[ ] Users can only see their own loans
[ ] Users can only modify their own loans
[ ] Service role access working for admin functions
[ ] No sensitive data in logs
```

## Rollback Plan

If deployment fails at any point:

### Step 1: Revert Database (if needed)
```
[ ] Connect to Supabase
[ ] Copy and run rollback SQL from LOANS_SETUP_GUIDE.md
[ ] This will drop tables and functions
[ ] Verify all loans objects removed
```

### Step 2: Revert Code
```
[ ] Git revert to previous commit
[ ] Or manually remove component files:
    - src/components/BorrowMoney.jsx
    - src/components/RequestLoanModal.jsx
    - src/components/LoanPaymentModal.jsx
    - src/components/NetworkBalances.jsx
    - src/lib/paymentMethods.js

[ ] Revert changes in:
    - src/components/Navbar.jsx
    - src/App.jsx
```

### Step 3: Rebuild and Deploy
```
[ ] npm install
[ ] npm run build
[ ] npm run dev
[ ] Verify application works
```

## Monitoring & Maintenance

### Daily Checks
- [ ] No error logs in browser console
- [ ] No error logs in Supabase
- [ ] Payment processing working normally
- [ ] Database queries performing well

### Weekly Checks
- [ ] Review loan_payments table for any failed transactions
- [ ] Check RLS policies are still enforcing
- [ ] Verify data integrity (no orphaned records)
- [ ] Review application logs

### Monthly Checks
- [ ] Database backup status
- [ ] Performance metrics
- [ ] User feedback compilation
- [ ] Security audit

## Feature Flags (For Gradual Rollout)

If desired, feature can be hidden with a flag:

```javascript
// In App.jsx
const loansFeatureEnabled = true; // Set to false to disable

// In Navbar.jsx
{loansFeatureEnabled && userEmail && (
  <div className="relative ml-2">
    {/* Borrow Money dropdown */}
  </div>
)}
```

## Sign-Off

- [ ] Product Owner Approval
- [ ] QA Testing Complete
- [ ] Security Review Complete
- [ ] Performance Testing Complete
- [ ] Documentation Complete
- [ ] Backup Created
- [ ] Deployment Ready

## Post-Launch

### Day 1
- [ ] Monitor for errors
- [ ] Check user feedback
- [ ] Verify all features working
- [ ] Review payment transactions

### Week 1
- [ ] Analyze usage patterns
- [ ] Check loan creation rate
- [ ] Review payment success rate
- [ ] Address any user issues

### Month 1
- [ ] Generate usage report
- [ ] Review feature adoption
- [ ] Plan payment gateway integrations
- [ ] Plan v2.0 enhancements

## Communication

### Notify Team
```
[ ] Email: Feature deployed
[ ] Slack: Feature announcement
[ ] Internal docs: Updated
[ ] User guides: Distributed
```

### Stakeholder Updates
```
[ ] Management: Deployment complete
[ ] Finance: System ready
[ ] Legal: Compliance verified
[ ] Support: Documentation shared
```

## Troubleshooting During Deployment

### Issue: Migration fails
**Solution:** Check SQL syntax, verify user has write permissions, check Supabase logs

### Issue: Components don't render
**Solution:** Check imports in App.jsx, verify no TypeScript errors, check browser console

### Issue: Forms don't work
**Solution:** Check Supabase connection, verify RLS policies, check network tab in dev tools

### Issue: Data not loading
**Solution:** Verify user is authenticated, check RLS policies, verify wallet exists

### Issue: Payment fails
**Solution:** Check wallet balance, verify wallet exists, check Supabase logs, review transaction type

## Success Criteria

Feature deployment is successful when:

✅ All migration applied without errors
✅ All components render correctly
✅ Can create personal loans
✅ Can create business loans
✅ Can make payments from wallet
✅ Loan status updates correctly
✅ Data is blurred in UI
✅ RLS prevents unauthorized access
✅ No console errors
✅ Mobile responsive
✅ All tests pass

## Final Checklist

```
Deployment Status: [ ] READY [ ] IN PROGRESS [ ] COMPLETE [ ] FAILED

Issues Found: _____________________________
Resolution: _______________________________
Completed By: _____________________________
Date: _____________________________________
Time: _____________________________________
```

---

**Keep this checklist for future reference and auditing purposes.**

For questions during deployment, refer to:
- `LOANS_SETUP_GUIDE.md` - Step-by-step instructions
- `LOANS_FEATURE_DOCUMENTATION.md` - Technical details
- `LOANS_QUICK_REFERENCE.md` - Quick answers
