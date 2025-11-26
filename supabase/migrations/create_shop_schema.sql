-- Create shop_categories table
CREATE TABLE IF NOT EXISTS shop_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  parent_category_id UUID REFERENCES shop_categories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  seo_title VARCHAR(255),
  seo_description TEXT,
  seo_keywords TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shop_products table with extensive metadata
CREATE TABLE IF NOT EXISTS shop_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  long_description TEXT,
  category_id UUID NOT NULL REFERENCES shop_categories(id) ON DELETE RESTRICT,
  brand VARCHAR(255),
  base_price DECIMAL(12, 2) NOT NULL,
  cost_price DECIMAL(12, 2),
  selling_price DECIMAL(12, 2),
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  discount_amount DECIMAL(12, 2),
  final_price DECIMAL(12, 2),
  currency VARCHAR(3) DEFAULT 'PHP',
  weight_kg DECIMAL(10, 3),
  dimensions_cm JSONB,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  is_bestseller BOOLEAN DEFAULT false,
  total_stock INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  supplier_id VARCHAR(255),
  supplier_name VARCHAR(255),
  supplier_product_id VARCHAR(255),
  origin_country VARCHAR(100),
  warranty_months INTEGER,
  return_days INTEGER DEFAULT 30,
  shipping_class VARCHAR(50),
  is_fragile BOOLEAN DEFAULT false,
  requires_special_handling BOOLEAN DEFAULT false,
  manufacturing_date DATE,
  expiry_date DATE,
  batch_number VARCHAR(255),
  tags TEXT,
  rating DECIMAL(3, 2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  seo_title VARCHAR(255),
  seo_description TEXT,
  seo_keywords TEXT,
  meta_data JSONB DEFAULT '{}'::jsonb,
  alibaba_url TEXT,
  alibaba_product_id VARCHAR(255),
  alibaba_shop_name VARCHAR(255),
  alibaba_min_order INT,
  alibaba_shipping_cost DECIMAL(12, 2),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create shop_product_variants table
CREATE TABLE IF NOT EXISTS shop_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  sku VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  variant_type VARCHAR(50),
  option_name VARCHAR(100),
  option_value VARCHAR(255),
  price_adjustment DECIMAL(12, 2) DEFAULT 0,
  cost_adjustment DECIMAL(12, 2) DEFAULT 0,
  weight_adjustment_kg DECIMAL(10, 3) DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shop_product_images table
CREATE TABLE IF NOT EXISTS shop_product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text VARCHAR(255),
  caption TEXT,
  position INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  mime_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shop_product_inventory table
CREATE TABLE IF NOT EXISTS shop_product_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  warehouse_location VARCHAR(255),
  quantity_on_hand INTEGER DEFAULT 0,
  quantity_reserved INTEGER DEFAULT 0,
  quantity_damaged INTEGER DEFAULT 0,
  last_stock_count TIMESTAMP WITH TIME ZONE,
  reorder_status VARCHAR(50),
  lead_time_days INTEGER,
  supplier_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shop_customers table
CREATE TABLE IF NOT EXISTS shop_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  date_of_birth DATE,
  gender VARCHAR(10),
  customer_type VARCHAR(50) DEFAULT 'individual',
  company_name VARCHAR(255),
  company_registration_number VARCHAR(255),
  tax_id VARCHAR(255),
  preferred_currency VARCHAR(3) DEFAULT 'PHP',
  preferred_language VARCHAR(10) DEFAULT 'en',
  total_lifetime_value DECIMAL(15, 2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(15, 2) DEFAULT 0,
  last_order_date TIMESTAMP WITH TIME ZONE,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  loyalty_points INTEGER DEFAULT 0,
  tier VARCHAR(50) DEFAULT 'bronze',
  marketing_consent BOOLEAN DEFAULT false,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shop_addresses table
CREATE TABLE IF NOT EXISTS shop_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES shop_customers(id) ON DELETE CASCADE,
  address_type VARCHAR(50) DEFAULT 'shipping',
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  company_name VARCHAR(255),
  street_address VARCHAR(255) NOT NULL,
  street_address_2 VARCHAR(255),
  barangay VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  province VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'Philippines',
  phone VARCHAR(20),
  email VARCHAR(255),
  is_default BOOLEAN DEFAULT false,
  is_billing_address BOOLEAN DEFAULT false,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  delivery_instructions TEXT,
  verified BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shop_orders table
CREATE TABLE IF NOT EXISTS shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES shop_customers(id) ON DELETE RESTRICT,
  order_status VARCHAR(50) DEFAULT 'pending',
  payment_status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(100),
  payment_method_details JSONB,
  subtotal DECIMAL(12, 2) NOT NULL,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  discount_code VARCHAR(100),
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  shipping_cost DECIMAL(12, 2) DEFAULT 0,
  handling_fee DECIMAL(12, 2) DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  shipping_address_id UUID REFERENCES shop_addresses(id) ON DELETE SET NULL,
  billing_address_id UUID REFERENCES shop_addresses(id) ON DELETE SET NULL,
  shipping_method VARCHAR(100),
  tracking_number VARCHAR(255),
  estimated_delivery_date DATE,
  actual_delivery_date DATE,
  customer_notes TEXT,
  admin_notes TEXT,
  cancellation_reason VARCHAR(255),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  refund_amount DECIMAL(12, 2),
  refund_method VARCHAR(100),
  refund_date TIMESTAMP WITH TIME ZONE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create shop_order_items table
CREATE TABLE IF NOT EXISTS shop_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE RESTRICT,
  variant_id UUID REFERENCES shop_product_variants(id) ON DELETE SET NULL,
  product_sku VARCHAR(100),
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  total_price DECIMAL(12, 2) NOT NULL,
  weight_kg DECIMAL(10, 3),
  attributes JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shop_order_status_history table
CREATE TABLE IF NOT EXISTS shop_order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  status_from VARCHAR(50),
  status_to VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shop_reviews table
CREATE TABLE IF NOT EXISTS shop_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES shop_customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES shop_orders(id) ON DELETE SET NULL,
  title VARCHAR(255),
  comment TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  verified_purchase BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  unhelpful_count INTEGER DEFAULT 0,
  is_approved BOOLEAN DEFAULT true,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  response_comment TEXT,
  response_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  response_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shop_wishlist table
CREATE TABLE IF NOT EXISTS shop_wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES shop_customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  priority VARCHAR(50) DEFAULT 'medium',
  notification_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(customer_id, product_id)
);

-- Create shop_promotions table
CREATE TABLE IF NOT EXISTS shop_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  discount_type VARCHAR(50),
  discount_value DECIMAL(12, 2),
  discount_percentage DECIMAL(5, 2),
  max_discount_amount DECIMAL(12, 2),
  minimum_order_amount DECIMAL(12, 2),
  max_usage_count INTEGER,
  max_usage_per_customer INTEGER DEFAULT 1,
  usage_count INTEGER DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  is_automatic BOOLEAN DEFAULT false,
  applicable_categories TEXT,
  applicable_products TEXT,
  excluded_products TEXT,
  customer_groups TEXT,
  first_time_buyers_only BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create shop_cart table (session-based)
CREATE TABLE IF NOT EXISTS shop_cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES shop_customers(id) ON DELETE CASCADE,
  session_id VARCHAR(255),
  product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES shop_product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days'
);

