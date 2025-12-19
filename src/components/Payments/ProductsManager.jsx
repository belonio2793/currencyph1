import { useState, useEffect } from 'react'
import { paymentsService } from '../../lib/paymentsService'

export default function ProductsManager({ merchant, onRefresh }) {
  const [products, setProducts] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_url: '',
    initial_price: '',
    currency: 'PHP'
  })

  useEffect(() => {
    if (merchant) {
      loadProducts()
    }
  }, [merchant])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const data = await paymentsService.getProductsByMerchant(merchant.id)

      // Fetch prices for each product
      const productsWithPrices = await Promise.all((data || []).map(async (p) => {
        const prices = await paymentsService.getPricesByProduct(p.id)
        return { ...p, prices }
      }))

      setProducts(productsWithPrices)
    } catch (err) {
      console.error('Error loading products:', err)
    } finally {
      setLoading(false)
    }
  }

  const autogeneratePaymentLink = async (product, merchantId) => {
    try {
      const defaultPrice = product.prices && product.prices.length > 0 ? product.prices[0] : null

      const paymentLinkData = {
        product_id: product.id,
        name: product.name,
        description: product.description || '',
        amount: defaultPrice ? defaultPrice.amount : null,
        currency: defaultPrice ? defaultPrice.currency : 'PHP',
        price_id: defaultPrice ? defaultPrice.id : null
      }

      const newLink = await paymentsService.createPaymentLink(merchantId, paymentLinkData)
      return newLink
    } catch (err) {
      console.error('Error autogenerating payment link:', err)
      return null
    }
  }

  const getPaymentLinkUrl = (linkSlug) => {
    const baseUrl = window.location.origin
    return `${baseUrl}/payment/${linkSlug}`
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      const newProduct = await paymentsService.createProduct(merchant.id, {
        name: formData.name,
        description: formData.description,
        image_url: formData.image_url
      })

      let initialPrice = null
      if (formData.initial_price) {
        initialPrice = await paymentsService.createPrice(merchant.id, {
          product_id: newProduct.id,
          amount: parseFloat(formData.initial_price),
          currency: formData.currency,
          type: 'one_time'
        })
      }

      setProducts([{ ...newProduct, prices: initialPrice ? [initialPrice] : [] }, ...products])
      setFormData({ name: '', description: '', image_url: '', initial_price: '', currency: 'PHP' })
      setShowCreateForm(false)
      onRefresh && onRefresh()
    } catch (err) {
      console.error('Error creating product:', err)
      alert('Failed to create product')
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
      const updated = await paymentsService.updateProduct(editingProduct.id, {
        name: formData.name,
        description: formData.description,
        image_url: formData.image_url
      })
      setProducts(products.map(p => p.id === updated.id ? { ...updated, prices: p.prices } : p))
      setEditingProduct(null)
      setFormData({ name: '', description: '', image_url: '', initial_price: '', currency: 'PHP' })
    } catch (err) {
      console.error('Error updating product:', err)
      alert('Failed to update product')
    }
  }

  const handleDelete = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      await paymentsService.deleteProduct(productId)
      setProducts(products.filter(p => p.id !== productId))
    } catch (err) {
      console.error('Error deleting product:', err)
      alert('Failed to delete product')
    }
  }

  const handleEdit = (product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description || '',
      image_url: product.image_url || ''
    })
    setShowCreateForm(false)
  }

  const handleCancel = () => {
    setShowCreateForm(false)
    setEditingProduct(null)
    setFormData({ name: '', description: '', image_url: '' })
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-slate-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-light text-slate-900">Products</h3>
        {!showCreateForm && !editingProduct && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            + New Product
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingProduct) && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h4 className="text-lg font-semibold text-slate-900 mb-4">
            {editingProduct ? 'Edit Product' : 'Create New Product'}
          </h4>
          <form onSubmit={editingProduct ? handleUpdate : handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Product or Service Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="e.g., Premium Subscription or Consulting Hour"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Describe what this product or service is"
                rows="2"
              />
            </div>

            {!editingProduct && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Initial Price (Optional)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.initial_price}
                    onChange={(e) => setFormData({ ...formData, initial_price: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="PHP">PHP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="https://example.com/image.jpg"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                {editingProduct ? 'Update Product' : 'Create Product'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 px-4 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Products List */}
      <div>
        {products.length === 0 ? (
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-8 text-center">
            <p className="text-slate-600 mb-4">No products yet</p>
            {!showCreateForm && !editingProduct && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Create Your First Product
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map(product => (
              <div key={product.id} className="bg-white rounded-lg border border-slate-200 p-6">
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-32 object-cover rounded-lg mb-4"
                  />
                )}
                <h4 className="text-lg font-semibold text-slate-900">{product.name}</h4>
                {product.prices && product.prices.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {product.prices.map(price => (
                      <p key={price.id} className="text-emerald-700 font-medium">
                        {price.currency} {price.amount.toFixed(2)}
                        <span className="text-xs text-slate-500 ml-2 font-normal">({price.type})</span>
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm mt-2 italic">No prices set</p>
                )}
                {product.description && (
                  <p className="text-slate-600 text-sm mt-2">{product.description}</p>
                )}
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => handleEdit(product)}
                    className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="flex-1 px-3 py-2 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
