import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import './ProductListingManager.css'

const PRODUCT_CATEGORIES = [
  'machinery',
  'agricultural',
  'construction',
  'industrial_tools',
  'spare_parts',
  'chemicals',
  'textiles',
  'metals',
  'electrical',
  'hydraulics'
]

export default function ProductListingManager({ businessId, userId }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'machinery',
    subcategory: '',
    price: '',
    unit_of_measurement: '',
    minimum_order_quantity: 1,
    stock_quantity: 0,
    primary_image_url: '',
    image_urls: [],
    specifications: {},
    features: [],
    shipping_available: true,
    delivery_time: '',
    delivery_cost: '',
    return_policy: '',
    warranty_info: '',
    payment_terms: '',
  })

  useEffect(() => {
    loadProducts()
  }, [businessId])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('industrial_products')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })

      if (err) throw err
      setProducts(data || [])
    } catch (err) {
      console.error('Error loading products:', err)
      setError('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSpecificationChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      specifications: {
        ...prev.specifications,
        [key]: value
      }
    }))
  }

  const addFeature = (feature) => {
    if (feature.trim()) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, feature]
      }))
    }
  }

  const removeFeature = (index) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name || !formData.price || !formData.category) {
      setError('Please fill in all required fields')
      return
    }

    try {
      const productData = {
        business_id: businessId,
        seller_id: userId,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        subcategory: formData.subcategory,
        price: parseFloat(formData.price),
        unit_of_measurement: formData.unit_of_measurement,
        minimum_order_quantity: parseInt(formData.minimum_order_quantity) || 1,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        primary_image_url: formData.primary_image_url,
        image_urls: formData.image_urls,
        specifications: formData.specifications,
        features: formData.features,
        shipping_available: formData.shipping_available,
        delivery_time: formData.delivery_time,
        delivery_cost: formData.delivery_cost ? parseFloat(formData.delivery_cost) : null,
        return_policy: formData.return_policy,
        warranty_info: formData.warranty_info,
        payment_terms: formData.payment_terms,
        status: 'active',
        visibility: 'public'
      }

      if (editingId) {
        const { error: err } = await supabase
          .from('industrial_products')
          .update(productData)
          .eq('id', editingId)

        if (err) throw err
        alert('Product updated successfully!')
      } else {
        const { error: err } = await supabase
          .from('industrial_products')
          .insert([productData])

        if (err) throw err
        alert('Product created successfully!')
      }

      loadProducts()
      setShowForm(false)
      setEditingId(null)
      resetForm()
    } catch (err) {
      console.error('Error saving product:', err)
      setError('Failed to save product')
    }
  }

  const handleEdit = (product) => {
    setFormData({
      name: product.name,
      description: product.description,
      category: product.category,
      subcategory: product.subcategory || '',
      price: product.price,
      unit_of_measurement: product.unit_of_measurement || '',
      minimum_order_quantity: product.minimum_order_quantity,
      stock_quantity: product.stock_quantity,
      primary_image_url: product.primary_image_url || '',
      image_urls: product.image_urls || [],
      specifications: product.specifications || {},
      features: product.features || [],
      shipping_available: product.shipping_available,
      delivery_time: product.delivery_time || '',
      delivery_cost: product.delivery_cost || '',
      return_policy: product.return_policy || '',
      warranty_info: product.warranty_info || '',
      payment_terms: product.payment_terms || '',
    })
    setEditingId(product.id)
    setShowForm(true)
  }

  const handleDelete = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const { error: err } = await supabase
        .from('industrial_products')
        .delete()
        .eq('id', productId)

      if (err) throw err
      alert('Product deleted successfully!')
      loadProducts()
    } catch (err) {
      console.error('Error deleting product:', err)
      setError('Failed to delete product')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'machinery',
      subcategory: '',
      price: '',
      unit_of_measurement: '',
      minimum_order_quantity: 1,
      stock_quantity: 0,
      primary_image_url: '',
      image_urls: [],
      specifications: {},
      features: [],
      shipping_available: true,
      delivery_time: '',
      delivery_cost: '',
      return_policy: '',
      warranty_info: '',
      payment_terms: '',
    })
    setEditingId(null)
  }

  return (
    <div className="product-listing-manager">
      <div className="manager-header">
        <h2>Industrial Products</h2>
        <button
          onClick={() => {
            setShowForm(true)
            resetForm()
          }}
          className="btn-add-product"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New Product
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Product List */}
      <div className="products-list">
        {loading ? (
          <p>Loading products...</p>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <p>No products yet</p>
            <p className="subtitle">Start selling by adding your first product</p>
          </div>
        ) : (
          <div className="products-table">
            <div className="table-header">
              <div className="col-name">Product Name</div>
              <div className="col-category">Category</div>
              <div className="col-price">Price</div>
              <div className="col-stock">Stock</div>
              <div className="col-actions">Actions</div>
            </div>
            {products.map(product => (
              <div key={product.id} className="table-row">
                <div className="col-name">{product.name}</div>
                <div className="col-category">{product.category}</div>
                <div className="col-price">₱{parseFloat(product.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                <div className="col-stock">{product.stock_quantity}</div>
                <div className="col-actions">
                  <button
                    onClick={() => handleEdit(product)}
                    className="action-btn edit-btn"
                    title="Edit product"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="action-btn delete-btn"
                    title="Delete product"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="form-modal-overlay" onClick={() => { setShowForm(false); resetForm() }}>
          <div className="form-modal" onClick={e => e.stopPropagation()}>
            <div className="form-header">
              <h3>{editingId ? 'Edit Product' : 'Add New Product'}</h3>
              <button
                onClick={() => { setShowForm(false); resetForm() }}
                className="close-btn"
              >
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-section">
                <h4>Basic Information</h4>

                <div className="form-group">
                  <label>Product Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., Heavy Duty Industrial Conveyor Belt"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Detailed product description..."
                    rows="4"
                  ></textarea>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Category *</label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      required
                    >
                      {PRODUCT_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>
                          {cat.replace(/_/g, ' ').toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Subcategory</label>
                    <input
                      type="text"
                      name="subcategory"
                      value={formData.subcategory}
                      onChange={handleInputChange}
                      placeholder="e.g., Rubber Conveyor"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4>Pricing & Inventory</h4>

                <div className="form-row">
                  <div className="form-group">
                    <label>Price (PHP) *</label>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Unit of Measurement</label>
                    <input
                      type="text"
                      name="unit_of_measurement"
                      value={formData.unit_of_measurement}
                      onChange={handleInputChange}
                      placeholder="e.g., piece, kg, meter"
                    />
                  </div>

                  <div className="form-group">
                    <label>Minimum Order Quantity</label>
                    <input
                      type="number"
                      name="minimum_order_quantity"
                      value={formData.minimum_order_quantity}
                      onChange={handleInputChange}
                      min="1"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Stock Quantity</label>
                  <input
                    type="number"
                    name="stock_quantity"
                    value={formData.stock_quantity}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>
              </div>

              <div className="form-section">
                <h4>Images</h4>

                <div className="form-group">
                  <label>Primary Image URL</label>
                  <input
                    type="url"
                    name="primary_image_url"
                    value={formData.primary_image_url}
                    onChange={handleInputChange}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div className="form-group">
                  <label>Additional Image URLs (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="URL1, URL2, URL3"
                    onBlur={(e) => {
                      const urls = e.target.value.split(',').map(u => u.trim()).filter(u => u)
                      setFormData(prev => ({ ...prev, image_urls: urls }))
                    }}
                  />
                </div>
              </div>

              <div className="form-section">
                <h4>Features</h4>
                <div className="features-input">
                  <input
                    type="text"
                    placeholder="Add a feature (e.g., High Efficiency)"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addFeature(e.target.value)
                        e.target.value = ''
                      }
                    }}
                  />
                </div>
                <div className="features-list">
                  {formData.features.map((feature, idx) => (
                    <span key={idx} className="feature-tag">
                      {feature}
                      <button
                        type="button"
                        onClick={() => removeFeature(idx)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-section">
                <h4>Shipping & Logistics</h4>

                <div className="form-group checkbox">
                  <label>
                    <input
                      type="checkbox"
                      name="shipping_available"
                      checked={formData.shipping_available}
                      onChange={handleInputChange}
                    />
                    Shipping Available
                  </label>
                </div>

                {formData.shipping_available && (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Delivery Time</label>
                        <input
                          type="text"
                          name="delivery_time"
                          value={formData.delivery_time}
                          onChange={handleInputChange}
                          placeholder="e.g., 5-7 days"
                        />
                      </div>

                      <div className="form-group">
                        <label>Delivery Cost (PHP)</label>
                        <input
                          type="number"
                          name="delivery_cost"
                          value={formData.delivery_cost}
                          onChange={handleInputChange}
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Return Policy</label>
                  <textarea
                    name="return_policy"
                    value={formData.return_policy}
                    onChange={handleInputChange}
                    placeholder="Describe your return policy..."
                    rows="3"
                  ></textarea>
                </div>

                <div className="form-group">
                  <label>Warranty Information</label>
                  <textarea
                    name="warranty_info"
                    value={formData.warranty_info}
                    onChange={handleInputChange}
                    placeholder="Describe warranty details..."
                    rows="3"
                  ></textarea>
                </div>

                <div className="form-group">
                  <label>Payment Terms</label>
                  <input
                    type="text"
                    name="payment_terms"
                    value={formData.payment_terms}
                    onChange={handleInputChange}
                    placeholder="e.g., 50% advance, 50% after delivery"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Update Product' : 'Create Product'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm() }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
