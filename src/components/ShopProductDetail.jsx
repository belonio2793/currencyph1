import { useState, useEffect } from 'react'
import { getProductById, getProductReviews } from '../lib/shopProductService'
import { useShoppingCart } from '../context/ShoppingCartContext'
import './ShopProductDetail.css'

export default function ShopProductDetail({ productId, onNavigate }) {
  const { addItemToCart, cart } = useShoppingCart()
  
  const [product, setProduct] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [addingToCart, setAddingToCart] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    loadProduct()
    loadReviews()
  }, [productId])

  const loadProduct = async () => {
    try {
      setLoading(true)
      setError('')
      const prod = await getProductById(productId)
      setProduct(prod)
      if (prod?.shop_product_images?.length > 0) {
        setSelectedImage(0)
      }
    } catch (err) {
      console.error('Error loading product:', err)
      setError('Failed to load product details. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadReviews = async () => {
    try {
      const reviewsData = await getProductReviews(productId, 1, 5)
      setReviews(reviewsData.reviews || [])
    } catch (err) {
      console.error('Error loading reviews:', err)
    }
  }

  const handleAddToCart = async () => {
    if (!product) return

    try {
      setAddingToCart(true)
      const success = await addItemToCart(productId, quantity, selectedVariant?.id)
      
      if (success) {
        setSuccessMessage('Product added to cart!')
        setTimeout(() => setSuccessMessage(''), 3000)
        setQuantity(1)
      }
    } catch (err) {
      console.error('Error adding to cart:', err)
    } finally {
      setAddingToCart(false)
    }
  }

  const handleBuyNow = async () => {
    await handleAddToCart()
    if (onNavigate) {
      onNavigate('shop-cart')
    }
  }

  if (loading) {
    return <div className="product-detail-loading">Loading product details...</div>
  }

  if (error || !product) {
    return (
      <div className="product-detail-error">
        <p>{error || 'Product not found'}</p>
        <button onClick={() => onNavigate?.('shop')} className="btn-back-to-shop">Back to Shop</button>
      </div>
    )
  }

  const images = product.shop_product_images || []
  const variants = product.shop_product_variants || []
  const inCart = cart.items.filter(item => item.product_id === productId).length

  return (
    <div className="product-detail-container">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <button onClick={() => onNavigate?.('shop')} className="breadcrumb-link">Shop</button>
        {product.shop_categories && <span>/ {product.shop_categories?.name || 'Product'}</span>}
        <span>/ {product.name}</span>
      </div>

      <div className="product-detail-content">
        {/* Image Gallery */}
        <div className="image-gallery">
          <div className="main-image">
            <img
              src={images[selectedImage]?.image_url || 'https://via.placeholder.com/500x500'}
              alt={product.name}
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/500x500?text=Product+Image'
              }}
            />
            {product.discount_percentage > 0 && (
              <span className="discount-badge">-{product.discount_percentage}%</span>
            )}
          </div>

          {images.length > 0 && (
            <div className="thumbnail-gallery">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  className={`thumbnail ${selectedImage === idx ? 'active' : ''}`}
                  onClick={() => setSelectedImage(idx)}
                >
                  <img
                    src={img.image_url}
                    alt={`${product.name} - ${idx + 1}`}
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/100x100'
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="product-details">
          <div className="detail-header">
            <h1>{product.name}</h1>
            {product.brand && <p className="brand">{product.brand}</p>}
            <p className="sku">SKU: {product.sku}</p>
          </div>

          {/* Rating */}
          <div className="rating-section">
            {product.rating > 0 ? (
              <>
                <span className="stars">{'★'.repeat(Math.round(product.rating))}{'☆'.repeat(5 - Math.round(product.rating))}</span>
                <span className="rating-count">{product.review_count} reviews</span>
              </>
            ) : (
              <span className="no-rating">No reviews yet</span>
            )}
          </div>

          {/* Price Section */}
          <div className="price-section">
            {product.discount_percentage > 0 ? (
              <>
                <span className="original-price">₱{product.base_price.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
                <span className="sale-price">₱{product.final_price.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
                <span className="savings">Save {product.discount_percentage}%</span>
              </>
            ) : (
              <span className="current-price">₱{product.final_price.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="description-section">
              <h3>Description</h3>
              <p>{product.description}</p>
            </div>
          )}

          {/* Variants */}
          {variants.length > 0 && (
            <div className="variants-section">
              <h3>Options</h3>
              <div className="variants-list">
                {variants.map(variant => (
                  <button
                    key={variant.id}
                    className={`variant-option ${selectedVariant?.id === variant.id ? 'selected' : ''}`}
                    onClick={() => setSelectedVariant(variant)}
                  >
                    {variant.name}
                    {variant.price_adjustment > 0 && (
                      <span className="variant-price">+₱{variant.price_adjustment}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock Status */}
          <div className="stock-section">
            {product.total_stock > 10 ? (
              <p className="in-stock">✓ In Stock</p>
            ) : product.total_stock > 0 ? (
              <p className="low-stock">⚠ Only {product.total_stock} left in stock</p>
            ) : (
              <p className="out-of-stock">Out of Stock</p>
            )}
          </div>

          {/* Quantity & Add to Cart */}
          {product.total_stock > 0 && (
            <div className="actions-section">
              <div className="quantity-selector">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max={product.total_stock}
                />
                <button
                  onClick={() => setQuantity(Math.min(product.total_stock, quantity + 1))}
                  disabled={quantity >= product.total_stock}
                >
                  +
                </button>
              </div>

              <button
                className="btn-add-to-cart"
                onClick={handleAddToCart}
                disabled={addingToCart}
              >
                {addingToCart ? 'Adding...' : `Add to Cart (${inCart})`}
              </button>

              <button
                className="btn-buy-now"
                onClick={handleBuyNow}
                disabled={addingToCart}
              >
                Buy Now
              </button>
            </div>
          )}

          {successMessage && (
            <div className="success-message">
              {successMessage}
            </div>
          )}

          {/* Product Info */}
          <div className="product-info-grid">
            {product.weight_kg && (
              <div className="info-item">
                <span className="info-label">Weight:</span>
                <span className="info-value">{product.weight_kg} kg</span>
              </div>
            )}
            {product.warranty_months && (
              <div className="info-item">
                <span className="info-label">Warranty:</span>
                <span className="info-value">{product.warranty_months} months</span>
              </div>
            )}
            {product.return_days && (
              <div className="info-item">
                <span className="info-label">Returns:</span>
                <span className="info-value">Within {product.return_days} days</span>
              </div>
            )}
            {product.shipping_class && (
              <div className="info-item">
                <span className="info-label">Shipping:</span>
                <span className="info-value">{product.shipping_class}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Long Description */}
      {product.long_description && (
        <div className="long-description-section">
          <h2>Product Details</h2>
          <div className="long-description">
            {product.long_description}
          </div>
        </div>
      )}

      {/* Reviews Section */}
      {reviews.length > 0 && (
        <div className="reviews-section">
          <h2>Customer Reviews</h2>
          <div className="reviews-list">
            {reviews.map(review => (
              <div key={review.id} className="review-card">
                <div className="review-header">
                  <span className="review-stars">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                  {review.title && <h4>{review.title}</h4>}
                </div>
                {review.comment && <p>{review.comment}</p>}
                <p className="review-date">{new Date(review.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Related Products Placeholder */}
      <div className="related-products-section">
        <h2>More Products from This Category</h2>
        <button onClick={() => onNavigate?.('shop')} className="btn-view-more">
          View All Products
        </button>
      </div>
    </div>
  )
}
