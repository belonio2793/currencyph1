# Receipt System Documentation

## Overview

The receipt system in this application provides a comprehensive solution for merchants to create, manage, and send digital receipts to customers. The system is designed with dual-access architecture, allowing both merchants and customers to view their receipts through their own accounts while maintaining data consistency.

## Database Schema

### Core Table: `business_receipts`

```sql
CREATE TABLE public.business_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receipt_number varchar(50),
  customer_name varchar(255),
  customer_email varchar(255),
  customer_phone varchar(255),
  amount numeric(12,2) NOT NULL,
  payment_method varchar(50),
  items jsonb DEFAULT '[]'::jsonb,
  notes text,
  is_printed boolean DEFAULT false,
  status varchar(20) DEFAULT 'completed' 
    CHECK (status IN ('draft', 'completed', 'refunded', 'cancelled')),
  is_sent boolean DEFAULT false,
  sent_to_email varchar(255),
  sent_to_phone varchar(255),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Field Descriptions

| Field | Type | Purpose | Notes |
|-------|------|---------|-------|
| `id` | UUID | Unique receipt identifier | Auto-generated |
| `business_id` | UUID | References the business that issued the receipt | Foreign key to `businesses` table |
| `user_id` | UUID | References the merchant/business owner | Foreign key to `auth.users` |
| `receipt_number` | varchar | Human-readable receipt identifier | Format: `RCP-{timestamp}-{random}` |
| `customer_name` | varchar | Name of the customer receiving the receipt | Optional, defaults to "Walk-in Customer" |
| `customer_email` | varchar | Customer's primary email | Optional, used for access control |
| `customer_phone` | varchar | Customer's phone number | Optional, used for access control |
| `amount` | numeric | Total receipt amount | Calculated from items |
| `payment_method` | varchar | How payment was made | Options: 'Cash', 'Balance', 'Other', or custom |
| `items` | jsonb | Array of purchased items | Format: `[{description, quantity, price}]` |
| `notes` | text | Additional notes or remarks | Optional |
| `is_printed` | boolean | Whether receipt was printed | Defaults to false |
| `status` | varchar | Receipt status | Values: 'draft', 'completed', 'refunded', 'cancelled' |
| `is_sent` | boolean | Whether receipt was sent to customer | Defaults to false |
| `sent_to_email` | varchar | Alternate email the receipt was sent to | May differ from `customer_email` |
| `sent_to_phone` | varchar | Alternate phone the receipt was sent to | May differ from `customer_phone` |
| `sent_at` | timestamptz | When the receipt was sent | Populated when `is_sent = true` |
| `created_at` | timestamptz | Receipt creation timestamp | Auto-generated |
| `updated_at` | timestamptz | Last update timestamp | Auto-updated |

### Indexes for Performance

```sql
CREATE INDEX idx_business_receipts_business ON public.business_receipts(business_id);
CREATE INDEX idx_business_receipts_created ON public.business_receipts(created_at);
CREATE INDEX idx_business_receipts_user_id ON public.business_receipts(user_id);
CREATE INDEX idx_business_receipts_customer_email ON public.business_receipts(customer_email);
CREATE INDEX idx_business_receipts_customer_phone ON public.business_receipts(customer_phone);
CREATE INDEX idx_business_receipts_sent_to_email ON public.business_receipts(sent_to_email);
CREATE INDEX idx_business_receipts_sent_to_phone ON public.business_receipts(sent_to_phone);
CREATE INDEX idx_business_receipts_status ON public.business_receipts(status);
```

## Row Level Security (RLS) Policies

### Merchant Access

Merchants can view, create, and update receipts for their own businesses:

```sql
-- Merchants can view all receipts for their businesses
CREATE POLICY "Merchants can view business receipts" ON public.business_receipts
  FOR SELECT USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

-- Merchants can create receipts for their businesses
CREATE POLICY "Merchants can create receipts" ON public.business_receipts
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );

-- Merchants can update receipts
CREATE POLICY "Merchants can update receipts" ON public.business_receipts
  FOR UPDATE USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE user_id = auth.uid()
    )
  );
