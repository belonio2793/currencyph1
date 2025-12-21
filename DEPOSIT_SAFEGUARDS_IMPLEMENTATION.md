# Deposit Safeguards & Synchronization System

## Overview

This implementation adds comprehensive safeguards to the deposit system to prevent double-crediting, enable safe reversals, track all changes, and keep everything synchronized across the network.

## What's New

### 1. **Audit Trail System**
Every deposit status change is now fully logged with:
- **deposit_status_history**: Tracks every status transition (pending → approved → completed, etc.)
- **deposit_audit_log**: Records complete audit trail with admin info, old state, new state, wallet impact
- **Admin accountability**: Every change is tracked with admin ID, email, timestamp

### 2. **Idempotency Prevention**
- **Problem**: If a network request times out, admins might click "Approve" twice, accidentally double-crediting the wallet
- **Solution**: Every approval includes a unique `idempotency_key`. If the same key is submitted twice, the system returns the cached result instead of processing again
- **Benefit**: Safe to retry failed requests without worrying about double-processing

### 3. **Version Control**
- Each deposit now has a `version` number that increments with each change
- **Optimistic locking**: If deposit was modified while you're changing it, you'll get an error instead of overwriting changes
- **Network sync**: Version numbers help track what was synced and what might have been missed

### 4. **Safe Reversals**
- When reverting an approval, the system:
  - Validates the wallet has sufficient balance
  - Debits the wallet correctly
  - Creates a reversal registry tracking the relationship
  - Records complete audit trail
- **Benefit**: Can safely revert incorrect approvals without corrupting wallet balances

### 5. **Wallet Balance Reconciliation**
- **Problem**: If a wallet approval fails halfway, balance might be inconsistent
- **Solution**: New reconciliation system that:
  - Compares actual wallet balance vs sum of approved deposits
  - Detects discrepancies automatically
  - Provides tools to fix them safely
  - Logs all corrections for audit

### 6. **Network-wide Sync**
- New `depositSyncService` that:
  - Validates all deposits across the system
  - Finds orphaned deposits (referencing deleted wallets)
  - Detects possible duplicates
  - Generates consistency reports
  - Can auto-fix common issues

## Database Schema Changes

### New Tables

```sql
-- Tracks all status changes
CREATE TABLE deposit_status_history (
  id UUID PRIMARY KEY,
  deposit_id UUID,
  old_status TEXT,
  new_status TEXT,
  changed_by UUID,
  reason TEXT,
  created_at TIMESTAMP
)

-- Complete audit trail
CREATE TABLE deposit_audit_log (
  id UUID PRIMARY KEY,
  deposit_id UUID,
  action TEXT ('approve', 'reject', 'reverse'),
  old_state JSONB,
  new_state JSONB,
  wallet_impact JSONB,
  admin_id UUID,
  idempotency_key TEXT UNIQUE,
  status TEXT ('success', 'failed'),
  network_sync_version INT
)

-- Tracks reversals and relationships
CREATE TABLE deposit_reversal_registry (
  id UUID PRIMARY KEY,
  original_deposit_id UUID,
  reversal_deposit_id UUID,
  reason TEXT,
  reversed_by UUID,
  status TEXT ('active', 'superseded')
)

-- Optimistic locking
CREATE TABLE deposit_state_lock (
  deposit_id UUID PRIMARY KEY,
  version INT,
  locked_by UUID,
  last_modified_at TIMESTAMP
)

-- Balance reconciliation tracking
CREATE TABLE wallet_balance_reconciliation (
  id UUID PRIMARY KEY,
  wallet_id UUID,
  balance_before NUMERIC,
  balance_after NUMERIC,
  discrepancy NUMERIC,
  reconciliation_type TEXT ('deposit_approval', 'deposit_reversal', 'auto_sync'),
  admin_id UUID,
  status TEXT ('pending', 'completed')
)
```

### Modified Deposits Table

New columns added:
- `version INT DEFAULT 1` - For optimistic locking
- `idempotency_key TEXT UNIQUE` - For idempotency
- `approved_by UUID` - Admin who approved
- `approved_at TIMESTAMP` - When approved
- `reversal_reason TEXT` - Reason if reverted

## How to Use

### For Admin UI

#### 1. Import the Admin Component
```jsx
import AdminDepositManager from '../components/AdminDepositManager'

// In your admin page:
<AdminDepositManager />
```

#### 2. Features Available
- **Filter by status**: View pending, approved, completed, rejected deposits
- **Approve/Reject**: Instantly with audit trail
- **Revert approval**: Safely revert with balance checking
- **View audit history**: See complete change history for any deposit
- **Reconcile wallet**: Check and fix balance discrepancies
- **Idempotent operations**: Safe to retry without double-crediting

