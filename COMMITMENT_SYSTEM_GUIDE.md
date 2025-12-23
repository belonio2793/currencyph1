# 🥥 Partnership Network - Commitment System Guide

## Overview

A comprehensive, interactive commitment interface for the coconuts ecosystem where users can create partnerships, calculate costs in real-time, and earn affiliate commissions.

## What Was Built

### 1. **Database Schema** (`supabase/migrations/060_create_commitments_system.sql`)
- **commitment_profiles** - User business profile information
- **commitments** - Individual commitment/pledge records
- Automatic calculation triggers for totals and commissions
- Row-level security (RLS) for data privacy
- Full audit trail with timestamps

### 2. **Calculation Engine** (`src/lib/commitmentCalculatorService.js`)
- Real-time cost calculations
- Support for multiple item types (coconut, equipment, machinery, labor, etc.)
- Estimated costs for delivery, handling, and shipping
- Affiliate commission calculations (default 50%)
- Currency formatting (PHP, USD, EUR)
- Schedule interval multipliers (daily, weekly, monthly, annual, etc.)

### 3. **React Components**

#### CommitmentManager (`src/components/CommitmentManager.jsx`)
- Main container component
- Authentication-aware
- Tab-based interface (Profile & Commitments)
- Educational "How It Works" section
- Feature highlights

#### CommitmentForm (`src/components/CommitmentForm.jsx`)
- User profile data entry
- Business type selection
- Contact information collection
- Location details
- Optional bio/description
- Form validation and error handling

#### CommitmentCalculator (`src/components/CommitmentCalculator.jsx`)
- Excel-like table interface for managing commitments
- Add/Edit/Delete operations
- Real-time calculation preview
- Cost breakdown display
- Commission calculation
- Interactive form with multiple sections:
  - Item details
  - Quantity & pricing
  - Schedule intervals
  - Additional requirements (delivery, handling, shipping)
  - Commission percentage

### 4. **Integration**
- Added to `src/App.jsx` with lazy loading
- Route: `/commitments`
- Navigation link in Sidebar (Community section)
- Footer link for easy access
- Suspense boundary with PageLoader fallback

## How to Use

### For Users

1. **Navigate to Partnership Network**
   - Click "Partnership Network" in the footer, or
   - Click "🥥 Partnership Network" in the sidebar under Community

2. **Create Your Profile**
   - Fill in business name and type
   - Add contact information
   - Provide location details
   - Write a brief bio about your business

3. **Add Commitments**
   - Click "Add New Commitment" after saving your profile
   - Select item type (coconut, equipment, machinery, labor, etc.)
   - Enter quantity and unit price
   - Choose schedule interval (daily, monthly, etc.)
   - Check boxes for delivery, handling, and shipping if needed
   - Set affiliate commission percentage (default: 50%)
   - Review calculated costs and commission
   - Save commitment

4. **Manage Commitments**
   - View all active commitments in the table
   - Edit any commitment by clicking "Edit"
   - Delete commitments that are no longer needed
   - No obligations - add or remove anytime

### For Developers

#### Accessing the Database

```sql
-- View all commitment profiles
SELECT * FROM commitment_profiles;

-- View all commitments
SELECT * FROM commitments;

-- View commitments for a specific user
SELECT * FROM commitments WHERE user_id = 'user-uuid';

-- Calculate total commitments by item type
SELECT item_type, COUNT(*), SUM(grand_total) as total_value
FROM commitments
WHERE status = 'active'
GROUP BY item_type;
```

#### Using the Calculation Service

```javascript
import {
  calculateTotalCommittedValue,
  estimateDeliveryCost,
  estimateHandlingCost,
  estimateShippingCost,
  calculateAffiliateCommission,
  generateCommitmentSummary,
  ITEM_TYPES,
  QUANTITY_UNITS,
  SCHEDULE_INTERVALS
} from './lib/commitmentCalculatorService'

// Generate complete summary
const summary = generateCommitmentSummary({
  quantity: 100,
  unitPrice: 50,
  intervalCount: 3,
  itemType: 'Coconut',
  quantityUnit: 'Tons',
  requiresDelivery: true,
  requiresHandling: true,
  requiresShipping: true,
  commissionPercentage: 50,
  currency: 'PHP'
})

console.log(summary.formattedGrandTotal) // "₱18,500.00"
console.log(summary.formattedCommission) // "₱9,250.00"
```

#### Extending Functionality

1. **Add New Item Types**
   - Update `ITEM_TYPES` array in `commitmentCalculatorService.js`
   - Add cost rules to `COST_ESTIMATION_RULES`

