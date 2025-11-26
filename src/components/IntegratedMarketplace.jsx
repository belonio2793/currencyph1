import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { currencyAPI } from '../lib/currencyAPI'
import AdvancedInventoryFeatures from './AdvancedInventoryFeatures'
import './IntegratedMarketplace.css'

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

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'best_seller', label: 'Best Sellers' },
]

export default function IntegratedMarketplace({ userId, setActiveTab, setCurrentProductId, businessId }) {
  const [activeView, setActiveView] = useState('marketplace') // 'marketplace' or 'inventory'
  
  // Marketplace state
  const [allProducts, setAllProducts] = useState([])
  const [marketplaceProducts, setMarketplaceProducts] = useState([])
  const [userProducts, setUserProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100000 })
  const [showFilters, setShowFilters] = useState(false)
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const ITEMS_PER_PAGE = 12
  
  // Favorites
  const [favorites, setFavorites] = useState([])
  
  // Inventory management
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
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
  const [exchangeRate, setExchangeRate] = useState(null)
  const [usdPrice, setUsdPrice] = useState('')

  // Load all products and user's products
  useEffect(() => {
    loadProducts()
    if (userId) {
      loadFavorites()
    }
    fetchExchangeRate()
  }, [currentPage, searchQuery, selectedCategory, sortBy, priceRange, userId])

  const loadProducts = async () => {
    try {
      setLoading(true)
      setError('')

      // Load all public products for marketplace
      let query = supabase
        .from('industrial_products')
        .select('id, name, slug, price, currency, category, primary_image_url, rating, review_count, stock_status, seller_id, business_id, created_at, status, visibility', { count: 'exact' })
        .eq('status', 'active')
        .eq('visibility', 'public')

      query = query.gte('price', priceRange.min).lte('price', priceRange.max)

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory)
      }

      if (searchQuery.trim()) {
        query = query.ilike('name', `%${searchQuery}%`)
      }

      if (sortBy === 'price_low') {
        query = query.order('price', { ascending: true })
      } else if (sortBy === 'price_high') {
        query = query.order('price', { ascending: false })
      } else if (sortBy === 'rating') {
        query = query.order('rating', { ascending: false })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      const { data, count, error: err } = await query.range(
        currentPage * ITEMS_PER_PAGE,
        (currentPage + 1) * ITEMS_PER_PAGE - 1
      )

      if (err) throw err

      // Fetch seller info for each product
      const productsWithSellers = await Promise.all(
        (data || []).map(async (product) => {
          const { data: seller } = await supabase
            .from('businesses')
            .select('business_name, rating')
            .eq('id', product.business_id)
            .single()

          return {
            ...product,
            seller_name: seller?.business_name || 'Unknown Seller',
            seller_rating: seller?.rating
          }
        })
      )

      setMarketplaceProducts(productsWithSellers)
      setAllProducts(productsWithSellers)
      setTotalCount(count || 0)

      // Load user's products if logged in
      if (userId) {
        const { data: userProds, error: userErr } = await supabase
          .from('industrial_products')
          .select('*')
          .eq('seller_id', userId)
          .order('created_at', { ascending: false })

        if (userErr) throw userErr
        setUserProducts(userProds || [])
      }
    } catch (err) {
      console.error('Error loading products:', err)
      setError('Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const loadFavorites = async () => {
    try {
      const { data } = await supabase
        .from('industrial_product_favorites')
        .select('product_id')
        .eq('user_id', userId)

      setFavorites(data?.map(f => f.product_id) || [])
    } catch (err) {
      console.error('Error loading favorites:', err)
    }
  }

  const fetchExchangeRate = async () => {
    try {
      const result = await currencyAPI.convert(1, 'PHP', 'USD')
      if (result) {
        setExchangeRate(result.convertedAmount)
      }
    } catch (err) {
      console.error('Error fetching exchange rate:', err)
      setExchangeRate(null)
    }
  }

  const calculateUsdPrice = (phpPrice) => {
    if (!phpPrice || !exchangeRate) return ''
    const usd = (parseFloat(phpPrice) * exchangeRate).toFixed(2)
    return usd
  }

  const toggleFavorite = async (productId) => {
    if (!userId) {
      setActiveTab('profile')
      return
    }

    try {
      const isFavorited = favorites.includes(productId)

      if (isFavorited) {
        await supabase
          .from('industrial_product_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('product_id', productId)

        setFavorites(favorites.filter(id => id !== productId))
      } else {
        await supabase
          .from('industrial_product_favorites')
          .insert([{ user_id: userId, product_id: productId }])

        setFavorites([...favorites, productId])
      }
    } catch (err) {
      console.error('Error toggling favorite:', err)
    }
  }

  // Inventory Management Functions
  const validateForm = () => {
    const errors = {}
    if (!formData.name.trim()) errors.name = 'Product name is required'
    if (!formData.category) errors.category = 'Category is required'
    if (!formData.price || parseFloat(formData.price) <= 0) errors.price = 'Valid price is required'
    if (formData.stock_quantity < 0) errors.stock_quantity = 'Stock quantity cannot be negative'
    
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
    setUsdPrice('')
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

      setUserProducts([data[0], ...userProducts])
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

      setUserProducts(userProducts.map(p => p.id === editingProduct.id ? { ...editingProduct, ...productData } : p))
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
      setUserProducts(userProducts.filter(p => p.id !== productId))
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
    setUsdPrice(calculateUsdPrice(product.price.toString()))
    setEditingProduct(product)
    setShowAddForm(true)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    if (name === 'price' && value) {
      setUsdPrice(calculateUsdPrice(value))
    }
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

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  // Seller statistics
  const sellerStats = {
    totalProducts: userProducts.length,
    activeProducts: userProducts.filter(p => p.status === 'active').length,
    publicProducts: userProducts.filter(p => p.visibility === 'public').length,
    totalValue: userProducts.reduce((sum, p) => sum + (p.price * p.stock_quantity), 0),
    totalStock: userProducts.reduce((sum, p) => sum + p.stock_quantity, 0),
  }

  return (
    <div className="integrated-marketplace">
      {/* View Toggle */}
      <div className="view-toggle-section">
        <div className="view-toggle">
          <button
            onClick={() => {
              setActiveView('marketplace')
              setCurrentPage(0)
            }}
            className={`toggle-button ${activeView === 'marketplace' ? 'active' : ''}`}
          >
            Browse Marketplace
          </button>
          {userId && (
            <button
              onClick={() => setActiveView('inventory')}
              className={`toggle-button ${activeView === 'inventory' ? 'active' : ''}`}
            >
              My Inventory
            </button>
          )}
        </div>
      </div>

      {/* MARKETPLACE VIEW */}
      {activeView === 'marketplace' && (
        <div className="marketplace-view">
          {/* Header */}
          <div className="marketplace-header">
            <div className="marketplace-title">
              <h1>Business Marketplace</h1>
              <p>Industrial Products, Machinery & Equipment</p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="marketplace-controls">
            <div className="search-container">
              <svg className="search-icon" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search products, machinery, equipment..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(0)
                }}
                className="search-input"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="filter-toggle-btn"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
            </button>
          </div>

          <div className="marketplace-container">
            {/* Sidebar Filters */}
            <aside className={`filters-sidebar ${showFilters ? 'visible' : ''}`}>
              <div className="filter-section">
                <h3 className="filter-title">Category</h3>
                <div className="filter-options">
                  <label className="filter-option">
                    <input
                      type="radio"
                      name="category"
                      value="all"
                      checked={selectedCategory === 'all'}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value)
                        setCurrentPage(0)
                      }}
                    />
                    <span>All Categories</span>
                  </label>
                  {PRODUCT_CATEGORIES.map(cat => (
                    <label key={cat.value} className="filter-option">
                      <input
                        type="radio"
                        name="category"
                        value={cat.value}
                        checked={selectedCategory === cat.value}
                        onChange={(e) => {
                          setSelectedCategory(e.target.value)
                          setCurrentPage(0)
                        }}
                      />
                      <span>{cat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="filter-section">
                <h3 className="filter-title">Price Range (PHP)</h3>
                <div className="price-filter">
                  <input
                    type="number"
                    placeholder="Min"
                    value={priceRange.min}
                    onChange={(e) => {
                      setPriceRange({ ...priceRange, min: parseInt(e.target.value) || 0 })
                      setCurrentPage(0)
                    }}
                    className="price-input"
                  />
                  <span>to</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={priceRange.max}
                    onChange={(e) => {
                      setPriceRange({ ...priceRange, max: parseInt(e.target.value) || 100000 })
                      setCurrentPage(0)
                    }}
                    className="price-input"
                  />
                </div>
                {exchangeRate && (priceRange.min > 0 || priceRange.max > 0) && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#667eea' }}>
                    {priceRange.min > 0 && `≈ $${(priceRange.min * exchangeRate).toFixed(2)}`}
                    {priceRange.min > 0 && priceRange.max > 0 && ' - '}
                    {priceRange.max > 0 && `$${(priceRange.max * exchangeRate).toFixed(2)} USD`}
                  </div>
                )}
              </div>

              <div className="filter-section">
                <h3 className="filter-title">Sort By</h3>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value)
                    setCurrentPage(0)
                  }}
                  className="sort-select"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </aside>

            {/* Products Grid */}
            <main className="products-main">
              {loading ? (
                <div className="loading-state">
                  <p>Loading products...</p>
                </div>
              ) : error ? (
                <div className="error-state">
                  <p>{error}</p>
                  <button onClick={loadProducts} className="retry-btn">
                    Try Again
                  </button>
                </div>
              ) : marketplaceProducts.length === 0 ? (
                <div className="empty-state">
                  <p>No products found matching your criteria</p>
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedCategory('all')
                      setPriceRange({ min: 0, max: 100000 })
                      setSortBy('newest')
                      setCurrentPage(0)
                    }}
                    className="reset-btn"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="results-info">
                    <p>Showing {marketplaceProducts.length} of {totalCount} products</p>
                  </div>

                  <div className="products-grid">
                    {marketplaceProducts.map(product => (
                      <div key={product.id} className="product-card">
                        <div className="product-image-container">
                          <img
                            src={product.primary_image_url || 'https://via.placeholder.com/300x200?text=Industrial+Product'}
                            alt={product.name}
                            className="product-image"
                          />
                          <button
                            onClick={() => toggleFavorite(product.id)}
                            className={`favorite-btn ${favorites.includes(product.id) ? 'favorited' : ''}`}
                            title={favorites.includes(product.id) ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <svg width="20" height="20" fill={favorites.includes(product.id) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                          </button>
                          {product.stock_status !== 'in_stock' && (
                            <div className="stock-badge out-of-stock">Out of Stock</div>
                          )}
                        </div>

                        <div className="product-content">
                          <h3 className="product-name">{product.name}</h3>
                          
                          <p className="product-seller">{product.seller_name}</p>

                          <div className="product-rating">
                            {product.rating ? (
                              <>
                                <span className="stars">★★★★★</span>
                                <span className="rating-value">{product.rating.toFixed(1)}</span>
                                <span className="review-count">({product.review_count} reviews)</span>
                              </>
                            ) : (
                              <span className="no-rating">No ratings yet</span>
                            )}
                          </div>

                          <div className="product-footer">
                            <div className="price-section">
                              <div>
                                <span className="price">₱{product.price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                              {exchangeRate && (
                                <div style={{ fontSize: '12px', color: '#667eea', marginTop: '4px' }}>
                                  ≈ ${(product.price * exchangeRate).toFixed(2)} USD
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setCurrentProductId(product.id)
                                setActiveTab('product-detail')
                              }}
                              className="view-btn"
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="pagination">
                      <button
                        onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                        disabled={currentPage === 0}
                        className="pagination-btn"
                      >
                        Previous
                      </button>

                      <div className="pagination-info">
                        Page {currentPage + 1} of {totalPages}
                      </div>

                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                        disabled={currentPage === totalPages - 1}
                        className="pagination-btn"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      )}

      {/* INVENTORY VIEW */}
      {activeView === 'inventory' && userId && (
        <div className="inventory-view">
          {/* Header */}
          <div className="inventory-header">
            <div className="header-content">
              <h1>Your Inventory</h1>
              <p>Manage products, pricing, and stock levels - synced with marketplace</p>
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
                <p className="stat-value">{sellerStats.totalProducts}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <p className="stat-label">Active Products</p>
                <p className="stat-value">{sellerStats.activeProducts}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <p className="stat-label">Public Products</p>
                <p className="stat-value">{sellerStats.publicProducts}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <p className="stat-label">Inventory Value</p>
                <p className="stat-value">₱{sellerStats.totalValue.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <p className="stat-label">Total Stock</p>
                <p className="stat-value">{sellerStats.totalStock}</p>
              </div>
            </div>
            <div className="stat-card warning">
              <div className="stat-content">
                <p className="stat-label">Low Stock Items</p>
                <p className="stat-value">{userProducts.filter(p => p.stock_quantity <= 5).length}</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
              <button onClick={() => setError('')} className="alert-close">×</button>
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
                      {exchangeRate && usdPrice && (
                        <div className="currency-conversion" style={{ marginTop: '8px', fontSize: '13px', color: '#667eea' }}>
                          ≈ ${usdPrice} USD
                        </div>
                      )}
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
                      />
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
          {!showAddForm && (
            <>
              {userProducts.length === 0 ? (
                <div className="empty-state">
                  <p>You haven't added any products yet</p>
                  <p>Click "+ Add Product" to get started!</p>
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

                  {userProducts.map(product => (
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
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="btn-delete"
                          title="Delete product"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Advanced Features */}
              {userProducts.length > 0 && (
                <AdvancedInventoryFeatures products={userProducts} userId={userId} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
