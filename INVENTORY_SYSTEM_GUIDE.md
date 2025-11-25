# User Inventory Management System - Complete Guide

## Overview

The Inventory Management System provides sellers with a comprehensive tool to manage their product listings, pricing, stock levels, and public marketplace display. This system is built on the `industrial_products` database schema and integrates seamlessly with the Business Marketplace.

## Features

### 1. **Dashboard Overview**
- Real-time inventory statistics (total products, active products, stock levels, inventory value)
- Quick status indicators (low stock alerts, product visibility)
- Search and filter capabilities
- Mobile-responsive design

### 2. **Product Management (CRUD)**

#### **Create Products**
- Add new products with comprehensive details:
  - Basic Information: Name, Description, Category, Subcategory
  - Pricing: Price (PHP), Unit of Measurement, MOQ (Minimum Order Quantity)
  - Stock Management: Stock Quantity, Stock Status
  - Shipping: Availability, Delivery Time, Delivery Cost
  - Policies: Return Policy, Warranty Info, Payment Terms
  - Media: Primary Image URL, Additional Images
  - Metadata: Tags, Status, Visibility

#### **Read Products**
- View all seller's products in a table format
- Display detailed information including:
  - Product name and category
  - Price and unit information
  - Stock quantity and MOQ
  - Status and visibility
  - Created/updated timestamps

#### **Update Products**
- Edit any product field
- Modify pricing in real-time
- Update stock quantities
- Change visibility and status
- Modify shipping details and policies

#### **Delete Products**
- Permanently remove products
- Confirmation dialog to prevent accidental deletion
- Cascade delete (removes associated orders, reviews, favorites)

### 3. **Pricing Controls**
- Set product price in PHP
- Define minimum order quantities with optional discounts
- Configure bulk pricing
- Set delivery costs
- Track total inventory value

### 4. **Stock Management**
- Real-time stock quantity tracking
- Low stock alerts (items with 5 or fewer units)
- Out-of-stock status management
- Stock status indicator (in_stock, low_stock, out_of_stock)

### 5. **Public Display & Marketplace**
- Control product visibility:
  - **Public**: Visible to all marketplace users
  - **Private**: Visible only to you
  - **Wholesale Only**: Visible to wholesale buyers only
- Activate/deactivate products
- Manage product status (active, inactive, discontinued)
- Rich product descriptions and specifications

### 6. **Advanced Features**
- Product categorization (10 categories)
- Tag-based organization
- Image gallery support
- Certification tracking
- Compliance information
- Customer reviews and ratings
- Inquiry management
- Order tracking

## Database Schema

### Main Table: `industrial_products`

```sql
CREATE TABLE public.industrial_products (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  
  -- Product Information
  name VARCHAR(255) NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  
  -- Specifications
  specifications JSONB,
  features JSONB,
  attributes JSONB,
  
  -- Pricing
  price DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  unit_of_measurement VARCHAR(50),
  minimum_order_quantity INTEGER DEFAULT 1,
  moq_discount DECIMAL(5, 2),
  bulk_pricing JSONB,
  
  -- Inventory
  stock_quantity INTEGER DEFAULT 0,
  stock_status VARCHAR(50) DEFAULT 'in_stock',
  
  -- Media
  image_urls TEXT[],
  primary_image_url TEXT,
  video_url TEXT,
  
  -- Shipping
  shipping_available BOOLEAN DEFAULT true,
  delivery_time VARCHAR(100),
  delivery_cost DECIMAL(12, 2),
  origin_country VARCHAR(100),
  origin_city VARCHAR(100),
  
  -- Status & Visibility
  status VARCHAR(50) DEFAULT 'active',
  visibility VARCHAR(50) DEFAULT 'public',
  
  -- Business Terms
  return_policy TEXT,
  warranty_info TEXT,
  payment_terms TEXT,
  
  -- Ratings
  rating DECIMAL(3, 2),
  review_count INTEGER DEFAULT 0,
  
  -- Metadata
  tags TEXT[],
  certifications JSONB,
  compliance_info JSONB,
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_modified_by uuid
)
```

