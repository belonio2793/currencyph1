import React, { useEffect, useState, useRef } from 'react'
import { nearbyUtils } from '../lib/nearbyUtils'
import { useGeolocation } from '../lib/useGeolocation'
import { supabase } from '../lib/supabaseClient'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix leaflet default icon paths (Vite + ESM)
let DEFAULT_LEAFLET_ICON = null
try {
  delete L.Icon.Default.prototype._getIconUrl
  const iconRetinaUrl = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href
  const iconUrl = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href
  const shadowUrl = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href
  L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl
  })
  DEFAULT_LEAFLET_ICON = L.icon({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })
} catch(e) {
  // ignore in environments where leaflet isn't available
}

export default function AddBusinessModal({ userId, onClose, onSubmitted }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [form, setForm] = useState({
    name: '',
    category: '',
    address: '',
    city: '',
    country: 'Philippines',
    latitude: '',
    longitude: '',
    phone_number: '',
    website: '',
    description: '',
    primary_image_url: ''
  })
  const [photoUrls, setPhotoUrls] = useState('')
  const { location, city: detectedCity } = useGeolocation()
  const [selectedFiles, setSelectedFiles] = useState([])
  const [filePreview, setFilePreview] = useState([])
  const [submitting, setSubmitting] = useState(false)
  // categories for dropdown fetched from existing listings
  const [categories, setCategories] = useState([])
  const [categorySelect, setCategorySelect] = useState('')
  const [customCategory, setCustomCategory] = useState('')
  // map picker state (inline map)
  const [missingFields, setMissingFields] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null)
  const [paying, setPaying] = useState(false)
  const APPROVAL_FEE = 1000

  useEffect(() => {
    if (location) {
      setForm(prev => ({
        ...prev,
        latitude: prev.latitude || String(location.latitude),
        longitude: prev.longitude || String(location.longitude),
        city: prev.city || detectedCity || prev.city
      }))
    }
  }, [location, detectedCity])

  // load existing categories from DB to present in dropdown
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const { data, error } = await supabase.from('nearby_listings').select('category').limit(1000)
        if (error) {
          console.warn('Failed to load categories', error)
          return
        }
        const cats = Array.from(new Set((data || []).map(d => d.category).filter(Boolean))).sort()
        if (!cancelled) setCategories(cats)
      } catch (e) {
        console.warn('Failed to load categories', e)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(files)
    
    const previews = files.map(file => ({
      name: file.name,
      url: URL.createObjectURL(file),
      type: 'file'
    }))
    setFilePreview(previews)
  }

  const handlePhotoUrlsChange = (e) => {
    const value = e.target.value
    setPhotoUrls(value)
    
    const urls = value
      .split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0)
    
    const urlPreviews = urls.map(url => ({
      name: url.split('/').pop() || 'image',
      url: url,
      type: 'url'
    }))
    
    setFilePreview(prev => [
      ...prev.filter(p => p.type === 'file'),
      ...urlPreviews
    ])
  }

  const removePreview = (index) => {
    const preview = filePreview[index]
    if (preview.type === 'file') {
      const fileIndex = selectedFiles.findIndex(f => f.name === preview.name)
      if (fileIndex > -1) {
        setSelectedFiles(selectedFiles.filter((_, i) => i !== fileIndex))
      }
    }
    setFilePreview(filePreview.filter((_, i) => i !== index))
  }

  const validatePage1 = () => {
    const required = ['name', 'category', 'city']
    const missing = required.filter((k) => !form[k] || String(form[k]).trim() === '')
    if (missing.length > 0) {
      setMissingFields(missing)
      setError('Please fill in all of the required fields.')
      return false
    }
    setMissingFields([])
    if (form.latitude && isNaN(parseFloat(form.latitude))) {
      setError('Latitude must be a valid number')
      return false
    }
    if (form.longitude && isNaN(parseFloat(form.longitude))) {
      setError('Longitude must be a valid number')
      return false
    }
    return true
  }

  const handleNextPage = () => {
    if (validatePage1()) {
      setError('')
      setCurrentPage(2)
    }
  }

  const handlePrevPage = () => {
    setError('')
    setCurrentPage(1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    try {
      setSubmitting(true)
      
      const payload = {
        name: form.name,
        category: form.category,
        address: form.address,
        city: form.city,
        country: form.country,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        phone_number: form.phone_number || null,
        website: form.website || null,
        description: form.description || null,
        primary_image_url: form.primary_image_url || null,
        raw: { source: 'community_submission' }
      }
      
      const created = await nearbyUtils.submitPendingListing(userId, payload)
      
      const uploadedUrls = []
      
      // Upload files if any
      if (selectedFiles && selectedFiles.length > 0) {
        setUploading(true)
        for (const file of selectedFiles) {
          try {
            const path = `pending/${created.id}/${Date.now()}-${file.name}`
            const { error: upErr } = await supabase.storage.from('nearby_listings').upload(path, file, { upsert: true })
            if (!upErr) {
              const { data: pub } = supabase.storage.from('nearby_listings').getPublicUrl(path)
              if (pub?.publicUrl) uploadedUrls.push(pub.publicUrl)
            }
          } catch (err) {
            console.warn('File upload error:', err)
          }
        }
        setUploading(false)
      }
      
      // Add URL-based photos
      const urlPhotos = photoUrls
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0)
      
      const allUrls = [...uploadedUrls, ...urlPhotos]
      
      // Update pending listing with all photo URLs
      if (allUrls.length > 0) {
        const primary = form.primary_image_url || allUrls[0]
        await supabase
          .from('pending_listings')
          .update({ 
            image_urls: allUrls, 
            primary_image_url: primary, 
            updated_at: new Date() 
          })
          .eq('id', created.id)
      }
      
      const refreshed = await supabase
        .from('pending_listings')
        .select('*')
        .eq('id', created.id)
        .single()
      
      setPending(refreshed.data || created)
      onSubmitted && onSubmitted(refreshed.data || created)
    } catch (err) {
      setError(err.message || 'Failed to submit')
    } finally {
      setSubmitting(false)
      setUploading(false)
    }
  }

  const handlePayFee = async () => {
    if (!pending) return
    try {
      setPaying(true)
      await nearbyUtils.payApprovalFee(pending.id, userId, 'PHP', APPROVAL_FEE)
      alert('Approval fee paid successfully.')
      onClose()
    } catch (err) {
      setError(err.message || 'Payment failed')
    } finally {
      setPaying(false)
    }
  }

  function LocationMarker() {
    const [pos, setPos] = useState(
      form.latitude && form.longitude ? [parseFloat(form.latitude), parseFloat(form.longitude)] : null
    )
    const markerRef = useRef(null)
    const map = useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng
        setPos([lat, lng])
        setForm(prev => ({ ...prev, latitude: String(lat), longitude: String(lng) }))
      }
    })

    // when form coordinates change externally, update marker position
    useEffect(() => {
      if (form.latitude && form.longitude) {
        const lat = parseFloat(form.latitude)
        const lng = parseFloat(form.longitude)
        if (!isNaN(lat) && !isNaN(lng)) {
          setPos([lat, lng])
          try { map.setView([lat, lng], map.getZoom()) } catch(e){}
        }
      }
    }, [form.latitude, form.longitude])

    useEffect(() => {
      if (pos && map && map.setView) {
        try { map.setView(pos, map.getZoom()) } catch(e){}
      }
    }, [pos])

    const eventHandlers = {
      dragend(e) {
        try {
          const latlng = e.target.getLatLng()
          const lat = latlng.lat
          const lng = latlng.lng
          setPos([lat, lng])
          setForm(prev => ({ ...prev, latitude: String(lat), longitude: String(lng) }))
        } catch (ex) {}
      }
    }

    return pos ? (
      <Marker
        draggable={true}
        eventHandlers={eventHandlers}
        ref={(el) => { markerRef.current = el ? el : null }}
        position={pos}
        icon={DEFAULT_LEAFLET_ICON}
      />
    ) : null
  }

  if (pending) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
          <div className="flex items-center justify-between border-b p-4">
            <h3 className="text-lg font-semibold">Submission Complete</h3>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
          </div>

          <div className="p-4">
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-700 text-sm">
                Submission created! Your business is now pending review. Pay the approval fee to finalize review.
              </div>
              {pending.image_urls && pending.image_urls.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Submitted Photos ({pending.image_urls.length})</p>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {pending.image_urls.map((url, idx) => (
                      <div key={idx} className="w-full h-20 bg-slate-100 rounded overflow-hidden">
                        <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <div className="text-sm text-slate-700">Approval fee</div>
                  <div className="text-base font-semibold">₱{APPROVAL_FEE.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-700">Coordinates</div>
                  <div className="text-sm text-slate-600">{pending.latitude && pending.longitude ? `${pending.latitude}, ${pending.longitude}` : 'Not set'}</div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-slate-50">Close</button>
                <button onClick={handlePayFee} disabled={paying} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700">
                  {paying ? 'Processing...' : 'Pay now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b p-4 sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">Add your business</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
        </div>

        <div className="p-4">
          <p className="text-sm text-slate-600 mb-4">
            {currentPage === 1 
              ? 'Basic business information' 
              : 'Add photos for your business'}
          </p>
          <div className="text-xs text-slate-500 mb-4">
            Page {currentPage} of 2
          </div>

          {error && (
            <div className="mb-3 p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {currentPage === 1 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Business Name *</label>
                    <input 
                      name="name" 
                      value={form.name} 
                      onChange={handleChange} 
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      placeholder="e.g., Juan's Eatery" 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Category *</label>
                    <div className="flex gap-2">
                      <select
                        name="category_select"
                        value={categorySelect}
                        onChange={(e) => {
                          const v = e.target.value
                          setCategorySelect(v)
                          if (v === '__other__') {
                            setForm(prev => ({ ...prev, category: customCategory || '' }))
                          } else {
                            setForm(prev => ({ ...prev, category: v }))
                          }
                        }}
                        className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select a category</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        <option value="__other__">Other...</option>
                      </select>
                      {categorySelect === '__other__' && (
                        <input
                          type="text"
                          value={customCategory}
                          onChange={(e) => {
                            setCustomCategory(e.target.value)
                            setForm(prev => ({ ...prev, category: e.target.value }))
                          }}
                          placeholder="Enter custom category"
                          className="w-1/2 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">City *</label>
                    <input
                      name="city"
                      value={form.city}
                      onChange={(e) => {
                        handleChange(e)
                        setMissingFields(prev => prev.filter(f => f !== 'city'))
                      }}
                      className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${missingFields.includes('city') ? 'border-red-500 ring-1 ring-red-200' : ''}`}
                      placeholder="City"
                    />
                    {missingFields.includes('city') && <p className="text-xs text-red-600 mt-1">City is required</p>}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Address</label>
                    <input
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Street, Barangay, City"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Latitude</label>
                    <input
                      name="latitude"
                      value={form.latitude}
                      onChange={(e) => {
                        handleChange(e)
                        // update marker by updating form (LocationMarker listens to form changes)
                        setMissingFields(prev => prev.filter(f => f !== 'latitude'))
                      }}
                      className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${error && form.latitude && isNaN(parseFloat(form.latitude)) ? 'border-red-500 ring-1 ring-red-200' : ''}`}
                      placeholder="14.5995"
                    />
                    {error && form.latitude && isNaN(parseFloat(form.latitude)) && <p className="text-xs text-red-600 mt-1">Latitude must be a valid number</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Longitude</label>
                    <input
                      name="longitude"
                      value={form.longitude}
                      onChange={(e) => { handleChange(e); setMissingFields(prev => prev.filter(f => f !== 'longitude')) }}
                      className={`w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${error && form.longitude && isNaN(parseFloat(form.longitude)) ? 'border-red-500 ring-1 ring-red-200' : ''}`}
                      placeholder="120.9842"
                    />
                    {error && form.longitude && isNaN(parseFloat(form.longitude)) && <p className="text-xs text-red-600 mt-1">Longitude must be a valid number</p>}
                  </div>
                  
                  <div className="md:col-span-2">
                    <div className="flex items-center gap-4 mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (location) setForm(prev => ({
                            ...prev,
                            latitude: String(location.latitude),
                            longitude: String(location.longitude),
                            city: prev.city || detectedCity || prev.city
                          }))
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Use my current location
                      </button>
                      <div className="text-sm text-slate-500">Or pick a location on the map below</div>
                    </div>

                    <div className="w-full h-64 border rounded overflow-hidden">
                      <MapContainer attributionControl={false} center={[form.latitude ? parseFloat(form.latitude) : 14.5995, form.longitude ? parseFloat(form.longitude) : 120.9842]} zoom={13} className="w-full h-full">
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                        <LocationMarker />
                      </MapContainer>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Click the map to place the marker. Drag the marker to fine-tune location. Latitude/Longitude are synchronized with the inputs above.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input 
                      name="phone_number" 
                      value={form.phone_number} 
                      onChange={handleChange} 
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      placeholder="09xx xxx xxxx" 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Website</label>
                    <input 
                      name="website" 
                      value={form.website} 
                      onChange={handleChange} 
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      placeholder="https://..." 
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea 
                      name="description" 
                      value={form.description} 
                      onChange={handleChange} 
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      rows={3}
                      placeholder="Tell us about your business..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button 
                    type="button" 
                    onClick={onClose} 
                    className="px-4 py-2 border rounded hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    onClick={handleNextPage}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Next: Add Photos
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Primary Photo URL</label>
                    <input 
                      name="primary_image_url" 
                      value={form.primary_image_url} 
                      onChange={handleChange} 
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      placeholder="https://example.com/photo.jpg" 
                    />
                    <p className="text-xs text-slate-500 mt-1">This will be the main photo displayed for your business</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Upload Images from Device</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      onChange={handleFileSelect} 
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={uploading}
                    />
                    <p className="text-xs text-slate-500 mt-1">Select multiple images to upload</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Or Add Photo URLs</label>
                    <textarea 
                      value={photoUrls} 
                      onChange={handlePhotoUrlsChange}
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                      rows={3}
                      placeholder="Paste image URLs separated by commas&#10;Example: https://example.com/photo1.jpg, https://example.com/photo2.jpg"
                    />
                    <p className="text-xs text-slate-500 mt-1">Enter URLs separated by commas</p>
                  </div>

                  {filePreview.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Preview ({filePreview.length} photo{filePreview.length !== 1 ? 's' : ''})</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-2 border rounded bg-slate-50">
                        {filePreview.map((preview, idx) => (
                          <div key={idx} className="relative group">
                            <div className="w-full aspect-square bg-slate-200 rounded overflow-hidden border">
                              <img 
                                src={preview.url} 
                                alt={preview.name} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removePreview(idx)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ✕
                            </button>
                            <p className="text-xs text-slate-600 mt-1 truncate">{preview.name}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between gap-2 mt-6">
                  <button 
                    type="button" 
                    onClick={handlePrevPage}
                    disabled={submitting || uploading}
                    className="px-4 py-2 border rounded hover:bg-slate-50 disabled:opacity-50"
                  >
                    ← Back
                  </button>
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={onClose}
                      disabled={submitting || uploading}
                      className="px-4 py-2 border rounded hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={submitting || uploading}
                      className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
                    >
                      {uploading ? 'Uploading...' : submitting ? 'Submitting...' : 'Submit for review'}
                    </button>
                  </div>
                </div>

                {(uploading || submitting) && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-blue-700 text-sm">
                    {uploading && 'Uploading images to cloud...'}
                    {submitting && !uploading && 'Processing your submission...'}
                  </div>
                )}
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
