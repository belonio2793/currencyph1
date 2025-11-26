import { supabase, executeWithRetry } from './supabaseClient'

export async function createOrder(orderData) {
  try {
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

    const { data, error } = await supabase
      .from('shop_orders')
      .insert([
        {
          ...orderData,
          order_number: orderNumber,
          order_status: 'pending',
          payment_status: 'pending'
        }
      ])
      .select()

    if (error) throw error

    const order = data?.[0]
    if (order) {
      await addOrderStatusHistory(order.id, null, 'pending', 'Order created')
    }

    return order
  } catch (err) {
    console.error('Error creating order:', err)
    throw err
  }
}

export async function addOrderItems(orderId, items) {
  try {
    const orderItems = items.map(item => ({
      order_id: orderId,
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      product_sku: item.product_sku,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_amount: item.discount_amount || 0,
      tax_amount: item.tax_amount || 0,
      total_price: item.total_price,
      weight_kg: item.weight_kg,
      attributes: item.attributes || null,
      status: 'pending'
    }))

    const { data, error } = await supabase
      .from('shop_order_items')
      .insert(orderItems)
      .select()

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error adding order items:', err)
    throw err
  }
}

export async function getOrderById(orderId) {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_orders')
        .select(`
          *,
          shop_order_items(
            id,product_id,variant_id,product_name,quantity,unit_price,discount_amount,tax_amount,total_price
          ),
          shop_customers(id,first_name,last_name,email,phone),
          shop_addresses!shipping_address_id(street_address,street_address_2,barangay,city,province,postal_code,phone),
          shop_order_status_history(id,status_from,status_to,changed_at,notes)
        `)
        .eq('id', orderId)
        .single()

      if (error) throw error
      return data
    }, 3)
  } catch (err) {
    console.error('Error fetching order:', err)
    throw err
  }
}

export async function getOrderByNumber(orderNumber) {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_orders')
        .select(`
          *,
          shop_order_items(id,product_id,product_name,quantity,unit_price,total_price),
          shop_customers(first_name,last_name,email),
          shop_addresses!shipping_address_id(street_address,city,province,postal_code)
        `)
        .eq('order_number', orderNumber)
        .single()

      if (error) throw error
      return data
    }, 3)
  } catch (err) {
    console.error('Error fetching order by number:', err)
    throw err
  }
}

export async function getCustomerOrders(customerId, page = 1, pageSize = 10) {
  try {
    return await executeWithRetry(async () => {
      const offset = (page - 1) * pageSize

      const { data, error, count } = await supabase
        .from('shop_orders')
        .select('id,order_number,order_status,payment_status,total_amount,created_at', { count: 'exact' })
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (error) throw error

      return {
        orders: data || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    }, 3)
  } catch (err) {
    console.error('Error fetching customer orders:', err)
    throw err
  }
}

export async function updateOrderStatus(orderId, newStatus, notes = '') {
  try {
    const { data: orderData, error: fetchError } = await supabase
      .from('shop_orders')
      .select('order_status')
      .eq('id', orderId)
      .single()

    if (fetchError) throw fetchError

    const currentStatus = orderData?.order_status

    const { data, error } = await supabase
      .from('shop_orders')
      .update({ order_status: newStatus, updated_at: new Date() })
      .eq('id', orderId)
      .select()

    if (error) throw error

    if (currentStatus !== newStatus) {
      await addOrderStatusHistory(orderId, currentStatus, newStatus, notes)
    }

    return data?.[0]
  } catch (err) {
    console.error('Error updating order status:', err)
    throw err
  }
}

export async function updatePaymentStatus(orderId, paymentStatus) {
  try {
    const { data, error } = await supabase
      .from('shop_orders')
      .update({ payment_status: paymentStatus, updated_at: new Date() })
      .eq('id', orderId)
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.error('Error updating payment status:', err)
    throw err
  }
}

export async function addOrderStatusHistory(orderId, statusFrom, statusTo, notes = '') {
  try {
    const { data: userData } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('shop_order_status_history')
      .insert([
        {
          order_id: orderId,
          status_from: statusFrom,
          status_to: statusTo,
          changed_by: userData.user?.id,
          notes
        }
      ])
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.error('Error adding order status history:', err)
  }
}

export async function updateOrderTracking(orderId, trackingNumber, estimatedDelivery) {
  try {
    const { data, error } = await supabase
      .from('shop_orders')
      .update({
        tracking_number: trackingNumber,
        estimated_delivery_date: estimatedDelivery,
        updated_at: new Date()
      })
      .eq('id', orderId)
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.error('Error updating order tracking:', err)
    throw err
  }
}

export async function cancelOrder(orderId, reason = '') {
  try {
    const { data: userData } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('shop_orders')
      .update({
        order_status: 'cancelled',
        cancellation_reason: reason,
        cancelled_at: new Date(),
        cancelled_by: userData.user?.id,
        updated_at: new Date()
      })
      .eq('id', orderId)
      .select()

    if (error) throw error

    await addOrderStatusHistory(orderId, null, 'cancelled', `Order cancelled. Reason: ${reason}`)

    return data?.[0]
  } catch (err) {
    console.error('Error cancelling order:', err)
    throw err
  }
}

export async function processRefund(orderId, refundAmount, refundMethod = 'original_payment') {
  try {
    const { data, error } = await supabase
      .from('shop_orders')
      .update({
        refund_amount: refundAmount,
        refund_method: refundMethod,
        refund_date: new Date(),
        payment_status: 'refunded',
        updated_at: new Date()
      })
      .eq('id', orderId)
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.error('Error processing refund:', err)
    throw err
  }
}

export async function markOrderCompleted(orderId) {
  try {
    const { data, error } = await supabase
      .from('shop_orders')
      .update({
        order_status: 'completed',
        completed_at: new Date(),
        actual_delivery_date: new Date(),
        updated_at: new Date()
      })
      .eq('id', orderId)
      .select()

    if (error) throw error

    await addOrderStatusHistory(orderId, null, 'completed', 'Order completed and delivered')

    return data?.[0]
  } catch (err) {
    console.error('Error marking order as completed:', err)
    throw err
  }
}

export async function getOrderStats() {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_orders')
        .select('order_status,payment_status', { count: 'exact' })

      if (error) throw error

      const stats = {
        totalOrders: data?.length || 0,
        pendingOrders: data?.filter(o => o.order_status === 'pending').length || 0,
        processingOrders: data?.filter(o => o.order_status === 'processing').length || 0,
        shippedOrders: data?.filter(o => o.order_status === 'shipped').length || 0,
        deliveredOrders: data?.filter(o => o.order_status === 'completed').length || 0,
        cancelledOrders: data?.filter(o => o.order_status === 'cancelled').length || 0,
        paidOrders: data?.filter(o => o.payment_status === 'paid').length || 0,
        pendingPaymentOrders: data?.filter(o => o.payment_status === 'pending').length || 0
      }

      return stats
    }, 3)
  } catch (err) {
    console.error('Error fetching order stats:', err)
    throw err
  }
}

export async function getRecentOrders(limit = 10) {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_orders')
        .select('*,shop_customers(first_name,last_name,email)')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    }, 3)
  } catch (err) {
    console.error('Error fetching recent orders:', err)
    throw err
  }
}
