import { supabase } from './supabaseClient'

// ============================================
// TRACKING CODE GENERATION
// ============================================

/**
 * Generate unique tracking code in format: PH-YYYY-XXXXXXXX
 * Example: PH-2025-A1B2C3D4
 */
export async function generateUniqueTrackingCode() {
  const year = new Date().getFullYear()
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  
  // Generate random 8-char code
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  const trackingCode = `PH-${year}-${code}`

  // Check uniqueness
  const { data } = await supabase
    .from('addresses_shipping_labels')
    .select('id')
    .eq('tracking_code', trackingCode)
    .single()

  // Retry if exists
  if (data) {
    return generateUniqueTrackingCode()
  }

  return trackingCode
}

/**
 * Generate multiple unique tracking codes for batch operations
 */
export async function generateMultipleTrackingCodes(count = 1) {
  const codes = []
  for (let i = 0; i < count; i++) {
    const code = await generateUniqueTrackingCode()
    codes.push(code)
  }
  return codes
}

// ============================================
// BARCODE & QR CODE SVG GENERATION
// ============================================

/**
 * Generate SVG barcode representation (simple pattern-based)
 * Creates a visual barcode-like SVG without external libraries
 */
export function generateBarcodeSVG(trackingCode) {
  try {
    const width = 300
    const height = 120
    const barWidth = 2
    const margin = 10

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`
    svg += `<rect width="${width}" height="${height}" fill="white"/>`

    // Generate barcode pattern from tracking code
    let x = margin
    for (let i = 0; i < trackingCode.length; i++) {
      const charCode = trackingCode.charCodeAt(i)
      const barPattern = (charCode % 15) + 3

      for (let j = 0; j < barPattern; j++) {
        const barHeight = ((charCode + j) % 2 === 0) ? 80 : 60
        const yOffset = height - margin - barHeight
        svg += `<rect x="${x}" y="${yOffset}" width="${barWidth}" height="${barHeight}" fill="black"/>`
        x += barWidth + 1
      }
    }

    // Add text label
    svg += `<text x="${width / 2}" y="${height - 5}" text-anchor="middle" font-size="12" font-family="monospace" font-weight="bold">${trackingCode}</text>`
    svg += `</svg>`

    return `data:image/svg+xml;base64,${btoa(svg)}`
  } catch (err) {
    console.error('Barcode generation error:', err)
    return null
  }
}

/**
 * Generate QR code SVG (client-side using simple grid pattern for demo)
 * For production, use: npm install qrcode
 */
export function generateQRCodeSVG(trackingCode) {
  try {
    // Simple QR-like pattern generator for demo
    // In production, replace with proper QR library:
    // import QRCode from 'qrcode'
    
    const size = 200
    const moduleCount = 29
    const moduleSize = Math.floor(size / moduleCount)
    
    // Create SVG
    let svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`
    svg += `<rect width="${size}" height="${size}" fill="white"/>`
    
    // Add border pattern (quiet zone)
    svg += `<rect x="0" y="0" width="${size}" height="${size}" fill="none" stroke="black" stroke-width="2"/>`
    
    // Generate pseudo-QR pattern from tracking code
    let hash = 0
    for (let i = 0; i < trackingCode.length; i++) {
      const char = trackingCode.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Keep it 32-bit
    }
    
    // Create pattern based on hash
    for (let y = 1; y < moduleCount - 1; y++) {
      for (let x = 1; x < moduleCount - 1; x++) {
        const seed = (x * 73856093) ^ (y * 19349663) ^ hash
        if ((seed & 1) === 0) {
          const px = x * moduleSize
          const py = y * moduleSize
          svg += `<rect x="${px}" y="${py}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`
        }
      }
    }
    
    // Add text
    svg += `<text x="${size / 2}" y="${size - 10}" text-anchor="middle" font-size="10" fill="black">${trackingCode}</text>`
    svg += `</svg>`
    
    return `data:image/svg+xml;base64,${btoa(svg)}`
  } catch (err) {
    console.error('QR code generation error:', err)
    return null
  }
}

