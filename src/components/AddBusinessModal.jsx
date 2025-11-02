import React, { useEffect, useState } from 'react'
import { nearbyUtils } from '../lib/nearbyUtils'
import { useGeolocation } from '../lib/useGeolocation'
import { supabase } from '../lib/supabaseClient'

export default function AddBusinessModal({ userId, onClose, onSubmitted }) {
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
  const { location, city: detectedCity } = useGeolocation()
  const [selectedFiles, setSelectedFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
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

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name || !form.category || !form.city) {
      setError('Please fill in name, category, and city')
      return
    }
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
      // Upload files if any
      if (selectedFiles && selectedFiles.length > 0) {
        const uploadedUrls = []
        for (const file of selectedFiles) {
          const path = `pending/${created.id}/${Date.now()}-${file.name}`
          const { error: upErr } = await supabase.storage.from('nearby_listings').upload(path, file, { upsert: true })
          if (!upErr) {
            const { data: pub } = supabase.storage.from('nearby_listings').getPublicUrl(path)
            if (pub?.publicUrl) uploadedUrls.push(pub.publicUrl)
          }
        }
        if (uploadedUrls.length > 0) {
          const primary = created.primary_image_url || uploadedUrls[0]
          await supabase
            .from('pending_listings')
            .update({ image_urls: uploadedUrls, primary_image_url: primary, updated_at: new Date() })
            .eq('id', created.id)
        }
      }
      const refreshed = created
      setPending(refreshed)
      onSubmitted && onSubmitted(refreshed)
    } catch (err) {
      setError(err.message || 'Failed to submit')
    } finally {
      setSubmitting(false)
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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold">Add your business</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
        </div>

        <div className="p-4">
          <p className="text-sm text-slate-600 mb-4">Submit your business for community review. Final approval requires a one-time fee of 1,000 PHP.</p>

          {error && (
            <div className="mb-3 p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">{error}</div>
          )}

          {!pending ? (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Business Name *</label>
                <input name="name" value={form.name} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="e.g., Juan's Eatery" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category *</label>
                <input name="category" value={form.category} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="Restaurant, Hotel, Attraction..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">City *</label>
                <input name="city" value={form.city} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="City" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Address</label>
                <input name="address" value={form.address} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="Street, Barangay, City" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Latitude</label>
                <input name="latitude" value={form.latitude} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="14.5995" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Longitude</label>
                <input name="longitude" value={form.longitude} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="120.9842" />
              </div>
              <div className="md:col-span-2 -mt-1">
                <button type="button" onClick={() => {
                  if (location) setForm(prev => ({ ...prev, latitude: String(location.latitude), longitude: String(location.longitude), city: prev.city || detectedCity || prev.city }))
                }} className="text-sm text-blue-600 hover:text-blue-700">
                  Use my current location
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input name="phone_number" value={form.phone_number} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="09xx xxx xxxx" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Website</label>
                <input name="website" value={form.website} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Primary Photo URL</label>
                <input name="primary_image_url" value={form.primary_image_url} onChange={handleChange} className="w-full border rounded px-3 py-2" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Upload Images</label>
                <input type="file" accept="image/*" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} className="w-full border rounded px-3 py-2" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} className="w-full border rounded px-3 py-2" rows={3} />
              </div>

              <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{submitting ? 'Submitting...' : 'Submit for review'}</button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-700 text-sm">Submission created. Pay the approval fee to finalize review.</div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-700">Approval fee</div>
                <div className="text-base font-semibold">₱{APPROVAL_FEE.toLocaleString()}</div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 border rounded">Close</button>
                <button onClick={handlePayFee} disabled={paying} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">{paying ? 'Processing...' : 'Pay now'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
