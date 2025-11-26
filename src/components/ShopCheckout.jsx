import { useState, useEffect } from 'react'
import { useShoppingCart } from '../context/ShoppingCartContext'
import { getCustomerByEmail, getOrCreateCustomer, getCustomerAddresses, addCustomerAddress, getDefaultAddress, setDefaultAddress } from '../lib/shopCustomerService'
import { processCheckout, calculateCheckoutTotals, applyPromoCode } from '../lib/shopCheckoutService'
import { supabase } from '../lib/supabaseClient'
import './ShopCheckout.css'

export default function ShopCheckout({ onNavigate, onOrderCreated }) {
  const { cart, clearCartItems, customerId, setCustomerAndLoadCart } = useShoppingCart()
  
  // Customer Info
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [customer, setCustomer] = useState(null)
  
  // Addresses
  const [addresses, setAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [isNewAddress, setIsNewAddress] = useState(false)
  const [newAddress, setNewAddress] = useState({
    street_address: '',
    street_address_2: '',
    barangay: '',
    city: '',
    province: '',
    postal_code: '',
    phone: ''
  })

  // Shipping & Payment
  const [shippingMethod, setShippingMethod] = useState('standard')
  const [paymentMethod, setPaymentMethod] = useState('cash_on_delivery')
  const [promoCode, setPromoCode] = useState('')
  const [discount, setDiscount] = useState(0)

  // UI States
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1)
  const [acceptTerms, setAcceptTerms] = useState(false)

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user?.email) {
        setEmail(userData.user.email)
        const cust = await getCustomerByEmail(userData.user.email)
        if (cust) {
          setCustomer(cust)
          setFirstName(cust.first_name || '')
          setLastName(cust.last_name || '')
          setPhone(cust.phone || '')
          loadAddresses(cust.id)
          setCustomerAndLoadCart(cust.id)
        }
      }
    } catch (err) {
      console.error('Error loading user data:', err)
    }
  }

  const loadAddresses = async (custId) => {
    try {
      const addrs = await getCustomerAddresses(custId, 'shipping')
      setAddresses(addrs)
      if (addrs.length > 0) {
        const defaultAddr = addrs.find(a => a.is_default)
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id)
        } else {
          setSelectedAddressId(addrs[0].id)
        }
      }
    } catch (err) {
      console.error('Error loading addresses:', err)
    }
  }

  const handleContinueAsGuest = async () => {
    if (!email || !firstName || !lastName) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setLoading(true)
      setError('')

      const cust = await getOrCreateCustomer(null, email, { first: firstName, last: lastName })
      setCustomer(cust)
      setCustomerAndLoadCart(cust.id)
      
      if (addresses.length === 0) {
        setIsNewAddress(true)
      } else {
        setStep(2)
      }
    } catch (err) {
      setError('Error creating customer profile')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddAddress = async () => {
    if (!newAddress.street_address || !newAddress.city || !newAddress.province) {
      setError('Please fill in all required address fields')
      return
    }

    try {
      setLoading(true)
      setError('')

      const addr = await addCustomerAddress(customer.id, {
        ...newAddress,
        address_type: 'shipping'
      })

      setAddresses([...addresses, addr])
      setSelectedAddressId(addr.id)
      setIsNewAddress(false)
      setNewAddress({
        street_address: '',
        street_address_2: '',
        barangay: '',
        city: '',
        province: '',
        postal_code: '',
        phone: ''
      })
      setStep(2)
    } catch (err) {
      setError('Error adding address')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyPromo = async () => {
    try {
      setError('')
      const result = await applyPromoCode(promoCode, totals.subtotal)
      setDiscount(result.discountValue)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCompleteCheckout = async () => {
    if (!acceptTerms) {
      setError('Please accept the terms and conditions')
      return
    }

    if (!selectedAddressId) {
      setError('Please select a shipping address')
      return
    }

    try {
      setLoading(true)
      setError('')

      const checkoutData = {
        customer_id: customer.id,
        shipping_address_id: selectedAddressId,
        shipping_method: shippingMethod,
        payment_method: paymentMethod,
        items: cart.items.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          sku: item.product?.sku,
          name: item.product?.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          weight: item.product?.weight_kg
        })),
        shippingCost: shippingCost,
        taxRate: 0.12,
        discountAmount: discount,
        discount_code: promoCode || null
      }

      const order = await processCheckout(checkoutData)

      if (order) {
        await clearCartItems()
        if (onOrderCreated) {
          onOrderCreated(order.id)
        }
        if (onNavigate) {
          onNavigate('shop-order-confirmation')
        }
      }
    } catch (err) {
      setError(err.message || 'Error processing checkout')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const subtotal = cart.subtotal || 0
  const shippingCost = shippingMethod === 'express' ? 300 : 150
  const tax = (subtotal - discount) * 0.12
  const totals = calculateCheckoutTotals(
    cart.items || [],
    shippingCost,
    0.12,
    discount
  )

  if (!cart.items || cart.items.length === 0) {
    return (
      <div className="checkout-empty">
        <p>Your cart is empty</p>
        <button onClick={() => onNavigate?.('shop')} className="btn-back">
          Back to Shop
        </button>
      </div>
    )
  }

  return (
    <div className="checkout-container">
      <div className="checkout-header">
        <h1>Checkout</h1>
        <div className="progress-bar">
          <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>1. Customer</div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>2. Address</div>
          <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>3. Shipping</div>
          <div className={`progress-step ${step >= 4 ? 'active' : ''}`}>4. Payment</div>
        </div>
      </div>

      <div className="checkout-content">
        {/* Main Content */}
        <div className="checkout-main">
          {error && <div className="error-message">{error}</div>}

          {/* Step 1: Customer Info */}
          {step === 1 && (
            <div className="checkout-step">
              <h2>Customer Information</h2>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Juan"
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dela Cruz"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+63 9XX XXX XXXX"
                />
              </div>
              <button
                onClick={handleContinueAsGuest}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Processing...' : 'Continue to Address'}
              </button>
            </div>
          )}

          {/* Step 2: Address */}
          {step === 2 && (
            <div className="checkout-step">
              <h2>Shipping Address</h2>

              {addresses.length > 0 && !isNewAddress && (
                <div className="address-selection">
                  {addresses.map(addr => (
                    <label key={addr.id} className="address-option">
                      <input
                        type="radio"
                        value={addr.id}
                        checked={selectedAddressId === addr.id}
                        onChange={(e) => setSelectedAddressId(e.target.value)}
                      />
                      <div className="address-content">
                        <p className="address-name">{addr.street_address}</p>
                        <p className="address-details">
                          {addr.barangay}, {addr.city}, {addr.province} {addr.postal_code}
                        </p>
                        {addr.phone && <p className="address-phone">{addr.phone}</p>}
                      </div>
                    </label>
                  ))}
                  <button
                    onClick={() => setIsNewAddress(true)}
                    className="btn-add-address"
                  >
                    + Add New Address
                  </button>
                </div>
              )}

              {isNewAddress && (
                <div className="address-form">
                  <div className="form-group">
                    <label>Street Address *</label>
                    <input
                      type="text"
                      value={newAddress.street_address}
                      onChange={(e) => setNewAddress({ ...newAddress, street_address: e.target.value })}
                      placeholder="House No., Building Name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Street Address 2</label>
                    <input
                      type="text"
                      value={newAddress.street_address_2}
                      onChange={(e) => setNewAddress({ ...newAddress, street_address_2: e.target.value })}
                      placeholder="Apartment, Suite, etc."
                    />
                  </div>
                  <div className="form-group">
                    <label>Barangay *</label>
                    <input
                      type="text"
                      value={newAddress.barangay}
                      onChange={(e) => setNewAddress({ ...newAddress, barangay: e.target.value })}
                      placeholder="Barangay"
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>City *</label>
                      <input
                        type="text"
                        value={newAddress.city}
                        onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                        placeholder="City"
                      />
                    </div>
                    <div className="form-group">
                      <label>Province *</label>
                      <input
                        type="text"
                        value={newAddress.province}
                        onChange={(e) => setNewAddress({ ...newAddress, province: e.target.value })}
                        placeholder="Province"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Postal Code</label>
                      <input
                        type="text"
                        value={newAddress.postal_code}
                        onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                        placeholder="1000"
                      />
                    </div>
                    <div className="form-group">
                      <label>Phone Number</label>
                      <input
                        type="tel"
                        value={newAddress.phone}
                        onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                        placeholder="+63 9XX XXX XXXX"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddAddress}
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? 'Saving...' : 'Save Address and Continue'}
                  </button>
                </div>
              )}

              {addresses.length === 0 && !isNewAddress && (
                <button
                  onClick={() => setIsNewAddress(true)}
                  className="btn-primary"
                >
                  Add Shipping Address
                </button>
              )}

              {selectedAddressId && !isNewAddress && (
                <button
                  onClick={() => setStep(3)}
                  className="btn-primary"
                  style={{ marginTop: '20px' }}
                >
                  Continue to Shipping
                </button>
              )}
            </div>
          )}

          {/* Step 3: Shipping */}
          {step === 3 && (
            <div className="checkout-step">
              <h2>Shipping Method</h2>
              <div className="shipping-options">
                <label className="shipping-option">
                  <input
                    type="radio"
                    value="standard"
                    checked={shippingMethod === 'standard'}
                    onChange={(e) => setShippingMethod(e.target.value)}
                  />
                  <div className="shipping-content">
                    <p className="shipping-name">Standard Shipping</p>
                    <p className="shipping-time">3-5 business days</p>
                    <p className="shipping-price">₱150</p>
                  </div>
                </label>

                <label className="shipping-option">
                  <input
                    type="radio"
                    value="express"
                    checked={shippingMethod === 'express'}
                    onChange={(e) => setShippingMethod(e.target.value)}
                  />
                  <div className="shipping-content">
                    <p className="shipping-name">Express Shipping</p>
                    <p className="shipping-time">1-2 business days</p>
                    <p className="shipping-price">₱300</p>
                  </div>
                </label>
              </div>

              <button
                onClick={() => setStep(4)}
                className="btn-primary"
                style={{ marginTop: '20px' }}
              >
                Continue to Payment
              </button>
            </div>
          )}

          {/* Step 4: Payment */}
          {step === 4 && (
            <div className="checkout-step">
              <h2>Payment Method</h2>
              <div className="payment-options">
                <label className="payment-option">
                  <input
                    type="radio"
                    value="cash_on_delivery"
                    checked={paymentMethod === 'cash_on_delivery'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <div className="payment-content">
                    <p className="payment-name">Cash On Delivery (COD)</p>
                    <p className="payment-desc">Pay when you receive your order</p>
                  </div>
                </label>

                <label className="payment-option">
                  <input
                    type="radio"
                    value="bank_transfer"
                    checked={paymentMethod === 'bank_transfer'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  />
                  <div className="payment-content">
                    <p className="payment-name">Bank Transfer</p>
                    <p className="payment-desc">Transfer details will be provided after order</p>
                  </div>
                </label>
              </div>

              <div className="terms-section">
                <label>
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                  />
                  <span>I agree to the Terms and Conditions and Privacy Policy</span>
                </label>
              </div>

              <button
                onClick={handleCompleteCheckout}
                disabled={loading || !acceptTerms}
                className="btn-primary btn-large"
              >
                {loading ? 'Processing...' : `Complete Order (₱${totals.total.toLocaleString('en-PH', { maximumFractionDigits: 2 })})`}
              </button>
            </div>
          )}
        </div>

        {/* Order Summary Sidebar */}
        <div className="checkout-summary">
          <h3>Order Summary</h3>
          <div className="summary-items">
            {cart.items?.map(item => (
              <div key={item.id} className="summary-item">
                <span className="item-name">{item.product?.name}</span>
                <span className="item-price">
                  ₱{item.totalPrice?.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>

          <div className="summary-totals">
            <div className="summary-row">
              <span>Subtotal</span>
              <span>₱{subtotal.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
            </div>
            {discount > 0 && (
              <div className="summary-row discount">
                <span>Discount</span>
                <span>-₱{discount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
              </div>
            )}
            {step >= 3 && (
              <>
                <div className="summary-row">
                  <span>Shipping</span>
                  <span>₱{shippingCost.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="summary-row">
                  <span>Tax (12%)</span>
                  <span>₱{tax.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
                </div>
              </>
            )}
            {step >= 3 && (
              <div className="summary-row total">
                <span>Total</span>
                <span>₱{(subtotal + shippingCost + tax - discount).toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
              </div>
            )}
          </div>

          {step <= 3 && (
            <div className="promo-section">
              <input
                type="text"
                placeholder="Promo Code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                className="promo-input"
              />
              <button onClick={handleApplyPromo} className="btn-apply">
                Apply
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
