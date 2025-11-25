-- Create industrial_products table for Business Marketplace
-- Supports machinery, equipment, agriculture, and industrial goods

CREATE TABLE IF NOT EXISTS public.industrial_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Product Information
  name VARCHAR(255) NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  
  -- Specifications and Details
  specifications JSONB DEFAULT '{}'::jsonb,
  features JSONB DEFAULT '[]'::jsonb,
  attributes JSONB DEFAULT '{}'::jsonb,
  
  -- Pricing
  price DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  unit_of_measurement VARCHAR(50),
  minimum_order_quantity INTEGER DEFAULT 1,
  
  -- Inventory
  stock_quantity INTEGER DEFAULT 0,
  stock_status VARCHAR(50) DEFAULT 'in_stock',
  
  -- Media
  image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  primary_image_url TEXT,
  video_url TEXT,
  
  -- Location and Logistics
  origin_country VARCHAR(100),
  origin_city VARCHAR(100),
  shipping_available BOOLEAN DEFAULT true,
  delivery_time VARCHAR(100),
  delivery_cost DECIMAL(12, 2),
  
  -- Status and Visibility
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  visibility VARCHAR(50) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'wholesale_only')),
  
  -- Ratings and Reviews
  rating DECIMAL(3, 2),
  review_count INTEGER DEFAULT 0,
  
  -- Certifications and Compliance
  certifications JSONB DEFAULT '[]'::jsonb,
  compliance_info JSONB DEFAULT '{}'::jsonb,
  
  -- Business Terms
  moq_discount DECIMAL(5, 2),
  bulk_pricing JSONB DEFAULT '{}'::jsonb,
  return_policy TEXT,
  warranty_info TEXT,
  payment_terms TEXT,
  
  -- Metadata
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_modified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create industrial_product_reviews table
CREATE TABLE IF NOT EXISTS public.industrial_product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.industrial_products(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  content TEXT,
  
  verified_buyer BOOLEAN DEFAULT false,
  helpful_count INTEGER DEFAULT 0,
  unhelpful_count INTEGER DEFAULT 0,
  
  attachments JSONB DEFAULT '[]'::jsonb,
  
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create industrial_product_inquiries table for buyer inquiries
CREATE TABLE IF NOT EXISTS public.industrial_product_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.industrial_products(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  quantity_inquiry INTEGER,
  
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed', 'archived')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create industrial_product_orders table
CREATE TABLE IF NOT EXISTS public.industrial_product_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.industrial_products(id) ON DELETE RESTRICT,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  
  -- Order Details
  order_number VARCHAR(50) UNIQUE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  
  -- Shipping and Payment
  shipping_address JSONB,
  shipping_method VARCHAR(100),
  tracking_number VARCHAR(100),
  estimated_delivery_date DATE,
  
  payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  payment_method VARCHAR(50),
  
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

-- Create industrial_product_favorites table
CREATE TABLE IF NOT EXISTS public.industrial_product_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.industrial_products(id) ON DELETE CASCADE,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, product_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_industrial_products_business_id ON public.industrial_products(business_id);
CREATE INDEX IF NOT EXISTS idx_industrial_products_seller_id ON public.industrial_products(seller_id);
CREATE INDEX IF NOT EXISTS idx_industrial_products_category ON public.industrial_products(category);
CREATE INDEX IF NOT EXISTS idx_industrial_products_status ON public.industrial_products(status);
CREATE INDEX IF NOT EXISTS idx_industrial_products_slug ON public.industrial_products(slug);
CREATE INDEX IF NOT EXISTS idx_industrial_products_created_at ON public.industrial_products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_industrial_products_rating ON public.industrial_products(rating DESC);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.industrial_product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_reviewer_id ON public.industrial_product_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status ON public.industrial_product_reviews(status);

CREATE INDEX IF NOT EXISTS idx_product_inquiries_product_id ON public.industrial_product_inquiries(product_id);
CREATE INDEX IF NOT EXISTS idx_product_inquiries_buyer_id ON public.industrial_product_inquiries(buyer_id);
CREATE INDEX IF NOT EXISTS idx_product_inquiries_seller_id ON public.industrial_product_inquiries(seller_id);
CREATE INDEX IF NOT EXISTS idx_product_inquiries_status ON public.industrial_product_inquiries(status);

CREATE INDEX IF NOT EXISTS idx_product_orders_product_id ON public.industrial_product_orders(product_id);
CREATE INDEX IF NOT EXISTS idx_product_orders_buyer_id ON public.industrial_product_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_product_orders_seller_id ON public.industrial_product_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_product_orders_status ON public.industrial_product_orders(status);

CREATE INDEX IF NOT EXISTS idx_product_favorites_user_id ON public.industrial_product_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_product_favorites_product_id ON public.industrial_product_favorites(product_id);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_industrial_products_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER industrial_products_update_timestamp
BEFORE UPDATE ON public.industrial_products
FOR EACH ROW
EXECUTE FUNCTION update_industrial_products_timestamp();

CREATE TRIGGER product_reviews_update_timestamp
BEFORE UPDATE ON public.industrial_product_reviews
FOR EACH ROW
EXECUTE FUNCTION update_industrial_products_timestamp();

CREATE TRIGGER product_inquiries_update_timestamp
BEFORE UPDATE ON public.industrial_product_inquiries
FOR EACH ROW
EXECUTE FUNCTION update_industrial_products_timestamp();

CREATE TRIGGER product_orders_update_timestamp
BEFORE UPDATE ON public.industrial_product_orders
FOR EACH ROW
EXECUTE FUNCTION update_industrial_products_timestamp();

-- Enable Row Level Security (RLS)
ALTER TABLE public.industrial_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industrial_product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industrial_product_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industrial_product_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industrial_product_favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can read active products
CREATE POLICY "public_read_active_products" ON public.industrial_products
  FOR SELECT USING (status = 'active' AND visibility = 'public');

-- RLS Policy: Sellers can read their own products
CREATE POLICY "seller_read_own_products" ON public.industrial_products
  FOR SELECT USING (auth.uid() = seller_id);

-- RLS Policy: Sellers can insert products for their business
CREATE POLICY "seller_insert_products" ON public.industrial_products
  FOR INSERT WITH CHECK (auth.uid() = seller_id AND auth.uid() IN (SELECT user_id FROM public.businesses WHERE id = business_id));

-- RLS Policy: Sellers can update their own products
CREATE POLICY "seller_update_own_products" ON public.industrial_products
  FOR UPDATE USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- RLS Policy: Sellers can delete their own products
CREATE POLICY "seller_delete_own_products" ON public.industrial_products
  FOR DELETE USING (auth.uid() = seller_id);

-- RLS Policy: Anyone authenticated can read reviews
CREATE POLICY "public_read_reviews" ON public.industrial_product_reviews
  FOR SELECT USING (true);

-- RLS Policy: Users can create reviews
CREATE POLICY "user_create_reviews" ON public.industrial_product_reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- RLS Policy: Anyone can read inquiries they are involved in
CREATE POLICY "inquiry_read_policy" ON public.industrial_product_inquiries
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- RLS Policy: Buyers can create inquiries
CREATE POLICY "buyer_create_inquiries" ON public.industrial_product_inquiries
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- RLS Policy: Involved parties can read orders
CREATE POLICY "order_read_policy" ON public.industrial_product_orders
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- RLS Policy: Buyers can create orders
CREATE POLICY "buyer_create_orders" ON public.industrial_product_orders
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- RLS Policy: Involved parties can update orders
CREATE POLICY "order_update_policy" ON public.industrial_product_orders
  FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id)
  WITH CHECK (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- RLS Policy: Users can manage their favorites
CREATE POLICY "user_manage_favorites" ON public.industrial_product_favorites
  FOR ALL USING (auth.uid() = user_id);
