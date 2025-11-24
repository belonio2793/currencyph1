-- Rename shipments table to addresses_shipments
ALTER TABLE IF EXISTS shipping_routes RENAME TO addresses_shipping_routes;
ALTER TABLE IF EXISTS shipping_partners RENAME TO addresses_shipping_partners;
ALTER TABLE IF EXISTS shipping_checkpoints RENAME TO addresses_shipment_checkpoints;
ALTER TABLE IF EXISTS shipping_label_generated_codes RENAME TO addresses_shipment_label_generated_codes;
ALTER TABLE IF EXISTS shipping_labels RENAME TO addresses_shipment_labels;
ALTER TABLE IF EXISTS shipment_tracking_history RENAME TO addresses_shipment_tracking;
ALTER TABLE IF EXISTS shipments RENAME TO addresses_shipments;

-- Update foreign key constraints for addresses_shipping_routes
ALTER TABLE addresses_shipping_routes
  DROP CONSTRAINT IF EXISTS shipping_routes_user_id_fkey,
  DROP CONSTRAINT IF EXISTS shipping_routes_shipment_id_fkey,
  ADD CONSTRAINT addresses_shipping_routes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT addresses_shipping_routes_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES addresses_shipments(id) ON DELETE CASCADE;

-- Update foreign key constraints for addresses_shipment_tracking
ALTER TABLE addresses_shipment_tracking
  DROP CONSTRAINT IF EXISTS shipment_tracking_history_shipment_id_fkey,
  ADD CONSTRAINT addresses_shipment_tracking_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES addresses_shipments(id) ON DELETE CASCADE;

-- Update foreign key constraints for addresses_shipment_labels
ALTER TABLE addresses_shipment_labels
  DROP CONSTRAINT IF EXISTS shipping_labels_user_id_fkey,
  DROP CONSTRAINT IF EXISTS shipping_labels_shipment_id_fkey,
  DROP CONSTRAINT IF EXISTS shipping_labels_origin_address_id_fkey,
  DROP CONSTRAINT IF EXISTS shipping_labels_destination_address_id_fkey,
  ADD CONSTRAINT addresses_shipment_labels_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT addresses_shipment_labels_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES addresses_shipments(id) ON DELETE CASCADE,
  ADD CONSTRAINT addresses_shipment_labels_origin_address_id_fkey FOREIGN KEY (origin_address_id) REFERENCES addresses(id) ON DELETE SET NULL,
  ADD CONSTRAINT addresses_shipment_labels_destination_address_id_fkey FOREIGN KEY (destination_address_id) REFERENCES addresses(id) ON DELETE SET NULL;

