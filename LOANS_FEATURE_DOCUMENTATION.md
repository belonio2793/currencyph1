# Loans Feature Documentation

## Overview

The loans feature provides a multi-tiered borrowing system with integrated payment methods, tracking, and schema visualization. Users can request Personal or Business loans with automatic 10% interest calculation.

## Architecture

### 1. Database Schema (`supabase/migrations/008_create_loans_table.sql`)

#### Tables Created:

**`loans` table**
- Core loan tracking with UUID primary key
- Fields:
  - `id` (UUID): Unique identifier
  - `user_id` (UUID): References users table
  - `loan_type` (VARCHAR): 'personal' or 'business'
  - `requested_amount` (NUMERIC): Original requested amount
  - `interest_rate` (NUMERIC): Default 10.00%
  - `total_owed` (NUMERIC): requested_amount × 1.10
  - `currency_code` (VARCHAR): Supported currency
  - `status` (VARCHAR): pending, active, completed, rejected, defaulted
  - `display_name` (VARCHAR): User's name (stored securely)
  - `city` (VARCHAR): User's city
  - `phone_number` (VARCHAR): User's phone (stored securely, blurred in UI)
  - `amount_paid` (NUMERIC): Amount paid so far
  - `remaining_balance` (NUMERIC): Amount still owed
  - `payment_method` (VARCHAR): gcash, crypto, bank_transfer, partner
  - Timestamps: created_at, updated_at, approved_at, completed_at

**`loan_payments` table**
- Audit trail of individual payments
- Fields:
  - `id` (UUID): Unique payment ID
  - `loan_id` (UUID): References loans table
  - `user_id` (UUID): References users table
  - `amount` (NUMERIC): Payment amount
  - `payment_method` (VARCHAR): Payment method used
  - `payment_reference` (VARCHAR): External payment ID
  - `status` (VARCHAR): pending, completed, failed, cancelled
  - Timestamps: created_at, completed_at

#### Functions:

1. **`create_loan_request()`**
   - Creates new loan request
   - Calculates total owed with 10% interest
   - Sets initial status to 'pending'

2. **`process_loan_payment()`**
   - Records payment against loan
   - Updates remaining balance
   - Transitions status from pending→active or to completed
   - Atomic transaction handling

#### Views:

1. **`user_loans_summary`**
   - Aggregates loan data with payment progress percentage
   - Shows currency information
   - Useful for dashboards

#### Row-Level Security (RLS):
- Users can only view their own loans
- Users can only insert/update their own loan payments
- Service role can manage loan approvals

### 2. Frontend Components

#### `src/components/BorrowMoney.jsx`
Main component for managing loans with three status tabs:

**Features:**
- Tab-based interface: Pending | Active | Completed
- Loan list with table display
- UUID display with truncation (first 8 chars)
- Blurred phone numbers (format: XXX****XXXX)
- Payment progress bar visualization
- Status badges with color coding
- Real-time loan list updates via Supabase
- Integration with wallet system

**Props:**
- `userId` (UUID): Current user ID
- `loanType` (string): 'personal' or 'business'

**State:**
- `loans` (array): List of loans
- `activeTab` (string): Current active tab
- `showRequestModal` (boolean): Request modal visibility
- `showPaymentModal` (boolean): Payment modal visibility
- `wallets` (array): User's wallets for payment

#### `src/components/RequestLoanModal.jsx`
Modal for requesting new loans

**Features:**
- Amount input with currency selector
- Real-time calculation of total owed with 10% interest preview
- User information collection (name, city, phone)
- Form validation
- Success/error messaging
- RPC integration with Supabase

**Form Fields:**
- Requested Amount (numeric)
- Currency (dropdown: PHP, USD, EUR)
- Full Name (text)
- City (text)
- Phone Number (tel)
- Terms agreement checkbox

#### `src/components/LoanPaymentModal.jsx`
Two-step modal for processing loan payments

**Step 1: Amount Selection**
- Display of loan balance information
- Payment amount input (max: remaining balance)
- Payment method selection

