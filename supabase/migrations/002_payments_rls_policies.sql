-- ===============================================
-- Complete RLS Policies for Payments Module
-- Safe, Idempotent - Can be run multiple times
-- ===============================================

-- ============ PRODUCTS RLS POLICIES ============
DO $$
BEGIN
    -- Users can view products for their merchants
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='users_can_view_products_for_their_merchants'
    ) THEN
        CREATE POLICY users_can_view_products_for_their_merchants ON products
        FOR SELECT USING (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;

    -- Users can create products for their merchants
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='users_can_create_products_for_their_merchants'
    ) THEN
        CREATE POLICY users_can_create_products_for_their_merchants ON products
        FOR INSERT WITH CHECK (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;

    -- Users can update products for their merchants
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='users_can_update_products_for_their_merchants'
    ) THEN
        CREATE POLICY users_can_update_products_for_their_merchants ON products
        FOR UPDATE USING (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;

    -- Users can delete products for their merchants
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='users_can_delete_products_for_their_merchants'
    ) THEN
        CREATE POLICY users_can_delete_products_for_their_merchants ON products
        FOR DELETE USING (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;
END$$;

-- ============ PRICES RLS POLICIES ============
DO $$
BEGIN
    -- Users can view prices for their merchants
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='prices' AND policyname='users_can_view_prices_for_their_merchants'
    ) THEN
        CREATE POLICY users_can_view_prices_for_their_merchants ON prices
        FOR SELECT USING (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;

    -- Users can create prices for their merchants
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='prices' AND policyname='users_can_create_prices_for_their_merchants'
    ) THEN
        CREATE POLICY users_can_create_prices_for_their_merchants ON prices
        FOR INSERT WITH CHECK (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;

    -- Users can update prices for their merchants
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='prices' AND policyname='users_can_update_prices_for_their_merchants'
    ) THEN
        CREATE POLICY users_can_update_prices_for_their_merchants ON prices
        FOR UPDATE USING (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;

    -- Users can delete prices for their merchants
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='prices' AND policyname='users_can_delete_prices_for_their_merchants'
    ) THEN
        CREATE POLICY users_can_delete_prices_for_their_merchants ON prices
        FOR DELETE USING (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;
END$$;

-- ============ INVOICES RLS POLICIES ============
DO $$
BEGIN
    -- Merchants can view their invoices, customers can view their own
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='users_can_view_invoices'
    ) THEN
        CREATE POLICY users_can_view_invoices ON invoices
        FOR SELECT USING (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            ) OR customer_id = auth.uid()
        );
    END IF;

    -- Merchants can create invoices
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='users_can_create_invoices'
    ) THEN
        CREATE POLICY users_can_create_invoices ON invoices
        FOR INSERT WITH CHECK (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;

    -- Merchants can update their own invoices
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='users_can_update_their_invoices'
    ) THEN
        CREATE POLICY users_can_update_their_invoices ON invoices
        FOR UPDATE USING (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;

    -- Merchants can delete their invoices
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='invoices' AND policyname='users_can_delete_their_invoices'
    ) THEN
        CREATE POLICY users_can_delete_their_invoices ON invoices
        FOR DELETE USING (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;
END$$;

-- ============ PAYMENT_INTENTS RLS POLICIES ============
DO $$
BEGIN
    -- Users can view their payment intents
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='payment_intents' AND policyname='users_can_view_payment_intents'
    ) THEN
        CREATE POLICY users_can_view_payment_intents ON payment_intents
        FOR SELECT USING (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            ) OR payer_id = auth.uid()
        );
    END IF;

    -- Anyone can create payment intents (guest checkout)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='payment_intents' AND policyname='anyone_can_create_payment_intents'
    ) THEN
        CREATE POLICY anyone_can_create_payment_intents ON payment_intents
        FOR INSERT WITH CHECK (true);
    END IF;

    -- Payers and merchants can update payment intents
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='payment_intents' AND policyname='users_can_update_payment_intents'
    ) THEN
        CREATE POLICY users_can_update_payment_intents ON payment_intents
        FOR UPDATE USING (
            payer_id = auth.uid() OR merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;

    -- Merchants can delete payment intents
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='payment_intents' AND policyname='users_can_delete_payment_intents'
    ) THEN
        CREATE POLICY users_can_delete_payment_intents ON payment_intents
        FOR DELETE USING (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;
END$$;

-- ============ TRANSACTIONS RLS POLICIES ============
DO $$
BEGIN
    -- Users can view their transactions
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='users_can_view_transactions'
    ) THEN
        CREATE POLICY users_can_view_transactions ON transactions
        FOR SELECT USING (
            payment_intent_id IN (
                SELECT id FROM payment_intents WHERE payer_id = auth.uid() OR
                    merchant_id IN (SELECT id FROM merchants WHERE owner_user_id = auth.uid())
            )
        );
    END IF;

    -- Users can create transactions (via payment processing)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='users_can_create_transactions'
    ) THEN
        CREATE POLICY users_can_create_transactions ON transactions
        FOR INSERT WITH CHECK (true);
    END IF;

    -- Merchants can update transactions for their payment intents
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='users_can_update_transactions'
    ) THEN
        CREATE POLICY users_can_update_transactions ON transactions
        FOR UPDATE USING (
            payment_intent_id IN (
                SELECT id FROM payment_intents WHERE
                    merchant_id IN (SELECT id FROM merchants WHERE owner_user_id = auth.uid())
            )
        );
    END IF;

    -- Merchants can delete transactions
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='transactions' AND policyname='users_can_delete_transactions'
    ) THEN
        CREATE POLICY users_can_delete_transactions ON transactions
        FOR DELETE USING (
            payment_intent_id IN (
                SELECT id FROM payment_intents WHERE
                    merchant_id IN (SELECT id FROM merchants WHERE owner_user_id = auth.uid())
            )
        );
    END IF;
