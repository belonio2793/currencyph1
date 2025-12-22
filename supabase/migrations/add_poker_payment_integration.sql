-- Add payment integration columns to chip_purchases table
-- These columns link chip purchases to the payment system

ALTER TABLE IF EXISTS chip_purchases
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'wallet' CHECK (payment_method IN ('wallet', 'bank_transfer', 'credit_card', 'e_wallet', 'crypto'));

-- Create index on payment_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_chip_purchases_payment_id ON chip_purchases(payment_id);

-- Create index on product_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_chip_purchases_product_id ON chip_purchases(product_id);

-- Add comment for documentation
COMMENT ON COLUMN chip_purchases.product_id IS 'Reference to payment product for this chip purchase';
COMMENT ON COLUMN chip_purchases.payment_id IS 'Reference to payment record for auditing and transaction tracking';
COMMENT ON COLUMN chip_purchases.payment_method IS 'The payment method used for this purchase';
