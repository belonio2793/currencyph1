# P2P Loan Marketplace - Complete Implementation Guide

## Overview

This document explains the complete peer-to-peer loan marketplace system built for your currency.ph platform. The system enables users to borrow and lend directly with each other, with community-managed verification, transparent ratings, and automatic penalty tracking.

## System Architecture

### Database Schema (`supabase/migrations/010_p2p_loan_marketplace.sql`)

The migration includes:

1. **user_verifications** - ID verification with document storage
   - Supports: Passport, Driver's License, National ID
   - Verified by community managers
   - Tracks expiration dates

2. **community_managers** - Decentralized verification and voting
   - Users voted in by community
   - Can verify user identities
   - Public profile with transparent voting history

3. **community_manager_votes** - Community voting system
   - Vote to approve or reject manager candidates
   - Tracks voting history
   - Transparent decision making

4. **lender_profiles** - Separate lending profiles
   - Rating (0-5 stars, auto-calculated)
   - Lending statistics
   - Payment method preferences
   - Verification status

5. **loan_offers** - Lender-borrower pairing
   - Lenders submit offers to loan requests
   - Terms: amount, interest rate, duration, payment method
   - Platform fee option (10% if using platform facilitation)
   - Status: pending, accepted, rejected, withdrawn, expired

6. **loan_ratings** - Automatic rating system
   - Created automatically on loan completion
   - Tracks: on-time payment, communication, trustworthiness
   - Separate ratings for lender and borrower

7. **loan_payment_schedules** - Payment tracking
   - Individual payments with due dates
   - Late payment penalties (1% per day past due)
   - Tracks paid amounts and dates

8. **platform_transactions** - Fee tracking
   - Records when platform facilitates transactions
   - Tracks 10% fee amounts
   - Separate from loan amounts

### Components

#### 1. **P2PLoanMarketplace.jsx** (Main Component)
The central hub for the P2P loan system with tabs for:
- **Browse Loans**: View available loan requests
- **My Requests**: Track your loan requests
- **My Offers**: Track offers you've submitted as a lender
- **History & Ratings**: View completed loans and your rating

**Features:**
- Request new loans
- Submit offers to loan requests
- View and accept offers as a borrower
- Progress tracking
- Automatic verification reminder banner

**Usage:**
```jsx
import P2PLoanMarketplace from './components/P2PLoanMarketplace'

// In your routing or App.jsx
{activeTab === 'p2p-loans' && (
  <P2PLoanMarketplace userId={userId} userEmail={userEmail} onTabChange={setActiveTab} />
)}
```

#### 2. **UserVerificationModal.jsx**
Allows users to submit ID documents for verification.

**ID Types Supported:**
- Driver's License
- Passport
- National ID

**Status:**
- Pending: Awaiting community manager review
- Approved: Can participate in lending/borrowing
- Rejected: Can resubmit with different ID

#### 3. **LenderProfileView.jsx**
Displays lender information including:
- Rating and review count
- Completion rate and loan statistics
- Recent reviews from borrowers
- Payment methods
- Verification badge
- Rating category (Excellent, Good, Fair, New)

#### 4. **SubmitLoanOfferModal.jsx**
Lenders submit offers to loan requests:
- Offered amount (can be less than requested)
- Interest rate (0-50%)
- Duration and due date
- Repayment schedule (Lump Sum, Monthly, Weekly)
- Payment method
- Optional platform facilitation fee (10%)

**Automatic Calculations:**
- Total with interest
- Platform fee (if using platform)
- Due date based on duration

#### 5. **LoanOffersListView.jsx**
Borrowers view and accept offers:
- Sort by: Rating, Interest Rate, Duration
- View lender profile
- See offer terms clearly
- Accept best offer

**Workflow:**
1. Borrower sees all pending offers
2. Can filter/sort by various criteria
3. Clicks "Accept Offer"
4. Loan becomes active
5. All other offers automatically rejected

#### 6. **LoanProgressTracker.jsx**
Tracks loan repayment progress:
- Total owed vs. amount paid
- Progress bar
- Payment schedule with status
- Late payment penalties
- Due date tracking

**Borrower Actions:**
- View payment schedule
- Mark payments as paid
- Track penalties
- Contact lender

#### 7. **CommunityManagerPanel.jsx**
For community managers to:
- Review pending ID verifications
- Approve/reject with notes
- Vote on new manager candidates
- Track verification status

## Services

### p2pLoanService.js
Core business logic:

**User Verification:**
```javascript
await p2pLoanService.submitVerification(userId, idType, idNumber, imageUrl)
await p2pLoanService.getVerificationStatus(userId)
```

