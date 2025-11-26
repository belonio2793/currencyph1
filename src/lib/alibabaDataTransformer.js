/**
 * Transforms Alibaba product data into industrial_products table schema
 * Maps Alibaba API response fields to our database columns
 */

export class AlibabaDataTransformer {
  /**
   * Transform single Alibaba product to industrial_products format
   * @param {Object} alibabaProduct - Raw product from Alibaba API
   * @param {string} businessId - Business ID to assign product to
   * @param {string} sellerId - User ID of seller/admin
   * @param {Object} exchangeRate - Current exchange rate (PHP per USD)
   * @returns {Object} Product data formatted for industrial_products table
   */
  static transformProduct(alibabaProduct, businessId, sellerId, exchangeRate = 1) {
    const transformed = {
      // Core product info
      name: this.extractName(alibabaProduct),
      description: this.extractDescription(alibabaProduct),
      
      // Category mapping
      category: this.mapCategory(alibabaProduct),
      subcategory: this.mapSubcategory(alibabaProduct),
      
      // Pricing - Convert from USD to PHP
      price: this.calculatePhpPrice(alibabaProduct.price, exchangeRate),
      currency: 'PHP',
      unit_of_measurement: this.extractUnit(alibabaProduct),
      minimum_order_quantity: alibabaProduct.minimumOrder || 1,
      
      // Inventory
      stock_quantity: this.extractStockQuantity(alibabaProduct),
      stock_status: this.determineStockStatus(alibabaProduct),
      
      // Media
      image_urls: this.extractImageUrls(alibabaProduct),
      primary_image_url: this.extractPrimaryImage(alibabaProduct),
      video_url: alibabaProduct.videoUrl || null,
      
      // Location & Logistics
      origin_country: alibabaProduct.supplierLocation?.country || 'China',
      origin_city: alibabaProduct.supplierLocation?.city || null,
      shipping_available: true,
      delivery_time: this.extractDeliveryTime(alibabaProduct),
      delivery_cost: this.estimateDeliveryCost(alibabaProduct, exchangeRate),
      
      // Status & Visibility
      status: 'active',
      visibility: 'public',
      
      // Ratings
      rating: parseFloat(alibabaProduct.sellerRating) || null,
      review_count: alibabaProduct.reviewCount || 0,
      
      // Certifications
      certifications: this.extractCertifications(alibabaProduct),
      compliance_info: this.extractComplianceInfo(alibabaProduct),
      
      // Business terms
      moq_discount: null,
      bulk_pricing: this.extractBulkPricing(alibabaProduct),
      return_policy: this.extractReturnPolicy(alibabaProduct),
      warranty_info: this.extractWarrantyInfo(alibabaProduct),
      payment_terms: this.extractPaymentTerms(alibabaProduct),
      
      // Tags & metadata
      tags: this.extractTags(alibabaProduct),
      metadata: {
        alibaba_source: true,
        alibaba_product_id: alibabaProduct.id,
        alibaba_supplier_id: alibabaProduct.supplierId,
        supplier_name: alibabaProduct.supplierName,
        supplier_url: alibabaProduct.supplierUrl,
        original_price: alibabaProduct.price,
        original_currency: alibabaProduct.currency || 'USD',
        import_date: new Date().toISOString(),
        specifications: alibabaProduct.specifications || {}
      },
      
      // Assignment
      business_id: businessId,
      seller_id: sellerId
    }
    
    return transformed
  }

  /**
   * Extract product name
   */
  static extractName(product) {
    return product.productName || product.name || product.title || 'Untitled Product'
  }

  /**
   * Extract and clean description
   */
  static extractDescription(product) {
    let desc = product.productDescription || product.description || ''
    // Truncate to reasonable length for DB
    return desc.substring(0, 2000)
  }

  /**
   * Map Alibaba category to our categories
   */
  static mapCategory(product) {
    const alibabaCategory = (product.category || '').toLowerCase()
    
    const categoryMap = {
      'machinery': 'Machinery & Equipment',
      'equipment': 'Machinery & Equipment',
      'agricultural': 'Agricultural Equipment',
      'construction': 'Construction Equipment',
      'tools': 'Industrial Tools',
      'spare parts': 'Spare Parts & Components',
      'chemical': 'Industrial Chemicals',
      'textile': 'Textiles & Fabrics',
      'metal': 'Metals & Materials',
      'electrical': 'Electrical Equipment',
      'hydraulic': 'Hydraulics & Pneumatics',
      'pneumatic': 'Hydraulics & Pneumatics',
    }
    
    for (const [key, value] of Object.entries(categoryMap)) {
      if (alibabaCategory.includes(key)) {
        return value
      }
    }
    
    return 'Machinery & Equipment' // Default
  }

  /**
   * Map to subcategory
   */
  static mapSubcategory(product) {
    return product.subcategory || product.specifications?.type || null
  }

  /**
   * Calculate PHP price from USD
   */
  static calculatePhpPrice(usdPrice, exchangeRate = 56) {
    if (!usdPrice) return 0
    const phpPrice = parseFloat(usdPrice) * exchangeRate
    return Math.round(phpPrice * 100) / 100 // Round to 2 decimals
  }

  /**
   * Extract unit of measurement
   */
  static extractUnit(product) {
    return product.unit || product.specifications?.unit || 'Piece'
  }

  /**
   * Extract stock quantity
   */
  static extractStockQuantity(product) {
    const stock = parseInt(product.stock) || parseInt(product.quantity) || 0
    return Math.max(0, stock)
  }

