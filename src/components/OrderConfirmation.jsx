import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getOrderById } from '../lib/shopOrderService'
import './OrderConfirmation.css'

export default function OrderConfirmation() {
  const { orderId } = useParams()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOrder()
  }, [orderId])

  const loadOrder = async () => {
    try {
      const data = await getOrderById(orderId)
      setOrder(data)
    } catch (err) {
      console.error('Error loading order:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="confirmation-loading">Loading order...</div>

  return (
    <div className="order-confirmation">
      <div className="confirmation-header">
        <div className="success-icon">✓</div>
        <h1>Order Confirmed!</h1>
        <p>Thank you for your purchase</p>
      </div>

      {order && (
        <div className="confirmation-content">
          <div className="order-info">
            <div className="info-section">
              <h3>Order Number</h3>
              <p className="order-number">{order.order_number}</p>
            </div>

            <div className="info-section">
              <h3>Order Total</h3>
              <p className="order-total">₱{order.total_amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</p>
            </div>

            <div className="info-section">
              <h3>Status</h3>
              <p className="order-status">{order.order_status}</p>
            </div>

            <div className="info-section">
              <h3>Payment Method</h3>
              <p className="payment-method">{order.payment_method === 'cash_on_delivery' ? 'Cash On Delivery' : order.payment_method}</p>
            </div>
          </div>

          <div className="confirmation-items">
            <h3>Items Ordered</h3>
            {order.shop_order_items?.map(item => (
              <div key={item.id} className="confirmation-item">
                <span>{item.product_name} x {item.quantity}</span>
                <span>₱{item.total_price.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>

          <div className="confirmation-actions">
            <Link to="/shop" className="btn-continue-shopping">
              Continue Shopping
            </Link>
            <Link to="/shop/orders" className="btn-view-orders">
              View My Orders
            </Link>
          </div>
        </div>
      )}

      <div className="confirmation-footer">
        <p>A confirmation email has been sent to your email address</p>
      </div>
    </div>
  )
}