**Step 2: Confirmation**
- Review payment details
- Show new balance after payment
- Confirm or cancel

**Payment Methods Supported:**
1. **Wallet Balance**
   - Direct deduction from user's wallet
   - RPC integration for atomic transaction
   - Wallet transaction audit trail

2. **GCash** (Pending integration)
   - Payment reference generation
   - Status tracking

3. **Cryptocurrency** (Pending integration)
   - Support for multiple chains
   - Token conversion

4. **Bank Transfer** (Pending integration)
   - International transfer support

5. **Partner Network** (Pending integration)
   - Multiple partner options (Maya, Remitly, InstaPay)

#### `src/components/NetworkBalances.jsx`
Schema visualization and network overview

**Features:**
- Summary cards showing:
  - Total wallets
  - Active loans count
  - Total balance in PHP
  - Recent transaction count
- Expandable table views for:
  - User Profile
  - Wallets
  - Loans
  - Currencies
  - Recent Transactions
- Database schema documentation
- Row-level expandable details

### 3. Navigation Integration

#### Navbar Updates (`src/components/Navbar.jsx`)
- Multi-tier "Borrow Money" dropdown menu
- Desktop dropdown with:
  - Personal Loan option
  - Business Loan option
- Mobile menu integration with:
  - Nested Borrow Money section
  - Full navigation hierarchy

### 4. App Integration

#### App.jsx Updates
- Added BorrowMoney component imports
- Added NetworkBalances component imports
- New tab handlers:
  - `borrow-personal`: Personal loans view
  - `borrow-business`: Business loans view
  - `network-balances`: Schema visualization
- Footer link to Network Balances

## Payment Methods Integration (`src/lib/paymentMethods.js`)

### Supported Methods:

1. **Wallet API**
   - Direct balance deduction
   - Transaction recording

2. **GCash API**
   - Phone number verification
   - Payment reference generation
   - Status verification

3. **Crypto API** (via ThirdWeb)
   - Multiple chains: Ethereum, Polygon, Arbitrum, Solana, Base
   - Token support: ETH, MATIC, USDC, USDT, SOL
   - Exchange rate lookup
   - Transaction status tracking

4. **Bank Transfer API** (via Wise/PayPal)
   - Account validation
   - Transfer estimation (2-day delivery)

5. **Partner Network**
   - Maya (Credit cards, installments)
   - Remitly (International transfers)
   - InstaPay (Instant transfers)

### Payment Handler
Central handler that:
- Routes to appropriate payment processor
- Manages payment lifecycle
- Verifies payment status
- Updates loan status

## Data Flow

### Request Loan Flow:
1. User clicks "Request New Loan" button
2. RequestLoanModal opens
3. User enters amount, currency, personal info
4. Form validates data
5. `create_loan_request()` RPC called
6. Loan created with status='pending'
7. User sees loan in "Pending" tab
8. Admin approves loan (future feature)
9. Status changes to 'active'

### Payment Flow:
1. User selects loan from Active tab
2. Clicks "Pay" button
3. LoanPaymentModal opens (Step 1)
4. User enters amount and selects payment method
5. User clicks "Review"
6. Modal shows Step 2 confirmation
7. User confirms payment
8. If wallet method:
   - `record_wallet_transaction()` RPC records withdrawal
   - `process_loan_payment()` RPC processes payment
   - Loan balance updated
   - Status updated if fully paid
9. Success message shown
10. Loan list automatically refreshes

## Security Features

### Row-Level Security (RLS)
- Database enforces user data isolation
- Users can't access other users' loans
- Audit trail prevents tampering

### Data Blurring
- Phone numbers displayed as: `+639****1234`
- UUID truncation to 8 characters
- Full data stored securely in database

### Encryption
- Phone numbers encrypted in database (future enhancement)
- Payment references stored for audit
- No sensitive data in logs

## Configuration

