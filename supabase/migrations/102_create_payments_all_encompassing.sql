-- Migration: Create All-Encompassing Payments Table
-- Description: A central table for all payment transactions, mapping to both merchant and customer views.

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
    
    -- Source references (UUID matching)
    payment_intent_id UUID REFERENCES public.payment_intents(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    payment_link_id UUID REFERENCES public.payment_links(id) ON DELETE SET NULL,
    deposit_intent_id UUID REFERENCES public.deposit_intents(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    
    -- Guest Info (if no customer_id)
    guest_email TEXT,
    guest_name TEXT,
    
    -- Financial Data
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
    fee_amount DECIMAL(12, 2) DEFAULT 0.00,
    net_amount DECIMAL(12, 2), -- amount - fee_amount
    
    -- Status & Type
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'cancelled')),
    payment_type TEXT NOT NULL DEFAULT 'payment' CHECK (payment_type IN ('payment', 'deposit', 'withdrawal', 'refund', 'transfer')),
    payment_method TEXT, -- e.g., 'wallet_balance', 'gcash', 'paymaya', 'bank_transfer', 'crypto'
    
    -- Metadata & Display
    description TEXT,
    reference_number TEXT UNIQUE, -- User-facing reference number
    external_reference_id TEXT, -- ID from external provider (e.g., GCash ref, Stripe ID)
    qr_code_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Constraints for syncing
    CONSTRAINT payments_payment_intent_unique UNIQUE (payment_intent_id),
    CONSTRAINT payments_deposit_intent_unique UNIQUE (deposit_intent_id),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_merchant_id ON public.payments(merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_business_id ON public.payments(business_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_intent_id ON public.payments(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_reference_number ON public.payments(reference_number);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- 1. Merchants can see payments made to them
CREATE POLICY "Merchants can view their own received payments" ON public.payments
    FOR SELECT
    USING (
        merchant_id IN (
            SELECT id FROM public.merchants WHERE owner_user_id = auth.uid()
        )
    );

-- 2. Customers can see payments they made
CREATE POLICY "Customers can view their own made payments" ON public.payments
    FOR SELECT
    USING (customer_id = auth.uid());

-- 3. System/Service Role can manage all (implicit)

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Function to generate reference number if not provided
CREATE OR REPLACE FUNCTION generate_payment_reference_number()
RETURNS TRIGGER AS $$
DECLARE
    prefix TEXT := 'PAY-';
    random_str TEXT;
BEGIN
    IF NEW.reference_number IS NULL THEN
        random_str := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
        NEW.reference_number := prefix || random_str || '-' || to_char(now(), 'YYYYMMDD');
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for reference number
CREATE TRIGGER set_payment_reference_number
    BEFORE INSERT ON public.payments
    FOR EACH ROW
    EXECUTE PROCEDURE generate_payment_reference_number();

-- Comment on table
COMMENT ON TABLE public.payments IS 'Centralized ledger for all finalized payment transactions in the system.';

-- Sync Triggers to automatically populate the payments table
-- 1. Sync from payment_intents
CREATE OR REPLACE FUNCTION sync_payment_intent_to_payments()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'succeeded' AND (OLD.status IS NULL OR OLD.status <> 'succeeded') THEN
        INSERT INTO public.payments (
            merchant_id,
            customer_id,
            payment_intent_id,
            invoice_id,
            payment_link_id,
            guest_email,
            guest_name,
            amount,
            currency,
            status,
            payment_type,
            metadata,
            completed_at
        ) VALUES (
            NEW.merchant_id,
            NEW.payer_id,
            NEW.id,
            NEW.invoice_id,
            NEW.payment_link_id,
            NEW.guest_email,
            NEW.guest_name,
            NEW.amount,
            NEW.currency,
            'succeeded',
            'payment',
            NEW.metadata,
            now()
        )
        ON CONFLICT (payment_intent_id) DO UPDATE SET
            status = 'succeeded',
            completed_at = now(),
            updated_at = now();
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_sync_payment_intent_to_payments ON public.payment_intents;
CREATE TRIGGER tr_sync_payment_intent_to_payments
    AFTER UPDATE ON public.payment_intents
    FOR EACH ROW
    EXECUTE PROCEDURE sync_payment_intent_to_payments();

-- 2. Sync from deposit_intents
CREATE OR REPLACE FUNCTION sync_deposit_intent_to_payments()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
        INSERT INTO public.payments (
            customer_id,
            deposit_intent_id,
            amount,
            currency,
            status,
            payment_type,
            payment_method,
            metadata,
            completed_at
        ) VALUES (
            NEW.user_id,
            NEW.id,
            NEW.amount,
            NEW.currency,
            'succeeded',
            'deposit',
            NEW.deposit_method,
            NEW.metadata,
            now()
        )
        ON CONFLICT (deposit_intent_id) DO UPDATE SET
            status = 'succeeded',
            completed_at = now(),
            updated_at = now();
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_sync_deposit_intent_to_payments ON public.deposit_intents;
CREATE TRIGGER tr_sync_deposit_intent_to_payments
    AFTER UPDATE ON public.deposit_intents
    FOR EACH ROW
    EXECUTE PROCEDURE sync_deposit_intent_to_payments();
