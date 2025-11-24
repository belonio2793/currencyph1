import { useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import {
  createShippingLabel,
  bulkCreateShippingLabels,
  exportBatchToPDF
} from '../lib/shippingLabelService'
import jsPDF from 'jspdf'
import './ShippingLabelGenerator.css'

export default function ShippingLabelGenerator({ userId, addresses = [] }) {
  const [activeTab, setActiveTab] = useState('single')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Single label form
  const [singleLabel, setSingleLabel] = useState({
    packageName: '',
    packageDescription: '',
    packageWeight: '',
    packageDimensions: '',
    originAddressId: '',
    destinationAddressId: '',
    labelFormat: 'a4-10'
  })
  
  // Bulk label form
  const [bulkLabel, setBulkLabel] = useState({
    quantity: 1,
    packageName: '',
    packageDescription: '',
    packageWeight: '',
    packageDimensions: '',
    originAddressId: '',
    destinationAddressId: '',
    labelFormat: 'a4-10'
  })
  
  // Generated labels for preview
  const [generatedLabels, setGeneratedLabels] = useState([])
  const canvasRef = useRef(null)

  // Handle single label generation
  const handleGenerateSingleLabel = async (e) => {
    e.preventDefault()
    if (!singleLabel.packageName.trim()) {
      setError('Package name is required')
      return
    }
    
    setLoading(true)
    setError('')
    setSuccess('')
    
    try {
      const label = await createShippingLabel(userId, {
        ...singleLabel,
        packageWeight: parseFloat(singleLabel.packageWeight) || 0
      })
      
      setGeneratedLabels([label])
      setSuccess(`Label created successfully: ${label.tracking_code}`)
      setSingleLabel({
        packageName: '',
        packageDescription: '',
        packageWeight: '',
        packageDimensions: '',
        originAddressId: '',
        destinationAddressId: '',
        labelFormat: 'a4-10'
      })
    } catch (err) {
      setError(err.message || 'Failed to generate label')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle bulk label generation
  const handleGenerateBulkLabels = async (e) => {
    e.preventDefault()
    const quantity = parseInt(bulkLabel.quantity) || 1
    
    if (quantity < 1 || quantity > 1000) {
      setError('Quantity must be between 1 and 1000')
      return
    }
    
    setLoading(true)
    setError('')
    setSuccess('')
    
    try {
      const labels = await bulkCreateShippingLabels(userId, quantity, {
        ...bulkLabel,
        packageWeight: parseFloat(bulkLabel.packageWeight) || 0
      })
      
      setGeneratedLabels(labels)
      setSuccess(`${labels.length} labels generated successfully`)
      setBulkLabel({
        quantity: 1,
        packageName: '',
        packageDescription: '',
        packageWeight: '',
        packageDimensions: '',
        originAddressId: '',
        destinationAddressId: '',
        labelFormat: 'a4-10'
      })
    } catch (err) {
      setError(err.message || 'Failed to generate labels')
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Export to PDF
  const handleExportPDF = async () => {
    if (generatedLabels.length === 0) {
      setError('No labels to export')
      return
    }

    setLoading(true)
    setError('')

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      let yPosition = 20
      const pageHeight = pdf.internal.pageSize.getHeight()
      const pageWidth = pdf.internal.pageSize.getWidth()
      let isFirstPage = true

      generatedLabels.forEach((label, index) => {
        if (!isFirstPage && yPosition > pageHeight - 80) {
          pdf.addPage()
          yPosition = 20
        }

        // Header
        pdf.setFontSize(12)
        pdf.setFont(undefined, 'bold')
        pdf.text('SHIPPING LABEL', pageWidth / 2, yPosition, { align: 'center' })
        yPosition += 10

        // Border box
        pdf.setDrawColor(0, 0, 0)
        pdf.rect(10, yPosition - 8, pageWidth - 20, 60)

        // Label details
        pdf.setFontSize(10)
        pdf.setFont(undefined, 'normal')
        pdf.text(`Tracking Code: ${label.tracking_code}`, 15, yPosition)
        yPosition += 8

        if (label.package_name) {
          pdf.text(`Package: ${label.package_name}`, 15, yPosition)
          yPosition += 6
        }

        if (label.weight_kg) {
          pdf.text(`Weight: ${label.weight_kg} kg`, 15, yPosition)
          yPosition += 6
        }

        if (label.dimensions) {
          pdf.text(`Dimensions: ${label.dimensions}`, 15, yPosition)
          yPosition += 6
        }

        // Barcode representation
        pdf.setFontSize(12)
        pdf.setFont(undefined, 'bold')
        pdf.text('|||||||||||||||', 15, yPosition)
        yPosition += 7
        pdf.setFontSize(9)
        pdf.text(label.tracking_code, 15, yPosition)

        yPosition += 20
        isFirstPage = false
      })

      const pdfBlob = pdf.output('blob')
      const pdfUrl = URL.createObjectURL(pdfBlob)

      // Trigger download
      const link = document.createElement('a')
      link.href = pdfUrl
      link.download = `shipping_labels_${Date.now()}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setSuccess(`PDF exported successfully with ${generatedLabels.length} labels`)
    } catch (err) {
      setError('Failed to export PDF: ' + err.message)
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="shipping-label-generator">
      <div className="generator-tabs">
        <button
          className={`tab-btn ${activeTab === 'single' ? 'active' : ''}`}
          onClick={() => setActiveTab('single')}
        >
          Generate Single Label
        </button>
        <button
          className={`tab-btn ${activeTab === 'bulk' ? 'active' : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          Bulk Generate
        </button>
        <button
          className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          Preview & Export
        </button>
      </div>

      <div className="generator-content">
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {activeTab === 'single' && (
          <form onSubmit={handleGenerateSingleLabel} className="label-form">
            <h3>Create Single Shipping Label</h3>
            
            <div className="form-group">
              <label>Package Name *</label>
              <input
                type="text"
                value={singleLabel.packageName}
                onChange={(e) => setSingleLabel({ ...singleLabel, packageName: e.target.value })}
                placeholder="e.g., Electronics Package"
                required
              />
            </div>

            <div className="form-group">
              <label>Package Description</label>
              <textarea
                value={singleLabel.packageDescription}
                onChange={(e) => setSingleLabel({ ...singleLabel, packageDescription: e.target.value })}
                placeholder="Description of the package contents"
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={singleLabel.packageWeight}
                  onChange={(e) => setSingleLabel({ ...singleLabel, packageWeight: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label>Dimensions (LxWxH cm)</label>
                <input
                  type="text"
                  value={singleLabel.packageDimensions}
                  onChange={(e) => setSingleLabel({ ...singleLabel, packageDimensions: e.target.value })}
                  placeholder="20x15x10"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Origin Address</label>
                <select
                  value={singleLabel.originAddressId}
                  onChange={(e) => setSingleLabel({ ...singleLabel, originAddressId: e.target.value })}
                >
                  <option value="">Select origin...</option>
                  {addresses.map(addr => (
                    <option key={addr.id} value={addr.id}>
                      {addr.addresses_address || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Destination Address</label>
                <select
                  value={singleLabel.destinationAddressId}
                  onChange={(e) => setSingleLabel({ ...singleLabel, destinationAddressId: e.target.value })}
                >
                  <option value="">Select destination...</option>
                  {addresses.map(addr => (
                    <option key={addr.id} value={addr.id}>
                      {addr.addresses_address || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Label Format</label>
              <select
                value={singleLabel.labelFormat}
                onChange={(e) => setSingleLabel({ ...singleLabel, labelFormat: e.target.value })}
              >
                <option value="a4-10">A4 (10 labels)</option>
                <option value="a4-4">A4 (4 labels)</option>
                <option value="4x6">4x6 Thermal</option>
              </select>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Generating...' : 'Generate Label'}
            </button>
          </form>
        )}

        {activeTab === 'bulk' && (
          <form onSubmit={handleGenerateBulkLabels} className="label-form">
            <h3>Bulk Generate Shipping Labels</h3>
            
            <div className="form-group">
              <label>Quantity *</label>
              <div className="quantity-presets">
                {[1, 10, 100, 1000].map(qty => (
                  <button
                    key={qty}
                    type="button"
                    className={`preset-btn ${parseInt(bulkLabel.quantity) === qty ? 'active' : ''}`}
                    onClick={() => setBulkLabel({ ...bulkLabel, quantity: qty })}
                  >
                    {qty}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={bulkLabel.quantity}
                onChange={(e) => setBulkLabel({ ...bulkLabel, quantity: e.target.value })}
                min="1"
                max="1000"
                placeholder="1-1000"
                required
              />
            </div>

            <div className="form-group">
              <label>Package Name Template</label>
              <input
                type="text"
                value={bulkLabel.packageName}
                onChange={(e) => setBulkLabel({ ...bulkLabel, packageName: e.target.value })}
                placeholder="e.g., Bulk Package"
              />
            </div>

            <div className="form-group">
              <label>Package Description</label>
              <textarea
                value={bulkLabel.packageDescription}
                onChange={(e) => setBulkLabel({ ...bulkLabel, packageDescription: e.target.value })}
                placeholder="Description for all packages"
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Weight (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={bulkLabel.packageWeight}
                  onChange={(e) => setBulkLabel({ ...bulkLabel, packageWeight: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label>Dimensions (LxWxH cm)</label>
                <input
                  type="text"
                  value={bulkLabel.packageDimensions}
                  onChange={(e) => setBulkLabel({ ...bulkLabel, packageDimensions: e.target.value })}
                  placeholder="20x15x10"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Origin Address</label>
                <select
                  value={bulkLabel.originAddressId}
                  onChange={(e) => setBulkLabel({ ...bulkLabel, originAddressId: e.target.value })}
                >
                  <option value="">Select origin...</option>
                  {addresses.map(addr => (
                    <option key={addr.id} value={addr.id}>
                      {addr.addresses_address || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Destination Address</label>
                <select
                  value={bulkLabel.destinationAddressId}
                  onChange={(e) => setBulkLabel({ ...bulkLabel, destinationAddressId: e.target.value })}
                >
                  <option value="">Select destination...</option>
                  {addresses.map(addr => (
                    <option key={addr.id} value={addr.id}>
                      {addr.addresses_address || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Label Format</label>
              <select
                value={bulkLabel.labelFormat}
                onChange={(e) => setBulkLabel({ ...bulkLabel, labelFormat: e.target.value })}
              >
                <option value="a4-10">A4 (10 labels)</option>
                <option value="a4-4">A4 (4 labels)</option>
                <option value="4x6">4x6 Thermal</option>
              </select>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? `Generating ${bulkLabel.quantity} labels...` : `Generate ${bulkLabel.quantity} Labels`}
            </button>
          </form>
        )}

        {activeTab === 'preview' && (
          <div className="preview-section">
            <h3>Generated Labels Preview</h3>
            
            {generatedLabels.length > 0 ? (
              <>
                <div className="labels-grid">
                  {generatedLabels.slice(0, 12).map((label, index) => (
                    <div key={label.id} className="label-card">
                      <div className="label-header">
                        <h4>SHIPPING LABEL</h4>
                      </div>
                      <div className="label-content">
                        <div className="label-field">
                          <span className="label-key">Tracking Code:</span>
                          <span className="label-value">{label.tracking_code}</span>
                        </div>
                        
                        {label.barcode_svg && (
                          <div className="barcode-container">
                            <img 
                              src={label.barcode_svg} 
                              alt="barcode" 
                              className="barcode-image"
                            />
                          </div>
                        )}
                        
                        {label.package_name && (
                          <div className="label-field">
                            <span className="label-key">Package:</span>
                            <span className="label-value">{label.package_name}</span>
                          </div>
                        )}
                        
                        {label.weight_kg && (
                          <div className="label-field">
                            <span className="label-key">Weight:</span>
                            <span className="label-value">{label.weight_kg} kg</span>
                          </div>
                        )}
                        
                        {label.dimensions && (
                          <div className="label-field">
                            <span className="label-key">Dimensions:</span>
                            <span className="label-value">{label.dimensions}</span>
                          </div>
                        )}
                        
                        <div className="label-field timestamp">
                          <span className="label-value">
                            {new Date(label.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="status-badge" style={{ marginTop: '8px' }}>
                          <span className={`badge badge-${label.status}`}>
                            {label.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {generatedLabels.length > 12 && (
                  <p className="info-text">Showing 12 of {generatedLabels.length} labels</p>
                )}
                
                <div className="export-actions">
                  <button onClick={handleExportPDF} className="btn btn-success" disabled={loading}>
                    {loading ? 'Exporting...' : `Export as PDF (${generatedLabels.length} labels)`}
                  </button>
                </div>
              </>
            ) : (
              <p className="empty-state">No labels generated yet. Generate labels from the tabs above.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
