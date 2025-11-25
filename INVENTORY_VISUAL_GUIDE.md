# Inventory Management System - Visual Guide

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────���───────┐   │
│  │      InventoryDashboard.jsx                     │   │
│  │  - Statistics Dashboard (6 metrics)             │   │
│  │  - Add/Edit Product Form                        │   │
│  │  - Product List with Filters                    │   │
│  │  - Delete Confirmation                          │   │
│  └────────────┬────────────────────────────────────┘   │
│               │                                          │
│  ┌────────────▼────────────────────────────────────┐   │
│  │    AdvancedInventoryFeatures.jsx                │   │
│  │  - Analytics Dashboard                          │   │
│  │  - Bulk Operations Panel                        │   │
│  │  - Export Functionality                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────��───────────────────────────────────┘
                          │
┌─────────────────────────▼──────────────────────────────┐
│                 SERVICE LAYER                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│      inventoryService.js (30+ utility functions)       │
│                                                          │
│  ✓ CRUD Operations    ✓ Stock Management               │
│  ✓ Price Management   ✓ Status Controls                │
│  ✓ Search & Filter    ✓ Analytics                      │
│  ✓ Bulk Operations    ✓ Export Functions               │
│                                                          │
└─────────────────────────▼──────────────────────────────┘
                          │
┌─────────────���───────────▼──────────────────────────────┐
│               DATABASE LAYER                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────┐      │
│  │  industrial_products Table                   │      │
│  │  ├─ Product Info (name, category, etc.)     │      │
│  │  ├─ Pricing (price, MOQ, delivery cost)     │      │
│  │  ├─ Inventory (stock_quantity, status)      │      │
│  │  ├─ Visibility (status, visibility)         │      │
│  │  ├─ Media (images, video)                   │      │
│  │  └─ Metadata (tags, certs, policies)        │      │
│  └──────────────────────────────────────────────┘      │
│                                                          │
│  Related Tables:                                       │
│  ├─ industrial_product_reviews                       │
│  ├─ industrial_product_inquiries                     │
│  ├─ industrial_product_orders                        │
│  └─ industrial_product_favorites                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 📱 User Flow Diagram

```
LOGIN
  │
  └─▶ HOMEPAGE
        │
        └─▶ CLICK "INVENTORY" (in navbar)
              │
              ├─▶ VIEW DASHBOARD
              │    ├─ See statistics
              │    ├─ Monitor low stock alerts
              │    └─ View all products
              │
              ├─▶ ADD PRODUCT
              │    ├─ Fill form
              │    ├─ Validate input
              │    └─ Save to database
              │
              ├─▶ EDIT PRODUCT
              │    ├─ Select product
              │    ├─ Modify details
              │    └─ Update database
              │
              ├─▶ DELETE PRODUCT
              │    ├─ Select product
              │    ├─ Confirm deletion
              │    └─ Remove from database
              │
              ├─▶ SEARCH/FILTER
              │    ├─ Search by name
              │    ├─ Filter by status
              │    └─ Filter by visibility
              │
              ├─▶ ADVANCED FEATURES
              │    ├─ View Analytics
              │    │  ├─ Products overview
              │    │  ├─ Visibility breakdown
              │    │  ├─ Stock analysis
              │    │  └─ Financial summary
              │    │
              │    ├─ Bulk Operations
              │    │  ├─ Select multiple products
              │    │  ├─ Update stock in bulk
              │    │  └─ Apply percentage changes
              │    │
              │    └─ Export Data
              │       ├─ Choose format (CSV/JSON)
              │       └─ Download file
              │
              └─▶ VIEW IN MARKETPLACE
                   ├─ Search public products
                   ├─ See your listings
                   ├─ View pricing
                   └─ Check stock status
```

## 🎨 UI Component Hierarchy