-- Create indexes for better query performance
CREATE INDEX idx_shop_products_category ON shop_products(category_id);
CREATE INDEX idx_shop_products_slug ON shop_products(slug);
CREATE INDEX idx_shop_products_sku ON shop_products(sku);
CREATE INDEX idx_shop_products_active ON shop_products(is_active) WHERE is_active = true;
CREATE INDEX idx_shop_products_featured ON shop_products(is_featured) WHERE is_featured = true;
CREATE INDEX idx_shop_products_bestseller ON shop_products(is_bestseller) WHERE is_bestseller = true;
CREATE INDEX idx_shop_product_images_product ON shop_product_images(product_id);
CREATE INDEX idx_shop_product_variants_product ON shop_product_variants(product_id);
CREATE INDEX idx_shop_product_inventory_product ON shop_product_inventory(product_id);
CREATE INDEX idx_shop_customers_email ON shop_customers(email);
CREATE INDEX idx_shop_customers_user ON shop_customers(user_id);
CREATE INDEX idx_shop_addresses_customer ON shop_addresses(customer_id);
CREATE INDEX idx_shop_orders_customer ON shop_orders(customer_id);
CREATE INDEX idx_shop_orders_number ON shop_orders(order_number);
CREATE INDEX idx_shop_orders_status ON shop_orders(order_status);
CREATE INDEX idx_shop_orders_payment_status ON shop_orders(payment_status);
CREATE INDEX idx_shop_orders_created ON shop_orders(created_at);
CREATE INDEX idx_shop_order_items_order ON shop_order_items(order_id);
CREATE INDEX idx_shop_order_items_product ON shop_order_items(product_id);
CREATE INDEX idx_shop_reviews_product ON shop_reviews(product_id);
CREATE INDEX idx_shop_reviews_customer ON shop_reviews(customer_id);
CREATE INDEX idx_shop_wishlist_customer ON shop_wishlist(customer_id);
CREATE INDEX idx_shop_wishlist_product ON shop_wishlist(product_id);
CREATE INDEX idx_shop_promotions_code ON shop_promotions(code);
CREATE INDEX idx_shop_promotions_active ON shop_promotions(is_active) WHERE is_active = true;
CREATE INDEX idx_shop_cart_customer ON shop_cart(customer_id);
CREATE INDEX idx_shop_cart_session ON shop_cart(session_id);

