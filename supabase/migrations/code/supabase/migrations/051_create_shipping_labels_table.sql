-- Create shipping_labels table for barcode and QR code tracking
CREATE TABLE IF NOT EXISTS shipping_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Unique identifier for the label
  serial_id VARCHAR(50) UNIQUE NOT NULL,
  barcode_data TEXT,
  qr_code_data TEXT,
  
  -- Shipment/Package Information
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  package_name VARCHAR(255),
  package_description TEXT,
  package_weight DECIMAL(8, 2),
  package_dimensions VARCHAR(100),
  
  -- Origin and Destination
  origin_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  destination_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  
  -- Route and Status
  status VARCHAR(50) DEFAULT 'created',
  current_checkpoint_id UUID,
  
  -- Label metadata
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Additional information
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shipping_checkpoints table for tracking package locations
CREATE TABLE IF NOT EXISTS shipping_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_label_id UUID REFERENCES shipping_labels(id) ON DELETE CASCADE NOT NULL,
  
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

-- Create shipping_label_generated_codes table for bulk code generation tracking
CREATE TABLE IF NOT EXISTS shipping_label_generated_codes (
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

-- Create indexes for faster queries
CREATE INDEX idx_shipping_labels_user_id ON shipping_labels(user_id);
CREATE INDEX idx_shipping_labels_serial_id ON shipping_labels(serial_id);
CREATE INDEX idx_shipping_labels_status ON shipping_labels(status);
CREATE INDEX idx_shipping_labels_shipment_id ON shipping_labels(shipment_id);
CREATE INDEX idx_shipping_labels_created_at ON shipping_labels(created_at);

CREATE INDEX idx_shipping_checkpoints_shipping_label_id ON shipping_checkpoints(shipping_label_id);
CREATE INDEX idx_shipping_checkpoints_location ON shipping_checkpoints(latitude, longitude);
CREATE INDEX idx_shipping_checkpoints_scanned_at ON shipping_checkpoints(scanned_at);
CREATE INDEX idx_shipping_checkpoints_status ON shipping_checkpoints(status);

CREATE INDEX idx_shipping_label_generated_codes_user_id ON shipping_label_generated_codes(user_id);
CREATE INDEX idx_shipping_label_generated_codes_batch_id ON shipping_label_generated_codes(batch_id);
CREATE INDEX idx_shipping_label_generated_codes_status ON shipping_label_generated_codes(status);

-- Enable Row Level Security
ALTER TABLE shipping_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_label_generated_codes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for shipping_labels
CREATE POLICY "Users can view their own shipping labels"
  ON shipping_labels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shipping labels"
  ON shipping_labels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipping labels"
  ON shipping_labels FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shipping labels"
  ON shipping_labels FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for shipping_checkpoints
CREATE POLICY "Users can view checkpoints for their shipping labels"
  ON shipping_checkpoints FOR SELECT
  USING (
    shipping_label_id IN (
      SELECT id FROM shipping_labels WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert checkpoints for their shipping labels"
  ON shipping_checkpoints FOR INSERT
  WITH CHECK (
    shipping_label_id IN (
      SELECT id FROM shipping_labels WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update checkpoints for their shipping labels"
  ON shipping_checkpoints FOR UPDATE
  USING (
    shipping_label_id IN (
      SELECT id FROM shipping_labels WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    shipping_label_id IN (
      SELECT id FROM shipping_labels WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for shipping_label_generated_codes
CREATE POLICY "Users can view their own generated codes"
  ON shipping_label_generated_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generated codes"
  ON shipping_label_generated_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generated codes"
  ON shipping_label_generated_codes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
