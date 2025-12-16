import { useState, useEffect } from 'react'
import { paymentsService } from '../../lib/paymentsService'

export default function PricingManager({ merchant, globalCurrency }) {
  const [prices, setPrices] = useState([])
  const [products, setProducts] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingPrice, setEditingPrice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterProduct, setFilterProduct] = useState('all')
  const [formData, setFormData] = useState({
    product_id: '',
    amount: '',
    currency: globalCurrency,
    type: 'one_time'
  })

  useEffect(() => {
    if (merchant) {
      loadData()
    }
  }, [merchant])

  const loadData = async () => {
    try {
      setLoading(true)
      const [pricesData, productsData] = await Promise.all([
        paymentsService.getPricesByMerchant(merchant.id),
        paymentsService.getProductsByMerchant(merchant.id)
      ])
      setPrices(pricesData || [])
      setProducts(productsData || [])
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      const newPrice = await paymentsService.createPrice(merchant.id, {
        product_id: formData.product_id || null,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        type: formData.type
      })
      setPrices([newPrice, ...prices])
      setFormData({
        product_id: '',
        amount: '',
        currency: globalCurrency,
        type: 'one_time'
      })
      setShowCreateForm(false)
    } catch (err) {
      console.error('Error creating price:', err)
      alert('Failed to create price')
    }
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    try {
      const updated = await paymentsService.updatePrice(editingPrice.id, {
        product_id: formData.product_id || null,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        type: formData.type
      })
      setPrices(prices.map(p => p.id === updated.id ? updated : p))
      setEditingPrice(null)
      setFormData({
        product_id: '',
        amount: '',
        currency: globalCurrency,
        type: 'one_time'
      })
    } catch (err) {
      console.error('Error updating price:', err)
      alert('Failed to update price')
    }
  }

  const handleDelete = async (priceId) => {
    if (!confirm('Are you sure you want to delete this price?')) return

    try {
      await paymentsService.deletePrice(priceId)
      setPrices(prices.filter(p => p.id !== priceId))
    } catch (err) {
      console.error('Error deleting price:', err)
      alert('Failed to delete price')
    }
  }

  const handleEdit = (price) => {
    setEditingPrice(price)
    setFormData({
      product_id: price.product_id || '',
      amount: price.amount.toString(),
      currency: price.currency,
      type: price.type
    })
    setShowCreateForm(false)
  }

  const handleCancel = () => {
    setShowCreateForm(false)
    setEditingPrice(null)
    setFormData({
      product_id: '',
      amount: '',
      currency: globalCurrency,
      type: 'one_time'
    })
  }

  const getProductName = (productId) => {
    if (!productId) return 'Standalone Price'
    const product = products.find(p => p.id === productId)
    return product?.name || 'Unknown Product'
  }

  const filteredPrices = filterProduct === 'all'
    ? prices
    : prices.filter(p => (p.product_id || 'standalone') === filterProduct)

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-slate-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-light text-slate-900">Pricing</h3>
        {!showCreateForm && !editingPrice && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            + New Price
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingPrice) && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h4 className="text-lg font-semibold text-slate-900 mb-4">
            {editingPrice ? 'Edit Price' : 'Create New Price'}
          </h4>
          <form onSubmit={editingPrice ? handleUpdate : handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Product (Optional)</label>
              <select
                value={formData.product_id}
                onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Standalone Price (no product)</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="PHP"
                  maxLength="3"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="one_time">One-time Payment</option>
                <option value="recurring">Recurring</option>
                <option value="usage">Usage-based</option>
              </select>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                {editingPrice ? 'Update Price' : 'Create Price'}
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

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setFilterProduct('all')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
            filterProduct === 'all'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
        >
          All Prices
        </button>
        <button
          onClick={() => setFilterProduct('standalone')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
            filterProduct === 'standalone'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
        >
          Standalone
        </button>
        {products.map(product => (
          <button
            key={product.id}
            onClick={() => setFilterProduct(product.id)}
            className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              filterProduct === product.id
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {product.name}
          </button>
        ))}
      </div>

      {/* Prices List */}
      <div>
        {filteredPrices.length === 0 ? (
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-8 text-center">
            <p className="text-slate-600 mb-4">No prices found</p>
            {!showCreateForm && !editingPrice && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Create Your First Price
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Created</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrices.map(price => (
                  <tr key={price.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {getProductName(price.product_id)}
                    </td>
                    <td className="py-3 px-4 text-slate-900">
                      {price.currency} {price.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {price.type.charAt(0).toUpperCase() + price.type.slice(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(price.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(price)}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(price.id)}
                          className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
