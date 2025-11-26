import { supabase, executeWithRetry } from './supabaseClient'
import { validateCartItems } from './shopCartService'
import { createOrder, addOrderItems } from './shopOrderService'

export async function validateCheckoutData(checkoutData) {
  const errors = {}

  if (!checkoutData.customer_id) errors.customer_id = 'Customer ID is required'
  if (!checkoutData.shipping_address_id) errors.shipping_address = 'Shipping address is required'
  if (!checkoutData.payment_method) errors.payment_method = 'Payment method is required'
  if (!checkoutData.items || checkoutData.items.length === 0) errors.items = 'Cart cannot be empty'

  if (checkoutData.items && checkoutData.items.length > 0) {
    const validation = await validateCartItems(checkoutData.items)
    if (!validation.valid) {
      errors.items = validation.results.filter(r => !r.valid)
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  }
}

export async function calculateCheckoutTotals(items, shippingCost = 0, taxRate = 0.12, discountAmount = 0) {
  try {
    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
    const taxAmount = subtotal * taxRate
    const total = subtotal + taxAmount + shippingCost - discountAmount

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      shippingCost: Math.round(shippingCost * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      total: Math.round(total * 100) / 100
    }
  } catch (err) {
    console.error('Error calculating checkout totals:', err)
    throw err
  }
}

export async function processCheckout(checkoutData) {
  try {
    const validation = await validateCheckoutData(checkoutData)
    if (!validation.valid) {
      throw new Error(`Checkout validation failed: ${JSON.stringify(validation.errors)}`)
    }

    const totals = await calculateCheckoutTotals(
      checkoutData.items,
      checkoutData.shippingCost || 0,
      checkoutData.taxRate || 0.12,
      checkoutData.discountAmount || 0
    )

    const orderData = {
      customer_id: checkoutData.customer_id,
      shipping_address_id: checkoutData.shipping_address_id,
      billing_address_id: checkoutData.billing_address_id || checkoutData.shipping_address_id,
      shipping_method: checkoutData.shipping_method || 'standard',
      payment_method: checkoutData.payment_method,
      payment_method_details: checkoutData.payment_method_details || {},
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      shipping_cost: totals.shippingCost,
      discount_amount: totals.discountAmount,
      total_amount: totals.total,
      discount_code: checkoutData.discount_code || null,
      customer_notes: checkoutData.customerNotes || '',
      ip_address: checkoutData.ipAddress || null,
      user_agent: checkoutData.userAgent || null,
      metadata: checkoutData.metadata || {}
    }

    const order = await createOrder(orderData)
    if (!order) throw new Error('Failed to create order')

    const orderItems = checkoutData.items.map(item => ({
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      product_sku: item.sku,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount_amount: (item.discount || 0),
      tax_amount: (item.unitPrice * item.quantity * (checkoutData.taxRate || 0.12)),
      total_price: item.totalPrice,
      weight_kg: item.weight || 0,
      attributes: item.attributes || null
    }))

    await addOrderItems(order.id, orderItems)

    return order
  } catch (err) {
    console.error('Error processing checkout:', err)
    throw err
  }
}

export async function applyPromoCode(code, subtotal) {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_promotions')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single()

      if (error) {
        throw new Error('Promo code not found or invalid')
      }

      const now = new Date()
      if (data.start_date && new Date(data.start_date) > now) {
        throw new Error('This promo code is not yet active')
      }
      if (data.end_date && new Date(data.end_date) < now) {
        throw new Error('This promo code has expired')
      }

      if (data.maximum_order_amount && subtotal > data.maximum_order_amount) {
        throw new Error(`This promo code is only valid for orders up to ₱${data.minimum_order_amount}`)
      }

      if (data.minimum_order_amount && subtotal < data.minimum_order_amount) {
        throw new Error(`Minimum order amount of ₱${data.minimum_order_amount} required for this promo code`)
      }

      if (data.max_usage_count && data.usage_count >= data.max_usage_count) {
        throw new Error('This promo code has reached its maximum usage limit')
      }

      let discount = 0
      if (data.discount_type === 'percentage') {
        discount = Math.min(subtotal * (data.discount_percentage / 100), data.max_discount_amount || Infinity)
      } else if (data.discount_type === 'fixed') {
        discount = Math.min(data.discount_value, subtotal)
      }

      return {
        valid: true,
        code: data.code,
        discountType: data.discount_type,
        discountValue: discount,
        description: data.description
      }
    }, 3)
  } catch (err) {
    console.error('Error applying promo code:', err)
    throw err
  }
}

export async function validateShippingAddress(addressId) {
  try {
    const { data, error } = await supabase
      .from('shop_addresses')
      .select('*')
      .eq('id', addressId)
      .single()

    if (error) throw error

    const required = ['street_address', 'city', 'province', 'postal_code']
    const missing = required.filter(field => !data[field])

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`)
    }

    return data
  } catch (err) {
    console.error('Error validating shipping address:', err)
    throw err
  }
}

export async function calculateShippingCost(addressData, cartTotal, weight = 0) {
  try {
    const baseCost = 150
    const perKmCost = 15
    const perKgCost = 25

    let shippingCost = baseCost + (weight * perKgCost)

    if (cartTotal > 5000) {
      shippingCost *= 0.8
    }

    return Math.round(shippingCost * 100) / 100
  } catch (err) {
    console.error('Error calculating shipping cost:', err)
    throw err
  }
}

export async function processPayment(orderId, paymentData) {
  try {
    if (paymentData.method === 'cash_on_delivery') {
      return {
        success: true,
        method: 'cash_on_delivery',
        status: 'pending',
        message: 'Payment will be collected upon delivery'
      }
    }

    if (paymentData.method === 'credit_card') {
      return {
        success: true,
        method: 'credit_card',
        status: 'processing',
        message: 'Credit card payment is being processed'
      }
    }

    if (paymentData.method === 'bank_transfer') {
      return {
        success: true,
        method: 'bank_transfer',
        status: 'pending',
        message: 'Please transfer the payment to the account details sent to your email'
      }
    }

    throw new Error('Unsupported payment method')
  } catch (err) {
    console.error('Error processing payment:', err)
    throw err
  }
}

export async function getCheckoutSummary(customerId, shippingAddressId) {
  try {
    const { data: cartData, error: cartError } = await supabase
      .from('shop_cart')
      .select(`
        quantity,
        shop_products(final_price)
      `)
      .eq('customer_id', customerId)

    if (cartError) throw cartError

    const { data: addressData, error: addressError } = await supabase
      .from('shop_addresses')
      .select('*')
      .eq('id', shippingAddressId)
      .single()

    if (addressError) throw addressError

    const subtotal = (cartData || []).reduce((sum, item) => sum + (item.shop_products?.final_price || 0) * item.quantity, 0)
    const shippingCost = await calculateShippingCost(addressData, subtotal)
    const totals = await calculateCheckoutTotals(
      (cartData || []).map((item, i) => ({
        unitPrice: item.shop_products?.final_price || 0,
        quantity: item.quantity
      })),
      shippingCost
    )

    return {
      subtotal: totals.subtotal,
      shipping: totals.shippingCost,
      tax: totals.taxAmount,
      total: totals.total,
      itemCount: cartData?.length || 0,
      shippingAddress: addressData
    }
  } catch (err) {
    console.error('Error getting checkout summary:', err)
    throw err
  }
}
