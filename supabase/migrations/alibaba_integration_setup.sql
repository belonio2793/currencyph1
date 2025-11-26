-- Alibaba Integration Tables
-- Tracks synced products and sync metadata

CREATE TABLE IF NOT EXISTS public.alibaba_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
  start_time TIMESTAMPTZ DEFAULT now(),
  end_time TIMESTAMPTZ,
  products_imported INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  products_failed INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table to link industrial_products with their original Alibaba data
CREATE TABLE IF NOT EXISTS public.alibaba_product_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industrial_product_id uuid NOT NULL UNIQUE REFERENCES public.industrial_products(id) ON DELETE CASCADE,
  alibaba_product_id VARCHAR(255) NOT NULL UNIQUE,
  alibaba_supplier_id VARCHAR(255),
  supplier_name VARCHAR(255),
  supplier_url TEXT,
  original_price DECIMAL(12, 2),
  original_currency VARCHAR(3),
  sync_log_id uuid REFERENCES public.alibaba_sync_log(id) ON DELETE SET NULL,
  
  -- Raw Alibaba data snapshot for reference
  alibaba_raw_data JSONB DEFAULT '{}'::jsonb,
  
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table for sync queue/scheduling
CREATE TABLE IF NOT EXISTS public.alibaba_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN ('full', 'incremental', 'manual')),
  priority INTEGER DEFAULT 0,
  alibaba_product_id VARCHAR(255),
  
  -- Retry logic
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  
  scheduled_for TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alibaba configuration (one per app instance)
CREATE TABLE IF NOT EXISTS public.alibaba_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id VARCHAR(255),
  -- Note: App secret and API signature should be stored in secrets/environment, NOT in DB
  
  sync_enabled BOOLEAN DEFAULT false,
  sync_frequency_minutes INTEGER DEFAULT 60,
  auto_sync_on_startup BOOLEAN DEFAULT true,
  
  -- Filter settings for what to import
  filter_by_category BOOLEAN DEFAULT false,
  allowed_categories TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  min_price DECIMAL(12, 2) DEFAULT 0,
  max_price DECIMAL(12, 2),
  
  import_images BOOLEAN DEFAULT true,
  import_certifications BOOLEAN DEFAULT true,
  max_products_per_sync INTEGER DEFAULT 1000,
  
  -- Metadata
  last_full_sync TIMESTAMPTZ,
  last_incremental_sync TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alibaba_sync_log_status ON public.alibaba_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_alibaba_sync_log_created ON public.alibaba_sync_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alibaba_product_mapping_alibaba_id ON public.alibaba_product_mapping(alibaba_product_id);
CREATE INDEX IF NOT EXISTS idx_alibaba_product_mapping_synced ON public.alibaba_product_mapping(last_synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_alibaba_sync_queue_status ON public.alibaba_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_alibaba_sync_queue_priority ON public.alibaba_sync_queue(priority DESC, scheduled_for ASC);

-- Enable RLS
ALTER TABLE public.alibaba_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alibaba_product_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alibaba_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alibaba_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only authenticated admins can manage
CREATE POLICY "admin_read_sync_log" ON public.alibaba_sync_log
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.businesses WHERE user_id = auth.uid()));

CREATE POLICY "admin_read_product_mapping" ON public.alibaba_product_mapping
  FOR SELECT USING (true);

CREATE POLICY "admin_read_sync_queue" ON public.alibaba_sync_queue
  FOR SELECT USING (auth.uid() IN (SELECT user_id FROM public.businesses WHERE user_id = auth.uid()));

CREATE POLICY "admin_read_config" ON public.alibaba_config
  FOR SELECT USING (true);

-- Insert default config (empty, waiting for API keys)
INSERT INTO public.alibaba_config (app_id) VALUES (null) ON CONFLICT DO NOTHING;
