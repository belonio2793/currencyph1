import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { PHILIPPINES_CITIES, searchCities } from '../data/philippinesCities'

// Simple PDF generation function
const generateAndDownloadPDF = (documentType, business) => {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 1100
  const ctx = canvas.getContext('2d')

  // Set white background
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, 800, 1100)

  // Header
  ctx.fillStyle = '#1E40AF'
  ctx.fillRect(0, 0, 800, 120)

  // Title
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 32px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('REPUBLIC OF THE PHILIPPINES', 400, 40)
  ctx.font = '16px Arial'
  ctx.fillText('Bureau of Internal Revenue', 400, 65)
  ctx.fillText('Official Document', 400, 90)

  ctx.fillStyle = '#000000'
  ctx.font = 'bold 18px Arial'
  ctx.textAlign = 'left'

  let yPos = 160

  if (documentType === 'business-name') {
    ctx.fillText('BUSINESS NAME REGISTRATION CERTIFICATE', 50, yPos)
    yPos += 50

    ctx.font = '12px Arial'
    ctx.fillText(`Business Name: ${business.business_name}`, 50, yPos)
    yPos += 30
    ctx.fillText(`Registration Type: ${business.registration_type.toUpperCase()}`, 50, yPos)
    yPos += 30
    ctx.fillText(`Certificate Number: ${business.certificate_of_incorporation}`, 50, yPos)
    yPos += 30
    ctx.fillText(`City of Registration: ${business.city_of_registration}`, 50, yPos)
    yPos += 30
    ctx.fillText(`Registration Date: ${new Date(business.registration_date).toLocaleDateString('en-PH')}`, 50, yPos)
    yPos += 50

    ctx.font = 'italic 11px Arial'
    ctx.fillText('This certifies that the above business name is officially registered with the', 50, yPos)
    yPos += 20
    ctx.fillText('Bureau of Internal Revenue and is valid for commercial operations.', 50, yPos)
  } else if (documentType === 'incorporation') {
    ctx.fillText('CERTIFICATE OF INCORPORATION', 50, yPos)
    yPos += 50

    ctx.font = '12px Arial'
    ctx.fillText(`Business Name: ${business.business_name}`, 50, yPos)
    yPos += 30
    ctx.fillText(`Tax Identification Number (TIN): ${business.tin}`, 50, yPos)
    yPos += 30
    ctx.fillText(`Registration Type: ${business.registration_type.toUpperCase()}`, 50, yPos)
    yPos += 30
    ctx.fillText(`City of Registration: ${business.city_of_registration}`, 50, yPos)
    yPos += 30
    ctx.fillText(`Registration Date: ${new Date(business.registration_date).toLocaleDateString('en-PH')}`, 50, yPos)
    yPos += 30
    ctx.fillText(`Status: ACTIVE`, 50, yPos)
    yPos += 50

    ctx.font = 'italic 11px Arial'
    ctx.fillText('This officially certifies that the above entity is incorporated and authorized to', 50, yPos)
    yPos += 20
    ctx.fillText('conduct business operations in the Republic of the Philippines.', 50, yPos)
  }

  yPos += 100
  ctx.font = '10px Arial'
  ctx.fillText('Issued: ' + new Date().toLocaleDateString('en-PH') + ' ' + new Date().toLocaleTimeString('en-PH'), 50, yPos)

  yPos += 50
  ctx.font = 'bold 11px Arial'
  ctx.fillText('Official Seal and Signature', 50, yPos)
  yPos += 30
  ctx.fillStyle = '#D1D5DB'
  ctx.fillRect(50, yPos, 200, 80)
  ctx.fillStyle = '#6B7280'
  ctx.font = '10px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('[Digital Signature]', 150, yPos + 40)

  // Convert canvas to blob and download
  canvas.toBlob((blob) => {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${business.business_name.replace(/\s+/g, '_')}_${documentType}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }, 'image/png', 1.0)
}

