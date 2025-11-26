import { useState, useEffect } from 'react'
import { getProducts, getCategories, createProduct, updateProduct, deleteProduct, importProductFromAlibaba } from '../lib/shopProductService'
import './ShopAdmin.css'

export default function ShopAdmin({ userId }) {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [alibabaUrl, setAlibabaUrl] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    category_id: '',
    brand: '',
    base_price: 0,
    cost_price: 0,
    total_stock: 0,
    is_active: true
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [productsData, categoriesData] = await Promise.all([
        getProducts({}, 1, 50),
        getCategories()
      ])
      setProducts(productsData.products || [])
      setCategories(categoriesData || [])
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProduct = async () => {
    try {
      if (editingId) {
        await updateProduct(editingId, formData)
      } else {
        await createProduct(formData)
      }
      resetForm()
      loadData()
    } catch (err) {
      console.error('Error saving product:', err)
      alert('Error saving product')
    }
  }

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('Are you sure?')) {
      try {
        await deleteProduct(productId)
        loadData()
      } catch (err) {
        console.error('Error deleting product:', err)
        alert('Error deleting product')
      }
    }
  }

  const handleImportFromAlibaba = async () => {
    if (!alibabaUrl || !formData.category_id) {
      alert('Please provide Alibaba URL and select a category')
      return
    }

    try {
      const mockData = {
        title: formData.name || 'Product from Alibaba',
        description: formData.description,
        price: formData.base_price,
        productId: Date.now().toString()
      }
      await importProductFromAlibaba(alibabaUrl, mockData, formData.category_id)
      resetForm()
      loadData()
      alert('Product imported successfully')
    } catch (err) {
      console.error('Error importing product:', err)
      alert('Error importing product')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      description: '',
      category_id: '',
      brand: '',
      base_price: 0,
      cost_price: 0,
      total_stock: 0,
      is_active: true
    })
    setAlibabaUrl('')
    setEditingId(null)
    setShowForm(false)
  }

  if (!userId) {
    return <div className="admin-panel"><p>Admin access required</p></div>
  }

  return (
    <div className="shop-admin-container">
      <div className="admin-header">
        <h1>Shop Admin Panel</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-add-product">
          {showForm ? 'Cancel' : '+ Add Product'}
        </button>
      </div>

      {showForm && (
        <div className="product-form">
          <h2>{editingId ? 'Edit Product' : 'Add New Product'}</h2>
          
          <div className="form-tabs">
            <button className="tab-btn active">Manual Entry</button>
            <button className="tab-btn">Import from Alibaba</button>
          </div>

          <div className="form-group">
            <label>Product Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Product name"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>SKU</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="SKU"
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Product description"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Base Price (PHP)</label>
              <input
                type="number"
                value={formData.base_price}
                onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) })}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>Cost Price (PHP)</label>
              <input
                type="number"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) })}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>Stock</label>
              <input
                type="number"
                value={formData.total_stock}
                onChange={(e) => setFormData({ ...formData, total_stock: parseInt(e.target.value) })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="form-actions">
            <button onClick={handleSaveProduct} className="btn-save">Save Product</button>
            <button onClick={resetForm} className="btn-cancel">Cancel</button>
          </div>

          <div className="alibaba-section">
            <h3>Or Import from Alibaba</h3>
            <input
              type="url"
              value={alibabaUrl}
              onChange={(e) => setAlibabaUrl(e.target.value)}
              placeholder="https://www.alibaba.com/product-detail/..."
              className="alibaba-input"
            />
            <button onClick={handleImportFromAlibaba} className="btn-import">Import from Alibaba</button>
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading products...</p>
      ) : (
        <div className="products-list">
          <table className="products-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.sku}</td>
                  <td>₱{product.base_price.toFixed(2)}</td>
                  <td>{product.total_stock}</td>
                  <td>{product.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="actions">
                    <button onClick={() => {
                      setFormData(product)
                      setEditingId(product.id)
                      setShowForm(true)
                    }} className="btn-edit">Edit</button>
                    <button onClick={() => handleDeleteProduct(product.id)} className="btn-delete">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