### Related Tables

- `industrial_product_reviews`: Customer reviews and ratings
- `industrial_product_inquiries`: Buyer inquiries about products
- `industrial_product_orders`: Order management
- `industrial_product_favorites`: User favorites/bookmarks

## Components

### Main Component: `InventoryDashboard.jsx`

Located at: `src/components/InventoryDashboard.jsx`

**Features:**
- Statistics dashboard with 6 key metrics
- Add product form with full validation
- Edit product functionality
- Delete confirmation
- Product search and filtering
- Status and visibility management
- Mobile-responsive design

**Props:**
```javascript
<InventoryDashboard
  userId={string}          // Current user ID
  businessId={string}      // Associated business ID
  setActiveTab={function}  // Navigation callback
/>
```

**Key Features:**
- Real-time form validation
- Error handling and user feedback
- Bulk status management
- Comprehensive filtering
- Responsive layout

### Utility Service: `inventoryService.js`

Located at: `src/lib/inventoryService.js`

**Available Functions:**

#### Product CRUD Operations
```javascript
// Fetch all products for a seller
fetchSellerProducts(userId)

// Fetch a single product
fetchProductById(productId)

// Create a new product
createProduct(productData, userId, businessId)

// Update a product
updateProduct(productId, productData, userId)

// Delete a product
deleteProduct(productId, userId)
```

#### Stock & Pricing Management
```javascript
// Update stock quantity
updateProductStock(productId, stockQuantity, userId)

// Update price
updateProductPrice(productId, price, userId)

// Bulk update stock
bulkUpdateStock(updates, userId)
```

#### Status Management
```javascript
// Update visibility (public, private, wholesale_only)
updateProductVisibility(productId, visibility, userId)

// Update status (active, inactive, discontinued)
updateProductStatus(productId, status, userId)
```

#### Analytics & Filtering
```javascript
// Calculate inventory statistics
calculateInventoryStats(products)

// Get products by category
getProductsByCategory(products, category)

// Search products
searchProducts(products, query)

// Filter products with multiple criteria
filterProducts(products, filters)

// Sort products
sortProducts(products, sortBy)
```

#### Marketplace Operations
```javascript
// Fetch public products for marketplace
fetchPublicProducts(filters)

// Fetch seller information
fetchSellerInfo(businessId)

// Fetch product reviews
fetchProductReviews(productId)

// Create product review
createProductReview(reviewData)
```

#### Favorites Management
```javascript
// Check if product is favorited
checkIfFavorited(userId, productId)

// Toggle favorite status
toggleProductFavorite(userId, productId, isFavorited)

// Fetch user's favorite products
fetchFavoriteProducts(userId)
```

#### Data Export
```javascript
// Export inventory data (CSV or JSON)
exportInventoryData(products, format)

// Download inventory export
downloadInventoryExport(products, format, filename)
```

## Navigation

### Adding Inventory to Your Navigation

The Inventory tab is automatically added to the main navigation when a user is authenticated.

**Tab ID:** `inventory`

**Access via:**
```javascript
// In any component
<button onClick={() => onTabChange('inventory')}>
  Inventory
</button>
```

## Styling

### CSS Classes

The system includes comprehensive styling in `src/components/InventoryDashboard.css`:

- `.inventory-dashboard` - Main container
- `.inventory-header` - Header section
- `.inventory-stats` - Statistics cards grid
- `.stat-card` - Individual stat card
- `.product-form` - Form styling
- `.products-list` - Product table
- `.product-row` - Table row styling
- `.alert` - Alert messages
- `.btn-*` - Button variants

### Responsive Design

The system is fully responsive:
- **Desktop**: Full table view with all columns
- **Tablet**: Optimized grid layout
- **Mobile**: Stacked card view with touch-friendly buttons

## SQL Integration

### Row Level Security (RLS) Policies

The `industrial_products` table has RLS policies:

1. **Public Read**: Anyone can read active, public products
2. **Seller Read**: Sellers can read their own products
3. **Seller Insert**: Sellers can insert products for their business
4. **Seller Update**: Sellers can update their own products
5. **Seller Delete**: Sellers can delete their own products

