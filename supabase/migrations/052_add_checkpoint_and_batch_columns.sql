-- Add checkpoint columns to addresses_shipment_tracking
ALTER TABLE addresses_shipment_tracking
ADD COLUMN IF NOT EXISTS checkpoint_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS checkpoint_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS location_address TEXT,
ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS scanned_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add batch tracking columns to addresses_shipment_labels
ALTER TABLE addresses_shipment_labels
ADD COLUMN IF NOT EXISTS batch_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS batch_size INTEGER,
ADD COLUMN IF NOT EXISTS generated_count INTEGER,
ADD COLUMN IF NOT EXISTS pdf_url TEXT,
ADD COLUMN IF NOT EXISTS export_format VARCHAR(50) DEFAULT 'pdf';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_addresses_shipment_tracking_location 
ON addresses_shipment_tracking(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_tracking_scanned_at 
ON addresses_shipment_tracking(scanned_at);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_tracking_checkpoint_type 
ON addresses_shipment_tracking(checkpoint_type);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_labels_batch_id 
ON addresses_shipment_labels(batch_id);

CREATE INDEX IF NOT EXISTS idx_addresses_shipment_labels_pdf_url 
ON addresses_shipment_labels(pdf_url);
