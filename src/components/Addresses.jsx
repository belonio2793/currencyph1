import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import './Addresses.css'

export default function Addresses({ userId, onClose }) {
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    label: '',
    street: '',
    city: '',
    province: '',
    postal_code: '',
    is_default: false
  })

  useEffect(() => {
    if (userId) {
      loadAddresses()
    }
  }, [userId])

  const loadAddresses = async () => {
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })

      if (fetchError) throw fetchError
      setAddresses(data || [])
    } catch (err) {
      console.error('Error loading addresses:', err)
      setError('Failed to load addresses')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, checked, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!formData.label.trim() || !formData.street.trim() || !formData.city.trim()) {
      setError('Please fill in all required fields')
      return
    }

    try {
      const { error: insertError } = await supabase
        .from('user_addresses')
        .insert([{
          user_id: userId,
          ...formData
        }])

      if (insertError) throw insertError

      setFormData({
        label: '',
        street: '',
        city: '',
        province: '',
        postal_code: '',
        is_default: false
      })
      setShowForm(false)
      await loadAddresses()
    } catch (err) {
      console.error('Error saving address:', err)
      setError('Failed to save address')
    }
  }

  const handleDelete = async (addressId) => {
    if (!window.confirm('Are you sure you want to delete this address?')) return

    try {
      const { error: deleteError } = await supabase
        .from('user_addresses')
        .delete()
        .eq('id', addressId)

      if (deleteError) throw deleteError
      await loadAddresses()
    } catch (err) {
      console.error('Error deleting address:', err)
      setError('Failed to delete address')
    }
  }

  return (
    <div className="addresses-container">
      <div className="addresses-header">
        <h1>Addresses</h1>
        <p className="addresses-subtitle">Manage your saved addresses</p>
      </div>

      {error && (
        <div className="addresses-error">
          {error}
          <button onClick={() => setError('')} className="error-close">×</button>
        </div>
      )}

      {loading ? (
        <div className="addresses-loading">Loading addresses...</div>
      ) : (
        <>
          {addresses.length === 0 ? (
            <div className="addresses-empty">
              <p>No addresses saved yet</p>
              <button
                onClick={() => setShowForm(true)}
                className="btn-add-address"
              >
                + Add Your First Address
              </button>
            </div>
          ) : (
            <>
              <div className="addresses-list">
                {addresses.map(address => (
                  <div key={address.id} className="address-card">
                    <div className="address-info">
                      <h3>{address.label}</h3>
                      <p>{address.street}</p>
                      <p>{address.city}{address.province ? `, ${address.province}` : ''}</p>
                      {address.postal_code && <p>{address.postal_code}</p>}
                      {address.is_default && <span className="badge-default">Default</span>}
                    </div>
                    <div className="address-actions">
                      <button
                        onClick={() => handleDelete(address.id)}
                        className="btn-delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="btn-add-address"
              >
                + Add New Address
              </button>
            </>
          )}

          {showForm && (
            <div className="addresses-form-overlay" onClick={() => setShowForm(false)}>
              <div className="addresses-form" onClick={e => e.stopPropagation()}>
                <div className="form-header">
                  <h2>Add New Address</h2>
                  <button
                    onClick={() => setShowForm(false)}
                    className="form-close"
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="address-form-content">
                  <div className="form-group">
                    <label>Label (e.g., Home, Office)</label>
                    <input
                      type="text"
                      name="label"
                      value={formData.label}
                      onChange={handleInputChange}
                      placeholder="e.g., Home"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Street Address</label>
                    <input
                      type="text"
                      name="street"
                      value={formData.street}
                      onChange={handleInputChange}
                      placeholder="Street address"
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>City</label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        placeholder="City"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Province</label>
                      <input
                        type="text"
                        name="province"
                        value={formData.province}
                        onChange={handleInputChange}
                        placeholder="Province"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Postal Code</label>
                    <input
                      type="text"
                      name="postal_code"
                      value={formData.postal_code}
                      onChange={handleInputChange}
                      placeholder="Postal code"
                    />
                  </div>

                  <div className="form-group checkbox">
                    <input
                      type="checkbox"
                      name="is_default"
                      checked={formData.is_default}
                      onChange={handleInputChange}
                      id="is_default"
                    />
                    <label htmlFor="is_default">Set as default address</label>
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="btn-cancel"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-save">
                      Save Address
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
