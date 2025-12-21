-- ============================================================================
-- STATUS REVERSAL SYSTEM
-- Comprehensive audit and reversal system for all status changes back to 'pending'
-- ============================================================================

-- Create audit log table for tracking all reversals
CREATE TABLE IF NOT EXISTS public.status_reversal_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  operations JSONB DEFAULT '[]'::jsonb,
  errors JSONB DEFAULT '[]'::jsonb,
  reversed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'success',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  INDEX idx_table_record (table_name, record_id),
  INDEX idx_reversed_at (reversed_at)
);

-- Create a function to handle loan status reversals
CREATE OR REPLACE FUNCTION handle_loan_status_reversal()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes TO 'pending'
  IF NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending' THEN
    -- Log the reversal operation
    INSERT INTO status_reversal_audit_log (table_name, record_id, status)
    VALUES ('loans', NEW.id, 'pending_reversal_triggered');
    
    -- Reverse disbursements
    WITH disbursed_amounts AS (
      SELECT wallet_id, SUM(amount) as total_amount, currency_code
      FROM loan_disbursements
      WHERE loan_id = NEW.id AND status = 'completed'
      GROUP BY wallet_id, currency_code
    )
    UPDATE wallet_transactions
    SET amount = -amount
    FROM disbursed_amounts
    WHERE reference_id IN (
      SELECT id FROM loan_disbursements 
      WHERE loan_id = NEW.id AND status = 'completed'
    );

    -- Mark payments as reversed
    UPDATE loan_payments
    SET status = 'reversed'
    WHERE loan_id = NEW.id AND status IN ('completed', 'paid');

    -- Mark interest accrual as reversed
    UPDATE loan_interest_accrual
    SET status = 'reversed'
    WHERE loan_id = NEW.id AND status != 'reversed';

    -- Reset loan financial fields
    UPDATE loans
    SET 
      amount_disbursed = 0,
      amount_paid = 0,
      total_interest = 0,
      status = 'pending'
    WHERE id = NEW.id;

    UPDATE status_reversal_audit_log
    SET status = 'success'
    WHERE record_id = NEW.id AND table_name = 'loans'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for loans
