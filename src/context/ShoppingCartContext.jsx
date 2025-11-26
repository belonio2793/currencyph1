import { createContext, useContext, useState, useEffect } from 'react'
import { getCart, addToCart, updateCartItem, removeFromCart, clearCart } from '../lib/shopCartService'

const ShoppingCartContext = createContext()

export function ShoppingCartProvider({ children }) {
  const [cart, setCart] = useState({ items: [], count: 0, subtotal: 0 })
  const [loading, setLoading] = useState(false)
  const [customerId, setCustomerId] = useState(null)
  const [sessionId, setSessionId] = useState(() => {
    const stored = localStorage.getItem('shop_session_id')
    if (stored) return stored
    const newId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('shop_session_id', newId)
    return newId
  })

  const loadCart = async (custId) => {
    try {
      setLoading(true)
      const cartData = await getCart(custId || customerId, !custId && sessionId)
      setCart(cartData)
    } catch (err) {
      console.error('Error loading cart:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (customerId) {
      loadCart(customerId)
    }
  }, [customerId])

  const addItemToCart = async (productId, quantity = 1, variantId = null) => {
    try {
      setLoading(true)
      await addToCart(customerId, productId, quantity, variantId, sessionId)
      await loadCart(customerId)
      return true
    } catch (err) {
      console.error('Error adding to cart:', err)
      return false
    } finally {
      setLoading(false)
    }
  }

  const updateQuantity = async (cartItemId, quantity) => {
    try {
      setLoading(true)
      await updateCartItem(cartItemId, quantity)
      await loadCart(customerId)
      return true
    } catch (err) {
      console.error('Error updating cart:', err)
      return false
    } finally {
      setLoading(false)
    }
  }

  const removeItem = async (cartItemId) => {
    try {
      setLoading(true)
      await removeFromCart(cartItemId)
      await loadCart(customerId)
      return true
    } catch (err) {
      console.error('Error removing from cart:', err)
      return false
    } finally {
      setLoading(false)
    }
  }

  const clearCartItems = async () => {
    try {
      setLoading(true)
      await clearCart(customerId, sessionId)
      setCart({ items: [], count: 0, subtotal: 0 })
      return true
    } catch (err) {
      console.error('Error clearing cart:', err)
      return false
    } finally {
      setLoading(false)
    }
  }

  const setCustomerAndLoadCart = (custId) => {
    setCustomerId(custId)
    loadCart(custId)
  }

  const value = {
    cart,
    loading,
    customerId,
    sessionId,
    addItemToCart,
    updateQuantity,
    removeItem,
    clearCartItems,
    loadCart,
    setCustomerAndLoadCart
  }

  return (
    <ShoppingCartContext.Provider value={value}>
      {children}
    </ShoppingCartContext.Provider>
  )
}

export function useShoppingCart() {
  const context = useContext(ShoppingCartContext)
  if (!context) {
    throw new Error('useShoppingCart must be used within ShoppingCartProvider')
  }
  return context
}
