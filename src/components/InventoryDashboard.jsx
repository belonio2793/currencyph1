import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdvancedInventoryFeatures from './AdvancedInventoryFeatures'
import './InventoryDashboard.css'

const PRODUCT_CATEGORIES = [
  { value: 'machinery', label: 'Machinery & Equipment' },
  { value: 'agricultural', label: 'Agricultural Equipment' },
  { value: 'construction', label: 'Construction Equipment' },
  { value: 'industrial_tools', label: 'Industrial Tools' },
  { value: 'spare_parts', label: 'Spare Parts & Components' },
  { value: 'chemicals', label: 'Industrial Chemicals' },
  { value: 'textiles', label: 'Textiles & Fabrics' },
  { value: 'metals', label: 'Metals & Materials' },
  { value: 'electrical', label: 'Electrical Equipment' },
  { value: 'hydraulics', label: 'Hydraulics & Pneumatics' },
]

export default function InventoryDashboard({ userId, businessId, setActiveTab }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterVisibility, setFilterVisibility] = useState('all')
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'machinery',
    subcategory: '',
    price: '',
    currency: 'PHP',
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
    status: 'active',
    visibility: 'public',
    tags: [],
  })

  const [newTag, setNewTag] = useState('')
  const [formErrors, setFormErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadProducts()
  }, [userId, businessId])

  const loadProducts = async () => {
    try {
      setLoading(true)
      setError('')
      
      const { data, error: err } = await supabase
        .from('industrial_products')
        .select('*')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false })

      if (err) throw err
      setProducts(data || [])
    } catch (err) {
      console.error('Error loading products:', err)
      setError('Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const errors = {}
    if (!formData.name.trim()) errors.name = 'Product name is required'
    if (!formData.category) errors.category = 'Category is required'
    if (!formData.price || parseFloat(formData.price) <= 0) errors.price = 'Valid price is required'
    if (formData.stock_quantity < 0) errors.stock_quantity = 'Stock quantity cannot be negative'
    if (formData.minimum_order_quantity < 1) errors.minimum_order_quantity = 'MOQ must be at least 1'
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'machinery',
      subcategory: '',
      price: '',
      currency: 'PHP',
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
      status: 'active',
      visibility: 'public',
      tags: [],
    })
    setFormErrors({})
    setNewTag('')
  }

  const handleAddProduct = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      setSubmitting(true)
      const productData = {
        ...formData,
        seller_id: userId,
        business_id: businessId,
        price: parseFloat(formData.price),
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        minimum_order_quantity: parseInt(formData.minimum_order_quantity) || 1,
        delivery_cost: formData.delivery_cost ? parseFloat(formData.delivery_cost) : null,
      }

      const { data, error: err } = await supabase
        .from('industrial_products')
        .insert([productData])
        .select()

      if (err) throw err

      setProducts([data[0], ...products])
      resetForm()
      setShowAddForm(false)
      setError('')
    } catch (err) {
      console.error('Error adding product:', err)
      setError('Failed to add product: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateProduct = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      setSubmitting(true)
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        minimum_order_quantity: parseInt(formData.minimum_order_quantity) || 1,
        delivery_cost: formData.delivery_cost ? parseFloat(formData.delivery_cost) : null,
      }

      const { error: err } = await supabase
        .from('industrial_products')
        .update(productData)
        .eq('id', editingProduct.id)
        .eq('seller_id', userId)

      if (err) throw err

      setProducts(products.map(p => p.id === editingProduct.id ? { ...editingProduct, ...productData } : p))
      resetForm()
      setEditingProduct(null)
      setError('')
    } catch (err) {
      console.error('Error updating product:', err)
      setError('Failed to update product: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return

    try {
      const { error: err } = await supabase
        .from('industrial_products')
        .delete()
        .eq('id', productId)
        .eq('seller_id', userId)

      if (err) throw err
      setProducts(products.filter(p => p.id !== productId))
    } catch (err) {
      console.error('Error deleting product:', err)
      setError('Failed to delete product: ' + err.message)
    }
  }

  const handleEditClick = (product) => {
    setFormData({
      name: product.name || '',
      description: product.description || '',
      category: product.category || 'machinery',
      subcategory: product.subcategory || '',
      price: product.price.toString(),
      currency: product.currency || 'PHP',
      unit_of_measurement: product.unit_of_measurement || '',
      minimum_order_quantity: product.minimum_order_quantity || 1,
      stock_quantity: product.stock_quantity || 0,
      primary_image_url: product.primary_image_url || '',
      image_urls: product.image_urls || [],
      specifications: product.specifications || {},
      features: product.features || [],
      shipping_available: product.shipping_available !== false,
      delivery_time: product.delivery_time || '',
      delivery_cost: product.delivery_cost ? product.delivery_cost.toString() : '',
      return_policy: product.return_policy || '',
      warranty_info: product.warranty_info || '',
      payment_terms: product.payment_terms || '',
      status: product.status || 'active',
      visibility: product.visibility || 'public',
      tags: product.tags || [],
    })
    setEditingProduct(product)
    setShowAddForm(true)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }))
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const addFeature = (feature) => {
    if (feature.trim() && !formData.features.includes(feature.trim())) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, feature.trim()]
      }))
    }
  }

  const removeFeature = (featureToRemove) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter(f => f !== featureToRemove)
    }))
  }

  // Calculate inventory stats
  const stats = {
    totalProducts: products.length,
    activeProducts: products.filter(p => p.status === 'active').length,
    publicProducts: products.filter(p => p.visibility === 'public').length,
    totalValue: products.reduce((sum, p) => sum + (p.price * p.stock_quantity), 0),
    totalStock: products.reduce((sum, p) => sum + p.stock_quantity, 0),
    lowStockProducts: products.filter(p => p.stock_quantity <= 5).length,
  }

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus
    const matchesVisibility = filterVisibility === 'all' || p.visibility === filterVisibility
    return matchesSearch && matchesStatus && matchesVisibility
  })

  return (
    <div className="inventory-dashboard">
      {/* Header */}
      <div className="inventory-header">
        <div className="header-content">
          <h1>Your Inventory</h1>
          <p>Manage products, pricing, and stock levels</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setEditingProduct(null)
            setShowAddForm(!showAddForm)
          }}
          className="btn-primary-lg"
        >
          {showAddForm ? 'Cancel' : 'Add Product'}
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="inventory-stats">
        <div className="stat-card">
          <div className="stat-content">
            <p className="stat-label">Total Products</p>
            <p className="stat-value">{stats.totalProducts}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <p className="stat-label">Active Products</p>
            <p className="stat-value">{stats.activeProducts}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <p className="stat-label">Public Products</p>
            <p className="stat-value">{stats.publicProducts}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <p className="stat-label">Inventory Value</p>
            <p className="stat-value">₱{stats.totalValue.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <p className="stat-label">Total Stock</p>
            <p className="stat-value">{stats.totalStock}</p>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-content">
            <p className="stat-label">Low Stock Items</p>
            <p className="stat-value">{stats.lowStockProducts}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
          <button onClick={() => setError('')} className="alert-close">✕</button>
        </div>
      )}

      {/* Add/Edit Product Form */}
      {showAddForm && (
        <div className="add-product-form-container">
          <form onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct} className="product-form">
            <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
            
            <div className="form-section">
              <h3>Basic Information</h3>
              
              <div className="form-group">
                <label>Product Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Industrial Conveyor Belt"
                  className={formErrors.name ? 'input-error' : ''}
                />
                {formErrors.name && <span className="error-text">{formErrors.name}</span>}
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Detailed product description"
                  rows="4"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category *</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className={formErrors.category ? 'input-error' : ''}
                  >
                    {PRODUCT_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                  {formErrors.category && <span className="error-text">{formErrors.category}</span>}
                </div>

                <div className="form-group">
                  <label>Subcategory</label>
                  <input
                    type="text"
                    name="subcategory"
                    value={formData.subcategory}
                    onChange={handleInputChange}
                    placeholder="e.g., Heavy Duty, Commercial"
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Pricing & Stock</h3>
              
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
                    className={formErrors.price ? 'input-error' : ''}
                  />
                  {formErrors.price && <span className="error-text">{formErrors.price}</span>}
                </div>

                <div className="form-group">
                  <label>Unit of Measurement</label>
                  <input
                    type="text"
                    name="unit_of_measurement"
                    value={formData.unit_of_measurement}
                    onChange={handleInputChange}
                    placeholder="e.g., meter, piece, kg"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Stock Quantity</label>
                  <input
                    type="number"
                    name="stock_quantity"
                    value={formData.stock_quantity}
                    onChange={handleInputChange}
                    min="0"
                    className={formErrors.stock_quantity ? 'input-error' : ''}
                  />
                  {formErrors.stock_quantity && <span className="error-text">{formErrors.stock_quantity}</span>}
                </div>

                <div className="form-group">
                  <label>Minimum Order Quantity</label>
                  <input
                    type="number"
                    name="minimum_order_quantity"
                    value={formData.minimum_order_quantity}
                    onChange={handleInputChange}
                    min="1"
                    className={formErrors.minimum_order_quantity ? 'input-error' : ''}
                  />
                  {formErrors.minimum_order_quantity && <span className="error-text">{formErrors.minimum_order_quantity}</span>}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Shipping & Delivery</h3>
              
              <div className="form-group checkbox">
                <input
                  type="checkbox"
                  name="shipping_available"
                  checked={formData.shipping_available}
                  onChange={handleInputChange}
                  id="shipping-available"
                />
                <label htmlFor="shipping-available">Shipping Available</label>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Delivery Time</label>
                  <input
                    type="text"
                    name="delivery_time"
                    value={formData.delivery_time}
                    onChange={handleInputChange}
                    placeholder="e.g., 3-5 business days"
                  />
                </div>

                <div className="form-group">
                  <label>Delivery Cost (PHP)</label>
                  <input
                    type="number"
                    name="delivery_cost"
                    value={formData.delivery_cost}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Return Policy</label>
                <textarea
                  name="return_policy"
                  value={formData.return_policy}
                  onChange={handleInputChange}
                  placeholder="Describe your return policy"
                  rows="2"
                />
              </div>
            </div>

            <div className="form-section">
              <h3>Additional Information</h3>
              
              <div className="form-group">
                <label>Warranty Info</label>
                <textarea
                  name="warranty_info"
                  value={formData.warranty_info}
                  onChange={handleInputChange}
                  placeholder="Describe warranty coverage"
                  rows="2"
                />
              </div>

              <div className="form-group">
                <label>Payment Terms</label>
                <input
                  type="text"
                  name="payment_terms"
                  value={formData.payment_terms}
                  onChange={handleInputChange}
                  placeholder="e.g., 30% deposit, balance on delivery"
                />
              </div>

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
                <label>Add Tags</label>
                <div className="tag-input-group">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Type and press Enter to add"
                  />
                  <button type="button" onClick={addTag} className="btn-small">Add</button>
                </div>
                <div className="tags-list">
                  {formData.tags.map(tag => (
                    <span key={tag} className="tag">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="tag-remove">✕</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Status & Visibility</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Visibility</label>
                  <select
                    name="visibility"
                    value={formData.visibility}
                    onChange={handleInputChange}
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="wholesale_only">Wholesale Only</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Add Product'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setEditingProduct(null)
                  resetForm()
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Products List */}
      {/* Advanced Features */}
      {!showAddForm && products.length > 0 && (
        <AdvancedInventoryFeatures products={products} userId={userId} />
      )}

      {!showAddForm && (
        <>
          <div className="products-controls">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="filter-controls">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="discontinued">Discontinued</option>
              </select>

              <select
                value={filterVisibility}
                onChange={(e) => setFilterVisibility(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Visibility</option>
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="wholesale_only">Wholesale Only</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <p>Loading inventory...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state">
              <p>No products found</p>
              {searchQuery || filterStatus !== 'all' || filterVisibility !== 'all' ? (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setFilterStatus('all')
                    setFilterVisibility('all')
                  }}
                  className="btn-secondary"
                >
                  Clear Filters
                </button>
              ) : (
                <p>Start by adding your first product to your inventory.</p>
              )}
            </div>
          ) : (
            <div className="products-list">
              <div className="products-table-header">
                <div className="col-image">Image</div>
                <div className="col-info">Product Info</div>
                <div className="col-pricing">Pricing</div>
                <div className="col-stock">Stock</div>
                <div className="col-status">Status</div>
                <div className="col-actions">Actions</div>
              </div>

              {filteredProducts.map(product => (
                <div key={product.id} className="product-row">
                  <div className="col-image">
                    <img
                      src={product.primary_image_url || 'https://via.placeholder.com/60x60?text=No+Image'}
                      alt={product.name}
                      className="product-thumbnail"
                    />
                  </div>

                  <div className="col-info">
                    <div className="product-name">{product.name}</div>
                    <div className="product-category">{product.category}</div>
                    {product.description && (
                      <div className="product-desc">{product.description.substring(0, 60)}...</div>
                    )}
                  </div>

                  <div className="col-pricing">
                    <div className="price">₱{product.price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    {product.unit_of_measurement && (
                      <div className="unit">per {product.unit_of_measurement}</div>
                    )}
                  </div>

                  <div className="col-stock">
                    <div className={`stock-badge ${product.stock_quantity <= 5 ? 'low' : 'normal'}`}>
                      {product.stock_quantity} units
                    </div>
                    {product.minimum_order_quantity > 1 && (
                      <div className="moq">MOQ: {product.minimum_order_quantity}</div>
                    )}
                  </div>

                  <div className="col-status">
                    <div className={`status-badge ${product.status}`}>{product.status}</div>
                    <div className={`visibility-badge ${product.visibility}`}>{product.visibility}</div>
                  </div>

                  <div className="col-actions">
                    <button
                      onClick={() => handleEditClick(product)}
                      className="btn-edit"
                      title="Edit product"
                    >
                      ✎ Edit
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="btn-delete"
                      title="Delete product"
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
