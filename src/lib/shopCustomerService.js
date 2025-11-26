import { supabase, executeWithRetry } from './supabaseClient'

export async function createOrUpdateCustomer(userId, customerData) {
  try {
    const { data: existingData, error: fetchError } = await supabase
      .from('shop_customers')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError

    if (existingData) {
      const { data, error } = await supabase
        .from('shop_customers')
        .update(customerData)
        .eq('id', existingData.id)
        .select()

      if (error) throw error
      return data?.[0]
    } else {
      const { data, error } = await supabase
        .from('shop_customers')
        .insert([
          {
            user_id: userId,
            email: customerData.email,
            ...customerData
          }
        ])
        .select()

      if (error) throw error
      return data?.[0]
    }
  } catch (err) {
    console.error('Error creating/updating customer:', err)
    throw err
  }
}

export async function getCustomer(customerId) {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_customers')
        .select(`
          *,
          shop_addresses(id,address_type,street_address,city,province,postal_code,is_default)
        `)
        .eq('id', customerId)
        .single()

      if (error) throw error
      return data
    }, 3)
  } catch (err) {
    console.error('Error fetching customer:', err)
    throw err
  }
}

export async function getCustomerByEmail(email) {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_customers')
        .select('*')
        .eq('email', email)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    }, 3)
  } catch (err) {
    console.error('Error fetching customer by email:', err)
    return null
  }
}

export async function getOrCreateCustomer(userId, email, firstAndLastName = {}) {
  try {
    let customer = await getCustomerByEmail(email)

    if (!customer) {
      customer = await createOrUpdateCustomer(userId, {
        email,
        first_name: firstAndLastName.first || '',
        last_name: firstAndLastName.last || '',
        is_verified: true
      })
    } else if (userId && !customer.user_id) {
      await supabase
        .from('shop_customers')
        .update({ user_id: userId, is_verified: true })
        .eq('id', customer.id)

      customer.user_id = userId
      customer.is_verified = true
    }

    return customer
  } catch (err) {
    console.error('Error getting or creating customer:', err)
    throw err
  }
}

export async function updateCustomer(customerId, updates) {
  try {
    const { data, error } = await supabase
      .from('shop_customers')
      .update(updates)
      .eq('id', customerId)
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.error('Error updating customer:', err)
    throw err
  }
}

export async function addCustomerAddress(customerId, addressData) {
  try {
    const { data, error } = await supabase
      .from('shop_addresses')
      .insert([
        {
          customer_id: customerId,
          ...addressData,
          is_default: addressData.is_default || false
        }
      ])
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.error('Error adding customer address:', err)
    throw err
  }
}

export async function updateCustomerAddress(addressId, updates) {
  try {
    const { data, error } = await supabase
      .from('shop_addresses')
      .update(updates)
      .eq('id', addressId)
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.error('Error updating customer address:', err)
    throw err
  }
}

export async function deleteCustomerAddress(addressId) {
  try {
    const { error } = await supabase
      .from('shop_addresses')
      .delete()
      .eq('id', addressId)

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting customer address:', err)
    throw err
  }
}

export async function getCustomerAddresses(customerId, addressType = null) {
  try {
    return await executeWithRetry(async () => {
      let query = supabase
        .from('shop_addresses')
        .select('*')
        .eq('customer_id', customerId)

      if (addressType) {
        query = query.eq('address_type', addressType)
      }

      const { data, error } = await query.order('is_default', { ascending: false })

      if (error) throw error
      return data || []
    }, 3)
  } catch (err) {
    console.error('Error fetching customer addresses:', err)
    throw err
  }
}