**Loan Offers:**
```javascript
await p2pLoanService.submitLoanOffer(loanRequestId, lenderId, offerData)
await p2pLoanService.getOffersForRequest(loanRequestId)
await p2pLoanService.acceptLoanOffer(offerId, borrowerId)
```

**Ratings:**
```javascript
await p2pLoanService.submitLoanRating(loanId, raterId, ratedUserId, ratingData)
```

**Payment Schedule:**
```javascript
await p2pLoanService.createPaymentSchedule(loanId, scheduleData)
await p2pLoanService.getPaymentSchedule(loanId)
```

### lenderMatchingService.js
Intelligent lender matching:

**Find Best Matches:**
```javascript
const matches = await lenderMatchingService.findBestMatches(loanRequest, limit)
```

**Scoring Factors (0-100):**
- Rating: 35% weight
- Completion rate: 25% weight
- Verification status: 15% weight
- Experience (loan count): 15% weight
- Payment method match: 10% weight

**Recommended Lenders:**
```javascript
const recommendations = await lenderMatchingService.getRecommendedLendersForBorrower(borrowerId)
```

**Compatibility Check:**
```javascript
const compat = await lenderMatchingService.calculateLenderBorrowerCompatibility(lenderId, borrowerId)
```

## Data Flow

### Borrowing Flow

```
1. User requests loan
   ↓
2. User must be verified (ID check by community manager)
   ↓
3. Lenders see request and can submit offers
   ↓
4. Borrower reviews offers (sorted by rating, interest, etc.)
   ↓
5. Borrower accepts best offer
   ↓
6. Loan becomes ACTIVE
   ↓
7. Borrower makes payments on schedule
   ↓
8. Late payments trigger penalties (1% per day)
   ↓
9. When fully paid, loan = COMPLETED
   ↓
10. Auto-generated ratings for both parties
   ↓
11. Ratings update lender profile scores
```

### Lending Flow

```
1. Lender builds profile with bio and preferences
   ↓
2. Lender browses loan requests
   ↓
3. Lender submits offer with terms
   ↓
4. Offer sits PENDING until borrower accepts
   ↓
5. On acceptance, loan = ACTIVE
   ↓
6. Lender tracks borrower's payments
   ↓
7. Can message borrower through chat
   ↓
8. On completion, auto-rated by borrower
   ↓
9. Rating improves lender profile
```

## Rating System

### Automatic Rating Generation

When a loan is marked as COMPLETED:
1. System creates two placeholder ratings:
   - One for lender to review borrower
   - One for borrower to review lender

2. Auto-calculated metrics:
   - **On-time payment**: TRUE if `days_past_due <= 0`
   - **Communication quality**: Default 3/5 (borrower/lender can update)
   - **Trustworthiness**: Default 3/5 (borrower/lender can update)

3. Rating updates lender profile:
   - Average star rating (0-5)
   - Total review count
   - Success rate calculation

### Rating Categories

- **Excellent**: 4.5-5.0 stars
- **Good**: 3.5-4.4 stars
- **Fair**: 2.5-3.4 stars
- **New**: No ratings yet

## Late Payment & Penalties

### Penalty Calculation

```
Days Late = Date.now() - Due Date (in days)
Penalty = (Payment Amount) × (Days Late × 0.01)
```

**Example:**
- Payment: 1,000 PHP
- Due date: Jan 1
- Paid: Jan 11 (10 days late)
- Penalty: 1,000 × (10 × 0.01) = 100 PHP

### Automatic Tracking

`loan_payment_schedules` table tracks:
- `days_late`: Auto-calculated
- `penalty_amount`: Auto-calculated
- `status`: Changes to 'late' or 'missed'

## Chat Integration

The P2P loan system integrates with your existing ChatBar component:

### How It Works

1. When a loan is accepted, borrower and lender can chat
2. Chat messages are associated with `loan_id`
3. Users can:
   - Ask questions about payment
   - Request payment arrangements
   - Provide payment proof
   - Communicate before loan completion

### Implementation

In your ChatBar component, check if user is in a loan relationship:

```jsx
// Inside ChatBar component
const getLoanChatContext = (userId, otherUserId) => {
  // Find active loan between these users (lender-borrower pair)
  // If found, associate chat with loan_id
  // Filter messages to only show loan-related conversation
}
```

Add to message structure:
```javascript
{
  id, message, sender_id, created_at,
  loan_id,  // NEW: Associate message with loan
  type: 'loan_negotiation' // Can be loan_offer, loan_payment, loan_issue
}
```

## Verification & Community Management

### Becoming a Community Manager

