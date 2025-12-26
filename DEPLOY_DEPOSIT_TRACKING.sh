#!/bin/bash

# ============================================================================
# DEPLOYMENT SCRIPT: Deposit ID Tracking Migrations
# ============================================================================
# This script applies the deposit_id tracking feature to wallet_transactions
# 
# Prerequisites:
# - psql must be installed and in PATH
# - Database credentials must be configured (via .pgpass or environment)
# - Run from project root directory
#
# Usage:
#   bash DEPLOY_DEPOSIT_TRACKING.sh
# 
# Or with database connection details:
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=password bash DEPLOY_DEPOSIT_TRACKING.sh
# ============================================================================

set -e  # Exit on first error

echo "=========================================="
echo "Deposit ID Tracking Deployment"
echo "=========================================="
echo ""

# Step 1: Apply migration 0121
echo "Step 1: Applying migration 0121..."
echo "   - Adding deposit_id column to wallet_transactions"
echo "   - Creating foreign key constraint"
echo "   - Creating performance indexes"
echo "   - Updating record_ledger_transaction() function"
echo "   - Updating trigger_auto_credit_on_deposit_approval() trigger"
echo ""

psql < supabase/migrations/0121_add_deposit_id_to_wallet_transactions.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration 0121 applied successfully!"
else
    echo "❌ Migration 0121 failed!"
    exit 1
fi

echo ""

# Step 2: Apply migration 0122
echo "Step 2: Applying migration 0122..."
echo "   - Updating sync_wallet_balance_on_deposit_delete() function"
echo "   - Preserving audit trail on deposit deletion"
echo "   - Setting deposit_id = NULL for sync records"
echo ""

psql < supabase/migrations/0122_update_delete_trigger_with_deposit_id.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration 0122 applied successfully!"
else
    echo "❌ Migration 0122 failed!"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Verify installation:"
echo "   psql -c \"SELECT column_name FROM information_schema.columns WHERE table_name = 'wallet_transactions' AND column_name = 'deposit_id';\""
echo ""
echo "2. Test functionality:"
echo "   psql -c \"SELECT COUNT(*) FROM wallet_transactions WHERE deposit_id IS NOT NULL;\""
echo ""
echo "3. Check for errors in application logs"
echo ""