2. **Add New Schedule Intervals**
   - Add to `SCHEDULE_INTERVALS` array with appropriate multiplier

3. **Custom Calculations**
   - Create new functions in `commitmentCalculatorService.js`
   - Import in component and use as needed

4. **Add More Fields**
   - Extend migration to add columns to `commitments` table
   - Update components to display/edit new fields
   - Add to RLS policies if needed

## Features

✅ **Real-time Calculations** - Costs update as you type  
✅ **Multiple Item Types** - Coconuts, equipment, machinery, labor, etc.  
✅ **Cost Breakdown** - Delivery, handling, shipping estimates  
✅ **Affiliate Commissions** - 50% default recurring commissions  
✅ **Schedule Flexibility** - Daily to annual intervals  
✅ **No Obligations** - Add/remove commitments anytime  
✅ **Responsive Design** - Works on mobile and desktop  
✅ **Secure** - Row-level security with Supabase  
✅ **Intuitive UI** - Excel-like table interface  
✅ **Currency Support** - PHP, USD, EUR  

## Database Tables

### commitment_profiles
```sql
- id (UUID, PK)
- user_id (UUID, FK, UNIQUE)
- planning_user_id (UUID, FK, optional)
- business_name (VARCHAR)
- business_type (VARCHAR) - farmer, vendor, wholesaler, etc.
- contact_person (VARCHAR)
- email (VARCHAR)
- phone_number (VARCHAR)
- address (TEXT)
- city, province, country (VARCHAR)
- bio (TEXT)
- profile_completed (BOOLEAN)
- metadata (JSONB)
- created_at, updated_at (TIMESTAMP)
```

### commitments
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- commitment_profile_id (UUID, FK)
- status (VARCHAR) - draft, active, paused, completed, cancelled
- item_type (VARCHAR) - coconut, equipment, machinery, etc.
- item_description (VARCHAR)
- quantity (DECIMAL)
- quantity_unit (VARCHAR) - pieces, tons, liters, kg, hours, etc.
- scheduled_interval (VARCHAR) - daily, weekly, monthly, etc.
- interval_count (INT)
- unit_price (DECIMAL)
- currency (VARCHAR, default: PHP)
- total_committed_value (DECIMAL) - auto-calculated
- requires_delivery, requires_handling, requires_shipping (BOOLEAN)
- estimated_delivery_cost, handling_cost, shipping_cost (DECIMAL)
- total_additional_costs (DECIMAL) - auto-calculated
- grand_total (DECIMAL) - auto-calculated
- commission_percentage (DECIMAL)
- affiliate_user_id (UUID, FK, optional)
- affiliate_commission_amount (DECIMAL) - auto-calculated
- notes (TEXT)
- metadata (JSONB)
- created_at, updated_at (TIMESTAMP)
- started_at, ended_at (TIMESTAMP, optional)
```

## Migration Steps

1. **Apply Database Migration**
   ```bash
   # The migration file is ready at: supabase/migrations/060_create_commitments_system.sql
   # It will be automatically applied when you push to Supabase
   ```

2. **No Configuration Needed**
   - Uses existing Supabase client
   - Uses existing auth system
   - Ready to use immediately

## Future Enhancements

- [ ] Partnership agreements/contracts
- [ ] Automatic commission distribution
- [ ] Analytics dashboard
- [ ] Export to PDF/Excel
- [ ] Notifications for status changes
- [ ] Integration with payments
- [ ] Multi-currency conversion
- [ ] Bulk upload from CSV
- [ ] Advanced filtering and search
- [ ] Approval workflows
- [ ] Activity timeline
- [ ] Document attachments
- [ ] Video/image uploads

## Support

For issues or questions:
1. Check database migration status in Supabase
2. Verify user is authenticated
3. Check browser console for errors
4. Review RLS policies in Supabase
5. Ensure all components are imported correctly

## Files Modified/Created

### New Files
- `supabase/migrations/060_create_commitments_system.sql`
- `src/lib/commitmentCalculatorService.js`
- `src/components/CommitmentManager.jsx`
- `src/components/CommitmentForm.jsx`
- `src/components/CommitmentCalculator.jsx`

### Modified Files
- `src/App.jsx` - Added import, route handling, and rendering
- `src/components/Sidebar.jsx` - Added navigation link

## Access the Feature

**URL:** `https://yourapp.com/commitments`

**Navigation:** 
- Sidebar → Community → 🥥 Partnership Network
- Footer → Partnership Network link