// ============================================
// LABEL CREATION
// ============================================

/**
 * Create single shipping label with tracking code and SVG barcodes
 */
export async function createShippingLabel(userId, labelData) {
  const trackingCode = await generateUniqueTrackingCode()
  
  // Generate barcode and QR code SVGs
  const barcodeSVG = generateBarcodeSVG(trackingCode)
  const qrCodeSVG = generateQRCodeSVG(trackingCode)

  const { data, error } = await supabase
    .from('addresses_shipping_labels')
    .insert([{
      user_id: userId,
      tracking_code: trackingCode,
      barcode_svg: barcodeSVG,
      qr_code_svg: qrCodeSVG,
      package_name: labelData.packageName,
      package_description: labelData.packageDescription,
      weight_kg: labelData.packageWeight,
      dimensions: labelData.packageDimensions,
      origin_address_id: labelData.originAddressId,
      destination_address_id: labelData.destinationAddressId,
      status: 'created',
      label_format: labelData.labelFormat || 'a4-10'
    }])
    .select()

  if (error) throw error
  return data[0]
}

/**
 * Bulk create shipping labels for batch operations (1, 10, 100, 1000)
 */
export async function bulkCreateShippingLabels(userId, count = 1, labelData = {}) {
  const trackingCodes = await generateMultipleTrackingCodes(count)
  const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

  // Create all labels
  const labels = trackingCodes.map(trackingCode => ({
    user_id: userId,
    tracking_code: trackingCode,
    barcode_svg: generateBarcodeSVG(trackingCode),
    qr_code_svg: generateQRCodeSVG(trackingCode),
    package_name: labelData.packageName || `Package ${trackingCode}`,
    package_description: labelData.packageDescription,
    weight_kg: labelData.packageWeight,
    dimensions: labelData.packageDimensions,
    origin_address_id: labelData.originAddressId,
    destination_address_id: labelData.destinationAddressId,
    status: 'created',
    batch_id: batchId,
    batch_position: trackingCodes.indexOf(trackingCode) + 1,
    label_format: labelData.labelFormat || 'a4-10'
  }))

  // Insert all labels
  const { data: insertedLabels, error: insertError } = await supabase
    .from('addresses_shipping_labels')
    .insert(labels)
    .select()

  if (insertError) throw insertError

  // Record batch generation
  const { error: batchError } = await supabase
    .from('addresses_shipping_batches')
    .insert([{
      user_id: userId,
      batch_id: batchId,
      requested_count: count,
      generated_count: insertedLabels.length,
      status: 'completed'
    }])

  if (batchError) throw batchError

  return insertedLabels
}

// ============================================
// LABEL QUERIES
// ============================================

/**
 * Search for label by tracking code
 */
export async function searchLabelByTrackingCode(trackingCode) {
  const { data, error } = await supabase
    .from('addresses_shipping_labels')
    .select(`
      *,
      origin_address:origin_address_id(*),
      destination_address:destination_address_id(*)
    `)
    .eq('tracking_code', trackingCode)
    .single()

  if (error && error.code !== 'PGRST116') throw error

  if (data) {
    // Fetch tracking history
    const { data: history } = await supabase
      .from('addresses_shipping_tracking')
      .select('*')
      .eq('tracking_code', trackingCode)
      .order('created_at', { ascending: false })

    data.tracking_history = history || []
  }

  return data
}

/**
 * Get all labels for a user
 */
export async function getUserShippingLabels(userId, status = null) {
  let query = supabase
    .from('addresses_shipping_labels')
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

  // Fetch tracking history for each label
  const labelsWithHistory = await Promise.all(
    (data || []).map(async (label) => {
      const { data: history } = await supabase
        .from('addresses_shipping_tracking')
        .select('*')
        .eq('tracking_code', label.tracking_code)
        .order('created_at', { ascending: false })

      return {
        ...label,
        tracking_history: history || []
      }
    })
  )

  return labelsWithHistory
}