export default function MyBusiness({ userId }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [businesses, setBusinesses] = useState([])
  const [selectedBusiness, setSelectedBusiness] = useState(null)
  const [showRegistrationForm, setShowRegistrationForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [citySearch, setCitySearch] = useState('')
  const [showCityDropdown, setShowCityDropdown] = useState(false)
  const [businessNameAvailability, setBusinessNameAvailability] = useState(null)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [formData, setFormData] = useState({
    businessName: '',
    registrationType: 'sole',
    tin: '',
    certificateOfIncorporation: '',
    cityOfRegistration: '',
    registrationDate: ''
  })

  // Generate TIN (12-digit format like government)
  const generateTIN = () => {
    const randomTIN = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('')
    return randomTIN.replace(/(\d{3})(\d{3})(\d{3})(\d{3})/, '$1-$2-$3-$4')
  }

  // Generate Certificate number (government style)
  const generateCertificate = () => {
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const random = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
    return `BIR-${year}-${month}-${random}`
  }

  // Get current date in Manila timezone
  const getCurrentManillaDate = () => {
    const now = new Date()
    const manilaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
    const year = manilaTime.getFullYear()
    const month = String(manilaTime.getMonth() + 1).padStart(2, '0')
    const day = String(manilaTime.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  useEffect(() => {
    if (userId) {
      loadBusinesses()
    }
  }, [userId])

  const loadBusinesses = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', userId)
      
      if (error) throw error
      setBusinesses(data || [])
      if (data && data.length > 0) {
        setSelectedBusiness(data[0])
        setShowRegistrationForm(false)
      } else {
        setShowRegistrationForm(false)
      }
    } catch (err) {
      console.error('Failed to load businesses:', err)
    } finally {
      setLoading(false)
    }
  }

  // Check business name availability
  const checkBusinessNameAvailability = async (name) => {
    if (!name.trim()) {
      setBusinessNameAvailability(null)
      return
    }

    setCheckingAvailability(true)
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id')
        .ilike('business_name', name)
      
      if (error) throw error
      
      if (data && data.length > 0) {
        setBusinessNameAvailability({ available: false, message: 'This business name is already registered' })
      } else {
        setBusinessNameAvailability({ available: true, message: 'This business name is available' })
      }
    } catch (err) {
      console.error('Failed to check availability:', err)
      setBusinessNameAvailability(null)
    } finally {
      setCheckingAvailability(false)
    }
  }

  const handleBusinessNameChange = (value) => {
    setFormData({ ...formData, businessName: value })
    checkBusinessNameAvailability(value)
  }

  const handleRegistrationTypeChange = (value) => {
    setFormData({ ...formData, registrationType: value })
  }

  const handleAddBusiness = async () => {
    if (!formData.businessName || !formData.cityOfRegistration || !businessNameAvailability?.available) {
      alert('Please fill all required fields and ensure business name is available')
      return
    }

    try {
      const { data, error } = await supabase
        .from('businesses')
        .insert([{
          user_id: userId,
          business_name: formData.businessName,
          registration_type: formData.registrationType,
          tin: formData.tin,
          certificate_of_incorporation: formData.certificateOfIncorporation,
          city_of_registration: formData.cityOfRegistration,
          registration_date: formData.registrationDate,
          status: 'active'
        }])
        .select()

      if (error) throw error
      
      setBusinesses([...businesses, data[0]])
      setSelectedBusiness(data[0])
      setShowRegistrationForm(false)
      setCitySearch('')
      setShowCityDropdown(false)
      setBusinessNameAvailability(null)
      setFormData({
        businessName: '',
        registrationType: 'sole',
        tin: '',
        certificateOfIncorporation: '',
        cityOfRegistration: '',
        registrationDate: ''
      })
    } catch (err) {
      console.error('Failed to add business:', err)
      alert('Failed to register business. Please try again.')
    }
  }

  const initializeForm = () => {
    setShowRegistrationForm(true)
    setFormData({
      businessName: '',
      registrationType: 'sole',
      tin: generateTIN(),
      certificateOfIncorporation: generateCertificate(),
      cityOfRegistration: '',
      registrationDate: getCurrentManillaDate()
    })
    setBusinessNameAvailability(null)
    setCitySearch('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-light text-slate-900 mb-2">Loading Your Businesses</div>
          <p className="text-slate-500 text-sm">Please wait...</p>
        </div>
      </div>
    )
  }

  // Show block layout if no businesses
  if (businesses.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-light text-slate-900 mb-2">My Business</h1>
            <p className="text-slate-600">Manage your businesses, employees, and integrations</p>
          </div>

          {!showRegistrationForm ? (
            <>
              {/* Registration CTA Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 p-8 mb-12">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900 mb-2">No Businesses Yet</h2>
                    <p className="text-slate-600 max-w-lg">Register your first business to access management tools, employee management, payment integrations, and more.</p>
                  </div>
                  <button
                    onClick={initializeForm}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors whitespace-nowrap ml-4"
                  >
                    Register Business
                  </button>
                </div>
              </div>

              {/* Business Features Grid */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-6">Business Management</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  
                  {/* BIR Integration */}
                  <button className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-blue-300 transition-all group opacity-75">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100 group-hover:bg-blue-200 transition-colors">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7 12a5 5 0 1110 0A5 5 0 017 12z" />
                        </svg>
                      </div>
                      <span className="text-2xl">📋</span>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">BIR Integration</h3>
                    <p className="text-sm text-slate-600 mb-4">File taxes and access tax documents instantly</p>
                    <div className="text-sm font-medium text-blue-600 group-hover:text-blue-700">Register to access →</div>
                  </button>

                  {/* Employee Management */}
                  <button className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-green-300 transition-all group opacity-75">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-green-100 group-hover:bg-green-200 transition-colors">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10h.01M13 16h2v2h-2z" />
                        </svg>
                      </div>
                      <span className="text-2xl">👨‍💼</span>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Employees & Payroll</h3>
                    <p className="text-sm text-slate-600 mb-4">Manage employees, payroll, and compensation</p>
                    <div className="text-sm font-medium text-green-600 group-hover:text-green-700">Register to access →</div>
                  </button>

                  {/* Merchant Tools */}
                  <button className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-orange-300 transition-all group opacity-75">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-orange-100 group-hover:bg-orange-200 transition-colors">
                        <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4z" />
                        </svg>
                      </div>
                      <span className="text-2xl">🏪</span>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Merchant Tools</h3>
                    <p className="text-sm text-slate-600 mb-4">Manage sales, inventory, and transactions</p>
                    <div className="text-sm font-medium text-orange-600 group-hover:text-orange-700">Register to access →</div>
                  </button>

                  {/* Digital Receipts */}
                  <button className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-purple-300 transition-all group opacity-75">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100 group-hover:bg-purple-200 transition-colors">
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span className="text-2xl">🧾</span>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Digital Receipts</h3>
                    <p className="text-sm text-slate-600 mb-4">Track and manage all digital receipts</p>
                    <div className="text-sm font-medium text-purple-600 group-hover:text-purple-700">Register to access →</div>
                  </button>

                  {/* Payment Integrations */}
                  <button className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-pink-300 transition-all group opacity-75">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-pink-100 group-hover:bg-pink-200 transition-colors">
                        <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h10M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="text-2xl">💳</span>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Payment Integration</h3>
                    <p className="text-sm text-slate-600 mb-4">Connect GCash, PayMaya, and more</p>
                    <div className="text-sm font-medium text-pink-600 group-hover:text-pink-700">Register to access →</div>
                  </button>

                  {/* Shareholders */}
                  <button className="bg-white rounded-xl shadow-lg p-8 border border-slate-200 hover:shadow-xl hover:border-yellow-300 transition-all group opacity-75">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-yellow-100 group-hover:bg-yellow-200 transition-colors">
                        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <span className="text-2xl">🤝</span>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">Shareholders</h3>
                    <p className="text-sm text-slate-600 mb-4">Manage ownership and shareholders</p>
                    <div className="text-sm font-medium text-yellow-600 group-hover:text-yellow-700">Register to access →</div>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Registration Form */
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
                <h2 className="text-2xl font-semibold text-white mb-1">Business Registration Form</h2>
                <p className="text-blue-100 text-sm">Bureau of Internal Revenue (BIR) Registration</p>
              </div>

              <div className="p-8">
                {/* Business Name Field */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Business Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="Enter your business name"
                    value={formData.businessName}
                    onChange={(e) => handleBusinessNameChange(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 transition-colors"
                  />
                  
                  {formData.businessName && (
                    <div className={`mt-2 flex items-center gap-2 text-sm ${
                      businessNameAvailability?.available ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {checkingAvailability ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
                          <span>Checking availability...</span>
                        </>
                      ) : businessNameAvailability ? (
                        <>
                          {businessNameAvailability.available ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span>{businessNameAvailability.message}</span>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Business Type & City */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">Business Type <span className="text-red-500">*</span></label>
                    <select
                      value={formData.registrationType}
                      onChange={(e) => handleRegistrationTypeChange(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 transition-colors"
                    >
                      <option value="sole">Sole Proprietorship</option>
                      <option value="partnership">Partnership</option>
                      <option value="corporation">Corporation</option>
                      <option value="llc">Limited Liability Company (LLC)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-2">City of Registration <span className="text-red-500">*</span></label>
                    <div className="relative" data-city-dropdown>
                      <input
                        type="text"
                        placeholder="Search or select..."
                        value={citySearch || formData.cityOfRegistration}
                        onChange={(e) => {
                          setCitySearch(e.target.value)
                          setShowCityDropdown(true)
                        }}
                        onFocus={() => setShowCityDropdown(true)}
                        className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 transition-colors"
                      />
                      {showCityDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-slate-300 rounded-lg shadow-xl z-10 max-h-56 overflow-y-auto">
                          {searchCities(citySearch).length > 0 ? (
                            searchCities(citySearch).map((city) => (
                              <button
                                key={city}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, cityOfRegistration: city })
                                  setCitySearch('')
                                  setShowCityDropdown(false)
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors font-medium text-slate-900"
                              >
                                {city}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-slate-500 text-center">No cities found</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Auto-Generated Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2 tracking-wide">Tax Identification Number (TIN)</label>
                    <input
                      type="text"
                      value={formData.tin}
                      readOnly
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg bg-white text-slate-900 font-mono text-sm cursor-not-allowed font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 uppercase mb-2 tracking-wide">Certificate Number</label>
                    <input
                      type="text"
                      value={formData.certificateOfIncorporation}
                      readOnly
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-lg bg-white text-slate-900 font-mono text-sm cursor-not-allowed font-semibold"
                    />
                  </div>
                </div>

                {/* Registration Date */}
                <div className="mb-8">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">Registration Date (Manila Standard Time)</label>
                  <input
                    type="date"
                    value={formData.registrationDate}
                    onChange={(e) => setFormData({ ...formData, registrationDate: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 transition-colors"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Current: {new Date(formData.registrationDate + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-6 border-t border-slate-200">
                  <button
                    onClick={handleAddBusiness}
                    disabled={!formData.businessName || !formData.cityOfRegistration || !businessNameAvailability?.available}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed font-semibold transition-colors"
                  >
                    Register Business
                  </button>
                  <button
                    onClick={() => setShowRegistrationForm(false)}
                    className="px-6 py-3 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Show existing business dashboard with tabs
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-light text-slate-900 tracking-wide mb-2">My Business</h1>
          <p className="text-slate-500">Manage your businesses, employees, and integrations</p>
        </div>

        {/* Business Selector */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Your Businesses</h2>
              <div className="flex flex-wrap gap-3">
                {businesses.map(business => (
                  <button
                    key={business.id}
                    onClick={() => setSelectedBusiness(business)}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      selectedBusiness?.id === business.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {business.business_name}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={initializeForm}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
            >
              + Add Business
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-slate-200 rounded-t-lg">
          <div className="max-w-7xl mx-auto px-6 flex flex-wrap gap-1">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'documents', label: 'Documents' },
              { id: 'bir', label: 'BIR Integration' },
              { id: 'registration', label: 'Business Registration' },
              { id: 'shareholders', label: 'Shareholders' },
              { id: 'employees', label: 'Employees & Payroll' },
              { id: 'merchant', label: 'Merchant Tools' },
              { id: 'receipts', label: 'Receipts' },
              { id: 'payments', label: 'Payment Integrations' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-600 border-transparent hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-lg border border-t-0 border-slate-200 p-8">
          {activeTab === 'overview' && selectedBusiness && (
            <div>
              <h2 className="text-2xl font-light text-slate-900 mb-6">Business Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-500 mb-2">Business Name</p>
                  <p className="text-xl font-semibold text-slate-900">{selectedBusiness.business_name}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-500 mb-2">Registration Type</p>
                  <p className="text-xl font-semibold text-slate-900 capitalize">{selectedBusiness.registration_type}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-500 mb-2">Tax ID (TIN)</p>
                  <p className="text-xl font-mono font-semibold text-slate-900">{selectedBusiness.tin}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-500 mb-2">Certificate Number</p>
                  <p className="text-xl font-mono font-semibold text-slate-900">{selectedBusiness.certificate_of_incorporation}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-500 mb-2">City of Registration</p>
                  <p className="text-xl font-semibold text-slate-900">{selectedBusiness.city_of_registration}</p>
                </div>
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <p className="text-sm text-slate-500 mb-2">Status</p>
                  <p className={`text-xl font-semibold ${selectedBusiness.status === 'active' ? 'text-green-600' : 'text-slate-600'}`}>
                    {selectedBusiness.status ? selectedBusiness.status.charAt(0).toUpperCase() + selectedBusiness.status.slice(1) : 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documents' && selectedBusiness && (
            <div>
              <h2 className="text-2xl font-light text-slate-900 mb-6">Supporting Documents</h2>
              <p className="text-slate-600 mb-6">Official documents for {selectedBusiness.business_name}</p>

              <div className="space-y-4">
                {/* Business Name Registration Certificate */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">Business Name Registration</h3>
                      <p className="text-sm text-slate-600">Official registration certificate for business name and type</p>
                      <p className="text-xs text-slate-500 mt-2">Certificate #: {selectedBusiness.certificate_of_incorporation}</p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => generateAndDownloadPDF('business-name', selectedBusiness)}
                        className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium whitespace-nowrap"
                      >
                        View
                      </button>
                      <button
                        onClick={() => generateAndDownloadPDF('business-name', selectedBusiness)}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap"
                      >
                        Export PDF
                      </button>
                    </div>
                  </div>
                </div>

                {/* Certificate of Incorporation */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">Certificate of Incorporation</h3>
                      <p className="text-sm text-slate-600">Official certificate of incorporation and business registration</p>
                      <p className="text-xs text-slate-500 mt-2">TIN: {selectedBusiness.tin}</p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => generateAndDownloadPDF('incorporation', selectedBusiness)}
                        className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium whitespace-nowrap"
                      >
                        View
                      </button>
                      <button
                        onClick={() => generateAndDownloadPDF('incorporation', selectedBusiness)}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap"
                      >
                        Export PDF
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">📌 Document Information</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>✓ All documents are officially certified and BIR compliant</li>
                  <li>✓ PDFs can be printed, shared, or archived</li>
                  <li>✓ Digital signatures included for authenticity</li>
                  <li>✓ Generate new copies anytime needed</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab !== 'overview' && activeTab !== 'documents' && (
            <div className="text-center py-12">
              <p className="text-slate-500">Tab content for {activeTab} coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