-- Update foreign key constraints for addresses_shipment_checkpoints
ALTER TABLE addresses_shipment_checkpoints
  DROP CONSTRAINT IF EXISTS shipping_checkpoints_shipping_label_id_fkey,
  DROP CONSTRAINT IF EXISTS shipping_checkpoints_scanned_by_user_id_fkey,
  ADD CONSTRAINT addresses_shipment_checkpoints_shipping_label_id_fkey FOREIGN KEY (shipping_label_id) REFERENCES addresses_shipment_labels(id) ON DELETE CASCADE,
  ADD CONSTRAINT addresses_shipment_checkpoints_scanned_by_user_id_fkey FOREIGN KEY (scanned_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update foreign key constraints for addresses_shipment_label_generated_codes
ALTER TABLE addresses_shipment_label_generated_codes
  DROP CONSTRAINT IF EXISTS shipping_label_generated_codes_user_id_fkey,
  ADD CONSTRAINT addresses_shipment_label_generated_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update indexes for addresses_shipments
DROP INDEX IF EXISTS idx_shipments_user_id;
DROP INDEX IF EXISTS idx_shipments_tracking_number;
DROP INDEX IF EXISTS idx_shipments_status;
DROP INDEX IF EXISTS idx_shipments_created_at;
CREATE INDEX idx_addresses_shipments_user_id ON addresses_shipments(user_id);
CREATE INDEX idx_addresses_shipments_tracking_number ON addresses_shipments(tracking_number);
CREATE INDEX idx_addresses_shipments_status ON addresses_shipments(status);
CREATE INDEX idx_addresses_shipments_created_at ON addresses_shipments(created_at);

-- Update indexes for addresses_shipment_tracking
DROP INDEX IF EXISTS idx_shipment_tracking_history_shipment_id;
DROP INDEX IF EXISTS idx_shipment_tracking_history_timestamp;
CREATE INDEX idx_addresses_shipment_tracking_shipment_id ON addresses_shipment_tracking(shipment_id);
CREATE INDEX idx_addresses_shipment_tracking_timestamp ON addresses_shipment_tracking(timestamp);

-- Update indexes for addresses_shipment_labels
DROP INDEX IF EXISTS idx_shipping_labels_user_id;
DROP INDEX IF EXISTS idx_shipping_labels_serial_id;
DROP INDEX IF EXISTS idx_shipping_labels_status;
DROP INDEX IF EXISTS idx_shipping_labels_shipment_id;
DROP INDEX IF EXISTS idx_shipping_labels_created_at;
CREATE INDEX idx_addresses_shipment_labels_user_id ON addresses_shipment_labels(user_id);
CREATE INDEX idx_addresses_shipment_labels_serial_id ON addresses_shipment_labels(serial_id);
CREATE INDEX idx_addresses_shipment_labels_status ON addresses_shipment_labels(status);
CREATE INDEX idx_addresses_shipment_labels_shipment_id ON addresses_shipment_labels(shipment_id);
CREATE INDEX idx_addresses_shipment_labels_created_at ON addresses_shipment_labels(created_at);

-- Update indexes for addresses_shipment_checkpoints
DROP INDEX IF EXISTS idx_shipping_checkpoints_shipping_label_id;
DROP INDEX IF EXISTS idx_shipping_checkpoints_location;
DROP INDEX IF EXISTS idx_shipping_checkpoints_scanned_at;
DROP INDEX IF EXISTS idx_shipping_checkpoints_status;
CREATE INDEX idx_addresses_shipment_checkpoints_shipping_label_id ON addresses_shipment_checkpoints(shipping_label_id);
CREATE INDEX idx_addresses_shipment_checkpoints_location ON addresses_shipment_checkpoints(latitude, longitude);
CREATE INDEX idx_addresses_shipment_checkpoints_scanned_at ON addresses_shipment_checkpoints(scanned_at);
CREATE INDEX idx_addresses_shipment_checkpoints_status ON addresses_shipment_checkpoints(status);

-- Update indexes for addresses_shipment_label_generated_codes
DROP INDEX IF EXISTS idx_shipping_label_generated_codes_user_id;
DROP INDEX IF EXISTS idx_shipping_label_generated_codes_batch_id;
DROP INDEX IF EXISTS idx_shipping_label_generated_codes_status;
CREATE INDEX idx_addresses_shipment_label_generated_codes_user_id ON addresses_shipment_label_generated_codes(user_id);
CREATE INDEX idx_addresses_shipment_label_generated_codes_batch_id ON addresses_shipment_label_generated_codes(batch_id);
CREATE INDEX idx_addresses_shipment_label_generated_codes_status ON addresses_shipment_label_generated_codes(status);

-- Update indexes for addresses_shipping_routes
DROP INDEX IF EXISTS idx_shipping_routes_user_id;
DROP INDEX IF EXISTS idx_shipping_routes_shipment_id;
DROP INDEX IF EXISTS idx_shipping_routes_origin_destination;
CREATE INDEX idx_addresses_shipping_routes_user_id ON addresses_shipping_routes(user_id);
CREATE INDEX idx_addresses_shipping_routes_shipment_id ON addresses_shipping_routes(shipment_id);
CREATE INDEX idx_addresses_shipping_routes_origin_destination ON addresses_shipping_routes(origin_city, destination_city);

-- Drop old RLS policies
DROP POLICY IF EXISTS "Users can view their own shipments" ON addresses_shipments;
DROP POLICY IF EXISTS "Users can insert their own shipments" ON addresses_shipments;
DROP POLICY IF EXISTS "Users can update their own shipments" ON addresses_shipments;
DROP POLICY IF EXISTS "Users can delete their own shipments" ON addresses_shipments;
DROP POLICY IF EXISTS "Users can view tracking history for their shipments" ON addresses_shipment_tracking;
DROP POLICY IF EXISTS "Users can view their own shipping labels" ON addresses_shipment_labels;
DROP POLICY IF EXISTS "Users can insert their own shipping labels" ON addresses_shipment_labels;
DROP POLICY IF EXISTS "Users can update their own shipping labels" ON addresses_shipment_labels;
DROP POLICY IF EXISTS "Users can delete their own shipping labels" ON addresses_shipment_labels;
DROP POLICY IF EXISTS "Users can view checkpoints for their shipping labels" ON addresses_shipment_checkpoints;
DROP POLICY IF EXISTS "Users can insert checkpoints for their shipping labels" ON addresses_shipment_checkpoints;
DROP POLICY IF EXISTS "Users can update checkpoints for their shipping labels" ON addresses_shipment_checkpoints;
DROP POLICY IF EXISTS "Users can view their own generated codes" ON addresses_shipment_label_generated_codes;
DROP POLICY IF EXISTS "Users can insert their own generated codes" ON addresses_shipment_label_generated_codes;
DROP POLICY IF EXISTS "Users can update their own generated codes" ON addresses_shipment_label_generated_codes;
DROP POLICY IF EXISTS "Users can view their own partners" ON addresses_shipping_partners;
DROP POLICY IF EXISTS "Users can insert their own partners" ON addresses_shipping_partners;
DROP POLICY IF EXISTS "Users can update their own partners" ON addresses_shipping_partners;
DROP POLICY IF EXISTS "Users can view their own routes" ON addresses_shipping_routes;
DROP POLICY IF EXISTS "Users can insert their own routes" ON addresses_shipping_routes;
DROP POLICY IF EXISTS "Users can update their own routes" ON addresses_shipping_routes;

-- Create new RLS policies for addresses_shipments
CREATE POLICY "Users can view their own shipments"
  ON addresses_shipments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shipments"
  ON addresses_shipments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipments"
  ON addresses_shipments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shipments"
  ON addresses_shipments FOR DELETE
  USING (auth.uid() = user_id);

-- Create new RLS policies for addresses_shipment_tracking
CREATE POLICY "Users can view tracking history for their shipments"
  ON addresses_shipment_tracking FOR SELECT
  USING (
    shipment_id IN (
      SELECT id FROM addresses_shipments WHERE user_id = auth.uid()
    )
  );

-- Create new RLS policies for addresses_shipment_labels
CREATE POLICY "Users can view their own shipping labels"
  ON addresses_shipment_labels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shipping labels"
  ON addresses_shipment_labels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipping labels"
  ON addresses_shipment_labels FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shipping labels"
  ON addresses_shipment_labels FOR DELETE
  USING (auth.uid() = user_id);

-- Create new RLS policies for addresses_shipment_checkpoints
CREATE POLICY "Users can view checkpoints for their shipping labels"
  ON addresses_shipment_checkpoints FOR SELECT
  USING (
    shipping_label_id IN (
      SELECT id FROM addresses_shipment_labels WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert checkpoints for their shipping labels"
  ON addresses_shipment_checkpoints FOR INSERT
  WITH CHECK (
    shipping_label_id IN (
      SELECT id FROM addresses_shipment_labels WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update checkpoints for their shipping labels"
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

-- Create new RLS policies for addresses_shipment_label_generated_codes
CREATE POLICY "Users can view their own generated codes"
  ON addresses_shipment_label_generated_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generated codes"
  ON addresses_shipment_label_generated_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generated codes"
  ON addresses_shipment_label_generated_codes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create new RLS policies for addresses_shipping_partners
CREATE POLICY "Users can view their own partners"
  ON addresses_shipping_partners FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own partners"
  ON addresses_shipping_partners FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own partners"
  ON addresses_shipping_partners FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create new RLS policies for addresses_shipping_routes
CREATE POLICY "Users can view their own routes"
  ON addresses_shipping_routes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own routes"
  ON addresses_shipping_routes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own routes"
  ON addresses_shipping_routes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
