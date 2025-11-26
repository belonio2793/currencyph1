import { useState, useEffect } from 'react'
import { useShoppingCart } from '../context/ShoppingCartContext'
import './ShoppingCart.css'

export default function ShoppingCart({ onNavigate }) {
  const { cart, removeItem, updateQuantity, clearCartItems } = useShoppingCart()
  const [promoCode, setPromoCode] = useState('')
  const [discount, setDiscount] = useState(0)

  const subtotal = cart.subtotal || 0
  const shipping = 150
  const tax = subtotal * 0.12
  const total = subtotal + shipping + tax - discount

  const handleUpdateQuantity = async (itemId, quantity) => {
    if (quantity > 0) {
      await updateQuantity(itemId, quantity)
    }
  }

  const handleRemoveItem = async (itemId) => {
    await removeItem(itemId)
  }

  const handleApplyPromo = () => {
    if (promoCode === 'SAVE10') {
      const discountAmount = subtotal * 0.10
      setDiscount(discountAmount)
      alert('Promo code applied! 10% discount')
    } else {
      alert('Invalid promo code')
    }
  }

  const handleProceedToCheckout = () => {
    if (cart.items && cart.items.length > 0 && onNavigate) {
      onNavigate('shop-checkout')
    }
  }

  const handleContinueShopping = () => {
    if (onNavigate) {
      onNavigate('shop')
    }
  }

  return (
    <div className="shopping-cart-container">
      <div className="cart-header">
        <h1>Shopping Cart</h1>
        <p>Review your items before checkout</p>
      </div>

      {!cart.items || cart.items.length === 0 ? (
        <div className="empty-cart">
          <div className="empty-cart-content">
            <div className="empty-icon">🛒</div>
            <h2>Your cart is empty</h2>
            <p>Add some products to get started!</p>
            <button onClick={() => onNavigate?.('shop')} className="btn-continue-shopping">
              Continue Shopping
            </button>
          </div>
        </div>
      ) : (
        <div className="cart-content">
          {/* Cart Items */}
          <div className="cart-items-section">
            <div className="cart-header-row">
              <div>Product</div>
              <div>Price</div>
              <div>Quantity</div>
              <div>Total</div>
              <div></div>
            </div>

            {cart.items.map(item => (
              <div key={item.id} className="cart-item">
                <div className="item-image">
                  {item.product?.shop_product_images?.[0]?.image_url && (
                    <img
                      src={item.product.shop_product_images[0].image_url}
                      alt={item.product?.name}
                    />
                  )}
                </div>

                <div className="item-details">
                  <h3>
                    {item.product?.name}
                  </h3>
                  {item.variant?.option_value && (
                    <p className="variant-info">{item.variant.option_value}</p>
                  )}
                  <p className="sku">SKU: {item.product?.sku}</p>
                </div>

                <div className="item-price">
                  ₱{item.unitPrice?.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                </div>

                <div className="item-quantity">
                  <button
                    onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                    min="1"
                    max={item.product?.total_stock}
                  />
                  <button
                    onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                    disabled={item.quantity >= (item.product?.total_stock || 1)}
                  >
                    +
                  </button>
                </div>

                <div className="item-total">
                  ₱{item.totalPrice?.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                </div>

                <button
                  className="btn-remove"
                  onClick={() => handleRemoveItem(item.id)}
                  title="Remove from cart"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Cart Summary */}
          <div className="cart-summary">
            <div className="promo-section">
              <h3>Promo Code</h3>
              <div className="promo-input-group">
                <input
                  type="text"
                  placeholder="Enter promo code"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="promo-input"
                />
                <button onClick={handleApplyPromo} className="btn-apply-promo">
                  Apply
                </button>
              </div>
              <p className="promo-hint">Try: SAVE10</p>
            </div>

            <div className="order-summary">
              <h3>Order Summary</h3>

              <div className="summary-row">
                <span>Subtotal:</span>
                <span>₱{subtotal.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
              </div>

              {discount > 0 && (
                <div className="summary-row discount">
                  <span>Discount:</span>
                  <span>-₱{discount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
                </div>
              )}

              <div className="summary-row">
                <span>Shipping:</span>
                <span>₱{shipping.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
              </div>

              <div className="summary-row">
                <span>Tax (12%):</span>
                <span>₱{tax.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
              </div>

              <div className="summary-row total">
                <span>Total:</span>
                <span>₱{total.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
              </div>

              <button
                className="btn-checkout"
                onClick={handleProceedToCheckout}
              >
                Proceed to Checkout
              </button>

              <button
                className="btn-continue"
                onClick={handleContinueShopping}
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