/**
 * Get batch details
 */
export async function getBatchDetails(batchId) {
  const { data: batch, error: batchError } = await supabase
    .from('addresses_shipping_batches')
    .select('*')
    .eq('batch_id', batchId)
    .single()

  if (batchError) throw batchError

  // Get all labels in batch
  const { data: labels, error: labelsError } = await supabase
    .from('addresses_shipping_labels')
    .select('*')
    .eq('batch_id', batchId)
    .order('batch_position', { ascending: true })

  if (labelsError) throw labelsError

  return {
    ...batch,
    labels: labels || []
  }
}

// ============================================
// CHECKPOINT TRACKING
// ============================================

/**
 * Add checkpoint/scan for a label
 */
export async function addCheckpoint(trackingCode, checkpointData) {
  // Get the label first
  const { data: label } = await supabase
    .from('addresses_shipping_labels')
    .select('id')
    .eq('tracking_code', trackingCode)
    .single()

  if (!label) {
    throw new Error(`Label not found: ${trackingCode}`)
  }

  // Insert checkpoint
  const { data: checkpoint, error } = await supabase
    .from('addresses_shipping_tracking')
    .insert([{
      tracking_code: trackingCode,
      status: checkpointData.status || 'scanned',
      checkpoint_name: checkpointData.checkpointName,
      latitude: checkpointData.latitude,
      longitude: checkpointData.longitude,
      address_text: checkpointData.addressText,
      scanned_by: checkpointData.scannedBy,
      notes: checkpointData.notes,
      metadata: checkpointData.metadata || {}
    }])
    .select()

  if (error) throw error

  // Update label with latest checkpoint info
  const checkpointToUse = checkpoint[0]
  const { error: updateError } = await supabase
    .from('addresses_shipping_labels')
    .update({
      status: checkpointData.status || 'in_transit',
      last_scanned_at: new Date().toISOString(),
      last_scanned_lat: checkpointData.latitude,
      last_scanned_lng: checkpointData.longitude,
      current_checkpoint: checkpointData.checkpointName
    })
    .eq('tracking_code', trackingCode)

  if (updateError) throw updateError

  return checkpointToUse
}

/**
 * Get tracking history for a label
 */
