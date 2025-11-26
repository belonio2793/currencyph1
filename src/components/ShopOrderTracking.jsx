import { useState, useEffect } from 'react'
import { useShoppingCart } from '../context/ShoppingCartContext'
import { getCustomerOrders } from '../lib/shopOrderService'
import './ShopOrderTracking.css'

export default function ShopOrderTracking() {
  const { customerId } = useShoppingCart()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (customerId) loadOrders()
  }, [customerId, page])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const data = await getCustomerOrders(customerId, page, 10)
      setOrders(data.orders || [])
    } catch (err) {
      console.error('Error loading orders:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!customerId) {
    return (
      <div className="order-tracking">
        <p>Please sign in to view your orders</p>
      </div>
    )
  }

  return (
    <div className="order-tracking-container">
      <h1>My Orders</h1>
      {loading ? (
        <p>Loading orders...</p>
      ) : orders.length === 0 ? (
        <p>No orders yet</p>
      ) : (
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Date</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                <td>{order.order_number}</td>
                <td>{new Date(order.created_at).toLocaleDateString()}</td>
                <td><span className={`status ${order.order_status}`}>{order.order_status}</span></td>
                <td>{order.payment_status}</td>
                <td>₱{order.total_amount?.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
