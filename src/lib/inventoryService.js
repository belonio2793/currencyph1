import { supabase } from './supabaseClient'

// Fetch all products for a seller
export const fetchSellerProducts = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('industrial_products')
      .select('*')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    console.error('Error fetching seller products:', err)
    return { data: null, error: err.message }
  }
}

// Fetch a single product by ID
export const fetchProductById = async (productId) => {
  try {
    const { data, error } = await supabase
      .from('industrial_products')
      .select('*')
      .eq('id', productId)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    console.error('Error fetching product:', err)
    return { data: null, error: err.message }
  }
}

// Create a new product
export const createProduct = async (productData, userId, businessId) => {
  try {
    const dataToInsert = {
      ...productData,
      seller_id: userId,
      business_id: businessId,
      price: parseFloat(productData.price),
      stock_quantity: parseInt(productData.stock_quantity) || 0,
      minimum_order_quantity: parseInt(productData.minimum_order_quantity) || 1,
      delivery_cost: productData.delivery_cost ? parseFloat(productData.delivery_cost) : null,
    }

    const { data, error } = await supabase
      .from('industrial_products')
      .insert([dataToInsert])
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (err) {
    console.error('Error creating product:', err)
    return { data: null, error: err.message }
  }
}

// Update an existing product
export const updateProduct = async (productId, productData, userId) => {
  try {
    const dataToUpdate = {
      ...productData,
      price: parseFloat(productData.price),
      stock_quantity: parseInt(productData.stock_quantity) || 0,
      minimum_order_quantity: parseInt(productData.minimum_order_quantity) || 1,
      delivery_cost: productData.delivery_cost ? parseFloat(productData.delivery_cost) : null,
    }

    const { data, error } = await supabase
      .from('industrial_products')
      .update(dataToUpdate)
      .eq('id', productId)
      .eq('seller_id', userId)
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (err) {
    console.error('Error updating product:', err)
    return { data: null, error: err.message }
  }
}

// Delete a product
export const deleteProduct = async (productId, userId) => {
  try {
    const { error } = await supabase
      .from('industrial_products')
      .delete()
      .eq('id', productId)
      .eq('seller_id', userId)

    if (error) throw error
    return { error: null }
  } catch (err) {
    console.error('Error deleting product:', err)
    return { error: err.message }
  }
}

// Update product stock
export const updateProductStock = async (productId, stockQuantity, userId) => {
  try {
    const { data, error } = await supabase
      .from('industrial_products')
      .update({ stock_quantity: parseInt(stockQuantity) || 0 })
      .eq('id', productId)
      .eq('seller_id', userId)
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (err) {
    console.error('Error updating product stock:', err)
    return { data: null, error: err.message }
  }
}

// Update product price
export const updateProductPrice = async (productId, price, userId) => {
  try {
    const { data, error } = await supabase
      .from('industrial_products')
      .update({ price: parseFloat(price) })
      .eq('id', productId)
      .eq('seller_id', userId)
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (err) {
    console.error('Error updating product price:', err)
    return { data: null, error: err.message }
  }
}

// Update product visibility
export const updateProductVisibility = async (productId, visibility, userId) => {
  try {
    const { data, error } = await supabase
      .from('industrial_products')
      .update({ visibility })
      .eq('id', productId)
      .eq('seller_id', userId)
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (err) {
    console.error('Error updating product visibility:', err)
    return { data: null, error: err.message }
  }
}

// Update product status
export const updateProductStatus = async (productId, status, userId) => {
  try {
    const { data, error } = await supabase
      .from('industrial_products')
      .update({ status })
      .eq('id', productId)
      .eq('seller_id', userId)
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (err) {
    console.error('Error updating product status:', err)
    return { data: null, error: err.message }
  }
}

// Calculate inventory statistics
export const calculateInventoryStats = (products) => {
  return {
    totalProducts: products.length,
    activeProducts: products.filter(p => p.status === 'active').length,
    inactiveProducts: products.filter(p => p.status === 'inactive').length,
    discontinuedProducts: products.filter(p => p.status === 'discontinued').length,
    publicProducts: products.filter(p => p.visibility === 'public').length,
    privateProducts: products.filter(p => p.visibility === 'private').length,
    wholesaleOnlyProducts: products.filter(p => p.visibility === 'wholesale_only').length,
    totalValue: products.reduce((sum, p) => sum + (p.price * p.stock_quantity), 0),
    totalStock: products.reduce((sum, p) => sum + p.stock_quantity, 0),
    lowStockProducts: products.filter(p => p.stock_quantity <= 5).length,
    outOfStockProducts: products.filter(p => p.stock_quantity === 0).length,
    averagePrice: products.length > 0 ? products.reduce((sum, p) => sum + p.price, 0) / products.length : 0,
  }
}

// Get products by category
export const getProductsByCategory = (products, category) => {
  return products.filter(p => p.category === category)
}

// Search products
export const searchProducts = (products, query) => {
  const lowerQuery = query.toLowerCase()
  return products.filter(p =>
    p.name.toLowerCase().includes(lowerQuery) ||
    p.description?.toLowerCase().includes(lowerQuery) ||
    p.category.toLowerCase().includes(lowerQuery) ||
    p.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
  )
}

// Filter products by multiple criteria
export const filterProducts = (products, filters = {}) => {
  let filtered = [...products]

  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter(p => p.status === filters.status)
  }

  if (filters.visibility && filters.visibility !== 'all') {
    filtered = filtered.filter(p => p.visibility === filters.visibility)
  }

  if (filters.category && filters.category !== 'all') {
    filtered = filtered.filter(p => p.category === filters.category)
  }

  if (filters.minPrice !== undefined) {
    filtered = filtered.filter(p => p.price >= filters.minPrice)
  }

  if (filters.maxPrice !== undefined) {
    filtered = filtered.filter(p => p.price <= filters.maxPrice)
  }

  if (filters.minStock !== undefined) {
    filtered = filtered.filter(p => p.stock_quantity >= filters.minStock)
  }

  if (filters.maxStock !== undefined) {
    filtered = filtered.filter(p => p.stock_quantity <= filters.maxStock)
  }

  if (filters.search) {
    filtered = searchProducts(filtered, filters.search)
  }

  return filtered
}

// Sort products
export const sortProducts = (products, sortBy = 'newest') => {
  const sorted = [...products]

  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    case 'price_low':
      return sorted.sort((a, b) => a.price - b.price)
    case 'price_high':
      return sorted.sort((a, b) => b.price - a.price)
    case 'name_asc':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'name_desc':
      return sorted.sort((a, b) => b.name.localeCompare(a.name))
    case 'stock_low':
      return sorted.sort((a, b) => a.stock_quantity - b.stock_quantity)
    case 'stock_high':
      return sorted.sort((a, b) => b.stock_quantity - a.stock_quantity)
    case 'value':
      return sorted.sort((a, b) => (b.price * b.stock_quantity) - (a.price * a.stock_quantity))
    default:
      return sorted
  }
}

// Fetch public products for marketplace
export const fetchPublicProducts = async (filters = {}) => {
  try {
    let query = supabase
      .from('industrial_products')
      .select('id, name, slug, price, currency, category, primary_image_url, rating, review_count, stock_status, seller_id, business_id, created_at', { count: 'exact' })
      .eq('status', 'active')
      .eq('visibility', 'public')

    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category)
    }

    if (filters.search) {
      query = query.ilike('name', `%${filters.search}%`)
    }

    if (filters.minPrice !== undefined) {
      query = query.gte('price', filters.minPrice)
    }

    if (filters.maxPrice !== undefined) {
      query = query.lte('price', filters.maxPrice)
    }

    if (filters.sortBy === 'price_low') {
      query = query.order('price', { ascending: true })
    } else if (filters.sortBy === 'price_high') {
      query = query.order('price', { ascending: false })
    } else if (filters.sortBy === 'rating') {
      query = query.order('rating', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    if (filters.limit) {
      query = query.limit(filters.limit)
    }

    const { data, count, error } = await query

    if (error) throw error
    return { data, count, error: null }
  } catch (err) {
    console.error('Error fetching public products:', err)
    return { data: null, count: 0, error: err.message }
  }
}

// Get seller info for a product
export const fetchSellerInfo = async (businessId) => {
  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('business_name, rating, location')
      .eq('id', businessId)
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    console.error('Error fetching seller info:', err)
    return { data: null, error: err.message }
  }
}

// Get product reviews
export const fetchProductReviews = async (productId) => {
  try {
    const { data, error } = await supabase
      .from('industrial_product_reviews')
      .select('*')
      .eq('product_id', productId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (err) {
    console.error('Error fetching product reviews:', err)
    return { data: null, error: err.message }
  }
}

// Create a product review
export const createProductReview = async (reviewData) => {
  try {
    const { data, error } = await supabase
      .from('industrial_product_reviews')
      .insert([reviewData])
      .select()

    if (error) throw error
    return { data: data?.[0], error: null }
  } catch (err) {
    console.error('Error creating review:', err)
    return { data: null, error: err.message }
  }
}

// Check if user has favorited a product
export const checkIfFavorited = async (userId, productId) => {
  try {
    const { data, error } = await supabase
      .from('industrial_product_favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return { favorited: !!data, error: null }
  } catch (err) {
    console.error('Error checking favorite status:', err)
    return { favorited: false, error: err.message }
  }
}

// Toggle product favorite
export const toggleProductFavorite = async (userId, productId, isFavorited) => {
  try {
    if (isFavorited) {
      const { error } = await supabase
        .from('industrial_product_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId)

      if (error) throw error
      return { favorited: false, error: null }
    } else {
      const { data, error } = await supabase
        .from('industrial_product_favorites')
        .insert([{ user_id: userId, product_id: productId }])
        .select()

      if (error) throw error
      return { favorited: true, error: null }
    }
  } catch (err) {
    console.error('Error toggling favorite:', err)
    return { favorited: isFavorited, error: err.message }
  }
}

// Fetch user's favorite products
export const fetchFavoriteProducts = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('industrial_product_favorites')
      .select('product_id')
      .eq('user_id', userId)

    if (error) throw error
    return { productIds: data?.map(f => f.product_id) || [], error: null }
  } catch (err) {
    console.error('Error fetching favorites:', err)
    return { productIds: [], error: err.message }
  }
}

// Bulk update stock for multiple products
export const bulkUpdateStock = async (updates, userId) => {
  try {
    const promises = updates.map(({ productId, quantity }) =>
      updateProductStock(productId, quantity, userId)
    )
    const results = await Promise.all(promises)
    const errors = results.filter(r => r.error)
    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors.map(e => e.error) : [],
      error: errors.length > 0 ? 'Some updates failed' : null
    }
  } catch (err) {
    console.error('Error bulk updating stock:', err)
    return { success: false, errors: [err.message], error: err.message }
  }
}

// Export inventory data
export const exportInventoryData = (products, format = 'csv') => {
  if (format === 'csv') {
    const headers = ['Product Name', 'Category', 'Price', 'Stock', 'Status', 'Visibility', 'Total Value']
    const rows = products.map(p => [
      p.name,
      p.category,
      p.price,
      p.stock_quantity,
      p.status,
      p.visibility,
      (p.price * p.stock_quantity).toFixed(2)
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    return csv
  } else if (format === 'json') {
    return JSON.stringify(products, null, 2)
  }
}

// Download inventory export
export const downloadInventoryExport = (products, format = 'csv', filename = 'inventory') => {
  const content = exportInventoryData(products, format)
  const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.${format === 'csv' ? 'csv' : 'json'}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