### For Backend Integration

#### 1. Change Deposit Status Safely
```javascript
import { depositStatusChangeService } from '../lib/depositStatusChangeService'

const result = await depositStatusChangeService.changeDepositStatus(
  depositId,
  'approved', // new status
  {
    adminId: 'user-uuid',
    adminEmail: 'admin@example.com',
    reason: 'Manual approval',
    notes: { custom: 'data' },
    idempotencyKey: 'unique-key-per-request' // optional, auto-generated if missing
  }
)

if (result.success) {
  console.log('Deposit approved')
  console.log('Audit log:', result.auditLog)
  console.log('Wallet impact:', result.walletReconciliation)
} else {
  console.error('Failed:', result.warnings)
}
```

#### 2. Get Audit History
```javascript
const { statusHistory, auditLogs } = await depositStatusChangeService.getAuditHistory(depositId)

// statusHistory: All status transitions
// auditLogs: Detailed operation logs with wallet impacts
```

#### 3. Reconcile Wallet Balance
```javascript
const reconciliation = await depositStatusChangeService.reconcileWalletBalance(walletId, adminId)

if (!reconciliation.isBalanced) {
  console.log(`Discrepancy: ${reconciliation.discrepancy}`)
  console.log(`Expected: ${reconciliation.expectedBalance}`)
  console.log(`Actual: ${reconciliation.actualBalance}`)
}
```

### For Network Sync

#### 1. Check User Deposits Sync
```javascript
import { depositSyncService } from '../lib/depositSyncService'

const syncReport = await depositSyncService.syncUserDeposits(userId, adminId)

// syncReport contains:
// - Total/pending/approved/completed counts
// - Wallet reconciliation results
// - Duplicate detection
// - Orphaned deposit detection
// - Issues and warnings
```

#### 2. Fix Balance Discrepancy
```javascript
const result = await depositSyncService.fixDiscrepancy(walletId, adminId, 'Correction reason')

// Automatically:
// - Recalculates expected balance from deposits
// - Updates wallet balance
// - Records correction in audit trail
// - Creates wallet transaction
```

#### 3. Generate Sync Report
```javascript
const report = await depositSyncService.generateSyncReport(adminId, {
  includeUsers: true,
  limit: 1000
})

// Shows:
// - Total deposits by status
// - Deposits by method
// - Discrepancies found
// - Recommendations
```

#### 4. Check Network Consistency
```javascript
const consistency = await depositSyncService.checkNetworkConsistency(adminId)

// Shows:
// - Total wallets
// - Inconsistent wallets
// - Consistency rate
// - Issues to fix
```

## Edge Functions

### Safe Deposit Status Change Function
**Endpoint**: `POST /functions/v1/safe-deposit-status-change`

**Request**:
```javascript
{
  depositId: "deposit-uuid",
  newStatus: "approved", // or 'rejected', 'completed', 'pending'
  adminId: "admin-user-uuid",
  adminEmail: "admin@example.com",
  reason: "Manual approval",
  notes: { /* any JSON data */ },
  idempotencyKey: "unique-key" // optional
}
```

**Response**:
```javascript
{
  success: true,
  message: "Deposit status changed...",
  deposit: { /* updated deposit */ },
  auditLog: { /* audit log entry */ },
  walletImpact: { /* balance change details */ }
}
```

## Safeguards in Place

### 1. **Idempotency**
- Each request has a unique `idempotencyKey`
- If same key submitted twice, returns cached result
- Prevents double-crediting from network retries

### 2. **Optimistic Locking**
- Each deposit has a `version` number
- Status updates only succeed if version hasn't changed
- Returns 409 error if deposit was modified concurrently
- Prevents race conditions

### 3. **Balance Validation**
- Before crediting: Verify wallet exists
- Before debiting (reversal): Verify sufficient balance
- Prevents negative balances

### 4. **Audit Trail**
- Every change logged in `deposit_status_history`
- Complete state snapshots in `deposit_audit_log`
- Admin accountability
- Can trace exactly what happened when

### 5. **Reversal Registry**
- When reverting approval, creates registry entry
- Tracks original → reversal relationships
- Can detect if deposit was reverted multiple times
- Helps investigate anomalies

### 6. **Wallet Reconciliation**
- Automatic balance checking
- Detects and logs discrepancies
- Can auto-fix consistent issues
- Manual review for unusual cases

### 7. **State Locks**
- Prevents concurrent modifications
- Each deposit has a lock with expiration
- Prevents "stuck" locks from blocking forever

## Workflow Examples

### Approving a Deposit