  /**
   * Determine stock status based on quantity
   */
  static determineStockStatus(product) {
    const stock = this.extractStockQuantity(product)
    if (stock === 0) return 'out_of_stock'
    if (stock < 10) return 'low_stock'
    return 'in_stock'
  }

  /**
   * Extract image URLs
   */
  static extractImageUrls(product) {
    const images = []
    
    if (product.images && Array.isArray(product.images)) {
      images.push(...product.images.map(img => typeof img === 'string' ? img : img.url))
    }
    if (product.imageUrl) images.push(product.imageUrl)
    if (product.imageUrls && Array.isArray(product.imageUrls)) {
      images.push(...product.imageUrls)
    }
    
    // Filter out duplicates and invalid URLs
    return [...new Set(images)].filter(url => url && url.startsWith('http')).slice(0, 10)
  }

  /**
   * Get primary image
   */
  static extractPrimaryImage(product) {
    const images = this.extractImageUrls(product)
    return images.length > 0 ? images[0] : null
  }

  /**
   * Extract delivery time
   */
  static extractDeliveryTime(product) {
    if (product.deliveryTime) return product.deliveryTime
    if (product.shippingTime) return product.shippingTime
    return '15-30 days' // Default for Alibaba
  }

  /**
   * Estimate delivery cost (rough estimate for international shipping)
   */
  static estimateDeliveryCost(product, exchangeRate = 56) {
    // Alibaba products typically have shipping cost in product details
    if (product.shippingCost) {
      return this.calculatePhpPrice(product.shippingCost, exchangeRate)
    }
    
    // Estimate based on weight/volume
    const weight = parseFloat(product.weight) || 0
    const estimatedCost = Math.max(500, weight * 100) // PHP
    return Math.round(estimatedCost * 100) / 100
  }

  /**
   * Extract certifications
   */
  static extractCertifications(product) {
    const certs = []
    
    if (product.certifications) {
      if (Array.isArray(product.certifications)) {
        certs.push(...product.certifications)
      } else if (typeof product.certifications === 'string') {
        certs.push(product.certifications)
      }
    }
    
    // Check common certification fields
    if (product.iso) certs.push('ISO: ' + product.iso)
    if (product.ce) certs.push('CE')
    if (product.fcc) certs.push('FCC')
    if (product.rohs) certs.push('RoHS')
    
    return certs
  }

  /**
   * Extract compliance info
   */
  static extractComplianceInfo(product) {
    return {
      country_of_origin: product.supplierLocation?.country || 'China',
      harmonized_tariff_code: product.hsCode || null,
      quality_assurance: product.qualityAssurance || null,
      testing_reports: product.testingReports || null
    }
  }

  /**
   * Extract bulk pricing info
   */
  static extractBulkPricing(product) {
    const bulkPricing = {}
    
    if (product.bulkPricing && Array.isArray(product.bulkPricing)) {
      product.bulkPricing.forEach(tier => {
        bulkPricing[`${tier.minQuantity}-${tier.maxQuantity || ''}`] = tier.price
      })
    }
    
    return Object.keys(bulkPricing).length > 0 ? bulkPricing : null
  }

  /**
   * Extract return policy
   */
  static extractReturnPolicy(product) {
    return product.returnPolicy || 'Supplier return policy applies'
  }

  /**
   * Extract warranty info
   */
  static extractWarrantyInfo(product) {
    if (product.warranty) {
      return typeof product.warranty === 'string' 
        ? product.warranty 
        : `${product.warranty.duration} ${product.warranty.unit}`
    }
    return null
  }

  /**
   * Extract payment terms
   */
  static extractPaymentTerms(product) {
    const terms = []
    
    if (product.paymentMethods) {
      if (Array.isArray(product.paymentMethods)) {
        terms.push(...product.paymentMethods)
      } else {
        terms.push(product.paymentMethods)
      }
    }
    
    if (product.paymentTerms) {
      terms.push(product.paymentTerms)
    }
    
    return terms.length > 0 ? terms.join(', ') : 'Alibaba Trade Assurance'
  }

  /**
   * Extract tags for search/filtering
   */
  static extractTags(product) {
    const tags = []
    
    if (product.tags && Array.isArray(product.tags)) {
      tags.push(...product.tags)
    }
    
    // Add automatic tags
    if (product.isTradeSafe) tags.push('trade-assured')
    if (product.isGoldSupplier) tags.push('gold-supplier')
    if (product.sellerRating && parseFloat(product.sellerRating) >= 4.5) tags.push('highly-rated')
    
    // Add location tag
    if (product.supplierLocation?.city) {
      tags.push(product.supplierLocation.city.toLowerCase())
    }
    
    return [...new Set(tags)].slice(0, 20) // Limit to 20 tags
  }

  /**
   * Create alibaba_product_mapping record
   */
  static createMappingRecord(industrialProductId, alibabaProduct, syncLogId) {
    return {
      industrial_product_id: industrialProductId,
      alibaba_product_id: alibabaProduct.id,
      alibaba_supplier_id: alibabaProduct.supplierId,
      supplier_name: alibabaProduct.supplierName,
      supplier_url: alibabaProduct.supplierUrl,
      original_price: alibabaProduct.price,
      original_currency: alibabaProduct.currency || 'USD',
      sync_log_id: syncLogId,
      alibaba_raw_data: alibabaProduct
    }
  }

  /**
   * Batch transform products
   */
  static transformBatch(alibabaProducts, businessId, sellerId, exchangeRate) {
    return alibabaProducts.map(product => 
      this.transformProduct(product, businessId, sellerId, exchangeRate)
    )
  }
}
