import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getProducts, getCategories, searchProducts } from '../lib/shopProductService'
import './ShopOnline.css'

export default function ShopOnline() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100000 })
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [viewMode, setViewMode] = useState('grid')
  const pageSize = 12

  useEffect(() => {
    loadCategories()
    loadProducts()
  }, [])

  useEffect(() => {
    loadProducts()
  }, [selectedCategory, priceRange, sortBy, page])

  const loadCategories = async () => {
    try {
      const cats = await getCategories()
      setCategories(cats)
    } catch (err) {
      console.error('Error loading categories:', err)
    }
  }

  const loadProducts = async () => {
    try {
      setLoading(true)
      setError('')

      let productsData

      if (searchQuery.trim()) {
        const searchResults = await searchProducts(searchQuery, 100)
        productsData = {
          products: searchResults,
          total: searchResults.length,
          page: 1,
          pageSize,
          totalPages: Math.ceil(searchResults.length / pageSize)
        }
      } else {
        const filters = {
          category_id: selectedCategory || undefined,
          min_price: priceRange.min,
          max_price: priceRange.max
        }

        productsData = await getProducts(filters, page, pageSize)
      }

      setProducts(productsData.products)
      setTotalPages(productsData.totalPages)
      setPage(1)
    } catch (err) {
      console.error('Error loading products:', err)
      setError('Failed to load products. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    loadProducts()
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedCategory('')
    setPriceRange({ min: 0, max: 100000 })
    setSortBy('newest')
    setPage(1)
  }

  const filteredAndSortedProducts = [...products].sort((a, b) => {
    switch (sortBy) {
      case 'price_low_high':
        return a.final_price - b.final_price
      case 'price_high_low':
        return b.final_price - a.final_price
      case 'rating':
        return b.rating - a.rating
      case 'bestseller':
        return b.sales_count - a.sales_count
      case 'newest':
      default:
        return new Date(b.created_at) - new Date(a.created_at)
    }
  })

  const getPrimaryImage = (product) => {
    if (!product.shop_product_images || product.shop_product_images.length === 0) {
      return 'https://via.placeholder.com/300x300?text=No+Image'
    }
    const primaryImage = product.shop_product_images.find(img => img.is_primary)
    return primaryImage?.image_url || product.shop_product_images[0]?.image_url || 'https://via.placeholder.com/300x300?text=No+Image'
  }

  return (
    <div className="shop-online-container">
      <div className="shop-header">
        <h1>Shop Online</h1>
        <p>Browse our extensive collection of quality products</p>
      </div>

      <div className="shop-content">
        {/* Sidebar Filters */}
        <aside className="shop-sidebar">
          <div className="filter-section">
            <h3>Filters</h3>
            <button className="reset-filters-btn" onClick={handleResetFilters}>
              Reset All Filters
            </button>
          </div>

          {/* Search */}
          <div className="filter-group">
            <h4>Search Products</h4>
            <form onSubmit={handleSearch}>
              <input
                type="text"
                placeholder="Search by name, brand..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="search-btn">Search</button>
            </form>
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div className="filter-group">
              <h4>Categories</h4>
              <div className="category-filter">
                <label>
                  <input
                    type="radio"
                    name="category"
                    value=""
                    checked={selectedCategory === ''}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value)
                      setPage(1)
                    }}
                  />
                  All Categories
                </label>

                {categories.map(cat => (
                  <label key={cat.id}>
                    <input
                      type="radio"
                      name="category"
                      value={cat.id}
                      checked={selectedCategory === cat.id}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value)
                        setPage(1)
                      }}
                    />
                    {cat.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Price Range */}
          <div className="filter-group">
            <h4>Price Range</h4>
            <div className="price-filter">
              <div className="price-input">
                <label>Min: ₱</label>
                <input
                  type="number"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange({ ...priceRange, min: parseInt(e.target.value) || 0 })}
                  className="price-input-field"
                />
              </div>
              <div className="price-input">
                <label>Max: ₱</label>
                <input
                  type="number"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange({ ...priceRange, max: parseInt(e.target.value) || 100000 })}
                  className="price-input-field"
                />
              </div>
            </div>
          </div>

          {/* Sort By */}
          <div className="filter-group">
            <h4>Sort By</h4>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
              <option value="newest">Newest</option>
              <option value="price_low_high">Price: Low to High</option>
              <option value="price_high_low">Price: High to Low</option>
              <option value="rating">Top Rated</option>
              <option value="bestseller">Best Sellers</option>
            </select>
          </div>
        </aside>

        {/* Main Content */}
        <main className="shop-main">
          {/* View Mode Toggle */}
          <div className="view-controls">
            <button
              className={`view-toggle ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              ⊞ Grid
            </button>
            <button
              className={`view-toggle ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              ≡ List
            </button>
          </div>

          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="loading-state">
              <p>Loading products...</p>
            </div>
          ) : filteredAndSortedProducts.length === 0 ? (
            <div className="empty-state">
              <p>No products found matching your criteria.</p>
              <button onClick={handleResetFilters} className="reset-btn">
                Clear Filters and Try Again
              </button>
            </div>
          ) : (
            <>
              {/* Products Display */}
              <div className={`products-${viewMode}`}>
                {filteredAndSortedProducts.map(product => (
                  <div key={product.id} className={`product-card ${viewMode}`}>
                    <Link to={`/shop/product/${product.id}`} className="product-image-link">
                      <div className="product-image-container">
                        <img
                          src={getPrimaryImage(product)}
                          alt={product.name}
                          className="product-image"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/300x300?text=Product+Image'
                          }}
                        />
                        {product.is_featured && <span className="badge-featured">Featured</span>}
                        {product.is_bestseller && <span className="badge-bestseller">Bestseller</span>}
                        {product.discount_percentage > 0 && (
                          <span className="badge-discount">-{product.discount_percentage}%</span>
                        )}
                      </div>
                    </Link>

                    <div className="product-info">
                      <h3>
                        <Link to={`/shop/product/${product.id}`}>{product.name}</Link>
                      </h3>

                      {product.brand && <p className="brand-name">{product.brand}</p>}

                      <div className="product-rating">
                        {product.rating > 0 ? (
                          <>
                            <span className="stars">{'★'.repeat(Math.round(product.rating))}{'☆'.repeat(5 - Math.round(product.rating))}</span>
                            <span className="rating-count">({product.review_count})</span>
                          </>
                        ) : (
                          <span className="no-reviews">No reviews yet</span>
                        )}
                      </div>

                      {viewMode === 'list' && product.description && (
                        <p className="product-description">{product.description.substring(0, 100)}...</p>
                      )}

                      <div className="product-price">
                        {product.discount_percentage > 0 ? (
                          <>
                            <span className="original-price">₱{product.base_price.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
                            <span className="sale-price">₱{product.final_price.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
                          </>
                        ) : (
                          <span className="price">₱{product.final_price.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
                        )}
                      </div>

                      <div className="product-actions">
                        <Link to={`/shop/product/${product.id}`} className="btn-view-details">
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="pagination-btn"
                  >
                    ← Previous
                  </button>

                  <div className="page-numbers">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`page-number ${page === p ? 'active' : ''}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="pagination-btn"
                  >
                    Next →
                  </button>
                </div>
              )}

              <div className="results-info">
                <p>Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, products.length)} of {products.length} products</p>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
