import { supabase } from './supabaseClient'

// Generate unique serial ID with prefix
export async function generateUniqueSerialId(prefix = 'PKG') {
  const timestamp = Date.now().toString(36).toUpperCase()
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
  const serialId = `${prefix}-${timestamp}-${randomPart}`

  // Check if it already exists
  const { data } = await supabase
    .from('addresses_shipment_labels')
    .select('id')
    .eq('serial_id', serialId)
    .single()

  // If exists, try again recursively
  if (data) {
    return generateUniqueSerialId(prefix)
  }

  return serialId
}

// Generate multiple unique serial IDs
export async function generateMultipleSerialIds(count = 1, prefix = 'PKG') {
  const serialIds = []
  for (let i = 0; i < count; i++) {
    const serialId = await generateUniqueSerialId(prefix)
    serialIds.push(serialId)
  }
  return serialIds
}

// Create shipping label with QR/barcode data
export async function createShippingLabel(userId, labelData) {
  const serialId = await generateUniqueSerialId(labelData.prefix || 'PKG')

  const { data, error } = await supabase
    .from('addresses_shipment_labels')
    .insert([{
      user_id: userId,
      serial_id: serialId,
      barcode_data: serialId,
      qr_code_data: JSON.stringify({
        serialId,
        packageName: labelData.packageName,
        origin: labelData.originAddressId,
        destination: labelData.destinationAddressId,
        createdAt: new Date().toISOString()
      }),
      shipment_id: labelData.shipmentId,
      package_name: labelData.packageName,
      package_description: labelData.packageDescription,
      package_weight: labelData.packageWeight,
      package_dimensions: labelData.packageDimensions,
      origin_address_id: labelData.originAddressId,
      destination_address_id: labelData.destinationAddressId,
      notes: labelData.notes
    }])
    .select()

  if (error) throw error
  return data[0]
}

// Bulk create shipping labels
export async function bulkCreateShippingLabels(userId, count = 1, labelData = {}) {
  const serialIds = await generateMultipleSerialIds(count, labelData.prefix || 'PKG')
  const batchId = `BATCH-${Date.now()}`

  const labels = serialIds.map(serialId => ({
    user_id: userId,
    serial_id: serialId,
    barcode_data: serialId,
    qr_code_data: JSON.stringify({
      serialId,
      packageName: labelData.packageName || `Package ${serialId}`,
      origin: labelData.originAddressId,
      destination: labelData.destinationAddressId,
      createdAt: new Date().toISOString(),
      batchId
    }),
    shipment_id: labelData.shipmentId,
    package_name: labelData.packageName || `Package ${serialId}`,
    package_description: labelData.packageDescription,
    package_weight: labelData.packageWeight,
    package_dimensions: labelData.packageDimensions,
    origin_address_id: labelData.originAddressId,
    destination_address_id: labelData.destinationAddressId,
    notes: labelData.notes
  }))

  const { data, error } = await supabase
    .from('addresses_shipment_labels')
    .insert(labels)
    .select()

  if (error) throw error

  // Record batch generation
  await supabase
    .from('addresses_shipment_label_generated_codes')
    .insert([{
      user_id: userId,
      batch_id: batchId,
      batch_size: count,
      generated_count: data.length,
      status: 'completed'
    }])

  return data
}

// Search for shipping label by serial ID
export async function searchShippingLabelBySerialId(userId, serialId) {
  const { data, error } = await supabase
    .from('addresses_shipment_labels')
    .select(`
      *,
      origin_address:origin_address_id(*),
      destination_address:destination_address_id(*)
    `)
    .eq('user_id', userId)
    .eq('serial_id', serialId)
    .single()

  if (error && error.code !== 'PGRST116') throw error

  // Fetch checkpoints from tracking table
  if (data) {
    const { data: checkpoints } = await supabase
      .from('addresses_shipment_tracking')
      .select('*')
      .eq('shipment_id', data.id)
      .order('scanned_at', { ascending: false })

    data.checkpoints = checkpoints || []
  }

  return data
}

// Get all shipping labels with checkpoints
export async function getShippingLabelsWithCheckpoints(userId, status = null) {
  let query = supabase
    .from('addresses_shipment_labels')
    .select(`
      *,
      origin_address:origin_address_id(*),
      destination_address:destination_address_id(*)
    `)
    .eq('user_id', userId)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) throw error

  // Fetch checkpoints from tracking table separately
  const labelsWithCheckpoints = await Promise.all(
    (data || []).map(async (label) => {
      const { data: checkpoints } = await supabase
        .from('addresses_shipment_tracking')
        .select('*')
        .eq('shipment_id', label.id)
        .order('scanned_at', { ascending: false })

      return {
        ...label,
        checkpoints: checkpoints || []
      }
    })
  )

  return labelsWithCheckpoints
}

// Add checkpoint for package
// Note: shipment_id field is used to track which label this checkpoint belongs to
export async function addCheckpoint(shippingLabelId, checkpointData) {
  const { data, error } = await supabase
    .from('addresses_shipment_tracking')
    .insert([{
      shipment_id: shippingLabelId,
      status: checkpointData.status || 'scanned',
      location: checkpointData.locationAddress,
      checkpoint_name: checkpointData.checkpointName,
      checkpoint_type: checkpointData.checkpointType || 'scanned',
      latitude: checkpointData.latitude,
      longitude: checkpointData.longitude,
      location_address: checkpointData.locationAddress,
      scanned_at: checkpointData.scannedAt || new Date().toISOString(),
      scanned_by_user_id: checkpointData.scannedByUserId,
      notes: checkpointData.notes,
      metadata: checkpointData.metadata || {}
    }])
    .select()

  if (error) throw error

  // Update shipping label status if it's the first checkpoint
  if (data && data.length > 0) {
    await supabase
      .from('addresses_shipment_labels')
      .update({
        current_checkpoint_id: data[0].id,
        status: 'in_transit',
        updated_at: new Date().toISOString()
      })
      .eq('id', shippingLabelId)
  }

  return data[0]
}

// Get checkpoint history for a label
export async function getCheckpointHistory(shippingLabelId) {
  const { data, error } = await supabase
    .from('addresses_shipment_tracking')
    .select('*')
    .eq('shipment_id', shippingLabelId)
    .order('scanned_at', { ascending: false })

  if (error) throw error
  return data
}

// Update shipping label status
export async function updateShippingLabelStatus(shippingLabelId, status) {
  const { data, error } = await supabase
    .from('addresses_shipment_labels')
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', shippingLabelId)
    .select()

  if (error) throw error
  return data[0]
}