DROP TRIGGER IF EXISTS trigger_loan_status_reversal ON loans;
CREATE TRIGGER trigger_loan_status_reversal
  AFTER UPDATE ON loans
  FOR EACH ROW
  WHEN (NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending')
  EXECUTE FUNCTION handle_loan_status_reversal();

-- Create function to handle order status reversals
CREATE OR REPLACE FUNCTION handle_order_status_reversal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending' THEN
    INSERT INTO status_reversal_audit_log (table_name, record_id, status)
    VALUES ('shop_orders', NEW.id, 'pending_reversal_triggered');

    -- Reverse inventory for all order items
    WITH order_items AS (
      SELECT product_id, quantity
      FROM shop_order_items
      WHERE order_id = NEW.id
    )
    UPDATE shop_product_inventory
    SET available_quantity = available_quantity + order_items.quantity
    FROM order_items
    WHERE product_id = order_items.product_id;

    -- Reset payment status
    UPDATE shop_orders
    SET payment_status = 'pending'
    WHERE id = NEW.id AND payment_status != 'pending';

    UPDATE status_reversal_audit_log
    SET status = 'success'
    WHERE record_id = NEW.id AND table_name = 'shop_orders'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for shop_orders
DROP TRIGGER IF EXISTS trigger_order_status_reversal ON shop_orders;
CREATE TRIGGER trigger_order_status_reversal
  AFTER UPDATE ON shop_orders
  FOR EACH ROW
  WHEN (NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending')
  EXECUTE FUNCTION handle_order_status_reversal();

-- Create function to handle deposit status reversals
CREATE OR REPLACE FUNCTION handle_deposit_status_reversal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending' THEN
    INSERT INTO status_reversal_audit_log (table_name, record_id, status)
    VALUES ('crypto_deposits', NEW.id, 'pending_reversal_triggered');

    -- Reverse wallet balance if it was confirmed/completed
    IF OLD.status IN ('confirmed', 'completed') THEN
      INSERT INTO wallet_transactions (user_id, wallet_id, transaction_type, amount, currency_code, description, reference_id)
      VALUES (
        NEW.user_id,
        NEW.wallet_id,
        'reversal',
        -NEW.amount,
        NEW.currency_code,
        'Deposit reversal - status reverted to pending',
        NEW.id
      );

      UPDATE wallets
      SET balance = balance - NEW.amount
      WHERE id = NEW.wallet_id;
    END IF;

    UPDATE status_reversal_audit_log
    SET status = 'success'
    WHERE record_id = NEW.id AND table_name = 'crypto_deposits'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for crypto_deposits
DROP TRIGGER IF EXISTS trigger_deposit_status_reversal ON crypto_deposits;
CREATE TRIGGER trigger_deposit_status_reversal
  AFTER UPDATE ON crypto_deposits
  FOR EACH ROW
  WHEN (NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending')
  EXECUTE FUNCTION handle_deposit_status_reversal();

-- Create function to handle payment status reversals
CREATE OR REPLACE FUNCTION handle_payment_status_reversal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' AND OLD.status IN ('succeeded', 'completed') THEN
    INSERT INTO status_reversal_audit_log (table_name, record_id, status)
    VALUES ('payments', NEW.id, 'pending_reversal_triggered');

    -- Create reversal payment record
    INSERT INTO payments (
      reference_number, guest_name, guest_email, amount, fee_amount,
      payment_type, payment_method, status, customer_id, metadata
    ) VALUES (
      'REVERSAL-' || NEW.id,
      NEW.guest_name,
      NEW.guest_email,
      -NEW.amount,
      NEW.fee_amount,
      'reversal',
      NEW.payment_method,
      'completed',
      NEW.customer_id,
      jsonb_build_object('original_payment_id', NEW.id, 'reason', 'status_reverted_to_pending')
    );

    UPDATE status_reversal_audit_log
    SET status = 'success'
    WHERE record_id = NEW.id AND table_name = 'payments'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payments
DROP TRIGGER IF EXISTS trigger_payment_status_reversal ON payments;
CREATE TRIGGER trigger_payment_status_reversal
  AFTER UPDATE ON payments
  FOR EACH ROW
  WHEN (NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending')
  EXECUTE FUNCTION handle_payment_status_reversal();

-- Create function to handle ride status reversals
CREATE OR REPLACE FUNCTION handle_ride_status_reversal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending' THEN
    INSERT INTO status_reversal_audit_log (table_name, record_id, status)
    VALUES ('ride_requests', NEW.id, 'pending_reversal_triggered');

    -- Revert ride matches
    UPDATE ride_matches
    SET status = 'pending'
    WHERE ride_id = NEW.id AND status != 'cancelled';

    -- Revert payment
    UPDATE ride_requests
    SET payment_status = 'pending'
    WHERE id = NEW.id AND payment_status = 'completed';

    UPDATE status_reversal_audit_log
    SET status = 'success'
    WHERE record_id = NEW.id AND table_name = 'ride_requests'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for ride_requests
DROP TRIGGER IF EXISTS trigger_ride_status_reversal ON ride_requests;
CREATE TRIGGER trigger_ride_status_reversal
  AFTER UPDATE ON ride_requests
  FOR EACH ROW
  WHEN (NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending')
  EXECUTE FUNCTION handle_ride_status_reversal();

-- Create function to handle shipment status reversals
CREATE OR REPLACE FUNCTION handle_shipment_status_reversal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending' THEN
    INSERT INTO status_reversal_audit_log (table_name, record_id, status)
    VALUES ('addresses_shipment_labels', NEW.id, 'pending_reversal_triggered');

    -- Mark tracking as reversed
    UPDATE addresses_shipment_tracking
    SET status = 'reversed'
    WHERE label_id = NEW.id AND status != 'reversed';

    -- Restore pending costs
    UPDATE addresses_route_cost_aggregates
    SET pending_amount = pending_amount + COALESCE(NEW.estimated_cost, 0)
    WHERE route_id = NEW.route_id;

    UPDATE status_reversal_audit_log
    SET status = 'success'
    WHERE record_id = NEW.id AND table_name = 'addresses_shipment_labels'
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for shipments
DROP TRIGGER IF EXISTS trigger_shipment_status_reversal ON addresses_shipment_labels;
CREATE TRIGGER trigger_shipment_status_reversal
  AFTER UPDATE ON addresses_shipment_labels
  FOR EACH ROW
  WHEN (NEW.status = 'pending' AND OLD.status IS DISTINCT FROM 'pending')
  EXECUTE FUNCTION handle_shipment_status_reversal();

-- Add indexes for better performance on reversal lookups
CREATE INDEX IF NOT EXISTS idx_loans_status_changed ON loans (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status_changed ON shop_orders (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_crypto_deposits_status_changed ON crypto_deposits (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_payments_status_changed ON payments (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_ride_requests_status_changed ON ride_requests (status, updated_at);
CREATE INDEX IF NOT EXISTS idx_addresses_shipment_labels_status_changed ON addresses_shipment_labels (status, updated_at);

-- Grant permissions if needed
GRANT ALL PRIVILEGES ON status_reversal_audit_log TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