1. User nominates themselves or is nominated
2. Community votes (needs majority approval)
3. Once approved, can verify other users
4. Public profile shows voting history
5. Can be removed by community vote

### Verification Process

1. User submits ID document + number
2. Status = PENDING
3. Community manager reviews
4. Approves or rejects with notes
5. User sees status and can resubmit if rejected

### Transparency

- All managers have public profiles
- Vote history is visible
- Approval requirements are clear
- Users can see who verified them

## Platform Fees

### Optional 10% Fee Model

**When User Chooses "Use Platform Facilitation":**
- Platform takes 10% of loan amount
- Fee is deducted from lender's proceeds
- Lender still receives 90% of interest

**Example:**
- Loan: 10,000 PHP
- Interest: 5% = 500 PHP
- Platform fee: 10% × 10,000 = 1,000 PHP
- Lender receives: 500 PHP interest (minus platform fee depends on fee timing)

**Current Implementation:**
- Fee is optional
- Lender chooses at offer time
- Fee is transparent to borrower
- Platform keeps 100% of fee (no distribution)

## Integration Checklist

To integrate P2P Loan Marketplace into your app:

### 1. Database Setup
```bash
# Run the migration in Supabase
# File: supabase/migrations/010_p2p_loan_marketplace.sql
```

### 2. Add to Navigation
```jsx
// In Navbar.jsx, add P2P Loans option
<button onClick={() => onTabChange('p2p-loans')}>
  💰 P2P Loans
</button>
```

### 3. Add Route in App.jsx
```jsx
import P2PLoanMarketplace from './components/P2PLoanMarketplace'

{activeTab === 'p2p-loans' && (
  <P2PLoanMarketplace userId={userId} userEmail={userEmail} onTabChange={setActiveTab} />
)}
```

### 4. Update Loans Table (Optional)
The migration expects the existing `loans` table. New columns are added with `ADD COLUMN IF NOT EXISTS`, so existing data is preserved.

### 5. Test Flow
1. Create test users (borrower, lender, manager)
2. Verify user as manager
3. Request a loan as borrower
4. Submit offer as lender
5. Accept offer
6. Track payment
7. Mark complete and rate

## Configuration & Customization

### Adjustable Parameters

In `lenderMatchingService.js`:
```javascript
weights = {
  rating: 0.35,      // Change importance of rating
  completion: 0.25,  // Change importance of success rate
  verification: 0.15,
  experience: 0.15,
  paymentMethod: 0.10
}
```

### Penalty Rate

In `supabase/migrations/010_p2p_loan_marketplace.sql`:
```sql
penalty_amount := ROUND((NEW.amount_due * (NEW.days_late * 0.01))::numeric, 2);
-- Change 0.01 to different rate (e.g., 0.005 for 0.5% per day)
```

### Platform Fee

In `SubmitLoanOfferModal.jsx`:
```javascript
const calculatePlatformFee = () => {
  if (!formData.usePlatformFacilitation) return 0
  return parseFloat(formData.offeredAmount) * 0.10  // Change 0.10 to different %
}
```

## Security & Best Practices

### Row-Level Security (RLS)

All tables have RLS policies:
- Users see only their own verifications
- Lenders see only their offers
- Borrowers see offers on their requests
- Community managers have broader access

### Verification Safeguards

1. ID must be submitted before participation
2. Community manager approval required
3. Transparent manager selection
4. Public voting history

### Rating Integrity

1. Ratings auto-generated on completion
2. Users must rate within 30 days (manual) or auto-rated
3. Rating tampering is prevented by RLS
4. Rating calculation is transparent

## Troubleshooting

### Users can't see offers
- Check if both users are verified
- Ensure loan status is 'pending'
- Verify RLS policies are enabled

### Penalties not calculating
- Check `loan_payment_schedules` table exists
- Ensure migration ran successfully
- Verify trigger is active

### Chat not linking to loans
- Add `loan_id` to your existing messages table
- Update ChatBar to filter by `loan_id`
- Ensure borrower/lender relationship is correct

## Next Steps

1. **Payment Gateway**: Integrate with GCash/Crypto for actual payments
2. **Dispute Resolution**: Add arbitration system for disputes
3. **Collateral System**: Add collateral options for larger loans
4. **Advanced Analytics**: Dashboard for admin viewing trends
5. **Mobile App**: React Native version
6. **Loan Insurance**: Optional default insurance
7. **Credit Scoring**: Algorithmic credit score from history

## Support

For issues or questions:
1. Check RLS policies first (most common issue)
2. Verify migration ran completely
3. Check browser console for errors
4. Review database logs in Supabase

---

**Created**: 2025
**Version**: 1.0
**Status**: Ready for Production