```
InventoryDashboard
├── Header
│   ├── Title & Description
│   └── Add Product Button
│
├── Statistics Cards (6 metrics)
│   ├── Total Products
│   ├── Active Products
│   ├── Public Products
│   ├── Inventory Value
│   ├── Total Stock
│   └── Low Stock Alert
│
├── Add/Edit Form (conditional)
│   ├── Basic Information Section
│   │   ├── Product Name (required)
│   │   ├── Description
│   │   ├── Category (required)
│   │   └── Subcategory
│   │
│   ├── Pricing & Stock Section
│   │   ├── Price (required)
│   │   ├── Unit of Measurement
│   │   ├── Stock Quantity
│   │   └── Minimum Order Quantity
│   │
│   ├── Shipping & Delivery Section
│   │   ├── Shipping Available (toggle)
│   │   ├── Delivery Time
│   │   └── Delivery Cost
│   │
│   ├── Additional Information Section
│   │   ├── Warranty Info
│   │   ├── Payment Terms
│   │   ├── Primary Image URL
│   │   └── Tags Input
│   │
│   ├── Status & Visibility Section
│   │   ├── Status (active/inactive/discontinued)
│   │   └── Visibility (public/private/wholesale)
│   │
│   └── Form Actions
│       ├── Submit Button
│       └── Cancel Button
│
├── Alert Messages (conditional)
│   └── Error/Success Display
│
├── Search & Filter Controls
│   ├── Search Input
│   ├── Status Filter
│   └── Visibility Filter
│
├── Products List/Table
│   ├── Product Image
│   ├── Product Info (name, category)
│   ├── Pricing
│   ├── Stock Status
│   ├── Status & Visibility Badges
│   └── Action Buttons (Edit, Delete)
│
└── Advanced Features
    ├── Analytics Tab
    │   ├── Products Overview Card
    │   ├── Visibility Overview Card
    │   ├── Stock Overview Card
    │   ├── Financial Overview Card
    │   ├── Category Breakdown
    │   └── Low/Out-of-Stock Alerts
    │
    ├── Bulk Operations Tab
    │   ├── Product Selection Grid
    │   ├── Select All Checkbox
    │   ├── Stock Update Form
    │   ├── Percentage Toggle
    │   └── Submit Button
    │
    └── Export Tab
        ├── Export Info
        ├── CSV Export Button
        ├── JSON Export Button
        ├── Preview Table
        └── Format Selection
```

## 🔄 Data Flow Diagram

```
USER ACTION (e.g., Click "Add Product")
    │
    ▼
COMPONENT EVENT HANDLER
    │ (e.g., handleAddProduct)
    ▼
FORM VALIDATION
    │ ├─ Check required fields
    │ ├─ Validate data types
    │ └─ Show error messages
    │
    ▼ (if valid)
CALL UTILITY FUNCTION
    │ (e.g., createProduct from inventoryService.js)
    ▼
SUPABASE API CALL
    │
    ├─ INSERT INTO industrial_products
    │
    ▼
DATABASE RESPONSE
    │
    ├─ Success: Return new product ID
    ├─ Error: Return error message
    │
    ▼
UPDATE COMPONENT STATE
    │
    ├─ Add to products array
    ├─ Show success message
    ├─ Clear form
    ├─ Reset error state
    │
    ▼
RE-RENDER COMPONENT
    │
    └─ User sees updated product list
       with new product visible
```

## 📊 Statistics Calculation Flow

```
Load Products from Database
    │
    ├─▶ calculateInventoryStats(products)
    │    │
    │    ├─▶ totalProducts = count(products)
    │    │
    │    ├─▶ activeProducts = count(status='active')
    │    │
    │    ├─▶ publicProducts = count(visibility='public')
    │    │
    │    ├─▶ totalValue = sum(price × stock_quantity)
    │    │
    │    ├─▶ totalStock = sum(stock_quantity)
    │    │
    │    └─▶ lowStockProducts = count(stock_quantity <= 5)
    │
    └─▶ Display in Dashboard Cards
         with real-time updates
```

## 🔐 Security Flow