```javascript
// Admin clicks "Approve" button
const result = await depositStatusChangeService.changeDepositStatus(
  depositId,
  'approved',
  {
    adminId: currentUserId,
    adminEmail: currentUserEmail,
    reason: 'Verified by admin',
    idempotencyKey: generateUniqueKey()
  }
)

if (result.success) {
  // Show: "Deposit approved for 10,000 PHP"
  // wallet balance updated: 50,000 → 60,000
  // Audit log created automatically
}
```

### Reverting an Incorrect Approval

```javascript
// Admin realizes approval was wrong, clicks "Revert"
const result = await depositStatusChangeService.changeDepositStatus(
  depositId,
  'pending',
  {
    adminId: currentUserId,
    adminEmail: currentUserEmail,
    reason: 'Incorrect approval - user reported duplicate',
    idempotencyKey: generateUniqueKey()
  }
)

if (result.success) {
  // Wallet balance restored: 60,000 → 50,000
  // Reversal registry created
  // Audit log shows who reverted and why
  // User can re-deposit if needed
}
```

### Reconciling a Wallet

```javascript
// Admin suspects balance is wrong
const reconciliation = await depositStatusChangeService.reconcileWalletBalance(walletId, adminId)

if (!reconciliation.isBalanced) {
  // Show discrepancy: Expected 100,000, Actual 95,000
  
  // Option 1: Fix automatically
  const fixed = await depositSyncService.fixDiscrepancy(walletId, adminId, 'Balance correction')
  
  // Option 2: Investigate (show audit history)
  const history = await depositStatusChangeService.getAuditHistory(depositId)
  // Look for approvals that were never recorded
  // Check for failed transactions
}
```

## Monitoring & Alerts

### Recommended Monitoring
1. **Pending deposits older than 24 hours** - Approval bottleneck
2. **Wallet balance discrepancies** - Data inconsistency
3. **Repeated status changes** - Possible user confusion or fraud
4. **High reversal rate** - Quality issue with approvals
5. **Failed idempotency keys** - Network issues

### Audit Reports
Run periodically:
```javascript
const report = await depositSyncService.generateSyncReport(adminId)
const consistency = await depositSyncService.checkNetworkConsistency(adminId)

// If consistency < 95%, escalate
// If discrepancies > threshold, investigate
```

## Migration Steps

1. **Apply migration**:
   ```bash
   # The migration file creates all new tables
   # Apply via Supabase dashboard or CLI
   supabase migration up
   ```

2. **Deploy edge function**:
   ```bash
   # Push the safe-deposit-status-change function
   supabase functions deploy safe-deposit-status-change
   ```

3. **Add admin UI** (optional but recommended):
   ```jsx
   // In admin section, add:
   import AdminDepositManager from './AdminDepositManager'
   ```

4. **Test thoroughly**:
   - Approve a test deposit
   - Verify audit log created
   - Revert the approval
   - Check wallet balance restored
   - View audit history
   - Test reconciliation

## Troubleshooting

### "Deposit was modified concurrently"
- Means deposit version changed while you were updating
- Refresh and try again
- If persistent, check for other concurrent operations

### Balance discrepancy detected
```javascript
// 1. Check what deposits exist
const { data } = await supabase
  .from('deposits')
  .select('*')
  .eq('wallet_id', walletId)
  
// 2. Verify status values
// 3. Use reconciliation to fix
await depositSyncService.fixDiscrepancy(walletId, adminId, 'reason')
```

### Idempotency key error
- Idempotency keys must be unique per request
- Use UUID or timestamp-based generation
- Don't reuse keys across different operations

### Audit log not created
- Check RLS policies allow insert
- Verify user has proper permissions
- Check if table exists (created by migration)

## Security Considerations

1. **Edge function requires service role key** - Never expose in browser
2. **Admin UI should check user is admin** - Add role-based access control
3. **Audit logs are immutable** - No deletions, only inserts
4. **Sensitive data in notes** - Consider encryption if needed
5. **Reconciliation should be admin-only** - Restrict API access

## Performance Notes

- All queries use indexes for fast lookups
- Status history stored separately (doesn't slow down deposit queries)
- Audit logs are append-only (no slow updates)
- Reconciliation might take a few seconds for users with 1000+ deposits
- Consider pagination for large reports

## Future Enhancements

1. **Automated reconciliation** - Run nightly sync
2. **Deposit review queue** - Auto-escalate suspicious deposits
3. **Bulk operations** - Approve multiple deposits at once
4. **Notifications** - Alert admins of discrepancies
5. **Analytics** - Trends in approval times, reversal rates
6. **Compliance reports** - For auditing and regulatory requirements

## Support & Documentation

For issues or questions:
1. Check deposit audit history first
2. Review reconciliation reports
3. Check wallet transactions
4. Review edge function logs (Supabase dashboard)

All changes are fully auditable - can trace any issue to the original action and who performed it.
