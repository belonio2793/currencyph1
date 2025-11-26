import { supabase, executeWithRetry } from './supabaseClient'

export async function addToCart(customerId, productId, quantity = 1, variantId = null, sessionId = null) {
  try {
    const { data, error } = await supabase
      .from('shop_cart')
      .insert([
        {
          customer_id: customerId,
          session_id: sessionId,
          product_id: productId,
          variant_id: variantId,
          quantity,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      ])
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.error('Error adding to cart:', err)
    throw err
  }
}

export async function updateCartItem(cartItemId, quantity) {
  try {
    if (quantity <= 0) {
      return await removeFromCart(cartItemId)
    }

    const { data, error } = await supabase
      .from('shop_cart')
      .update({ quantity, updated_at: new Date() })
      .eq('id', cartItemId)
      .select()

    if (error) throw error
    return data?.[0]
  } catch (err) {
    console.error('Error updating cart item:', err)
    throw err
  }
}

export async function removeFromCart(cartItemId) {
  try {
    const { error } = await supabase
      .from('shop_cart')
      .delete()
      .eq('id', cartItemId)

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error removing from cart:', err)
    throw err
  }
}

export async function getCart(customerId, sessionId = null) {
  try {
    return await executeWithRetry(async () => {
      let query = supabase
        .from('shop_cart')
        .select(`
          id,quantity,product_id,variant_id,added_at,
          shop_products(id,name,sku,final_price,total_stock,shop_product_images(image_url,is_primary)),
          shop_product_variants(id,name,option_value,price_adjustment)
        `)
        .gt('expires_at', new Date().toISOString())

      if (customerId) {
        query = query.eq('customer_id', customerId)
      } else if (sessionId) {
        query = query.eq('session_id', sessionId)
      }

      const { data, error } = await query

      if (error) throw error

      const cartItems = (data || []).map(item => ({
        id: item.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        product: item.shop_products,
        variant: item.shop_product_variants,
        unitPrice: item.shop_products?.final_price || 0,
        totalPrice: (item.shop_products?.final_price || 0) * item.quantity
      }))

      return {
        items: cartItems,
        count: cartItems.length,
        subtotal: cartItems.reduce((sum, item) => sum + item.totalPrice, 0)
      }
    }, 3)
  } catch (err) {
    console.error('Error fetching cart:', err)
    throw err
  }
}

export async function clearCart(customerId, sessionId = null) {
  try {
    let query = supabase.from('shop_cart').delete()

    if (customerId) {
      query = query.eq('customer_id', customerId)
    } else if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    const { error } = await query

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error clearing cart:', err)
    throw err
  }
}

export async function getCartItemCount(customerId, sessionId = null) {
  try {
    return await executeWithRetry(async () => {
      let query = supabase
        .from('shop_cart')
        .select('quantity', { count: 'exact' })
        .gt('expires_at', new Date().toISOString())

      if (customerId) {
        query = query.eq('customer_id', customerId)
      } else if (sessionId) {
        query = query.eq('session_id', sessionId)
      }

      const { data, count, error } = await query

      if (error) throw error

      const totalQuantity = data?.reduce((sum, item) => sum + item.quantity, 0) || 0

      return {
        count: count || 0,
        totalQuantity
      }
    }, 3)
  } catch (err) {
    console.error('Error getting cart item count:', err)
    throw err
  }
}

export async function mergeCartSessions(oldSessionId, customerId) {
  try {
    const sessionCart = await getCart(null, oldSessionId)

    for (const item of sessionCart.items) {
      await addToCart(customerId, item.product_id, item.quantity, item.variant_id)
    }

    await clearCart(null, oldSessionId)

    return true
  } catch (err) {
    console.error('Error merging cart sessions:', err)
    throw err
  }
}

export async function validateCartItems(cartItems) {
  try {
    const validationResults = []

    for (const item of cartItems) {
      const { data, error } = await supabase
        .from('shop_products')
        .select('id,total_stock,final_price,is_active')
        .eq('id', item.product_id)
        .single()

      if (error || !data) {
        validationResults.push({
          product_id: item.product_id,
          valid: false,
          reason: 'Product not found or unavailable'
        })
      } else if (!data.is_active) {
        validationResults.push({
          product_id: item.product_id,
          valid: false,
          reason: 'Product is no longer available'
        })
      } else if (data.total_stock < item.quantity) {
        validationResults.push({
          product_id: item.product_id,
          valid: false,
          reason: `Only ${data.total_stock} items in stock`,
          availableQuantity: data.total_stock
        })
      } else {
        validationResults.push({
          product_id: item.product_id,
          valid: true,
          price: data.final_price
        })
      }
    }

    const allValid = validationResults.every(r => r.valid)

    return {
      valid: allValid,
      results: validationResults
    }
  } catch (err) {
    console.error('Error validating cart items:', err)
    throw err
  }
}