```
User Login Request
    │
    ▼
Supabase Authentication
    │ ├─ Verify credentials
    │ └─ Return session token
    │
    ▼ (Session stored in browser)
Access Inventory Page
    │
    ▼
Check User ID
    │ └─ Get from auth session
    │
    ▼
Fetch Products with RLS
    │
    ├─ Query: 
    │   SELECT * FROM industrial_products
    │   WHERE seller_id = auth.uid()
    │
    └─ Database enforces RLS policy
       (only own products visible)

ALL MODIFICATIONS
    │
    ├─ INSERT: seller_id = auth.uid()
    ├─ UPDATE: seller_id must match auth.uid()
    ├─ DELETE: seller_id must match auth.uid()
    │
    └─ Database rejects unauthorized changes
```

## 💾 Database Schema Overview

```
industrial_products
├── Core Identity
│   ├── id (UUID, Primary Key)
│   ├── business_id (Foreign Key)
│   └── seller_id (Foreign Key, Auth User)
│
├── Product Information
│   ├── name (VARCHAR, Required)
│   ├── slug (TEXT, Unique)
│   ├── description (TEXT)
│   ├── category (VARCHAR, Required)
│   └── subcategory (VARCHAR)
│
├── Pricing
│   ├── price (DECIMAL, Required)
│   ├── currency (VARCHAR, Default: 'PHP')
│   ├── unit_of_measurement (VARCHAR)
│   ├── minimum_order_quantity (INTEGER)
│   ├── moq_discount (DECIMAL)
│   └── bulk_pricing (JSONB)
│
├── Inventory
│   ├── stock_quantity (INTEGER)
│   └── stock_status (VARCHAR)
│
├── Media
│   ├── image_urls (TEXT[])
│   ├── primary_image_url (TEXT)
│   └── video_url (TEXT)
│
├── Shipping
│   ├── shipping_available (BOOLEAN)
│   ├── delivery_time (VARCHAR)
│   ├── delivery_cost (DECIMAL)
│   ├── origin_country (VARCHAR)
│   └── origin_city (VARCHAR)
│
├── Status & Visibility
│   ├── status (VARCHAR, Check: active|inactive|discontinued)
│   └── visibility (VARCHAR, Check: public|private|wholesale_only)
│
├── Business Terms
│   ├── return_policy (TEXT)
│   ├── warranty_info (TEXT)
│   └── payment_terms (TEXT)
│
├── Ratings
│   ├���─ rating (DECIMAL)
│   └── review_count (INTEGER)
│
├── Metadata
│   ├── tags (TEXT[])
│   ├── certifications (JSONB)
│   ├── compliance_info (JSONB)
│   └── metadata (JSONB)
│
└── Timestamps
    ├── created_at (TIMESTAMPTZ)
    ├── updated_at (TIMESTAMPTZ)
    └── last_modified_by (UUID)
```

## 🔄 CRUD Operations Workflow

```
┌─────────────────────────────────────────────┐
│ CREATE (Add Product)                        │
├─────────────────────────────────────────────┤
│ 1. User clicks "Add Product"                │
│ 2. Form opens with empty fields             │
│ 3. User fills in details                    │
│ 4. Form validates input                     │
│ 5. createProduct() called                   │
│ 6. Data sent to Supabase INSERT             │
│ 7. Database creates record                  │
│ 8. New product added to list                │
│ 9. Success message shown                    │
│ 10. Form cleared                            │
└──────────────���──────────────────────────────┘

┌─────────────────────────────────────────────┐
│ READ (View Products)                        │
├─────────────────────────────────────────────┤
│ 1. Component mounts                         │
│ 2. fetchSellerProducts() called             │
│ 3. Query fetches all user's products        │
│ 4. Products displayed in table/list         │
│ 5. Search filters results                   │
│ 6. Filters applied to display               │
│ 7. Statistics calculated                    │
│ 8. Dashboard updated with stats             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ UPDATE (Edit Product)                       │
├─────────────────────────────────────────────┤
│ 1. User clicks "Edit" button                │
│ 2. Form opens with current data             │
│ 3. User modifies fields                     │
│ 4. Form validates changes                   │
│ 5. updateProduct() called                   │
│ 6. Data sent to Supabase UPDATE             │
│ 7. Database updates record                  │
│ 8. Product list refreshed                   │
│ 9. Success message shown                    │
│ 10. Form closed                             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ DELETE (Remove Product)                     │
├─────────────────────────────────────────────┤
│ 1. User clicks "Delete" button              │
│ 2. Confirmation dialog shown                │
│ 3. User confirms deletion                   │
│ 4. deleteProduct() called                   │
│ 5. Data sent to Supabase DELETE             │
│ 6. Database removes record                  │
│ 7. Product removed from list                │
│ 8. Success message shown                    │
│ 9. Statistics updated                       │
└─────────────────────────────────────────────┘
```

