import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ChevronLeft, Heart, Share2, Star, MessageSquare, MapPin, Truck } from 'lucide-react'
import './BusinessMarketplaceDetail.css'

export default function BusinessMarketplaceDetail({ productId, userId, onBack, setActiveTab }) {
  const [product, setProduct] = useState(null)
  const [seller, setSeller] = useState(null)
  const [reviews, setReviews] = useState([])
  const [isFavorited, setIsFavorited] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [showInquiryForm, setShowInquiryForm] = useState(false)
  const [inquiryData, setInquiryData] = useState({
    subject: '',
    message: '',
    quantity_inquiry: 1
  })

  useEffect(() => {
    loadProductDetails()
  }, [productId])

  const loadProductDetails = async () => {
    try {
      setLoading(true)
      setError('')

      // Load product
      const { data: productData, error: prodErr } = await supabase
        .from('industrial_products')
        .select('*')
        .eq('id', productId)
        .single()

      if (prodErr) throw prodErr

      setProduct(productData)

      // Load seller
      const { data: sellerData } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', productData.business_id)
        .single()

      setSeller(sellerData)

      // Load reviews
      const { data: reviewsData } = await supabase
        .from('industrial_product_reviews')
        .select('*')
        .eq('product_id', productId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })

      setReviews(reviewsData || [])

      // Load favorite status
      if (userId) {
        const { data: favData } = await supabase
          .from('industrial_product_favorites')
          .select('id')
          .eq('user_id', userId)
          .eq('product_id', productId)
          .single()

        setIsFavorited(!!favData)
      }
    } catch (err) {
      console.error('Error loading product details:', err)
      setError('Failed to load product details')
    } finally {
      setLoading(false)
    }
  }

  const toggleFavorite = async () => {
    if (!userId) {
      setActiveTab('profile')
      return
    }

    try {
      if (isFavorited) {
        await supabase
          .from('industrial_product_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('product_id', productId)
      } else {
        await supabase
          .from('industrial_product_favorites')
          .insert([{ user_id: userId, product_id: productId }])
      }
      setIsFavorited(!isFavorited)
    } catch (err) {
      console.error('Error toggling favorite:', err)
    }
  }

  const handleInquirySubmit = async (e) => {
    e.preventDefault()

    if (!userId) {
      setActiveTab('profile')
      return
    }

    try {
      const { error: err } = await supabase
        .from('industrial_product_inquiries')
        .insert([{
          product_id: productId,
          buyer_id: userId,
          seller_id: product.seller_id,
          subject: inquiryData.subject,
          message: inquiryData.message,
          quantity_inquiry: inquiryData.quantity_inquiry
        }])

      if (err) throw err

      setShowInquiryForm(false)
      setInquiryData({ subject: '', message: '', quantity_inquiry: 1 })
      alert('Inquiry sent successfully!')
    } catch (err) {
      console.error('Error sending inquiry:', err)
      alert('Failed to send inquiry')
    }
  }

  if (loading) {
    return (
      <div className="product-detail-container">
        <div className="loading-state">Loading product...</div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="product-detail-container">
        <button onClick={onBack} className="back-btn">
          <ChevronLeft size={20} /> Back
        </button>
        <div className="error-state">{error || 'Product not found'}</div>
      </div>
    )
  }

  const images = product.image_urls || (product.primary_image_url ? [product.primary_image_url] : [])

  return (
    <div className="product-detail-container">
      {/* Header */}
      <button onClick={onBack} className="back-btn">
        <ChevronLeft size={20} /> Back to Marketplace
      </button>

      <div className="detail-content">
        {/* Image Gallery */}
        <aside className="image-gallery">
          <div className="main-image">
            <img
              src={images[activeImageIndex] || 'https://via.placeholder.com/500x400?text=Industrial+Product'}
              alt={product.name}
            />
          </div>
          {images.length > 1 && (
            <div className="thumbnail-list">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  className={`thumbnail ${idx === activeImageIndex ? 'active' : ''}`}
                  onClick={() => setActiveImageIndex(idx)}
                >
                  <img src={img} alt={`${product.name} ${idx}`} />
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Product Info */}
        <section className="product-info">
          <div className="product-header">
            <h1 className="product-title">{product.name}</h1>
            <div className="action-buttons">
              <button
                onClick={toggleFavorite}
                className={`action-btn favorite-btn ${isFavorited ? 'favorited' : ''}`}
                title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart size={20} fill={isFavorited ? 'currentColor' : 'none'} />
              </button>
              <button className="action-btn share-btn" title="Share product">
                <Share2 size={20} />
              </button>
            </div>
          </div>

          {/* Category and Meta */}
          <div className="product-meta">
            <span className="category-badge">{product.category}</span>
            {product.subcategory && (
              <span className="subcategory-badge">{product.subcategory}</span>
            )}
          </div>

          {/* Rating */}
          {product.rating && (
            <div className="rating-section">
              <div className="stars">
                {'★'.repeat(Math.round(product.rating))}
                {'☆'.repeat(5 - Math.round(product.rating))}
              </div>
              <span className="rating-value">{product.rating.toFixed(1)}</span>
              <span className="review-count">({product.review_count} reviews)</span>
            </div>
          )}

          {/* Price */}
          <div className="price-section">
            <div className="price-display">
              <span className="price">₱{product.price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              {product.currency && <span className="currency">{product.currency}</span>}
            </div>
            {product.unit_of_measurement && (
              <p className="unit-info">per {product.unit_of_measurement}</p>
            )}
          </div>

          {/* Stock Status */}
          <div className="stock-status">
            <span className={`status-badge ${product.stock_status}`}>
              {product.stock_status === 'in_stock' ? '✓ In Stock' : 'Out of Stock'}
            </span>
            {product.minimum_order_quantity > 1 && (
              <p className="moq">Minimum Order: {product.minimum_order_quantity} units</p>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="description-section">
              <h3>Description</h3>
              <p>{product.description}</p>
            </div>
          )}

          {/* Specifications */}
          {product.specifications && Object.keys(product.specifications).length > 0 && (
            <div className="specifications-section">
              <h3>Specifications</h3>
              <table className="specs-table">
                <tbody>
                  {Object.entries(product.specifications).map(([key, value]) => (
                    <tr key={key}>
                      <td className="spec-key">{key}</td>
                      <td className="spec-value">{String(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Features */}
          {product.features && product.features.length > 0 && (
            <div className="features-section">
              <h3>Features</h3>
              <ul className="features-list">
                {product.features.map((feature, idx) => (
                  <li key={idx}>✓ {feature}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Logistics */}
          <div className="logistics-section">
            <div className="logistics-item">
              <Truck size={20} />
              <div>
                <p className="logistics-title">Shipping</p>
                {product.shipping_available ? (
                  <p className="logistics-detail">
                    {product.delivery_time || 'Negotiable delivery time'}
                    {product.delivery_cost && ` - Delivery: ₱${product.delivery_cost}`}
                  </p>
                ) : (
                  <p className="logistics-detail">Pickup only</p>
                )}
              </div>
            </div>
            {product.origin_city && (
              <div className="logistics-item">
                <MapPin size={20} />
                <div>
                  <p className="logistics-title">Origin</p>
                  <p className="logistics-detail">{product.origin_city}, {product.origin_country || 'Philippines'}</p>
                </div>
              </div>
            )}
          </div>

          {/* CTA Buttons */}
          <div className="cta-buttons">
            <button
              onClick={() => setShowInquiryForm(!showInquiryForm)}
              className="btn btn-primary"
            >
              <MessageSquare size={18} />
              Send Inquiry
            </button>
            <button className="btn btn-secondary">
              Add to Cart
            </button>
          </div>

          {/* Inquiry Form */}
          {showInquiryForm && (
            <form onSubmit={handleInquirySubmit} className="inquiry-form">
              <h3>Send Inquiry to Seller</h3>

              <div className="form-group">
                <label>Subject</label>
                <input
                  type="text"
                  value={inquiryData.subject}
                  onChange={(e) => setInquiryData({ ...inquiryData, subject: e.target.value })}
                  placeholder="What would you like to know?"
                  required
                />
              </div>

              <div className="form-group">
                <label>Quantity Interested In</label>
                <input
                  type="number"
                  min="1"
                  value={inquiryData.quantity_inquiry}
                  onChange={(e) => setInquiryData({ ...inquiryData, quantity_inquiry: parseInt(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>Message</label>
                <textarea
                  value={inquiryData.message}
                  onChange={(e) => setInquiryData({ ...inquiryData, message: e.target.value })}
                  placeholder="Tell the seller your requirements..."
                  rows="4"
                  required
                ></textarea>
              </div>

              <div className="form-buttons">
                <button type="submit" className="btn btn-primary">Send Inquiry</button>
                <button
                  type="button"
                  onClick={() => setShowInquiryForm(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      {/* Seller Information */}
      {seller && (
        <section className="seller-section">
          <div className="seller-card">
            <div className="seller-header">
              <h2>{seller.business_name}</h2>
              <div className="seller-rating">
                {seller.rating && (
                  <>
                    <span className="stars">{'★'.repeat(Math.round(seller.rating))}{'☆'.repeat(5 - Math.round(seller.rating))}</span>
                    <span>{seller.rating.toFixed(1)}</span>
                  </>
                )}
              </div>
            </div>

            {seller.description && (
              <p className="seller-description">{seller.description}</p>
            )}

            <div className="seller-info">
              {seller.city_of_registration && (
                <p>📍 Located in {seller.city_of_registration}</p>
              )}
              <p>Member since {new Date(seller.created_at).getFullYear()}</p>
            </div>

            <button className="btn btn-primary" onClick={() => alert('Visit seller store coming soon')}>
              View Store
            </button>
          </div>
        </section>
      )}

      {/* Reviews Section */}
      <section className="reviews-section">
        <h2>Customer Reviews ({reviews.length})</h2>

        {reviews.length === 0 ? (
          <p className="no-reviews">No reviews yet. Be the first to review this product!</p>
        ) : (
          <div className="reviews-list">
            {reviews.map(review => (
              <div key={review.id} className="review-item">
                <div className="review-header">
                  <div className="review-rating">
                    {'★'.repeat(review.rating)}
                    {'☆'.repeat(5 - review.rating)}
                  </div>
                  <span className="review-title">{review.title}</span>
                </div>
                {review.content && <p className="review-content">{review.content}</p>}
                <p className="review-date">
                  {new Date(review.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