export async function getTrackingHistory(trackingCode) {
  const { data, error } = await supabase
    .from('addresses_shipping_tracking')
    .select('*')
    .eq('tracking_code', trackingCode)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

// ============================================
// STATUS UPDATES
// ============================================

/**
 * Update label status (created, printed, in_transit, delivered, returned, lost)
 */
export async function updateLabelStatus(trackingCode, status) {
  const validStatuses = ['created', 'printed', 'in_transit', 'delivered', 'returned', 'lost']
  
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`)
  }

  const { data, error } = await supabase
    .from('addresses_shipping_labels')
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq('tracking_code', trackingCode)
    .select()

  if (error) throw error
  return data[0]
}

/**
 * Mark label as printed
 */
export async function markLabelAsPrinted(trackingCode, pdfUrl = null) {
  return updateLabelStatus(trackingCode, 'printed')
}

/**
 * Mark label as delivered
 */
export async function markLabelAsDelivered(trackingCode) {
  return updateLabelStatus(trackingCode, 'delivered')
}

// ============================================
// PDF GENERATION & EXPORT
// ============================================

/**
 * Generate PDF with label details and barcode/QR
 * Uses jsPDF for PDF generation
 */
export async function generateLabelPDF(label, jsPDF) {
  if (!jsPDF) {
    throw new Error('jsPDF library required')
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  let yPos = 15

  // Title
  pdf.setFontSize(14)
  pdf.setFont(undefined, 'bold')
  pdf.text('SHIPPING LABEL', pageWidth / 2, yPos, { align: 'center' })
  yPos += 12

  // Border
  pdf.setDrawColor(0, 0, 0)
  pdf.rect(10, yPos - 8, pageWidth - 20, 70)

  // Tracking Code
  pdf.setFontSize(11)
  pdf.setFont(undefined, 'bold')
  pdf.text(`Tracking: ${label.tracking_code}`, 15, yPos)
  yPos += 10

  // Package info
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'normal')
  
  if (label.package_name) {
    pdf.text(`Package: ${label.package_name}`, 15, yPos)
    yPos += 6
  }

  if (label.weight_kg) {
    pdf.text(`Weight: ${label.weight_kg} kg`, 15, yPos)
    yPos += 6
  }

  if (label.dimensions) {
    pdf.text(`Dimensions: ${label.dimensions}`, 15, yPos)
    yPos += 6
  }

  // Barcode representation (text version since we can't embed SVG directly)
  pdf.setFontSize(12)
  pdf.setFont(undefined, 'bold')
  pdf.text('|||||||||||||||', 15, yPos)
  yPos += 7

  pdf.setFontSize(10)
  pdf.text(label.tracking_code, 15, yPos)

  return pdf.output('blob')
}

/**
 * Bulk export multiple labels to PDF
 */
export async function exportBatchToPDF(batchId, jsPDF) {
  const batch = await getBatchDetails(batchId)
  
  if (!jsPDF) {
    throw new Error('jsPDF library required')
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  let yPos = 15
  let isFirstPage = true

  for (const label of batch.labels) {
    // Add new page if needed
    if (!isFirstPage && yPos > pageHeight - 90) {
      pdf.addPage()
      yPos = 15
    }

    // Title
    pdf.setFontSize(12)
    pdf.setFont(undefined, 'bold')
    pdf.text('SHIPPING LABEL', pageWidth / 2, yPos, { align: 'center' })
    yPos += 10

    // Border
    pdf.setDrawColor(0, 0, 0)
    pdf.rect(10, yPos - 8, pageWidth - 20, 60)

    // Tracking Code
    pdf.setFontSize(10)
    pdf.setFont(undefined, 'bold')
    pdf.text(`Code: ${label.tracking_code}`, 15, yPos)
    yPos += 8

    // Package info
    pdf.setFontSize(8)
    pdf.setFont(undefined, 'normal')
    
    if (label.package_name) {
      pdf.text(`Pkg: ${label.package_name}`, 15, yPos)
      yPos += 5
    }

    if (label.weight_kg) {
      pdf.text(`Wt: ${label.weight_kg}kg`, 15, yPos)
      yPos += 5
    }

    // Barcode text
    pdf.setFontSize(9)
    pdf.setFont(undefined, 'bold')
    pdf.text('|||||||||||', 15, yPos)
    yPos += 8
    pdf.text(label.tracking_code, 15, yPos)
    yPos += 15

    isFirstPage = false
  }

  return pdf.output('blob')
}

// ============================================
// BATCH OPERATIONS
// ============================================

/**
 * Get user's batch history
 */
export async function getUserBatches(userId) {
  const { data, error } = await supabase
    .from('addresses_shipping_batches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Get batch generation statistics
 */
export async function getBatchStats(userId) {
  const { data: batches, error } = await supabase
    .from('addresses_shipping_batches')
    .select('*')
    .eq('user_id', userId)

  if (error) throw error

  const stats = {
    totalBatches: batches?.length || 0,
    totalLabelsGenerated: 0,
    completedBatches: 0,
    failedBatches: 0,
    processingBatches: 0
  }

  batches?.forEach(batch => {
    stats.totalLabelsGenerated += batch.generated_count || 0
    if (batch.status === 'completed') stats.completedBatches++
    if (batch.status === 'failed') stats.failedBatches++
    if (batch.status === 'processing') stats.processingBatches++
  })

  return stats
}