## 📈 Analytics Dashboard Flow

```
Products Array
    │
    ▼
Category Analysis
├─ Group by category
├─ Count products per category
├─ Sum stock per category
└─ Calculate value per category
    │
    ▼
Status Analysis
├─ Count active products
├─ Count inactive products
├─ Count discontinued
└─ Display breakdown
    │
    ▼
Visibility Analysis
├─ Count public products
├─ Count private products
├─ Count wholesale only
└─ Display distribution
    │
    ▼
Stock Analysis
├─ Sum total units
├─ Count low stock items (≤5)
├─ Count out of stock (0)
└─ Show stock levels
    │
    ▼
Financial Analysis
├─ Calculate total value
├─ Calculate average price
├─ Identify top value items
└─ Display financials
    │
    ▼
Render Analytics Cards
└─ Show all metrics to user
```

## 🎯 Feature Implementation Map

```
Inventory System Features
│
├─ Dashboard
│  ├─ ✅ Statistics (6 metrics)
│  ├─ ✅ Product search
│  ├─ ✅ Product filtering
│  └─ ✅ Quick actions
│
├─ Product Management
│  ├─ ✅ Add products
│  ├─ ✅ Edit products
│  ├─ ✅ Delete products
│  └─ ✅ Full form validation
│
├─ Inventory Control
│  ├─ ✅ Stock tracking
│  ├─ ✅ Low stock alerts
│  ├─ ✅ Stock status
│  └─ ✅ MOQ management
│
├─ Pricing
│  ├─ ✅ Price management
│  ├─ ✅ Delivery costs
│  ├─ ✅ Bulk pricing
│  └─ ✅ Price history ready
│
├─ Public Display
│  ├─ ✅ Visibility controls
│  ├─ ✅ Status management
│  ├─ ✅ Public marketplace
│  └─ ✅ Search integration
│
├─ Advanced Features
│  ├─ ✅ Analytics dashboard
│  ├─ ✅ Bulk operations
│  ├─ ✅ Data export (CSV/JSON)
│  └─ ✅ Category analysis
│
└─ Quality
   ├─ ✅ Mobile responsive
   ├─ ✅ Error handling
   ├─ ✅ Input validation
   ├─ ✅ Security (RLS)
   └─ ✅ Performance optimized
```

## 🚀 Quick Access Map

```
NAVBAR (Top Navigation)
│
└─ INVENTORY (visible when logged in)
   │
   ├─ Dashboard
   │  ├─ Statistics cards (top)
   │  ├─ Product list (middle)
   │  ���─ Advanced features (bottom)
   │
   ├─ Add/Edit Product
   │  └─ Collapsible form
   │
   ├─ Search & Filter
   │  ├─ Search input
   │  ├─ Status filter
   │  └─ Visibility filter
   │
   └─ Advanced Features (Tabs)
      ├─ Analytics (📊)
      ├─ Bulk Operations (⚙️)
      └─ Export (📥)
```

---

**This visual guide helps understand the complete inventory system architecture and data flow.**
