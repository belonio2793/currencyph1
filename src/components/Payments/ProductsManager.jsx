import { useState, useEffect } from 'react'
import { paymentsService } from '../../lib/paymentsService'

export default function ProductsManager({ merchant, onRefresh }) {
  const [products, setProducts] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState(null)
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

  const copyToClipboard = async (text, id) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        const textArea = document.createElement("textarea")
        textArea.value = text
        textArea.style.position = "fixed"
        textArea.style.left = "-999999px"
        textArea.style.top = "-999999px"
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
      }
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const loadProducts = async () => {
    try {
      setLoading(true)
      const data = await paymentsService.getProductsByMerchant(merchant.id)

      // Fetch all payment links once
      let allLinks = []
      try {
        allLinks = await paymentsService.getPaymentLinksByMerchant(merchant.id)
      } catch (err) {
        console.error('Error loading payment links:', err)
      }

      // Fetch prices and attach/generate payment links for each product
      const productsWithData = await Promise.all((data || []).map(async (p) => {
        const prices = await paymentsService.getPricesByProduct(p.id)
        let payment_link = allLinks.find(link => link.product_id === p.id) || null

        // Auto-generate if missing
        if (!payment_link) {
          console.log(`Auto-generating missing payment link for product: ${p.name}`)
          payment_link = await autogeneratePaymentLink({ ...p, prices }, merchant.id)
        }

        return { ...p, prices, payment_link }
      }))

      setProducts(productsWithData)
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

      const productWithPrices = { ...newProduct, prices: initialPrice ? [initialPrice] : [] }

      // Autogenerate payment link for the product
      const paymentLink = await autogeneratePaymentLink(productWithPrices, merchant.id)
      const productWithLink = { ...productWithPrices, payment_link: paymentLink }

      setProducts([productWithLink, ...products])
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

            {editingProduct && editingProduct.payment_link && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Link (Auto-generated - Not Editable)</label>
                <div className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 flex items-center justify-between">
                  <code className="text-sm text-slate-700 break-all">{getPaymentLinkUrl(editingProduct.payment_link.url_slug)}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(getPaymentLinkUrl(editingProduct.payment_link.url_slug), 'edit-link')}
                    className={`ml-2 px-2 py-1 text-xs rounded transition-colors flex-shrink-0 ${
                      copiedId === 'edit-link' ? 'bg-emerald-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                    title="Copy link"
                  >
                    {copiedId === 'edit-link' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

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
                {product.payment_link && (
                  <div className="mt-4 pt-4 border-t border-emerald-200 bg-emerald-50 -m-6 mt-4 p-6 rounded-b-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <p className="text-sm font-medium text-emerald-900">Payment Link Generated</p>
                    </div>
                    <div className="bg-white rounded border border-emerald-200 px-3 py-2 flex items-center justify-between mb-2">
                      <code className="text-xs text-emerald-700 break-all font-mono">{getPaymentLinkUrl(product.payment_link.url_slug)}</code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(getPaymentLinkUrl(product.payment_link.url_slug), product.id)}
                      className={`w-full px-3 py-2 text-sm rounded transition-colors font-medium ${
                        copiedId === product.id ? 'bg-emerald-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                      title="Copy link"
                    >
                      {copiedId === product.id ? 'Copied to Clipboard!' : 'Copy Payment Link'}
                    </button>
                  </div>
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
