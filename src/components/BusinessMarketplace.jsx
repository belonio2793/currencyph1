import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import './BusinessMarketplace.css'

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

export default function BusinessMarketplace({ userId, setActiveTab, setCurrentProductId }) {
  const [products, setProducts] = useState([])
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

  // Load products
  useEffect(() => {
    loadProducts()
    if (userId) {
      loadFavorites()
    }
  }, [currentPage, searchQuery, selectedCategory, sortBy, priceRange])

  const loadProducts = async () => {
    try {
      setLoading(true)
      setError('')

      let query = supabase
        .from('industrial_products')
        .select('id, name, slug, price, currency, category, primary_image_url, rating, review_count, stock_status, seller_id, business_id, created_at', { count: 'exact' })
        .eq('status', 'active')
        .eq('visibility', 'public')

      // Apply price filter
      query = query.gte('price', priceRange.min).lte('price', priceRange.max)

      // Apply category filter
      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory)
      }

      // Apply search filter
      if (searchQuery.trim()) {
        query = query.ilike('name', `%${searchQuery}%`)
      }

      // Apply sorting
      if (sortBy === 'price_low') {
        query = query.order('price', { ascending: true })
      } else if (sortBy === 'price_high') {
        query = query.order('price', { ascending: false })
      } else if (sortBy === 'rating') {
        query = query.order('rating', { ascending: false })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      // Pagination
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

      setProducts(productsWithSellers)
      setTotalCount(count || 0)
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

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  return (
    <div className="business-marketplace">
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
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" className={showFilters ? 'rotated' : ''}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
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
          ) : products.length === 0 ? (
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
                <p>Showing {products.length} of {totalCount} products</p>
              </div>

              <div className="products-grid">
                {products.map(product => (
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
                        <Heart size={20} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} />
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
                          <span className="price">₱{product.price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
  )
}
