import { supabase, executeWithRetry } from './supabaseClient'

export async function getProducts(filters = {}, page = 1, pageSize = 20) {
  try {
    return await executeWithRetry(async () => {
      let query = supabase
        .from('shop_products')
        .select('*,shop_product_images(id,image_url,alt_text,is_primary)', { count: 'exact' })
        .eq('is_active', true)

      if (filters.category_id) {
        query = query.eq('category_id', filters.category_id)
      }
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`)
      }
      if (filters.min_price) {
        query = query.gte('final_price', filters.min_price)
      }
      if (filters.max_price) {
        query = query.lte('final_price', filters.max_price)
      }
      if (filters.brand) {
        query = query.eq('brand', filters.brand)
      }
      if (filters.supplier_name) {
        query = query.eq('supplier_name', filters.supplier_name)
      }
      if (filters.origin_country) {
        query = query.eq('origin_country', filters.origin_country)
      }
      if (filters.warranty_months) {
        query = query.eq('warranty_months', filters.warranty_months)
      }
      if (filters.is_featured) {
        query = query.eq('is_featured', true)
      }
      if (filters.is_bestseller) {
        query = query.eq('is_bestseller', true)
      }

      const offset = (page - 1) * pageSize
      query = query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)

      const { data, error, count } = await query

      if (error) throw error

      return {
        products: data || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    }, 3)
  } catch (err) {
    console.error('Error fetching products:', err)
    throw err
  }
}

export async function getProductById(productId) {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_products')
        .select(`
          *,
          shop_product_images(id,image_url,alt_text,is_primary,position),
          shop_product_variants(id,name,option_name,option_value,price_adjustment,stock_quantity,is_active),
          shop_reviews(id,rating,comment,customer_id,created_at)
        `)
        .eq('id', productId)
        .eq('is_active', true)
        .single()

      if (error) throw error

      if (data) {
        await incrementProductViews(productId)
      }

      return data
    }, 3)
  } catch (err) {
    console.error('Error fetching product:', err)
    throw err
  }
}

export async function getProductsByCategory(categoryId, limit = 10) {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_products')
        .select('*,shop_product_images(image_url,is_primary)')
        .eq('category_id', categoryId)
        .eq('is_active', true)
        .limit(limit)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    }, 3)
  } catch (err) {
    console.error('Error fetching products by category:', err)
    throw err
  }
}

export async function getCategories() {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      if (error) throw error
      return data || []
    }, 3)
  } catch (err) {
    console.error('Error fetching categories:', err)
    throw err
  }
}

export async function searchProducts(query, limit = 20) {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_products')
        .select('*,shop_product_images(image_url,is_primary)')
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%,brand.ilike.%${query}%`)
        .limit(limit)

      if (error) throw error
      return data || []
    }, 3)
  } catch (err) {
    console.error('Error searching products:', err)
    throw err
  }
}

export async function getFeaturedProducts(limit = 8) {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_products')
        .select('*,shop_product_images(image_url,is_primary)')
        .eq('is_active', true)
        .eq('is_featured', true)
        .limit(limit)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    }, 3)
  } catch (err) {
    console.error('Error fetching featured products:', err)
    throw err
  }
}

export async function getBestsellersProducts(limit = 8) {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_products')
        .select('*,shop_product_images(image_url,is_primary)')
        .eq('is_active', true)
        .eq('is_bestseller', true)
        .order('sales_count', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    }, 3)
  } catch (err) {
    console.error('Error fetching bestsellers:', err)
    throw err
  }
}

export async function getProductVariants(productId) {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_product_variants')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('position', { ascending: true })

      if (error) throw error
      return data || []
    }, 3)
  } catch (err) {
    console.error('Error fetching product variants:', err)
    throw err
  }
}

export async function getProductImages(productId) {
  try {
    return await executeWithRetry(async () => {
      const { data, error } = await supabase
        .from('shop_product_images')
        .select('*')
        .eq('product_id', productId)
        .order('position', { ascending: true })

      if (error) throw error
      return data || []
    }, 3)
  } catch (err) {
    console.error('Error fetching product images:', err)
    throw err
  }
}

export async function getProductReviews(productId, page = 1, pageSize = 10) {
  try {
    return await executeWithRetry(async () => {
      const offset = (page - 1) * pageSize

      const { data, error, count } = await supabase
        .from('shop_reviews')
        .select('*,shop_customers(first_name,last_name)', { count: 'exact' })
        .eq('product_id', productId)
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (error) throw error

      return {
        reviews: data || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    }, 3)
  } catch (err) {
    console.error('Error fetching product reviews:', err)
    throw err
  }
}

export async function incrementProductViews(productId) {
  try {
    await supabase
      .from('shop_products')
      .update({ view_count: supabase.sql`view_count + 1` })
      .eq('id', productId)
  } catch (err) {
    console.debug('Error incrementing product views:', err)
  }
}

export async function checkProductStock(productId, quantity = 1) {
  try {
    const { data, error } = await supabase
      .from('shop_products')
      .select('total_stock,id')
      .eq('id', productId)
      .single()

    if (error) throw error
    return data.total_stock >= quantity
  } catch (err) {
    console.error('Error checking product stock:', err)
    return false
  }
}

export async function createProduct(productData) {
  try {
    const { data: userData } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('shop_products')
      .insert([
        {
          ...productData,
          created_by: userData.user?.id
        }
      ])
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (err) {
    console.error('Error creating product:', err)
    throw err
  }
}

export async function updateProduct(productId, updates) {
  try {
    const { data, error } = await supabase
      .from('shop_products')
      .update(updates)
      .eq('id', productId)
      .select()

    if (error) throw error
    return data?.[0] || null
  } catch (err) {
    console.error('Error updating product:', err)
    throw err
  }
}

export async function deleteProduct(productId) {
  try {
    const { error } = await supabase
      .from('shop_products')
      .update({ deleted_at: new Date() })
      .eq('id', productId)

    if (error) throw error
    return true
  } catch (err) {
    console.error('Error deleting product:', err)
    throw err
  }
}

export async function importProductFromAlibaba(alibabaUrl, alibabaData, categoryId) {
  try {
    const product = {
      sku: alibabaData.sku || `ALI-${Date.now()}`,
      name: alibabaData.name || alibabaData.title,
      description: alibabaData.description,
      long_description: alibabaData.longDescription,
      category_id: categoryId,
      brand: alibabaData.brand || 'Alibaba',
      base_price: alibabaData.price || 0,
      cost_price: alibabaData.costPrice,
      selling_price: alibabaData.sellingPrice,
      weight_kg: alibabaData.weight,
      total_stock: alibabaData.stock || 0,
      alibaba_url: alibabaUrl,
      alibaba_product_id: alibabaData.productId,
      alibaba_shop_name: alibabaData.shopName,
      alibaba_min_order: alibabaData.minOrder,
      alibaba_shipping_cost: alibabaData.shippingCost,
      slug: alibabaData.name?.toLowerCase().replace(/\s+/g, '-') || `product-${Date.now()}`,
      is_active: true
    }

    return await createProduct(product)
  } catch (err) {
    console.error('Error importing product from Alibaba:', err)
    throw err
  }
}