export async function setDefaultAddress(customerId, addressId, addressType = 'shipping') {
  try {
    const { data: allAddresses, error: fetchError } = await supabase
      .from('shop_addresses')
      .select('id')
      .eq('customer_id', customerId)
      .eq('address_type', addressType)

    if (fetchError) throw fetchError

    for (const addr of allAddresses || []) {
      if (addr.id !== addressId) {
        await supabase
          .from('shop_addresses')
          .update({ is_default: false })
          .eq('id', addr.id)
      }
    }

    const { data, error } = await supabase
      .from('shop_addresses')
      .update({ is_default: true })
      .eq('id', addressId)
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.error('Error setting default address:', err)
    throw err
  }
}

export async function getDefaultAddress(customerId, addressType = 'shipping') {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_addresses')
        .select('*')
        .eq('customer_id', customerId)
        .eq('address_type', addressType)
        .eq('is_default', true)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    }, 3)
  } catch (err) {
    console.error('Error fetching default address:', err)
    return null
  }
}

export async function addToWishlist(customerId, productId) {
  try {
    const { data, error } = await supabase
      .from('shop_wishlist')
      .upsert([
        {
          customer_id: customerId,
          product_id: productId
        }
      ])
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.error('Error adding to wishlist:', err)
    throw err
  }
}

export async function removeFromWishlist(customerId, productId) {
  try {
    const { error } = await supabase
      .from('shop_wishlist')
      .delete()
      .match({ customer_id: customerId, product_id: productId })

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error removing from wishlist:', err)
    throw err
  }
}

export async function getWishlist(customerId) {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_wishlist')
        .select(`
          id,product_id,created_at,
          shop_products(id,name,sku,final_price,shop_product_images(image_url,is_primary))
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    }, 3)
  } catch (err) {
    console.error('Error fetching wishlist:', err)
    throw err
  }
}

export async function isInWishlist(customerId, productId) {
  try {
    const { data, error } = await supabase
      .from('shop_wishlist')
      .select('id')
      .eq('customer_id', customerId)
      .eq('product_id', productId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return !!data
  } catch (err) {
    console.error('Error checking wishlist:', err)
    return false
  }
}

export async function addProductReview(productId, customerId, reviewData) {
  try {
    const { data, error } = await supabase
      .from('shop_reviews')
      .insert([
        {
          product_id: productId,
          customer_id: customerId,
          title: reviewData.title,
          comment: reviewData.comment,
          rating: reviewData.rating,
          order_id: reviewData.order_id || null,
          verified_purchase: reviewData.verified_purchase || false
        }
      ])
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.error('Error adding review:', err)
    throw err
  }
}

export async function updateCustomerLoyaltyPoints(customerId, points) {
  try {
    const { data: customer, error: fetchError } = await supabase
      .from('shop_customers')
      .select('loyalty_points')
      .eq('id', customerId)
      .single()

    if (fetchError) throw fetchError

    const newPoints = Math.max(0, (customer?.loyalty_points || 0) + points)

    const { data, error } = await supabase
      .from('shop_customers')
      .update({ loyalty_points: newPoints })
      .eq('id', customerId)
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.error('Error updating loyalty points:', err)
    throw err
  }
}

export async function getCustomerStats(customerId) {
  try {
    return await executeWithRetry(async () => {
      const { data: orders, error: ordersError } = await supabase
        .from('shop_orders')
        .select('id,total_amount,created_at')
        .eq('customer_id', customerId)

      if (ordersError) throw ordersError

      const totalOrders = orders?.length || 0
      const totalSpent = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0

      const { data: customer, error: customerError } = await supabase
        .from('shop_customers')
        .select('loyalty_points,tier')
        .eq('id', customerId)
        .single()

      if (customerError) throw customerError

      return {
        totalOrders,
        totalSpent: Math.round(totalSpent * 100) / 100,
        loyaltyPoints: customer?.loyalty_points || 0,
        tier: customer?.tier || 'bronze',
        averageOrderValue: totalOrders > 0 ? Math.round((totalSpent / totalOrders) * 100) / 100 : 0
      }
    }, 3)
  } catch (err) {
    console.error('Error fetching customer stats:', err)
    throw err
  }
}