### Environment Variables
No new environment variables required. Uses existing:
- `VITE_PROJECT_URL` (Supabase)
- `VITE_SUPABASE_ANON_KEY` (Supabase)
- `VITE_THIRDWEB_CLIENT_ID` (For crypto payments)

### Currency Support
Supports all currencies in `currencies` table:
- Fiat: PHP (default), USD, EUR, GBP, etc.
- Crypto: BTC, ETH, USDC, USDT, SOL, etc.

## Testing

### Prerequisite Setup:
1. Run migration: `008_create_loans_table.sql` in Supabase
2. Ensure RLS policies are enabled
3. Create test user with at least 1 wallet

### Test Cases:

**1. Create Personal Loan Request**
- Login as user
- Navigate to Navbar → Borrow Money → Personal Loan
- Click "Request New Personal Loan"
- Fill form with valid data
- Verify loan appears in "Pending" tab

**2. Create Business Loan Request**
- Follow same steps but select "Business Loan"
- Verify loan_type='business' in database

**3. Payment with Wallet**
- Create loan with active status
- Click "Pay" button
- Enter amount less than total owed
- Select "Wallet Balance"
- Review and confirm
- Verify:
  - Loan amount_paid increases
  - remaining_balance decreases
  - Wallet transaction created

**4. Loan Completion**
- Make payment equal to remaining_balance
- Verify status changes to 'completed'
- Verify loan moves to "Completed" tab

**5. Network Balances View**
- Click footer link to Network Balances
- Verify all tables load correctly
- Expand/collapse tables
- View summary statistics

**6. Blurred Phone Numbers**
- In loan list, verify phone numbers show as masked
- Check database to confirm full numbers stored

## Future Enhancements

1. **Admin Approval System**
   - Loan review interface
   - Approval/rejection workflow
   - Risk assessment

2. **Payment Gateway Integration**
   - Live GCash API integration
   - Real cryptocurrency payments
   - Bank transfer processing

3. **Interest Calculation**
   - Variable interest rates
   - Late payment penalties
   - Early repayment discounts

4. **Collateral Management**
   - Asset-based lending
   - Collateral valuation
   - Liquidation workflows

5. **Notifications**
   - Payment reminders
   - Loan approval notifications
   - Due date alerts

6. **Analytics Dashboard**
   - Lending statistics
   - Default rate tracking
   - Revenue analysis

7. **Mobile App**
   - Native iOS/Android apps
   - Offline loan management
   - Push notifications

## Troubleshooting

### Issue: Migration not applying
**Solution:** Ensure Supabase is connected and migrations folder is synced

### Issue: Loans not loading
**Solution:** 
- Check user is authenticated
- Verify RLS policies are enabled
- Check browser console for errors

### Issue: Payment fails
**Solution:**
- Verify wallet has sufficient balance
- Check currency matches
- Review payment reference in loan_payments table

### Issue: Phone numbers visible
**Solution:**
- Check `blurPhoneNumber()` function is called
- Verify data is coming from correct table

## Database Queries

### Get all pending loans for user:
```sql
SELECT * FROM loans 
WHERE user_id = $1 AND status = 'pending'
ORDER BY created_at DESC;
```

### Get total amount owed:
```sql
SELECT SUM(remaining_balance) as total_owed
FROM loans
WHERE user_id = $1 AND status IN ('pending', 'active');
```

### Get payment history:
```sql
SELECT * FROM loan_payments
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 20;
```

### Get loans with payment progress:
```sql
SELECT 
  id,
  loan_type,
  requested_amount,
  total_owed,
  amount_paid,
  remaining_balance,
  ROUND((amount_paid::numeric / total_owed * 100)::numeric, 2) as progress_percentage,
  status
FROM loans
WHERE user_id = $1
ORDER BY created_at DESC;
```

## Support & Documentation

For issues or questions:
1. Check this documentation
2. Review Supabase RLS policies
3. Check browser developer console
4. Review migration file syntax
5. Contact support with reproduction steps

---

**Created:** 2024
**Version:** 1.0.0
**Status:** Production Ready (with payment gateway integration pending)
