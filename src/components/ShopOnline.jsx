import { useState, useEffect } from 'react'
import { getProducts, getCategories } from '../lib/shopProductService'
import './ShopOnline.css'

export default function ShopOnline({ onProductSelect = null }) {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [originCountries, setOriginCountries] = useState([])
  const [warranties, setWarranties] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [selectedOriginCountry, setSelectedOriginCountry] = useState('')
  const [selectedWarranty, setSelectedWarranty] = useState('')
  const [priceMin, setPriceMin] = useState(0)
  const [priceMax, setPriceMax] = useState(100000)
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  
  const pageSize = 12

  // Load categories and filter options on mount
  useEffect(() => {
    loadCategories()
    loadFilterOptions()
  }, [])

  // Load products when filters change
  useEffect(() => {
    loadProducts()
  }, [selectedCategory, selectedBrand, selectedSupplier, selectedOriginCountry, selectedWarranty, priceMin, priceMax, sortBy, page])

  const loadCategories = async () => {
    try {
      const cats = await getCategories()
      setCategories(cats)
    } catch (err) {
      console.error('Error loading categories:', err)
      setError('Failed to load categories')
    }
  }

  const loadProducts = async () => {
    try {
      setLoading(true)
      setError('')

      const filters = {
        category_id: selectedCategory || undefined,
        min_price: priceMin,
        max_price: priceMax
      }

      const result = await getProducts(filters, page, pageSize)
      
      let productsToSort = [...result.products]
      
      // Apply sorting
      productsToSort = productsToSort.sort((a, b) => {
        switch (sortBy) {
          case 'price_low':
            return (a.final_price || a.base_price) - (b.final_price || b.base_price)
          case 'price_high':
            return (b.final_price || b.base_price) - (a.final_price || a.base_price)
          case 'rating':
            return (b.rating || 0) - (a.rating || 0)
          case 'bestseller':
            return (b.sales_count || 0) - (a.sales_count || 0)
          case 'newest':
          default:
            return new Date(b.created_at) - new Date(a.created_at)
        }
      })

      setProducts(productsToSort)
    } catch (err) {
      console.error('Error loading products:', err)
      setError('Failed to load products')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    // Apply search filter by filtering products locally
    loadProducts()
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedCategory('')
    setPriceMin(0)
    setPriceMax(100000)
    setSortBy('newest')
    setPage(1)
  }

  // Filter products based on search query
  const filteredProducts = products.filter(product => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      product.name?.toLowerCase().includes(query) ||
      product.brand?.toLowerCase().includes(query) ||
      product.sku?.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query)
    )
  })

  const getPrimaryImage = (product) => {
    if (!product.shop_product_images || product.shop_product_images.length === 0) {
      return 'https://via.placeholder.com/300x300?text=No+Image'
    }
    const primaryImage = product.shop_product_images.find(img => img.is_primary)
    return primaryImage?.image_url || product.shop_product_images[0]?.image_url
  }

  const getPrice = (product) => {
    return product.final_price || product.selling_price || product.base_price || 0
  }

  const getOriginalPrice = (product) => {
    if (product.discount_percentage > 0 || product.discount_amount > 0) {
      return product.base_price || 0
    }
    return null
  }

  return (
    <div className="shop-container">
      <div className="shop-header-section">
        <h1>Shop Online</h1>
        <p>Browse our extensive collection of quality products</p>
      </div>

      <div className="shop-wrapper">
        {/* Sidebar */}
        <aside className="shop-sidebar">
          <div className="sidebar-section filters-header">
            <h3>Filters</h3>
            <button className="btn-reset" onClick={handleResetFilters}>
              Reset All
            </button>
          </div>

          {/* Search */}
          <div className="filter-block">
            <h4>Search</h4>
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="btn-search">Search</button>
            </form>
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div className="filter-block">
              <h4>Categories</h4>
              <div className="category-list">
                <label className="category-item">
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
                  <span>All Categories</span>
                </label>
                {categories.map(cat => (
                  <label key={cat.id} className="category-item">
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
                    <span>{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Price Range */}
          <div className="filter-block">
            <h4>Price Range</h4>
            <div className="price-inputs">
              <div className="price-input-group">
                <label>Min: ₱</label>
                <input
                  type="number"
                  value={priceMin}
                  onChange={(e) => setPriceMin(Math.max(0, parseInt(e.target.value) || 0))}
                  min="0"
                  className="price-field"
                />
              </div>
              <div className="price-input-group">
                <label>Max: ₱</label>
                <input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(Math.max(priceMin, parseInt(e.target.value) || 100000))}
                  min={priceMin}
                  className="price-field"
                />
              </div>
            </div>
          </div>

          {/* Sort By */}
          <div className="filter-block">
            <h4>Sort By</h4>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-dropdown"
            >
              <option value="newest">Newest</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
              <option value="rating">Top Rated</option>
              <option value="bestseller">Best Sellers</option>
            </select>
          </div>
        </aside>

        {/* Main Content */}
        <main className="shop-main">
          {/* View Controls */}
          <div className="view-controls">
            <div className="view-buttons">
              <button
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                ⊞ Grid
              </button>
              <button
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                ≡ List
              </button>
            </div>
            <div className="results-count">
              {filteredProducts.length} products found
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="alert alert-error">
              <p>{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="empty-state">
              <p>Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state">
              <p>No products found matching your criteria.</p>
              <button onClick={handleResetFilters} className="btn-secondary">
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              {/* Products Container */}
              <div className={`products-container products-${viewMode}`}>
                {filteredProducts.map(product => (
                  <div key={product.id} className="product-item">
                    <div className="product-link" onClick={() => onProductSelect && onProductSelect(product.id)}>
                      <div className="product-image-wrapper">
                        <img
                          src={getPrimaryImage(product)}
                          alt={product.name}
                          className="product-image"
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/300x300?text=Product'
                          }}
                        />
                        {product.is_featured && <span className="badge badge-featured">Featured</span>}
                        {product.is_bestseller && <span className="badge badge-bestseller">Bestseller</span>}
                        {(product.discount_percentage > 0 || product.discount_amount > 0) && (
                          <span className="badge badge-discount">
                            {product.discount_percentage > 0 ? `-${product.discount_percentage}%` : 'Sale'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="product-details">
                      <h3>
                        <span
                          className="product-name-link"
                          onClick={() => onProductSelect && onProductSelect(product.id)}
                        >
                          {product.name}
                        </span>
                      </h3>

                      {product.brand && <p className="product-brand">{product.brand}</p>}

                      {product.rating > 0 && (
                        <div className="product-rating">
                          <span className="stars">{'★'.repeat(Math.round(product.rating))}{'☆'.repeat(5 - Math.round(product.rating))}</span>
                          <span className="review-count">({product.review_count})</span>
                        </div>
                      )}

                      {viewMode === 'list' && product.description && (
                        <p className="product-desc">{product.description.substring(0, 100)}...</p>
                      )}

                      <div className="product-price-section">
                        {getOriginalPrice(product) ? (
                          <>
                            <span className="price-original">₱{getOriginalPrice(product).toLocaleString()}</span>
                            <span className="price-current">₱{getPrice(product).toLocaleString()}</span>
                          </>
                        ) : (
                          <span className="price-current">₱{getPrice(product).toLocaleString()}</span>
                        )}
                      </div>

                      <button
                        onClick={() => onProductSelect && onProductSelect(product.id)}
                        className="btn-primary btn-view"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
