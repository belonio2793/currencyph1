-- Create merchants table
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  merchant_name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  default_settlement_currency VARCHAR(3) DEFAULT 'PHP',
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT merchants_owner_unique UNIQUE(owner_user_id, merchant_name)
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create prices table
CREATE TABLE IF NOT EXISTS prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
  type VARCHAR(50) NOT NULL DEFAULT 'one_time',
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email TEXT,
  customer_name TEXT,
  amount_due DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  due_date DATE,
  description TEXT,
  line_items JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Create payment_intents table
CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  payer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_email TEXT,
  guest_name TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  source_type VARCHAR(50) NOT NULL,
  reference_id UUID,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  payment_link_id UUID,
  qr_code_data TEXT,
  onboarding_state VARCHAR(50) DEFAULT 'none',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  from_balance_id UUID REFERENCES balances(id) ON DELETE SET NULL,
  to_balance_id UUID REFERENCES balances(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  transaction_hash TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create deposit_intents table (for guest checkout flow)
CREATE TABLE IF NOT EXISTS deposit_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
  deposit_method VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  linked_payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create payment_links table
CREATE TABLE IF NOT EXISTS payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  price_id UUID REFERENCES prices(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(12, 2),
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
  is_active BOOLEAN DEFAULT true,
  url_slug TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT payment_links_slug_unique UNIQUE(merchant_id, url_slug)
);

-- Create indexes for better query performance
CREATE INDEX idx_merchants_owner_user_id ON merchants(owner_user_id);
CREATE INDEX idx_merchants_business_id ON merchants(business_id);
CREATE INDEX idx_products_merchant_id ON products(merchant_id);
CREATE INDEX idx_prices_merchant_id ON prices(merchant_id);
CREATE INDEX idx_prices_product_id ON prices(product_id);
CREATE INDEX idx_invoices_merchant_id ON invoices(merchant_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_payment_intents_merchant_id ON payment_intents(merchant_id);
CREATE INDEX idx_payment_intents_payer_id ON payment_intents(payer_id);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);
CREATE INDEX idx_payment_intents_invoice_id ON payment_intents(invoice_id);
CREATE INDEX idx_transactions_payment_intent_id ON transactions(payment_intent_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_deposit_intents_user_id ON deposit_intents(user_id);
CREATE INDEX idx_payment_links_merchant_id ON payment_links(merchant_id);
CREATE INDEX idx_payment_links_slug ON payment_links(url_slug);

-- Enable RLS
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for merchants
CREATE POLICY "Users can view their own merchants" ON merchants
  FOR SELECT USING (owner_user_id = auth.uid());

CREATE POLICY "Users can create their own merchants" ON merchants
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Users can update their own merchants" ON merchants
  FOR UPDATE USING (owner_user_id = auth.uid());

CREATE POLICY "Users can delete their own merchants" ON merchants
  FOR DELETE USING (owner_user_id = auth.uid());

-- RLS Policies for products
CREATE POLICY "Users can view products for their merchants" ON products
  FOR SELECT USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create products for their merchants" ON products
  FOR INSERT WITH CHECK (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update products for their merchants" ON products
  FOR UPDATE USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete products for their merchants" ON products
  FOR DELETE USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

-- RLS Policies for prices
CREATE POLICY "Users can view prices for their merchants" ON prices
  FOR SELECT USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create prices for their merchants" ON prices
  FOR INSERT WITH CHECK (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update prices for their merchants" ON prices
  FOR UPDATE USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete prices for their merchants" ON prices
  FOR DELETE USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

-- RLS Policies for invoices
CREATE POLICY "Merchants can view their invoices" ON invoices
  FOR SELECT USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    ) OR customer_id = auth.uid()
  );

CREATE POLICY "Merchants can create invoices" ON invoices
  FOR INSERT WITH CHECK (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can update their invoices" ON invoices
  FOR UPDATE USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

-- RLS Policies for payment_intents
CREATE POLICY "Users can view their payment intents" ON payment_intents
  FOR SELECT USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    ) OR payer_id = auth.uid()
  );

CREATE POLICY "Anyone can create payment intents" ON payment_intents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Payers can update their intents" ON payment_intents
  FOR UPDATE USING (
    payer_id = auth.uid() OR merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

-- RLS Policies for transactions
CREATE POLICY "Users can view their transactions" ON transactions
  FOR SELECT USING (
    payment_intent_id IN (
      SELECT id FROM payment_intents WHERE payer_id = auth.uid() OR
        merchant_id IN (SELECT id FROM merchants WHERE owner_user_id = auth.uid())
    )
  );

CREATE POLICY "Users can create transactions" ON transactions
  FOR INSERT WITH CHECK (true);

-- RLS Policies for deposit_intents
CREATE POLICY "Users can view their deposit intents" ON deposit_intents
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create deposit intents" ON deposit_intents
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their deposit intents" ON deposit_intents
  FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for payment_links
CREATE POLICY "Users can view payment links for their merchants" ON payment_links
  FOR SELECT USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create payment links" ON payment_links
  FOR INSERT WITH CHECK (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update payment links" ON payment_links
  FOR UPDATE USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete payment links" ON payment_links
  FOR DELETE USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_user_id = auth.uid()
    )
  );