-- Enable RLS (Row Level Security)
ALTER TABLE shop_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_product_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_cart ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow public read for products, authenticated write for orders)
CREATE POLICY "Public products are viewable by everyone" ON shop_products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view their own customer profile" ON shop_customers
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can view their own addresses" ON shop_addresses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shop_customers 
      WHERE shop_customers.id = shop_addresses.customer_id 
      AND shop_customers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own orders" ON shop_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shop_customers 
      WHERE shop_customers.id = shop_orders.customer_id 
      AND shop_customers.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view reviews" ON shop_reviews
  FOR SELECT USING (is_approved = true);

-- Create trigger to update product updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_update_timestamp
BEFORE UPDATE ON shop_products
FOR EACH ROW
EXECUTE FUNCTION update_product_timestamp();

-- Create trigger to auto-update product final_price
CREATE OR REPLACE FUNCTION calculate_product_final_price()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.selling_price IS NOT NULL THEN
    NEW.final_price = NEW.selling_price;
  ELSIF NEW.discount_amount IS NOT NULL AND NEW.discount_amount > 0 THEN
    NEW.final_price = NEW.base_price - NEW.discount_amount;
  ELSIF NEW.discount_percentage IS NOT NULL AND NEW.discount_percentage > 0 THEN
    NEW.final_price = NEW.base_price - (NEW.base_price * NEW.discount_percentage / 100);
  ELSE
    NEW.final_price = NEW.base_price;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_price_calculation
BEFORE INSERT OR UPDATE ON shop_products
FOR EACH ROW
EXECUTE FUNCTION calculate_product_final_price();

-- Create trigger for order total calculation
CREATE OR REPLACE FUNCTION calculate_order_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_amount = COALESCE(NEW.subtotal, 0) + COALESCE(NEW.tax_amount, 0) + COALESCE(NEW.shipping_cost, 0) + COALESCE(NEW.handling_fee, 0) - COALESCE(NEW.discount_amount, 0);
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_total_calculation
BEFORE INSERT OR UPDATE ON shop_orders
FOR EACH ROW
EXECUTE FUNCTION calculate_order_total();