### Indexes for Performance

Optimized indexes on:
- `business_id` - Fast lookup by business
- `seller_id` - Fast lookup by seller
- `category` - Category filtering
- `status` - Status filtering
- `created_at` - Sorting by date
- `rating` - Rating-based sorting

## Usage Examples

### Example 1: Adding a Product

```javascript
import { createProduct } from '../lib/inventoryService'

const handleAddProduct = async () => {
  const productData = {
    name: 'Industrial Conveyor Belt',
    description: 'Heavy-duty conveyor belt for manufacturing',
    category: 'machinery',
    price: 5000,
    stock_quantity: 10,
    minimum_order_quantity: 1,
    primary_image_url: 'https://example.com/image.jpg',
    status: 'active',
    visibility: 'public',
  }

  const { data, error } = await createProduct(
    productData,
    userId,
    businessId
  )

  if (error) {
    console.error('Failed to create product:', error)
  } else {
    console.log('Product created:', data)
  }
}
```

### Example 2: Updating Stock

```javascript
import { updateProductStock } from '../lib/inventoryService'

const handleUpdateStock = async (productId, newQuantity) => {
  const { data, error } = await updateProductStock(
    productId,
    newQuantity,
    userId
  )

  if (error) {
    console.error('Failed to update stock:', error)
  } else {
    console.log('Stock updated:', data.stock_quantity)
  }
}
```

### Example 3: Searching Products

```javascript
import { searchProducts } from '../lib/inventoryService'

const results = searchProducts(products, 'conveyor')
// Returns products matching 'conveyor' in name/description
```

### Example 4: Calculating Statistics

```javascript
import { calculateInventoryStats } from '../lib/inventoryService'

const stats = calculateInventoryStats(products)
console.log(`Total inventory value: ₱${stats.totalValue}`)
console.log(`Low stock items: ${stats.lowStockProducts}`)
```

## Best Practices

1. **Always Validate Input**: Use form validation before submitting
2. **Handle Errors Gracefully**: Show user-friendly error messages
3. **Optimize Queries**: Use filters to reduce data transfer
4. **Track Stock Carefully**: Regularly review low stock alerts
5. **Update Regularly**: Keep product information current
6. **Use Categories**: Organize products by category for easy management
7. **Set Visibility Correctly**: Control who can see each product
8. **Maintain Images**: Use high-quality product images
9. **Document Policies**: Clearly state return and warranty policies
10. **Monitor Reviews**: Respond to customer feedback

## Troubleshooting

### Product Not Appearing in Marketplace

**Checklist:**
- Product status is "active"
- Product visibility is "public"
- Product is associated with a business
- Product price is set to a valid number

### Stock Updates Not Working

**Check:**
- User is logged in as product owner
- Stock quantity is a valid integer
- No other process is updating simultaneously

### Slow Performance

**Optimize:**
- Limit search results
- Use filters to reduce data
- Optimize images before uploading
- Archive old/discontinued products

## Support & Maintenance

### Database Maintenance

Regular maintenance tasks:
- Archive discontinued products
- Remove duplicate products
- Update product ratings
- Clean up broken image links

### Updates & Changes

The inventory system integrates with:
- Business Marketplace for public display
- Review system for customer feedback
- Wallet system for payments
- Order management system

## Future Enhancements

Planned features:
- Bulk import from CSV
- Advanced analytics dashboard
- Price history tracking
- Inventory forecasting
- Multi-location stock management
- Barcode integration
- Automatic reorder points
- Supplier management
- Real-time stock sync

## Security

### Data Protection

- RLS policies enforce seller ownership
- All operations logged with timestamps
- Price and stock changes are audited
- User authentication required for modifications

### Best Practices

- Never share API keys
- Use HTTPS for all connections
- Validate all user inputs
- Regularly backup data
- Monitor for suspicious activity

---

**Version:** 1.0.0  
**Last Updated:** 2024  
**Maintained By:** Currency.PH Development Team
