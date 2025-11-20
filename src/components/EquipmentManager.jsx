import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { phpToUsd, usdToPhp, formatPhp, formatUsd, CurrencyInput } from '../lib/currencyConversion'
import { getPhpToUsdRate } from '../lib/currencyConversion'

export default function EquipmentManager({ projectId, onClose, exchangeRate = 0.018 }) {
  const [equipment, setEquipment] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [images, setImages] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [parseLoading, setParseLoading] = useState(false)
  const [rate, setRate] = useState(exchangeRate)
  const [parsePreview, setParsePreview] = useState(null)
  const [showRawInput, setShowRawInput] = useState(false)

  useEffect(() => {
    if (projectId) {
      loadEquipment()
      loadRate()
    }
  }, [projectId])

  async function loadRate() {
    try {
      const r = await getPhpToUsdRate()
      setRate(r)
    } catch (err) {
      console.warn('Failed to load rate:', err)
    }
  }

  async function loadEquipment() {
    setLoading(true)
    try {
      const { data: eqData } = await supabase
        .from('project_equipment')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at')

      const { data: imgData } = await supabase
        .from('equipment_images')
        .select('*')
        .eq('project_id', projectId)

      setEquipment(eqData || [])

      const imgMap = {}
      ;(imgData || []).forEach(img => {
        if (!imgMap[img.equipment_id]) imgMap[img.equipment_id] = []
        imgMap[img.equipment_id].push(img)
      })
      setImages(imgMap)
    } catch (err) {
      console.error('Failed loading equipment:', err)
      setError('Failed to load equipment')
    } finally {
      setLoading(false)
    }
  }

  const current = equipment[currentIndex] || {}
  const currentImages = images[current.id] || []

  async function updateCurrent(field, value) {
    const updated = [...equipment]
    updated[currentIndex] = { ...updated[currentIndex], [field]: value }
    setEquipment(updated)
  }

  async function handleImageUpload(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    if (!current.id) {
      setError('Please save equipment first before adding images')
      return
    }

    try {
      for (const file of files) {
        const timestamp = Date.now()
        const filename = `${projectId}/${current.id}/${timestamp}-${file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase()}`

        const { data, error: uploadErr } = await supabase.storage
          .from('equipment-images')
          .upload(filename, file)

        if (uploadErr) throw uploadErr

        const { data: publicUrl } = supabase.storage
          .from('equipment-images')
          .getPublicUrl(filename)

        const { error: dbErr } = await supabase
          .from('equipment_images')
          .insert([{
            project_id: projectId,
            equipment_id: current.id,
            image_url: publicUrl.publicUrl,
            storage_path: filename,
            alt_text: file.name,
            is_primary: currentImages.length === 0,
            file_size: file.size,
            mime_type: file.type
          }])

        if (dbErr) throw dbErr

        setSuccess('Image uploaded successfully')
        await loadEquipment()
      }
    } catch (err) {
      console.error('Image upload failed:', err)
      setError(`Upload failed: ${err.message}`)
    }
  }

  async function deleteImage(imageId) {
    if (!confirm('Delete this image?')) return
    try {
      const { error } = await supabase
        .from('equipment_images')
        .delete()
        .eq('id', imageId)

      if (error) throw error
      setSuccess('Image deleted')
      await loadEquipment()
    } catch (err) {
      setError(`Failed to delete: ${err.message}`)
    }
  }

  async function saveEquipment() {
    if (!current.equipment_name) {
      setError('Equipment name is required')
      return
    }

    setSaving(true)
    try {
      if (current.id) {
        const { error } = await supabase
          .from('project_equipment')
          .update(current)
          .eq('id', current.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('project_equipment')
          .insert([{ ...current, project_id: projectId }])
        if (error) throw error
      }

      setSuccess('Equipment saved')
      await loadEquipment()
    } catch (err) {
      console.error('Save failed:', err)
      setError(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function deleteCurrentEquipment() {
    if (!confirm('Delete this equipment?')) return
    if (!current.id) {
      const updated = equipment.filter((_, i) => i !== currentIndex)
      setEquipment(updated)
      setCurrentIndex(Math.max(0, currentIndex - 1))
      return
    }

    try {
      const { error } = await supabase
        .from('project_equipment')
        .delete()
        .eq('id', current.id)
      if (error) throw error
      setSuccess('Equipment deleted')
      await loadEquipment()
      setCurrentIndex(Math.max(0, currentIndex - 1))
    } catch (err) {
      setError(`Delete failed: ${err.message}`)
    }
  }

  async function addNewEquipment() {
    setEquipment([...equipment, {}])
    setCurrentIndex(equipment.length)
  }

  async function parseEquipmentText() {
    if (!pasteText.trim()) {
      setError('Please enter equipment data')
      return
    }

    setParseLoading(true)
    setError('')

    try {
      const xApiKey = process.env.VITE_X_API_KEY || 'xai-qe0lzba8kfDmccd5EBClqO7ELZXxYG3hyyetV1b5D4dISqjStXLHcFElnYfmRD3ddy0gV4sHxnR3XZT3'

      const schema = {
        fields: [
          'equipment_name (required)',
          'equipment_type',
          'capacity_value',
          'capacity_unit (L, kg, T, L/h, kg/h, T/h, etc.)',
          'quantity (default 1)',
          'unit_cost_usd (extract numeric value, convert from PHP if needed at rate ${rate})',
          'power_consumption_kw',
          'material_of_construction',
          'length_mm',
          'width_mm',
          'height_mm',
          'weight_kg',
          'installation_days',
          'installation_cost_usd',
          'lead_time_days',
          'expected_lifespan_years',
          'maintenance_cost_annual_usd',
          'expected_efficiency_percentage',
          'notes'
        ]
      }

      const prompt = `You are an expert at parsing equipment specifications from unstructured text.

Parse this equipment data and extract structured information. Return ONLY a valid JSON array.

SCHEMA: Extract these fields for each equipment item:
${schema.fields.join('\n')}

RULES:
1. equipment_name is REQUIRED for each item
2. Omit any field that is not mentioned or cannot be determined
3. Convert currency to USD (PHP to USD multiply by ${rate})
4. Extract numeric values only for numeric fields
5. For capacity_unit, use standard units (L, kg, T, L/h, kg/h, etc.)
6. Return ONLY valid JSON array with no markdown, no code blocks, no extra text

INPUT TEXT:
${pasteText}

Return ONLY the JSON array:`

      const response = await fetch('https://api.x.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${xApiKey}`
        },
        body: JSON.stringify({
          model: 'grok-2',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 4096
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      const data = await response.json()
      let content = data.choices?.[0]?.message?.content || ''

      let parsed = []
      try {
        parsed = JSON.parse(content)
      } catch (e) {
        const jsonMatch = content.match(/\[[\s\S]*\]/m)
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('Could not extract valid JSON from response')
        }
      }

      if (!Array.isArray(parsed)) {
        parsed = [parsed]
      }

      setParsePreview(parsed)
      setSuccess(`Parsed ${parsed.length} equipment item(s)`)
    } catch (err) {
      console.error('Parse error:', err)
      setError(`Parse failed: ${err.message}`)
      setParsePreview(null)
    } finally {
      setParseLoading(false)
    }
  }

  function acceptParsedData() {
    if (!parsePreview) return
    setEquipment([...equipment, ...parsePreview])
    setPasteText('')
    setParsePreview(null)
    setShowRawInput(false)
    setSuccess(`Added ${parsePreview.length} equipment item(s)`)
    setCurrentIndex(equipment.length)
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-600">Loading equipment...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-5xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Equipment Management</h2>
          <p className="text-blue-100 text-sm mt-1">
            {equipment.length === 0 ? 'No equipment added' : `Item ${currentIndex + 1} of ${equipment.length}`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-white/20 rounded-lg p-2 text-2xl"
        >
          x
        </button>
      </div>

      {error && <div className="bg-red-50 border-b border-red-200 text-red-700 p-4 text-sm">{error}</div>}
      {success && <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-700 p-4 text-sm">{success}</div>}

      <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
        {!showRawInput && equipment.length === 0 ? (
          <div className="p-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">Add Equipment</h3>
              <p className="text-slate-700 mb-4">
                Paste any equipment information below. The AI will automatically extract and organize the data into the proper fields.
              </p>
              <button
                onClick={() => setShowRawInput(true)}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Paste Equipment Data
              </button>
            </div>
            <div className="text-center text-slate-500 text-sm">
              or
            </div>
            <button
              onClick={addNewEquipment}
              className="w-full mt-4 px-6 py-3 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium"
            >
              Add Manually
            </button>
          </div>
        ) : showRawInput ? (
          <div className="p-8 space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-900 block mb-2">Equipment Information</label>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste any equipment details here. Examples:
- washing machine, stainless steel, 10L capacity, 1.5kW power, $500
- grinding machine 5kg/h, aluminum, 2.2kW, $1000, 50kg weight
- centrifuge SUS 304, 20 L/h capacity, 3kW, installation 15 days, $2000

The AI will intelligently parse and extract all data."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows="10"
              />
              <p className="text-xs text-slate-500 mt-2">Paste any format - CSV, bullet points, natural text, or structured data. AI will understand it.</p>
            </div>

            {parsePreview && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <h4 className="font-semibold text-emerald-900 mb-3">Preview - {parsePreview.length} item(s) parsed</h4>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {parsePreview.map((item, idx) => (
                    <div key={idx} className="bg-white p-3 rounded border border-emerald-100 text-sm">
                      <div className="font-medium text-slate-900">{item.equipment_name}</div>
                      <div className="text-slate-600 grid grid-cols-2 gap-2 mt-1 text-xs">
                        {item.equipment_type && <div>Type: {item.equipment_type}</div>}
                        {item.capacity_value && <div>Capacity: {item.capacity_value} {item.capacity_unit}</div>}
                        {item.unit_cost_usd && <div>Cost: ${item.unit_cost_usd}</div>}
                        {item.power_consumption_kw && <div>Power: {item.power_consumption_kw}kW</div>}
                        {item.weight_kg && <div>Weight: {item.weight_kg}kg</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={parseEquipmentText}
                disabled={parseLoading || !pasteText.trim()}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {parseLoading ? 'Parsing with AI...' : 'Parse with AI'}
              </button>
              {parsePreview && (
                <button
                  onClick={acceptParsedData}
                  className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
                >
                  Accept and Add
                </button>
              )}
              <button
                onClick={() => {
                  setShowRawInput(false)
                  setPasteText('')
                  setParsePreview(null)
                }}
                className="px-6 py-3 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {/* Equipment Form */}
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Equipment Name *</label>
                    <input
                      type="text"
                      value={current.equipment_name || ''}
                      onChange={(e) => updateCurrent('equipment_name', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Washing Machine"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Type</label>
                    <input
                      type="text"
                      value={current.equipment_type || ''}
                      onChange={(e) => updateCurrent('equipment_type', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., processing, storage"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Quantity</label>
                    <input
                      type="number"
                      value={current.quantity || 1}
                      onChange={(e) => updateCurrent('quantity', parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Material</label>
                    <input
                      type="text"
                      value={current.material_of_construction || ''}
                      onChange={(e) => updateCurrent('material_of_construction', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., SUS 304, Stainless Steel"
                    />
                  </div>
                </div>
              </div>

              {/* Capacity & Performance */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Capacity & Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Capacity Value</label>
                    <input
                      type="number"
                      step="0.01"
                      value={current.capacity_value || ''}
                      onChange={(e) => updateCurrent('capacity_value', parseFloat(e.target.value) || null)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 10, 500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Capacity Unit</label>
                    <input
                      type="text"
                      value={current.capacity_unit || ''}
                      onChange={(e) => updateCurrent('capacity_unit', e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="L, kg, T, L/h, etc."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Power Consumption (kW)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={current.power_consumption_kw || ''}
                      onChange={(e) => updateCurrent('power_consumption_kw', parseFloat(e.target.value) || null)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 1.5"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Efficiency (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={current.expected_efficiency_percentage || ''}
                      onChange={(e) => updateCurrent('expected_efficiency_percentage', parseFloat(e.target.value) || null)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0-100"
                    />
                  </div>
                </div>
              </div>

              {/* Measurements */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Physical Dimensions & Weight</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Length (mm)</label>
                    <input
                      type="number"
                      value={current.length_mm || ''}
                      onChange={(e) => updateCurrent('length_mm', parseInt(e.target.value) || null)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Width (mm)</label>
                    <input
                      type="number"
                      value={current.width_mm || ''}
                      onChange={(e) => updateCurrent('width_mm', parseInt(e.target.value) || null)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Height (mm)</label>
                    <input
                      type="number"
                      value={current.height_mm || ''}
                      onChange={(e) => updateCurrent('height_mm', parseInt(e.target.value) || null)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs font-medium text-slate-700 block mb-2">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={current.weight_kg || ''}
                      onChange={(e) => updateCurrent('weight_kg', parseFloat(e.target.value) || null)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Costs & Timeline */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Costs & Timeline</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Unit Cost (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={current.unit_cost_usd || ''}
                      onChange={(e) => updateCurrent('unit_cost_usd', parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                    {current.unit_cost_usd && (
                      <p className="text-xs text-slate-600 mt-1">
                        Total: {formatPhp((current.unit_cost_usd * (current.quantity || 1)) / rate)} PHP
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Installation Cost (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={current.installation_cost_usd || ''}
                      onChange={(e) => updateCurrent('installation_cost_usd', parseFloat(e.target.value) || null)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Installation Days</label>
                    <input
                      type="number"
                      value={current.installation_days || ''}
                      onChange={(e) => updateCurrent('installation_days', parseInt(e.target.value) || null)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Lead Time (days)</label>
                    <input
                      type="number"
                      value={current.lead_time_days || ''}
                      onChange={(e) => updateCurrent('lead_time_days', parseInt(e.target.value) || null)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Expected Lifespan (years)</label>
                    <input
                      type="number"
                      value={current.expected_lifespan_years || ''}
                      onChange={(e) => updateCurrent('expected_lifespan_years', parseInt(e.target.value) || null)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-2">Annual Maintenance (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={current.maintenance_cost_annual_usd || ''}
                      onChange={(e) => updateCurrent('maintenance_cost_annual_usd', parseFloat(e.target.value) || null)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Additional Notes</h3>
                <textarea
                  value={current.notes || ''}
                  onChange={(e) => updateCurrent('notes', e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Add any additional notes about this equipment..."
                />
              </div>

              {/* Images */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Photos</h3>
                {current.id ? (
                  <>
                    <div className="mb-4">
                      <label className="block px-4 py-8 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors text-center">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <div className="text-blue-600 font-medium">Click to upload images</div>
                        <p className="text-xs text-slate-600 mt-1">or drag and drop</p>
                      </label>
                    </div>

                    {currentImages.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {currentImages.map(img => (
                          <div key={img.id} className="relative group">
                            <img
                              src={img.image_url}
                              alt={img.alt_text}
                              className="w-full h-40 object-cover rounded-lg border border-slate-200"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-lg transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <button
                                onClick={() => deleteImage(img.id)}
                                className="px-2 py-1 bg-red-600 text-white text-sm rounded"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-slate-600 text-sm">Save equipment first to add images</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Import Modal */}

      {/* Footer Actions */}
      {equipment.length > 0 && (
        <div className="border-t bg-slate-50 p-6">
          {/* Pagination */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="px-3 py-2 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-100"
              >
                ← Previous
              </button>
              <div className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium">
                {currentIndex + 1} / {equipment.length}
              </div>
              <button
                onClick={() => setCurrentIndex(Math.min(equipment.length - 1, currentIndex + 1))}
                disabled={currentIndex === equipment.length - 1}
                className="px-3 py-2 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-slate-100"
              >
                Next →
              </button>
            </div>

            <div className="flex gap-2 flex-wrap justify-end">
              <button
                onClick={addNewEquipment}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Add Another
              </button>
              <button
                onClick={() => setShowRawInput(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
              >
                Paste Data
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={saveEquipment}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Saving...' : 'Save Equipment'}
            </button>
            <button
              onClick={deleteCurrentEquipment}
              className="px-6 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium text-sm"
            >
              Delete
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-slate-300 rounded-lg hover:bg-slate-100 font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
