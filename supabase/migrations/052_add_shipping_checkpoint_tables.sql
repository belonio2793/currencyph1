-- Create addresses_shipment_checkpoints table if it doesn't exist
CREATE TABLE IF NOT EXISTS addresses_shipment_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_label_id UUID REFERENCES addresses_shipment_labels(id) ON DELETE CASCADE NOT NULL,
  
  -- Location Information
  checkpoint_name VARCHAR(255),
  checkpoint_type VARCHAR(50),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_address TEXT,
  
  -- Checkpoint Status
  status VARCHAR(50) DEFAULT 'scanned',
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scanned_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Additional Details
  notes TEXT,
  metadata JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create addresses_shipment_label_generated_codes table for bulk code generation tracking
CREATE TABLE IF NOT EXISTS addresses_shipment_label_generated_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Batch Information
  batch_id VARCHAR(50) UNIQUE NOT NULL,
  batch_size INTEGER DEFAULT 1,
  generated_count INTEGER DEFAULT 0,
  
  -- Batch Status
  status VARCHAR(50) DEFAULT 'pending',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- PDF and Export
  pdf_url TEXT,
  export_format VARCHAR(50) DEFAULT 'pdf',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for addresses_shipment_checkpoints
CREATE INDEX IF NOT EXISTS idx_addresses_shipment_checkpoints_shipping_label_id ON addresses_shipment_checkpoints(shipping_label_id);
CREATE INDEX IF NOT EXISTS idx_addresses_shipment_checkpoints_location ON addresses_shipment_checkpoints(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_addresses_shipment_checkpoints_scanned_at ON addresses_shipment_checkpoints(scanned_at);
CREATE INDEX IF NOT EXISTS idx_addresses_shipment_checkpoints_status ON addresses_shipment_checkpoints(status);

-- Create indexes for addresses_shipment_label_generated_codes
CREATE INDEX IF NOT EXISTS idx_addresses_shipment_label_generated_codes_user_id ON addresses_shipment_label_generated_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_shipment_label_generated_codes_batch_id ON addresses_shipment_label_generated_codes(batch_id);
CREATE INDEX IF NOT EXISTS idx_addresses_shipment_label_generated_codes_status ON addresses_shipment_label_generated_codes(status);

-- Enable Row Level Security if not already enabled
ALTER TABLE addresses_shipment_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses_shipment_label_generated_codes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for addresses_shipment_checkpoints
CREATE POLICY IF NOT EXISTS "Users can view checkpoints for their shipping labels"
  ON addresses_shipment_checkpoints FOR SELECT
  USING (
    shipping_label_id IN (
      SELECT id FROM addresses_shipment_labels WHERE user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can insert checkpoints for their shipping labels"
  ON addresses_shipment_checkpoints FOR INSERT
  WITH CHECK (
    shipping_label_id IN (
      SELECT id FROM addresses_shipment_labels WHERE user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Users can update checkpoints for their shipping labels"
  ON addresses_shipment_checkpoints FOR UPDATE
  USING (
    shipping_label_id IN (
      SELECT id FROM addresses_shipment_labels WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    shipping_label_id IN (
      SELECT id FROM addresses_shipment_labels WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for addresses_shipment_label_generated_codes
CREATE POLICY IF NOT EXISTS "Users can view their own generated codes"
  ON addresses_shipment_label_generated_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own generated codes"
  ON addresses_shipment_label_generated_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own generated codes"
  ON addresses_shipment_label_generated_codes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