END$$;

-- ============ DEPOSIT_INTENTS RLS POLICIES ============
DO $$
BEGIN
    -- Users can view their own deposit intents
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='deposit_intents' AND policyname='users_can_view_deposit_intents'
    ) THEN
        CREATE POLICY users_can_view_deposit_intents ON deposit_intents
        FOR SELECT USING (user_id = auth.uid());
    END IF;

    -- Users can create deposit intents
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='deposit_intents' AND policyname='users_can_create_deposit_intents'
    ) THEN
        CREATE POLICY users_can_create_deposit_intents ON deposit_intents
        FOR INSERT WITH CHECK (user_id = auth.uid());
    END IF;

    -- Users can update their deposit intents
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='deposit_intents' AND policyname='users_can_update_deposit_intents'
    ) THEN
        CREATE POLICY users_can_update_deposit_intents ON deposit_intents
        FOR UPDATE USING (user_id = auth.uid());
    END IF;

    -- Users can delete their deposit intents
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='deposit_intents' AND policyname='users_can_delete_deposit_intents'
    ) THEN
        CREATE POLICY users_can_delete_deposit_intents ON deposit_intents
        FOR DELETE USING (user_id = auth.uid());
    END IF;
END$$;

-- ============ PAYMENT_LINKS RLS POLICIES ============
DO $$
BEGIN
    -- Users can view payment links for their merchants
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='payment_links' AND policyname='users_can_view_payment_links'
    ) THEN
        CREATE POLICY users_can_view_payment_links ON payment_links
        FOR SELECT USING (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;

    -- Users can create payment links
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='payment_links' AND policyname='users_can_create_payment_links'
    ) THEN
        CREATE POLICY users_can_create_payment_links ON payment_links
        FOR INSERT WITH CHECK (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;

    -- Users can update payment links
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='payment_links' AND policyname='users_can_update_payment_links'
    ) THEN
        CREATE POLICY users_can_update_payment_links ON payment_links
        FOR UPDATE USING (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;

    -- Users can delete payment links
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename='payment_links' AND policyname='users_can_delete_payment_links'
    ) THEN
        CREATE POLICY users_can_delete_payment_links ON payment_links
        FOR DELETE USING (
            merchant_id IN (
                SELECT id FROM merchants WHERE owner_user_id = auth.uid()
            )
        );
    END IF;
END$$;
