-- Create addresses_shipment_labels table for shipping label management
CREATE TABLE IF NOT EXISTS addresses_shipment_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  serial_id VARCHAR(100) NOT NULL UNIQUE,
  barcode_data TEXT,
  qr_code_data JSONB,
  shipment_id UUID,
  package_name VARCHAR(255),
  package_description TEXT,
  package_weight DECIMAL(10, 3),
  package_dimensions VARCHAR(100),
  origin_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  destination_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  current_checkpoint_id UUID,
  status VARCHAR(50) DEFAULT 'created',
  notes TEXT,
  batch_id VARCHAR(50),
  batch_size INTEGER,
  generated_count INTEGER,
  pdf_url TEXT,
  export_format VARCHAR(50) DEFAULT 'pdf',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create addresses_shipment_tracking table for checkpoint tracking
CREATE TABLE IF NOT EXISTS addresses_shipment_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES addresses_shipment_labels(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'scanned',
  location VARCHAR(255),
  checkpoint_name VARCHAR(255),
  checkpoint_type VARCHAR(50),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_address TEXT,
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scanned_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create addresses_shipment_label_generated_codes table for batch tracking
CREATE TABLE IF NOT EXISTS addresses_shipment_label_generated_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id VARCHAR(100) NOT NULL,
  batch_size INTEGER NOT NULL,
  generated_count INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for addresses_shipment_labels
CREATE INDEX IF NOT EXISTS idx_addresses_shipment_labels_user_id 
ON addresses_shipment_labels(user_id);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_labels_serial_id 
ON addresses_shipment_labels(serial_id);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_labels_status 
ON addresses_shipment_labels(status);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_labels_created_at 
ON addresses_shipment_labels(created_at);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_labels_origin_address_id 
ON addresses_shipment_labels(origin_address_id);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_labels_destination_address_id 
ON addresses_shipment_labels(destination_address_id);

-- Create indexes for addresses_shipment_tracking
CREATE INDEX IF NOT EXISTS idx_addresses_shipment_tracking_shipment_id 
ON addresses_shipment_tracking(shipment_id);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_tracking_status 
ON addresses_shipment_tracking(status);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_tracking_created_at 
ON addresses_shipment_tracking(created_at);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_tracking_scanned_by_user_id 
ON addresses_shipment_tracking(scanned_by_user_id);

-- Create indexes for addresses_shipment_label_generated_codes
CREATE INDEX IF NOT EXISTS idx_addresses_shipment_label_generated_codes_user_id 
ON addresses_shipment_label_generated_codes(user_id);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_label_generated_codes_batch_id 
ON addresses_shipment_label_generated_codes(batch_id);

-- Enable Row Level Security
ALTER TABLE addresses_shipment_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses_shipment_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses_shipment_label_generated_codes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for addresses_shipment_labels
CREATE POLICY "Users can view their own shipping labels"
ON addresses_shipment_labels FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own shipping labels"
ON addresses_shipment_labels FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipping labels"
ON addresses_shipment_labels FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shipping labels"
ON addresses_shipment_labels FOR DELETE
USING (auth.uid() = user_id);

-- Create RLS policies for addresses_shipment_tracking
CREATE POLICY "Users can view checkpoints for their shipping labels"
ON addresses_shipment_tracking FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM addresses_shipment_labels asl
    WHERE asl.id = addresses_shipment_tracking.shipment_id
    AND asl.user_id = auth.uid()
  )
);

CREATE POLICY "Users can add checkpoints to their shipping labels"
ON addresses_shipment_tracking FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM addresses_shipment_labels asl
    WHERE asl.id = addresses_shipment_tracking.shipment_id
    AND asl.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update checkpoints in their shipping labels"
ON addresses_shipment_tracking FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM addresses_shipment_labels asl
    WHERE asl.id = addresses_shipment_tracking.shipment_id
    AND asl.user_id = auth.uid()
  )
);

-- Create RLS policies for addresses_shipment_label_generated_codes
CREATE POLICY "Users can view their own batch generation records"
ON addresses_shipment_label_generated_codes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create batch generation records"
ON addresses_shipment_label_generated_codes FOR INSERT
WITH CHECK (auth.uid() = user_id);
