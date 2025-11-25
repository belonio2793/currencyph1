import React, { useState } from 'react'
import {
  calculateInventoryStats,
  filterProducts,
  sortProducts,
  downloadInventoryExport,
  bulkUpdateStock
} from '../lib/inventoryService'
import './AdvancedInventoryFeatures.css'

export default function AdvancedInventoryFeatures({ products, userId }) {
  const [activeTab, setActiveTab] = useState('analytics')
  const [selectedProducts, setSelectedProducts] = useState([])
  const [bulkStockUpdate, setBulkStockUpdate] = useState('')
  const [bulkApplyPercentage, setBulkApplyPercentage] = useState(false)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkSuccess, setBulkSuccess] = useState('')

  const stats = calculateInventoryStats(products)

  const handleSelectProduct = (productId) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    )
  }

  const handleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(products.map(p => p.id))
    }
  }

  const handleBulkStockUpdate = async () => {
    if (!selectedProducts.length || !bulkStockUpdate) return

    try {
      setBulkSubmitting(true)
      setBulkError('')
      setBulkSuccess('')

      const updates = selectedProducts.map(productId => {
        const product = products.find(p => p.id === productId)
        let newQuantity = parseInt(bulkStockUpdate) || 0

        if (bulkApplyPercentage) {
          newQuantity = Math.round((product.stock_quantity * (100 + newQuantity)) / 100)
        }

        return { productId, quantity: newQuantity }
      })

      const result = await bulkUpdateStock(updates, userId)

      if (result.success) {
        setBulkSuccess(`Successfully updated ${selectedProducts.length} products`)
        setSelectedProducts([])
        setBulkStockUpdate('')
      } else {
        setBulkError(`Failed: ${result.error}`)
      }
    } catch (err) {
      setBulkError(err.message)
    } finally {
      setBulkSubmitting(false)
    }
  }

  const handleExport = (format) => {
    const productsToExport = selectedProducts.length > 0
      ? products.filter(p => selectedProducts.includes(p.id))
      : products

    downloadInventoryExport(productsToExport, format, 'inventory')
  }

  return (
    <div className="advanced-inventory-features">
      {/* Tabs */}
      <div className="feature-tabs">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
        >
          📊 Analytics
        </button>
        <button
          onClick={() => setActiveTab('bulk-operations')}
          className={`tab-button ${activeTab === 'bulk-operations' ? 'active' : ''}`}
        >
          ⚙️ Bulk Operations
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`tab-button ${activeTab === 'export' ? 'active' : ''}`}
        >
          📥 Export
        </button>
      </div>

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="feature-content analytics-tab">
          <h3>Inventory Analytics</h3>

          <div className="analytics-grid">
            {/* Products Overview */}
            <div className="analytics-card">
              <h4>Products Overview</h4>
              <div className="stat-item">
                <span className="label">Total Products:</span>
                <span className="value">{stats.totalProducts}</span>
              </div>
              <div className="stat-item">
                <span className="label">Active:</span>
                <span className="value positive">{stats.activeProducts}</span>
              </div>
              <div className="stat-item">
                <span className="label">Inactive:</span>
                <span className="value warning">{stats.inactiveProducts}</span>
              </div>
              <div className="stat-item">
                <span className="label">Discontinued:</span>
                <span className="value danger">{stats.discontinuedProducts}</span>
              </div>
            </div>

            {/* Visibility Overview */}
            <div className="analytics-card">
              <h4>Visibility Overview</h4>
              <div className="stat-item">
                <span className="label">Public:</span>
                <span className="value">{stats.publicProducts}</span>
              </div>
              <div className="stat-item">
                <span className="label">Private:</span>
                <span className="value">{stats.privateProducts}</span>
              </div>
              <div className="stat-item">
                <span className="label">Wholesale Only:</span>
                <span className="value">{stats.wholesaleOnlyProducts}</span>
              </div>
            </div>

            {/* Stock Overview */}
            <div className="analytics-card">
              <h4>Stock Overview</h4>
              <div className="stat-item">
                <span className="label">Total Units:</span>
                <span className="value">{stats.totalStock}</span>
              </div>
              <div className="stat-item">
                <span className="label">Low Stock Items:</span>
                <span className="value warning">{stats.lowStockProducts}</span>
              </div>
              <div className="stat-item">
                <span className="label">Out of Stock:</span>
                <span className="value danger">{stats.outOfStockProducts}</span>
              </div>
            </div>

            {/* Financial Overview */}
            <div className="analytics-card">
              <h4>Financial Overview</h4>
              <div className="stat-item">
                <span className="label">Total Inventory Value:</span>
                <span className="value large">₱{stats.totalValue.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="stat-item">
                <span className="label">Average Price:</span>
                <span className="value">₱{stats.averagePrice.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="analytics-section">
            <h4>Category Breakdown</h4>
            <div className="category-list">
              {Array.from(new Set(products.map(p => p.category))).map(category => {
                const categoryProducts = products.filter(p => p.category === category)
                const categoryValue = categoryProducts.reduce((sum, p) => sum + (p.price * p.stock_quantity), 0)
                const categoryStock = categoryProducts.reduce((sum, p) => sum + p.stock_quantity, 0)
                return (
                  <div key={category} className="category-item">
                    <div className="category-name">{category}</div>
                    <div className="category-stats">
                      <span>{categoryProducts.length} products</span>
                      <span>{categoryStock} units</span>
                      <span>₱{categoryValue.toLocaleString('en-PH', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Low Stock Alert */}
          {stats.lowStockProducts > 0 && (
            <div className="alert alert-warning">
              ⚠️ You have {stats.lowStockProducts} product(s) with low stock (5 units or less)
            </div>
          )}

          {/* Out of Stock Alert */}
          {stats.outOfStockProducts > 0 && (
            <div className="alert alert-danger">
              🚨 You have {stats.outOfStockProducts} product(s) that are out of stock
            </div>
          )}
        </div>
      )}

      {/* Bulk Operations Tab */}
      {activeTab === 'bulk-operations' && (
        <div className="feature-content bulk-operations-tab">
          <h3>Bulk Operations</h3>

          {bulkError && (
            <div className="alert alert-error">
              {bulkError}
              <button onClick={() => setBulkError('')} className="alert-close">✕</button>
            </div>
          )}

          {bulkSuccess && (
            <div className="alert alert-success">
              {bulkSuccess}
              <button onClick={() => setBulkSuccess('')} className="alert-close">✕</button>
            </div>
          )}

          {/* Product Selection */}
          <div className="bulk-section">
            <div className="section-header">
              <h4>Select Products</h4>
              <button
                onClick={handleSelectAll}
                className="btn-text"
              >
                {selectedProducts.length === products.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="products-selection-grid">
              {products.map(product => (
                <label key={product.id} className="product-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(product.id)}
                    onChange={() => handleSelectProduct(product.id)}
                  />
                  <span className="product-info">
                    <span className="product-name">{product.name}</span>
                    <span className="product-price">₱{product.price.toLocaleString('en-PH')}</span>
                    <span className="product-stock">{product.stock_quantity} units</span>
                  </span>
                </label>
              ))}
            </div>

            {selectedProducts.length > 0 && (
              <p className="selection-info">
                {selectedProducts.length} product(s) selected
              </p>
            )}
          </div>

          {/* Bulk Stock Update */}
          {selectedProducts.length > 0 && (
            <div className="bulk-section">
              <h4>Update Stock</h4>
              <div className="bulk-form">
                <div className="form-group">
                  <label>New Stock Quantity</label>
                  <input
                    type="number"
                    value={bulkStockUpdate}
                    onChange={(e) => setBulkStockUpdate(e.target.value)}
                    placeholder="Enter quantity"
                    min="0"
                  />
                </div>

                <div className="form-group checkbox">
                  <input
                    type="checkbox"
                    checked={bulkApplyPercentage}
                    onChange={(e) => setBulkApplyPercentage(e.target.checked)}
                    id="apply-percentage"
                  />
                  <label htmlFor="apply-percentage">
                    Apply as percentage increase/decrease (e.g., 10 = +10%)
                  </label>
                </div>

                <button
                  onClick={handleBulkStockUpdate}
                  disabled={!bulkStockUpdate || bulkSubmitting}
                  className="btn-primary-bulk"
                >
                  {bulkSubmitting ? 'Updating...' : 'Update Stock for Selected Products'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="feature-content export-tab">
          <h3>Export Inventory Data</h3>

          <div className="export-section">
            <h4>Export Options</h4>
            <p className="export-info">
              {selectedProducts.length > 0
                ? `Export ${selectedProducts.length} selected product(s)`
                : 'Export all products'}
            </p>

            <div className="export-buttons">
              <button
                onClick={() => handleExport('csv')}
                className="btn-export btn-csv"
              >
                📊 Export as CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="btn-export btn-json"
              >
                📋 Export as JSON
              </button>
            </div>

            {selectedProducts.length > 0 && (
              <button
                onClick={() => setSelectedProducts([])}
                className="btn-secondary-small"
              >
                Clear Selection
              </button>
            )}
          </div>

          {/* Export Preview */}
          <div className="export-section">
            <h4>Preview</h4>
            <div className="export-preview">
              <table>
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Price (₱)</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Value (₱)</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedProducts.length > 0
                    ? products.filter(p => selectedProducts.includes(p.id))
                    : products
                  ).slice(0, 5).map(product => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.category}</td>
                      <td>{product.price.toLocaleString('en-PH')}</td>
                      <td>{product.stock_quantity}</td>
                      <td>{product.status}</td>
                      <td>{(product.price * product.stock_quantity).toLocaleString('en-PH')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(selectedProducts.length > 0 ? selectedProducts.length : products.length) > 5 && (
                <p className="preview-note">... and {(selectedProducts.length > 0 ? selectedProducts.length : products.length) - 5} more products</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