```

### Customer Access

Customers can view receipts issued to them through multiple channels:

```sql
-- Customers can view receipts by email address
CREATE POLICY "Customers can view receipts by email" ON public.business_receipts
  FOR SELECT USING (
    customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Customers can view receipts by phone number
CREATE POLICY "Customers can view receipts by phone" ON public.business_receipts
  FOR SELECT USING (
    customer_phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
  );

-- Customers can view receipts sent to alternate email
CREATE POLICY "Customers can view receipts sent to email" ON public.business_receipts
  FOR SELECT USING (
    sent_to_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Customers can view receipts sent to alternate phone
CREATE POLICY "Customers can view receipts sent to phone" ON public.business_receipts
  FOR SELECT USING (
    sent_to_phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
  );
```

## Data Sync Strategy

### Merchant View (Business Owner)
- Merchants see all receipts created by their business
- Access is controlled by the `business_id` and `user_id` relationship with the `businesses` table
- Merchants can see the complete receipt history for all transactions

### Customer View (Receipt Recipient)
- Customers receive receipts when the merchant issues one to their email/phone
- Customers can only view receipts that match their:
  - `customer_email` matches their auth email, OR
  - `customer_phone` matches their auth phone, OR
  - `sent_to_email` matches their auth email, OR
  - `sent_to_phone` matches their auth phone
- This provides multiple ways for customers to receive and view receipts

### Data Flow

```
1. Merchant creates receipt
   ├─ Sets: business_id, user_id, customer_email/phone
   ├─ Amount calculated from items
   └─ Status: 'completed'

2. Receipt auto-synced to merchant's account
   └─ Visible via: SELECT * FROM business_receipts WHERE business_id IN (user's businesses)

3. Merchant sends receipt to customer
   ├─ Updates: is_sent = true, sent_at = NOW()
   ├─ Sets: sent_to_email and/or sent_to_phone
   └─ (In production: Email/SMS service integration)

4. Receipt auto-synced to customer's account
   └─ Visible via: SELECT * FROM business_receipts WHERE 
         customer_email = auth.email() OR sent_to_email = auth.email() OR
         customer_phone = auth.phone() OR sent_to_phone = auth.phone()
```

## API Methods

### receiptService.js

#### `createReceipt(businessId, userId, receiptData)`
Creates a new receipt with automatic validation.

**Parameters:**
```javascript
{
  businessId: string,           // UUID of merchant's business
  userId: string,               // UUID of merchant/business owner
  receiptData: {
    receipt_number?: string,    // Auto-generated if not provided
    customer_name?: string,     // Defaults to "Walk-in Customer"
    customer_email?: string,    // Optional
    customer_phone?: string,    // Optional
    amount: number,             // Total amount in PHP
    payment_method: string,     // 'Cash', 'Balance', 'Other', etc.
    items: Array<{              // Required: at least one item
      description: string,
      quantity: number,
      price: number
    }>,
    notes?: string             // Optional
  }
}
```

**Returns:** Receipt object with all fields

**Error Handling:**
- Validates business_id and user_id exist
- Validates amount >= 0
- Requires at least one valid item
- Throws descriptive error messages

---

#### `getBusinessReceipts(businessId, limit = 50)`
Retrieves all receipts for a specific business, ordered by creation date (newest first).

**Returns:** Array of receipt objects

---

#### `getUserReceipts(customerEmail, customerPhone)`
Retrieves all receipts issued to a customer by email or phone.

**Parameters:**
- `customerEmail`: Email address to search
- `customerPhone`: Phone number to search

**Returns:** Merged and deduplicated array of receipt objects with business details

---

#### `sendReceipt(receiptId, sendToEmail, sendToPhone)`
Marks a receipt as sent and records where it was sent.

**Parameters:**
- `receiptId`: UUID of the receipt
- `sendToEmail`: Email to send to (optional if phone provided)
- `sendToPhone`: Phone to send to (optional if email provided)

**Returns:** Updated receipt object

**Updates in DB:**
- `is_sent = true`
- `sent_at = NOW()`
- `sent_to_email = sendToEmail`
- `sent_to_phone = sendToPhone`

---

#### `searchReceipts(businessId, searchTerm)`
Searches receipts by customer name, email, or phone within a business.

**Returns:** Array of matching receipt objects

---

#### `updateReceipt(receiptId, updates)`
Generic update method for receipt modifications.

**Parameters:**
- `receiptId`: UUID
- `updates`: Object with fields to update

---

#### `deleteReceipt(receiptId)`
Deletes a receipt from the database.

---

## Frontend Implementation

### MerchantReceipts Component

The receipt creation UI is in `src/components/MerchantReceipts.jsx` and provides:

#### Features:
1. **No Requirements Receipt Creation**
   - Customer name defaults to "Walk-in Customer"
   - Email and phone are optional
   - Amount is auto-calculated from items
   - Receipt number is auto-generated

2. **Item Management**
   - Add items with description, quantity, price
   - Save frequently used items to browser localStorage
   - Reuse saved items in future receipts
   - Edit items before sending

3. **Payment Method Selection**
   - Default: "Balance"
   - Options: Cash, Balance, Other (custom)
   - Custom payment methods supported

4. **Send Receipt To Customer**
   - Modal prompts after receipt creation
   - Can send via email, phone, or both
   - Defaults to customer info provided
   - Can override with alternate contact info
   - Skip option if sending later

5. **Receipt History**
   - View all created receipts
   - Search by receipt number, customer, email, phone
   - Display payment method, amount, date
   - View/export receipt details

### Item Storage

Saved items are stored in browser localStorage with key: `saved-items-{businessId}`

Format:
```javascript
[
  {
    id: "timestamp",
    name: "Coffee",
    description: "Regular Coffee",
    quantity: 1,
    price: 150
  }
]
```

## Testing Checklist

- [ ] Create receipt with minimal data (no customer info)
- [ ] Create receipt with full customer info
- [ ] Save item for future use
- [ ] Reuse saved item in another receipt
- [ ] Send receipt after creation
- [ ] Search receipts by customer name
- [ ] Search receipts by email
- [ ] Search receipts by phone
- [ ] Verify merchant can see own business receipts
- [ ] Verify customer can see receipt in their account (if registered)
- [ ] Verify payment method defaults to "Balance"
- [ ] Test custom payment methods
- [ ] Verify receipt amount calculation
- [ ] Test pagination and search

## Future Enhancements

1. **Email/SMS Integration**
   - Connect to Resend or Twilio for actual email/SMS delivery
   - Add delivery status tracking
   - Add email/SMS templates

2. **Receipt Preferences**
   - Customer preferences for receipt delivery
   - Subscription to receipt notifications
   - Digital receipt storage limits

3. **Receipt Analytics**
   - Sales trends by product
   - Customer purchase history
   - Payment method preferences

4. **Receipt Customization**
   - Business logo and branding
   - Custom footer/header messages
   - Receipt template selection

5. **Compliance Features**
   - BIR-compliant receipt formats
   - Digital signature support
   - Audit logging

## Troubleshooting

### "Failed to create receipt" Error

**Possible Causes:**
1. `business_id` or `user_id` missing or invalid
   - **Fix:** Ensure MyBusiness passes both props correctly
   
2. No valid items provided
   - **Fix:** Add at least one item with description and price > 0

3. RLS policy violation
   - **Fix:** Check that user_id matches current auth user
   - **Fix:** Check that business_id exists and belongs to user

4. Amount validation failed
   - **Fix:** Ensure amount is numeric and >= 0

### Customer Can't See Receipt

**Possible Causes:**
1. Merchant provided wrong email/phone
   - **Fix:** Verify customer_email matches their auth email or sent_to_email is correct

2. RLS policies not applied
   - **Fix:** Run migration 017_complete_receipt_schema_sync.sql

3. Customer not logged in with correct email
   - **Fix:** Verify auth email matches receipt email

### Saved Items Not Persisting

**Causes:**
1. Browser localStorage disabled
   - **Fix:** Enable localStorage in browser settings

2. Different business ID
   - **Fix:** Items are stored per-business

3. Private/Incognito mode
   - **Fix:** localStorage doesn't persist in private mode

## Related Files

- `src/components/MerchantReceipts.jsx` - UI for receipt management
- `src/lib/receiptService.js` - API layer for receipt operations
- `src/components/ReceiptTemplate.jsx` - Receipt display template
- `supabase/migrations/014_create_businesses_table.sql` - Initial schema
- `supabase/migrations/015_add_customer_phone_to_receipts.sql` - Added phone support
- `supabase/migrations/016_add_receipt_history_rls.sql` - Customer access policies
- `supabase/migrations/017_complete_receipt_schema_sync.sql` - Complete schema with sync
