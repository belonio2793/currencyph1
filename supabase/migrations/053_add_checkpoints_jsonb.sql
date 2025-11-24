-- Add JSONB array column for storing all checkpoints directly on label
ALTER TABLE addresses_shipping_labels
ADD COLUMN IF NOT EXISTS checkpoints_jsonb JSONB[] DEFAULT '{}';

-- Add index for JSONB array operations
CREATE INDEX IF NOT EXISTS idx_shipping_labels_checkpoints_jsonb
ON addresses_shipping_labels USING GIN (checkpoints_jsonb);

-- Add comment explaining the structure
COMMENT ON COLUMN addresses_shipping_labels.checkpoints_jsonb IS
'Array of checkpoint objects: [{lat: float, lng: float, timestamp: ISO8601, checkpoint_name: string, notes: string, user_id: UUID}, ...]';
